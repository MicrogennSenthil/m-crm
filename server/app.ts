import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import compression from "compression";

import { registerRoutes } from "./routes";
import { startAutoAssignmentScheduler } from "./autoAssignmentScheduler";
import { startModuleContractReminderScheduler } from "./moduleContractReminderScheduler";
import { storage } from "./storage";
import { setCached } from "./cache";
import { pool } from "./db";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(compression());

// Cache static assets aggressively — JS/CSS files have hashed names so safe to cache for 1 year
app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (req.path.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  next();
});

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Replit uses port 5000 (firewalled), VPS typically uses port 3000
  // this serves both the API and the client.
  const isReplit = process.env.REPL_ID !== undefined;
  const defaultPort = isReplit ? '5000' : '3000';
  const port = parseInt(process.env.PORT || defaultPort, 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Sync system modules from manifest on startup (automatic module registration)
    try {
      const syncResult = await storage.syncSystemModulesFromManifest();
      if (syncResult.created > 0 || syncResult.updated > 0) {
        log(`[ModuleSync] Created ${syncResult.created} new modules, updated ${syncResult.updated} existing modules`, "scheduler");
      } else {
        log(`[ModuleSync] All system modules are up to date`, "scheduler");
      }
    } catch (error) {
      log(`[ModuleSync] Error syncing system modules: ${error}`, "scheduler");
    }
    
    // Start the auto-assignment scheduler for support tickets
    startAutoAssignmentScheduler();
    
    // Start the module contract reminder scheduler (checks daily)
    startModuleContractReminderScheduler();

    // Pre-warm global (non-user-specific) caches so first login is fast
    setTimeout(async () => {
      try {
        const [customers, modules, users, dashStats, activities] = await Promise.all([
          storage.getCustomers().catch(() => null),
          storage.getModules().catch(() => null),
          storage.getUsers().catch(() => null),
          storage.getDashboardStats().catch(() => null),
          storage.getRecentActivities(20).catch(() => null),
        ]);
        if (customers) setCached("customers:all", customers, 600);
        if (modules) setCached("modules:all", modules, 600);
        if (users) setCached("users:all:active", users.filter((u: any) => u.isActive !== false), 600);
        if (dashStats) setCached("dashboard:stats", dashStats, 600);
        if (activities) setCached("dashboard:activities", activities, 600);
        log("[Warmup] Global caches pre-warmed", "scheduler");
      } catch (e) {
        log(`[Warmup] Pre-warm skipped: ${e}`, "scheduler");
      }
    }, 3000); // 3s delay — let DB connections fully settle first

    // Pre-warm shared list caches (used by admin/full-access users across all menus)
    // Cache keys must exactly match routes.ts patterns
    setTimeout(async () => {
      try {
        const [ticketResult, leadResult, projectsList] = await Promise.all([
          storage.getTicketsPaginated({ page: 1, pageSize: 50 }).catch(() => null),
          storage.getLeadsPaginated({ page: 1, pageSize: 50 }).catch(() => null),
          storage.getProjects({}).catch(() => null),
        ]);
        // tickets:v2:${prefix}:${assignedTo}:${fromDate}:${toDate}:${search}:${category}:${statusTab}:${status}:${priority}:${customerId}:${page}:${pageSize}
        if (ticketResult) setCached("tickets:v2:shared:::::::::1:50", ticketResult, 900);
        // leads:list:${prefix}:${stage}:${salesExecutiveId}:${search}:${city}:${area}:${leadSource}:${fromDate}:${toDate}:${page}:${pageSize}
        if (leadResult) setCached("leads:list:shared::::::::::1:50", leadResult, 600);
        // projects:list:${prefix}:${status}:${fromDate}:${toDate}
        if (projectsList) setCached("projects:list:shared:::", projectsList, 900);

        log("[Warmup] Shared list caches pre-warmed", "scheduler");
      } catch (e) {
        log(`[Warmup] Shared list pre-warm skipped: ${e}`, "scheduler");
      }
    }, 6000); // 6s delay — after global caches settle

    // Purge expired sessions daily to prevent table bloat (root cause of slow logins on VPS)
    const purgeExpiredSessions = async () => {
      try {
        const result = await pool.query(
          "DELETE FROM sessions WHERE expire < NOW()"
        );
        const deleted = result.rowCount ?? 0;
        if (deleted > 0) {
          log(`[SessionCleanup] Purged ${deleted} expired sessions`, "scheduler");
        }
      } catch (e) {
        log(`[SessionCleanup] Error purging sessions: ${e}`, "scheduler");
      }
    };

    // Run once at startup (after a short delay) then every 24h
    setTimeout(purgeExpiredSessions, 10000);
    setInterval(purgeExpiredSessions, 24 * 60 * 60 * 1000);
  });
}
