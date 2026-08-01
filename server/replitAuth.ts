import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { SignJWT, jwtVerify } from "jose";
import { storage } from "./storage";
import { sendWelcomeEmail } from "./email";
import { pool } from "./db";
import { getCachedAsync, setCachedAsync, invalidateCacheAsync } from "./cache";

// JWT helpers for VPS cookie-bypass auth
const JWT_ALG = "HS256";
const JWT_TTL = "7d";

function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "mcrm-fallback-secret-change-me";
  return new TextEncoder().encode(secret);
}

export interface JwtUserPayload {
  sub: string;         // userId
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isLocalAuth: true;
}

// Sign a JWT that carries user data — isAuthenticated reads this directly
// without hitting the DB on every request (eliminating N+1 DB queries on dashboard load)
export async function signAuthToken(userId: string, userData?: { email: string; firstName: string; lastName: string; role: string }): Promise<string> {
  const payload: Record<string, unknown> = { sub: userId, isLocalAuth: true };
  if (userData) {
    payload.email = userData.email;
    payload.firstName = userData.firstName;
    payload.lastName = userData.lastName;
    payload.role = userData.role;
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(getJwtSecret());
}

// Logout blacklist stored in Redis (persistent across PM2 restarts) with in-memory fallback.
// Key: logout:blacklist:<userId>  Value: logout timestamp (ms as string)  TTL: 7 days
const BLACKLIST_TTL = 7 * 24 * 60 * 60; // seconds
const blacklistKey = (userId: string) => `logout:blacklist:${userId}`;

export async function blacklistUserJwt(userId: string): Promise<void> {
  await setCachedAsync(blacklistKey(userId), Date.now(), BLACKLIST_TTL);
}

export async function clearUserBlacklist(userId: string): Promise<void> {
  await invalidateCacheAsync(blacklistKey(userId));
}

export async function isUserBlacklisted(userId: string): Promise<boolean> {
  const ts = await getCachedAsync<number>(blacklistKey(userId));
  return ts !== null;
}

async function getBlacklistTimestamp(userId: string): Promise<number | null> {
  return getCachedAsync<number>(blacklistKey(userId));
}

export async function verifyAuthToken(token: string): Promise<JwtUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.isLocalAuth && typeof payload.sub === "string") {
      // Reject tokens issued before the user's logout timestamp (Redis-backed, survives restarts)
      const logoutAt = await getBlacklistTimestamp(payload.sub);
      if (logoutAt !== null) {
        const issuedAt = (payload.iat ?? 0) * 1000; // iat is in seconds
        if (issuedAt < logoutAt) return null;
      }
      return payload as unknown as JwtUserPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// Cookie name used for the server-set JWT (bypasses both session store and nginx header issues)
export const AUTH_COOKIE_NAME = "mcrm_token";

// Parse the Cookie header manually (no cookie-parser dependency needed)
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (k) result[k.trim()] = decodeURIComponent(v.join("=").trim());
  });
  return result;
}

// Check if running on Replit or if OIDC should be enabled
const isReplit = process.env.REPL_ID !== undefined;
const useReplitAuth = process.env.USE_REPLIT_AUTH === "true" || (isReplit && process.env.USE_REPLIT_AUTH !== "false");

const getOidcConfig = memoize(
  async () => {
    if (!useReplitAuth) {
      throw new Error("Replit Auth is not enabled");
    }
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Determine if we should use secure cookies.
  // On Replit: secure in production (Replit sets X-Forwarded-Proto correctly).
  // On VPS behind Nginx: do NOT use secure cookies by default because Express
  // sees plain HTTP from nginx and express-session won't send the Secure cookie
  // unless trust proxy is configured AND nginx sends X-Forwarded-Proto.
  // Since nginx handles HTTPS termination, the cookie is safe over the wire even
  // without the Secure flag — HttpOnly still protects against XSS.
  // Override with SECURE_COOKIES=true/false env var if needed.
  const isProduction = process.env.NODE_ENV === "production";
  const forceSecureCookies = process.env.SECURE_COOKIES === "true";
  const disableSecureCookies = process.env.SECURE_COOKIES === "false";
  
  // On VPS (no REPL_ID), default to non-secure cookies unless explicitly forced
  const onVPS = !isReplit;
  const secureCookies = disableSecureCookies ? false
    : forceSecureCookies ? true
    : (isProduction && !onVPS);
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookies,
      maxAge: sessionTtl,
      sameSite: secureCookies ? "strict" : "lax",
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const result = await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  
  // Send welcome email for new users
  if (result.isNew && claims["email"]) {
    try {
      const fullName = `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || "User";
      const role = result.user.role || "user";
      await sendWelcomeEmail(claims["email"], fullName, role);
    } catch (error) {
      // Log error but don't block authentication
      console.error("Failed to send welcome email:", error);
    }
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Only setup OIDC routes if Replit Auth is enabled
  if (!useReplitAuth) {
    console.log("[Auth] Replit Auth disabled - using local authentication only");
    
    // Simple logout for local auth
    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        // Clear local auth session
        if (req.session) {
          (req.session as any).isLocalAuth = false;
          (req.session as any).userId = null;
        }
        res.redirect("/");
      });
    });
    
    // Redirect to local login page instead of OIDC
    app.get("/api/login", (_req, res) => {
      res.redirect("/auth/login");
    });
    
    return;
  }

  console.log("[Auth] Setting up Replit OIDC authentication");
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Build req.user from a verified JWT payload — ZERO DB queries if payload has user data.
  // Falls back to a DB lookup only for old tokens (issued before user-data was embedded).
  const authenticateFromJwt = async (jwtPayload: JwtUserPayload): Promise<boolean> => {
    const userId = jwtPayload.sub;
    if (jwtPayload.email && jwtPayload.role) {
      // Fast path: all user data is in the JWT — no DB needed
      req.user = {
        claims: {
          sub: userId,
          email: jwtPayload.email,
          first_name: jwtPayload.firstName || "",
          last_name: jwtPayload.lastName || "",
          metadata: { role: jwtPayload.role }
        }
      };
      return true;
    }
    // Slow path: old token without user data → DB lookup (one-time cost until they re-login)
    const user = await storage.getUser(userId);
    if (!user) return false;
    if (!user.isActive) {
      res.status(403).json({ message: "Your account has been deactivated. Please contact administrator." });
      return true;
    }
    req.user = {
      claims: {
        sub: userId,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        metadata: { role: user.role }
      }
    };
    return true;
  };

  const cookies = parseCookies(req.headers.cookie as string | undefined);

  // ── 1. Server-set JWT cookie (most reliable — set by server at login, no client JS needed) ──
  const cookieToken = cookies[AUTH_COOKIE_NAME];
  if (cookieToken) {
    const jwtPayload = await verifyAuthToken(cookieToken);
    if (jwtPayload) {
      const handled = await authenticateFromJwt(jwtPayload);
      if (handled) {
        if (res.headersSent) return;
        return next();
      }
    }
  }

  // ── 2. JWT Bearer token (Authorization: Bearer header) ──
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const jwtPayload = await verifyAuthToken(token);
    if (jwtPayload) {
      const handled = await authenticateFromJwt(jwtPayload);
      if (handled) {
        if (res.headersSent) return;
        return next();
      }
    }
  }

  // ── 3. Session cookie (local email/password auth) ──
  if ((req.session as any)?.isLocalAuth && (req.session as any)?.userId) {
    // For local auth, set up req.user with claims for consistency
    const userId = (req.session as any).userId;
    // Reject session if user has logged out — compare loginAt vs blacklistAt
    // (mirrors the JWT path logic; needed for cluster mode where in-memory
    // blacklist may be stale on some workers after re-login)
    const blacklistedAt = await getBlacklistTimestamp(userId);
    if (blacklistedAt !== null) {
      const loginAt: number = (req.session as any).loginAt ?? 0;
      if (loginAt < blacklistedAt) {
        // Session predates the logout — invalidate it
        (req.session as any).isLocalAuth = false;
        (req.session as any).userId = null;
        return res.status(401).json({ message: "Unauthorized" });
      }
      // loginAt >= blacklistedAt means user re-logged-in after the logout — valid session
    }
    const user = await storage.getUser(userId);
    if (user) {
      // Check if user is active
      if (!user.isActive) {
        // Clear session for inactive user
        (req.session as any).isLocalAuth = false;
        (req.session as any).userId = null;
        return res.status(403).json({ message: "Your account has been deactivated. Please contact administrator." });
      }
      req.user = {
        claims: {
          sub: userId,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          metadata: { role: user.role }
        }
      };
      return next();
    }
  }

  // ── 3. OIDC/Replit Auth ──
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    // Check if user is active in database
    const dbUser = await storage.getUser(user.claims?.sub);
    if (dbUser && !dbUser.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact administrator." });
    }
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Check if user is active after refresh
    const dbUser = await storage.getUser(user.claims?.sub);
    if (dbUser && !dbUser.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact administrator." });
    }
    
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export const isAdmin: RequestHandler = async (req: any, res, next) => {
  const user = req.user as any;
  
  // Check if user has admin role from claims (set by isAuthenticated middleware)
  const legacyRole = user?.claims?.metadata?.role;
  const email = user?.claims?.email;
  const userId = user?.claims?.sub;
  
  // Super admin check by email - always has admin access
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
  
  if (isSuperAdmin) {
    return next();
  }
  
  // Check legacy role field first (case-insensitive to handle "Admin" vs "admin")
  if (legacyRole?.toLowerCase() === "admin") {
    return next();
  }
  
  // Check user_role_assignments for admin role
  if (userId) {
    try {
      const assignments = await storage.getUserRoleAssignments(userId);
      const roleIds = assignments.filter(a => a.isActive).map(a => a.roleId);
      
      // Get role details to check if any is an admin role
      for (const roleId of roleIds) {
        const role = await storage.getUserRole(roleId);
        if (role && role.name === 'admin' && role.isActive) {
          return next();
        }
      }
    } catch (error) {
      console.error("Error checking user role assignments:", error);
    }
  }
  
  return res.status(403).json({ message: "Access denied. Admin privileges required." });
};

// Permission types for module access
type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

// Cache for user permissions per request to avoid repeated DB calls
const permissionCache = new Map<string, {
  permissions: Map<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
  timestamp: number;
}>();

// Clear stale cache entries (older than 5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(permissionCache.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > CACHE_TTL) {
      permissionCache.delete(key);
    }
  }
}, 60 * 1000);

// Helper to check if user is super admin
export function isSuperAdmin(email: string | undefined): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

// Get user permissions with caching
async function getUserPermissions(userId: string): Promise<Map<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }
  
  const effectivePermissions = await storage.getUserEffectivePermissions(userId);
  const permMap = new Map<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>();
  
  for (const perm of effectivePermissions) {
    permMap.set(perm.module, {
      canView: perm.canView,
      canCreate: perm.canCreate,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    });
  }
  
  // Only cache if we actually got modules back. If the list is empty it likely
  // means the DB returned nothing (transient error or pre-sync window). Caching
  // an empty map for 5 minutes would block ALL permission checks until expiry.
  if (permMap.size > 0) {
    permissionCache.set(userId, { permissions: permMap, timestamp: Date.now() });
  }
  return permMap;
}

// Clear permission cache for a user (call when permissions are updated)
export function clearPermissionCache(userId?: string): void {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}

// Clear all permission caches (call when role rights are updated)
export function clearAllPermissionCaches(): void {
  permissionCache.clear();
}

// Middleware factory to check module permissions
export function requirePermission(moduleName: string, action: PermissionAction): RequestHandler {
  return async (req: any, res, next) => {
    const user = req.user as any;
    const email = user?.claims?.email;
    const userId = user?.claims?.sub;
    
    // Super admin bypasses all permission checks
    if (isSuperAdmin(email)) {
      return next();
    }
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const permissions = await getUserPermissions(userId);
      const modulePerm = permissions.get(moduleName);
      
      if (!modulePerm) {
        // No permissions defined for this module - check if user has admin role
        const assignments = await storage.getUserRoleAssignments(userId);
        const roleIds = assignments.filter(a => a.isActive).map(a => a.roleId);
        
        for (const roleId of roleIds) {
          const role = await storage.getUserRole(roleId);
          if (role && role.name === 'admin' && role.isActive) {
            return next();
          }
        }
        
        // Also check legacy role field (case-insensitive to handle "Admin" vs "admin")
        const legacyRole = user?.claims?.metadata?.role;
        if (legacyRole?.toLowerCase() === 'admin') {
          return next();
        }
        
        return res.status(403).json({ 
          message: `Access denied. No permissions found for module: ${moduleName}` 
        });
      }
      
      // Check specific action permission
      let hasPermission = false;
      switch (action) {
        case 'view':
          hasPermission = modulePerm.canView;
          break;
        case 'create':
          hasPermission = modulePerm.canCreate;
          break;
        case 'edit':
          hasPermission = modulePerm.canEdit;
          break;
        case 'delete':
          hasPermission = modulePerm.canDelete;
          break;
      }
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. You don't have ${action} permission for ${moduleName}` 
        });
      }
      
      return next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ message: "Error checking permissions" });
    }
  };
}

// Middleware to check if user has ANY of the specified permissions
export function requireAnyPermission(permissions: Array<{ module: string; action: PermissionAction }>): RequestHandler {
  return async (req: any, res, next) => {
    const user = req.user as any;
    const email = user?.claims?.email;
    const userId = user?.claims?.sub;
    
    // Super admin bypasses all permission checks
    if (isSuperAdmin(email)) {
      return next();
    }
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const userPermissions = await getUserPermissions(userId);
      
      for (const { module: moduleName, action } of permissions) {
        const modulePerm = userPermissions.get(moduleName);
        if (modulePerm) {
          let hasPermission = false;
          switch (action) {
            case 'view':
              hasPermission = modulePerm.canView;
              break;
            case 'create':
              hasPermission = modulePerm.canCreate;
              break;
            case 'edit':
              hasPermission = modulePerm.canEdit;
              break;
            case 'delete':
              hasPermission = modulePerm.canDelete;
              break;
          }
          if (hasPermission) {
            return next();
          }
        }
      }
      
      // Check if user has admin role as fallback
      const assignments = await storage.getUserRoleAssignments(userId);
      const roleIds = assignments.filter(a => a.isActive).map(a => a.roleId);
      
      for (const roleId of roleIds) {
        const role = await storage.getUserRole(roleId);
        if (role && role.name === 'admin' && role.isActive) {
          return next();
        }
      }
      
      // Also check legacy role field (case-insensitive to handle "Admin" vs "admin")
      const legacyRole = user?.claims?.metadata?.role;
      if (legacyRole?.toLowerCase() === 'admin') {
        return next();
      }
      
      return res.status(403).json({ 
        message: "Access denied. You don't have the required permissions." 
      });
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ message: "Error checking permissions" });
    }
  };
}
