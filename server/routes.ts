import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { getCached, setCached, invalidateCache } from "./cache";
import { setupAuth, isAuthenticated, isAdmin, requirePermission, requireAnyPermission, isSuperAdmin, clearPermissionCache, clearAllPermissionCaches, signAuthToken, verifyAuthToken, AUTH_COOKIE_NAME, blacklistUserJwt, clearUserBlacklist } from "./replitAuth";
import { getAllowedUserIdsForUser, isUserIdAllowed, filterAllowedUserId, invalidateAccessControlCache, SUPER_ADMIN_EMAIL } from "./accessControl";
import { db } from "./db";
import { users, leads, modules, projectModules, projectEngineers, tickets, ticketComments, escalationHistory, feedback, activityLog, tasks, taskFollowups, contractTypeChangeLogs, monthlyPaymentReminders, customers, customerModuleContracts, marketingDailyReports, projects, developmentTasks, type User } from "@shared/schema";
import { sendQuoteEmail, sendTicketClosureFeedbackEmail, sendTrainingConfirmationEmail, sendWelcomeEmail, sendEmail, sendOtpEmail, sendPasswordResetSuccessEmail, sendPasswordResetNotificationEmail, clearSmtpSettingsCache, setStorageGetter } from "./email";
import { eq, sql, and, desc, or, ilike, inArray, isNotNull, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  insertCustomerSchema,
  insertLeadSchema,
  insertFollowUpSchema,
  insertQuoteSchema,
  insertProjectSchema,
  insertProjectEngineerSchema,
  insertModuleSchema,
  insertProjectModuleSchema,
  insertProjectProgressEntrySchema,
  insertTrainingRecordSchema,
  insertTicketSchema,
  insertTicketCommentSchema,
  insertEscalationHistorySchema,
  insertFeedbackSchema,
  insertAttachmentSchema,
  insertUserSchema,
  insertUserRoleSchema,
  insertUserRoleRightSchema,
  insertTaskSchema,
  insertTaskCommentSchema,
  insertTaskFollowupSchema,
  insertDepartmentSchema,
  insertSystemModuleSchema,
  insertUserRoleAssignmentSchema,
  insertRoleChangeHistorySchema,
  insertUserModulePermissionSchema,
  insertKnowledgeBaseSourceSchema,
  knowledgeBaseCategories,
  knowledgeBaseContentTypes,
  supportedLanguages,
  smtpConfigSchema,
  insertPointCategorySchema,
  insertPointCategoryDepartmentSettingSchema,
  insertContractTypeSchema,
  insertCustomerContractSchema,
  insertContractFollowupSchema,
  insertCustomerContractModuleSchema,
  contractTypes,
  customerContracts,
  contractFollowups,
  customerContractModules,
  insertSalesPlanSchema,
  insertSalesMonthlyTargetSchema,
} from "@shared/schema";
import { generateEmbedding, generateEmbeddings, chunkText, extractTextFromContent, estimateTokenCount } from "./embeddings";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { handleAssignment, handleCompletion } from "./pointsService";

// Simple in-memory cache with TTL for expensive analytics computations
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const analyticsCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache TTL

function getCachedData<T>(key: string): T | null {
  const entry = analyticsCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  if (entry) {
    analyticsCache.delete(key); // Clean up expired entry
  }
  return null;
}

function setCachedData<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  analyticsCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

// Generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Webhook Basic Auth middleware
async function validateWebhookAuth(req: any, res: any, next: any) {
  try {
    // Get webhook auth settings from database
    const enabledSetting = await storage.getSystemSetting("webhook_auth_enabled");
    const isEnabled = enabledSetting?.settingValue === "true";
    
    if (!isEnabled) {
      // Webhook auth is disabled, allow request
      return next();
    }
    
    const usernameSetting = await storage.getSystemSetting("webhook_auth_username");
    const passwordSetting = await storage.getSystemSetting("webhook_auth_password");
    
    if (!usernameSetting?.settingValue || !passwordSetting?.settingValue) {
      // No credentials configured but auth is enabled - deny access
      console.warn("[Webhook] Auth enabled but no credentials configured");
      return res.status(401).json({ error: "Webhook authentication required" });
    }
    
    // Check for Basic Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Decode Base64 credentials
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    // Use indexOf to find the first colon - passwords may contain colons
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      return res.status(401).json({ error: "Invalid credentials format" });
    }
    const username = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);
    
    // Validate credentials
    if (username === usernameSetting.settingValue && password === passwordSetting.settingValue) {
      return next();
    }
    
    return res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    console.error("[Webhook] Auth validation error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up email service storage getter for database SMTP configuration
  setStorageGetter(async () => storage);
  
  // Auth middleware
  await setupAuth(app);

  // =============================================
  // LOCAL AUTHENTICATION ROUTES
  // =============================================

  // Step 1: Signup - Request OTP
  app.post("/api/auth/signup/request-otp", async (req, res) => {
    try {
      const { email, firstName, lastName, password } = req.body;
      
      if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ message: "Email, first name, last name, and password are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.isEmailVerified) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      
      // Validate password (min 8 chars)
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Generate OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store OTP
      await storage.createOtp(email, otpCode, "signup", expiresAt);
      
      // Send OTP email
      await sendOtpEmail(email, otpCode, "signup");
      
      // Store pending user data in session temporarily
      (req.session as any).pendingSignup = {
        email,
        firstName,
        lastName,
        passwordHash: await bcrypt.hash(password, 10)
      };
      
      res.json({ success: true, message: "OTP sent to your email" });
    } catch (error: any) {
      console.error("Error requesting signup OTP:", error);
      
      // Check if it's a Resend domain verification error
      if (error.message && error.message.includes("only send testing emails")) {
        return res.status(400).json({ 
          message: "Email service is in test mode. Please contact the administrator to verify the email domain, or use snayagamk@gmail.com for testing.",
          isEmailRestriction: true
        });
      }
      
      res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }
  });

  // Step 2: Signup - Verify OTP and create account
  app.post("/api/auth/signup/verify-otp", async (req, res) => {
    try {
      const { email, otpCode } = req.body;
      
      if (!email || !otpCode) {
        return res.status(400).json({ message: "Email and OTP code are required" });
      }
      
      // Verify OTP
      const isValid = await storage.verifyOtp(email, otpCode, "signup");
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      
      // Get pending signup data
      const pendingSignup = (req.session as any).pendingSignup;
      if (!pendingSignup || pendingSignup.email !== email) {
        return res.status(400).json({ message: "No pending signup found. Please start again." });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.isEmailVerified) {
        // User already exists and is verified - they should log in instead
        delete (req.session as any).pendingSignup;
        return res.status(400).json({ 
          message: "An account with this email already exists. Please log in instead.",
          redirect: "/auth/login"
        });
      }
      
      // Determine role - super admin gets admin role automatically
      const userRole = pendingSignup.email === "senthil@microgenn.com" ? "admin" : "sales_executive";
      
      let user;
      
      if (existingUser && !existingUser.isEmailVerified) {
        // User exists but not verified - update their info and verify
        await storage.updateUser(existingUser.id, {
          firstName: pendingSignup.firstName,
          lastName: pendingSignup.lastName,
          passwordHash: pendingSignup.passwordHash,
          role: userRole,
          isEmailVerified: true,
        });
        user = await storage.getUser(existingUser.id);
      } else {
        // Create new user
        user = await storage.createUserWithPassword({
          email: pendingSignup.email,
          firstName: pendingSignup.firstName,
          lastName: pendingSignup.lastName,
          passwordHash: pendingSignup.passwordHash,
          role: userRole,
        });
        
        // Mark email as verified
        await storage.updateUser(user!.id, { isEmailVerified: true });
      }
      
      if (!user) {
        return res.status(500).json({ message: "Failed to create account" });
      }
      
      // Clear pending signup
      delete (req.session as any).pendingSignup;
      
      // Send welcome email
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      await sendWelcomeEmail(user.email!, fullName, user.role);
      
      // Set up session
      (req.session as any).userId = user.id;
      (req.session as any).isLocalAuth = true;
      req.user = { claims: { sub: user.id } };
      
      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
    } catch (error) {
      console.error("Error verifying signup OTP:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Local Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({ message: "Your account has been deactivated. Please contact an administrator." });
      }
      
      // Check if using local auth
      if (!user.passwordHash) {
        return res.status(401).json({ message: "Please login using your original sign-in method" });
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Auto-assign admin role to super admin email if not already admin
      let userRole = user.role;
      if (email === "senthil@microgenn.com" && user.role !== "admin") {
        userRole = "admin";
        storage.updateUser(user.id, { role: "admin" }).catch(() => {});
      }
      
      // Set up session
      (req.session as any).userId = user.id;
      (req.session as any).isLocalAuth = true;
      req.user = { claims: { sub: user.id } };

      // Invalidate any stale auth caches for this user
      invalidateCache(`auth:permissions:${user.id}`);
      invalidateCache(`auth:user:${user.id}`);

      // Update last login in background (non-blocking)
      storage.updateUser(user.id, { lastLoginAt: new Date() }).catch(() => {});

      // Remove from logout blacklist so re-login works immediately
      await clearUserBlacklist(user.id);

      // Sign a JWT that carries user data so isAuthenticated needs ZERO DB queries.
      // Two delivery mechanisms:
      // 1. mcrm_token cookie — set server-side, works even with old cached frontend JS
      // 2. authToken in JSON body — stored in localStorage by new frontend JS
      const authToken = await signAuthToken(user.id, {
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: userRole,
      });
      const cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      res.cookie(AUTH_COOKIE_NAME, authToken, {
        httpOnly: true,
        secure: false,   // false so it works over HTTP (nginx handles HTTPS)
        maxAge: cookieMaxAge,
        sameSite: "lax",
        path: "/",
      });
      const loginPayload = { 
        success: true, 
        authToken,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          role: userRole,
          profileImageUrl: user.profileImageUrl
        } 
      };

      // Save session explicitly with a 3-second hard timeout.
      // On a loaded VPS the session store (connect-pg-simple) can block
      // res.end() indefinitely if the DB pool is exhausted. This guarantees
      // the login response is sent within 3 s regardless of store latency.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          console.warn("[Auth] Session save timeout — responding without confirmed save");
          resolve();
        }, 3000);
        req.session.save((err) => {
          clearTimeout(timer);
          if (err) console.error("[Auth] Session save error:", err);
          resolve();
        });
      });

      if (!res.headersSent) res.json(loginPayload);
    } catch (error: any) {
      console.error("Error logging in:", error?.message || error, error?.stack);
      if (!res.headersSent) res.status(500).json({ message: "Login failed", error: error?.message });
    }
  });

  // Request password reset OTP
  app.post("/api/auth/forgot-password/request-otp", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return res.json({ success: true, message: "If an account exists with this email, you will receive an OTP" });
      }
      
      // Generate OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store OTP
      await storage.createOtp(email, otpCode, "password_reset", expiresAt);
      
      // Send OTP email
      await sendOtpEmail(email, otpCode, "password_reset");
      
      res.json({ success: true, message: "If an account exists with this email, you will receive an OTP" });
    } catch (error) {
      console.error("Error requesting password reset OTP:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Reset password with OTP
  app.post("/api/auth/forgot-password/reset", async (req, res) => {
    try {
      const { email, otpCode, newPassword } = req.body;
      
      if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ message: "Email, OTP code, and new password are required" });
      }
      
      // Validate password
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Verify OTP
      const isValid = await storage.verifyOtp(email, otpCode, "password_reset");
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash });
      
      // Send confirmation email
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      await sendPasswordResetSuccessEmail(email, userName);
      
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Change password (authenticated)
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub || (req.session as any).userId;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has password (local auth)
      if (!user.passwordHash) {
        return res.status(400).json({ message: "Cannot change password for this account type" });
      }
      
      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { passwordHash });
      
      // Send confirmation email
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      if (user.email) {
        await sendPasswordResetSuccessEmail(user.email, userName);
      }
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Super Admin: Impersonate user
  app.post("/api/auth/impersonate", isAuthenticated, async (req: any, res) => {
    try {
      const adminUserId = req.user.claims.sub || (req.session as any).userId;
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }
      
      // Check if current user is admin
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can impersonate users" });
      }
      
      // Get target user
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      // Prevent impersonating super admin
      if (targetUser.email === "senthil@microgenn.com") {
        return res.status(403).json({ message: "Cannot impersonate super admin" });
      }
      
      // Store original admin session
      (req.session as any).originalAdminId = adminUserId;
      (req.session as any).isImpersonating = true;
      
      // Switch to target user
      (req.session as any).userId = targetUserId;
      req.user = { claims: { sub: targetUserId } };
      
      res.json({ 
        success: true, 
        message: `Now logged in as ${targetUser.firstName} ${targetUser.lastName}`,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          role: targetUser.role,
          profileImageUrl: targetUser.profileImageUrl,
          isImpersonating: true
        }
      });
    } catch (error) {
      console.error("Error impersonating user:", error);
      res.status(500).json({ message: "Failed to impersonate user" });
    }
  });

  // Super Admin: Stop impersonating
  app.post("/api/auth/stop-impersonating", isAuthenticated, async (req: any, res) => {
    try {
      const originalAdminId = (req.session as any).originalAdminId;
      
      if (!originalAdminId || !(req.session as any).isImpersonating) {
        return res.status(400).json({ message: "Not currently impersonating any user" });
      }
      
      // Restore admin session
      (req.session as any).userId = originalAdminId;
      req.user = { claims: { sub: originalAdminId } };
      delete (req.session as any).originalAdminId;
      delete (req.session as any).isImpersonating;
      
      // Get admin user
      const adminUser = await storage.getUser(originalAdminId);
      
      res.json({ 
        success: true, 
        message: "Stopped impersonating",
        user: adminUser
      });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Get all users for admin (for impersonation)
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub || (req.session as any).userId;
      
      // Check if current user is admin
      const currentUser = await storage.getUser(userId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can view all users" });
      }
      
      const allUsers = await storage.getUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Super Admin email - protected from modifications
  const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

  // Admin: Update user (admin only)
  app.patch("/api/users/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminUserId = req.user.claims.sub || (req.session as any).userId;
      const { userId } = req.params;
      const { isActive, role, firstName, lastName, email, departmentId } = req.body;
      
      // Prevent admin from deactivating themselves
      if (userId === adminUserId && isActive === false) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Protect super admin from role/status changes
      if (targetUser.email === SUPER_ADMIN_EMAIL) {
        if (role && role !== "admin") {
          return res.status(403).json({ message: "Cannot change super admin role" });
        }
        if (isActive === false) {
          return res.status(403).json({ message: "Cannot deactivate super admin account" });
        }
      }
      
      // Build update object with all allowed fields
      const updates: any = {};
      
      if (typeof isActive === "boolean") {
        updates.isActive = isActive;
      }
      // Validate role against user_roles master table
      if (role) {
        const validRoles = await storage.getUserRoles();
        const roleExists = validRoles.some(r => r.name === role && r.isActive);
        if (!roleExists) {
          return res.status(400).json({ message: `Invalid role: "${role}". Role must exist in User Roles master.` });
        }
        updates.role = role;
      }
      if (firstName !== undefined) {
        updates.firstName = firstName;
      }
      if (lastName !== undefined) {
        updates.lastName = lastName;
      }
      if (email !== undefined) {
        updates.email = email;
      }
      if (departmentId !== undefined) {
        updates.departmentId = departmentId || null;
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      
      // Log activity
      await storage.logActivity({
        entityType: "user",
        entityId: userId,
        action: "updated",
        description: `User updated: ${updatedUser.firstName} ${updatedUser.lastName}`,
        userId: adminUserId,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Reset/Assign password - Available to admins and department heads
  app.post("/api/users/:userId/reset-password", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      const { userId } = req.params;
      const { newPassword, sendEmail } = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Get current user info
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Authorization check:
      // 1. Admins can reset any user's password (except super admin)
      // 2. Department heads can reset passwords for users in their department
      let isAuthorized = false;
      
      if (currentUser.role === "admin") {
        // Admins can reset any password except super admin (unless they ARE the super admin)
        if (targetUser.email === SUPER_ADMIN_EMAIL && currentUser.email !== SUPER_ADMIN_EMAIL) {
          return res.status(403).json({ message: "Cannot reset super admin password" });
        }
        isAuthorized = true;
      } else {
        // Check if current user is a department head (using junction table)
        const managedDepartments = await storage.getDepartmentsByHead(currentUserId);
        
        if (managedDepartments.length > 0) {
          // Check if target user is in one of the managed departments
          const managedDeptIds = managedDepartments.map(d => d.id);
          if (targetUser.departmentId && managedDeptIds.includes(targetUser.departmentId)) {
            isAuthorized = true;
          }
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "You don't have permission to reset this user's password" });
      }
      
      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      // Update the user's password
      await storage.updateUser(userId, { passwordHash });
      
      // Log activity
      await storage.logActivity({
        entityType: "user",
        entityId: userId,
        action: "password_reset",
        description: `Password reset for user: ${targetUser.firstName} ${targetUser.lastName} by ${currentUser.firstName} ${currentUser.lastName}`,
        userId: currentUserId,
      });
      
      // Send email notification if requested
      if (sendEmail && targetUser.email) {
        try {
          await sendPasswordResetNotificationEmail(
            targetUser.email,
            targetUser.firstName || "User",
            newPassword,
            currentUser.firstName || "Administrator"
          );
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
          // Don't fail the request if email fails
        }
      }
      
      res.json({ 
        success: true, 
        message: `Password ${sendEmail ? 'reset and sent to' : 'reset for'} ${targetUser.email}` 
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Get users in department (for department heads)
  app.get("/api/department-users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Admins see all users
      if (currentUser.role === "admin") {
        const allUsers = await storage.getUsers();
        return res.json(allUsers);
      }
      
      // Get departments where current user is the head (using junction table)
      const managedDepartments = await storage.getDepartmentsByHead(currentUserId);
      
      if (managedDepartments.length === 0) {
        return res.json([]);
      }
      
      // Get all users in managed departments
      const allUsers = await storage.getUsers();
      const managedDeptIds = managedDepartments.map(d => d.id);
      const departmentUsers = allUsers.filter(u => 
        u.departmentId && managedDeptIds.includes(u.departmentId)
      );
      
      res.json(departmentUsers);
    } catch (error) {
      console.error("Error fetching department users:", error);
      res.status(500).json({ message: "Failed to fetch department users" });
    }
  });

  // Check if current user can manage passwords
  app.get("/api/can-manage-passwords", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.json({ canManage: false, role: null, managedDepartments: [] });
      }
      
      // Admins can always manage
      if (currentUser.role === "admin") {
        return res.json({ 
          canManage: true, 
          role: "admin", 
          managedDepartments: [] 
        });
      }
      
      // Check if department head (using junction table)
      const managedDepartments = await storage.getDepartmentsByHead(currentUserId);
      
      if (managedDepartments.length > 0) {
        return res.json({ 
          canManage: true, 
          role: "department_head", 
          managedDepartments: managedDepartments.map(d => ({ id: d.id, name: d.name }))
        });
      }
      
      return res.json({ canManage: false, role: currentUser.role, managedDepartments: [] });
    } catch (error) {
      console.error("Error checking password management permissions:", error);
      res.status(500).json({ message: "Failed to check permissions" });
    }
  });

  // Local logout — client fetches this as JSON, applies Set-Cookie, then redirects itself
  app.get("/api/auth/logout", async (req: any, res) => {
    try {
      // Parse userId from session or JWT cookie (route has no isAuthenticated middleware)
      let userId = (req.session as any)?.userId || req.user?.claims?.sub;
      if (!userId) {
        const cookieHeader = req.headers.cookie as string | undefined;
        if (cookieHeader) {
          const cookieMap: Record<string, string> = {};
          cookieHeader.split(";").forEach(part => {
            const [k, ...v] = part.trim().split("=");
            if (k) cookieMap[k.trim()] = decodeURIComponent(v.join("=").trim());
          });
          const rawToken = cookieMap[AUTH_COOKIE_NAME];
          if (rawToken) {
            const jwtPayload = await verifyAuthToken(rawToken);
            if (jwtPayload?.sub) userId = jwtPayload.sub;
          }
        }
      }
      if (userId) {
        invalidateCache(`auth:permissions:${userId}`);
        invalidateCache(`auth:user:${userId}`);
      }
      // Clear both auth cookies in this response so the browser drops them
      // before the client does window.location.replace('/auth/login').
      res.clearCookie("connect.sid", { path: "/" });
      res.clearCookie(AUTH_COOKIE_NAME, { path: "/", httpOnly: true, sameSite: "lax", secure: false });
      req.session.destroy((err: any) => {
        if (err) console.error("Error destroying session:", err);
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Error logging out:", error);
      res.json({ success: true });
    }
  });

  // Keep POST for backwards compatibility
  app.post("/api/auth/local-logout", async (req: any, res) => {
    try {
      const userId = (req.session as any).userId || req.user?.claims?.sub;
      if (userId) {
        await blacklistUserJwt(userId);
        invalidateCache(`auth:permissions:${userId}`);
        invalidateCache(`auth:user:${userId}`);
      }
      req.session.destroy((err: any) => {
        if (err) console.error("Error destroying session:", err);
        res.clearCookie("connect.sid", { path: "/" });
        res.clearCookie(AUTH_COOKIE_NAME, { path: "/", httpOnly: true, sameSite: "lax", secure: false });
        res.json({ success: true, message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCacheKey = `auth:user:${userId}`;
      const cachedUser = getCached<any>(userCacheKey);
      if (cachedUser) return res.json(cachedUser);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      setCached(userCacheKey, user, 120);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get current user's permissions based on their role assignments (new system)
  app.get("/api/auth/my-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub || (req.session as any).userId;

      const cacheKey = `auth:permissions:${userId}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const [user, effectivePermissions, roleAssignments] = await Promise.all([
        storage.getUser(userId),
        storage.getUserEffectivePermissions(userId),
        storage.getUserRoleAssignments(userId),
      ]);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userIsSuperAdmin = isSuperAdmin(user.email || undefined);

      // Role data is already embedded in the assignments — no extra DB calls needed
      const assignedRoles = roleAssignments
        .filter(a => a.isActive && a.role)
        .map(a => ({
          id: a.role!.id,
          name: a.role!.name,
          displayName: a.role!.displayName
        }));

      const permissions = effectivePermissions.map(perm => ({
        moduleId: perm.module,
        moduleName: perm.module,
        moduleDisplayName: perm.moduleName,
        canView: perm.canView,
        canCreate: perm.canCreate,
        canEdit: perm.canEdit,
        canDelete: perm.canDelete,
        source: perm.source
      }));

      const result = {
        userId: user.id,
        email: user.email,
        legacyRole: user.role,
        assignedRoles,
        permissions,
        isSuperAdmin: userIsSuperAdmin,
        hasAdminRole: userIsSuperAdmin || assignedRoles.some(r => r.name === 'admin') || user.role === 'admin'
      };

      setCached(cacheKey, result, 600);
      res.json(result);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // User routes - for dropdowns/selection, only return active users
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const { role, includeInactive } = req.query;
      if (role) {
        let userList = await storage.getUsersByRole(role as string);
        // Filter out inactive users unless explicitly requested (for admin views)
        if (includeInactive !== 'true') {
          userList = userList.filter(u => u.isActive !== false);
        }
        return res.json(userList);
      }
      res.json([]);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get users who can be assigned to support tickets (based on role's isSupportAssignable flag)
  // Only returns active users for assignment purposes
  app.get("/api/users/support-assignable", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("users:support-assignable");
      if (cached) return res.json(cached);
      let supportUsers = await storage.getSupportAssignableUsers();
      supportUsers = supportUsers.filter(u => u.isActive !== false);
      setCached("users:support-assignable", supportUsers, 120);
      res.json(supportUsers);
    } catch (error) {
      console.error("Error fetching support assignable users:", error);
      res.status(500).json({ message: "Failed to fetch support assignable users" });
    }
  });

  app.get("/api/users/development-assignable", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("users:development-assignable");
      if (cached) return res.json(cached);
      const devDepartment = await storage.getDepartmentByName("Development");
      if (!devDepartment) return res.json([]);
      const allUsers = await storage.getUsers();
      const devUsers = allUsers.filter(u => u.departmentId === devDepartment.id && u.isActive !== false);
      setCached("users:development-assignable", devUsers, 120);
      res.json(devUsers);
    } catch (error) {
      console.error("Error fetching development assignable users:", error);
      res.status(500).json({ message: "Failed to fetch development assignable users" });
    }
  });

  // =============================================
  // MASTER DATA ROUTES
  // =============================================

  // Customer Master routes
  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("customers:all");
      if (cached) return res.json(cached);
      const customersList = await storage.getCustomers();
      setCached("customers:all", customersList, 120);
      res.json(customersList);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/with-lifecycle", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("customers:with-lifecycle");
      if (cached) return res.json(cached);
      const customersWithLifecycle = await storage.getCustomersWithLifecycle();
      setCached("customers:with-lifecycle", customersWithLifecycle, 120);
      res.json(customersWithLifecycle);
    } catch (error) {
      console.error("Error fetching customers with lifecycle:", error);
      res.status(500).json({ message: "Failed to fetch customers with lifecycle" });
    }
  });

  app.get("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      
      // Check if customer name already exists
      const existingCustomer = await storage.getCustomerByName(validatedData.name);
      if (existingCustomer) {
        return res.status(400).json({ message: "A customer with this name already exists" });
      }
      
      const newCustomer = await storage.createCustomer(validatedData);
      
      await storage.logActivity({
        entityType: "customer",
        entityId: newCustomer.id,
        action: "created",
        description: `New customer created: ${newCustomer.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("customers:");
      res.json(newCustomer);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A customer with this name already exists" });
      }
      res.status(400).json({ message: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateCustomer(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "customer",
        entityId: updated.id,
        action: "updated",
        description: `Customer updated: ${updated.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("customers:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(400).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      await storage.deleteCustomer(req.params.id);
      
      await storage.logActivity({
        entityType: "customer",
        entityId: req.params.id,
        action: "deleted",
        description: `Customer deleted: ${customer.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("customers:");
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Find duplicate customers (by name)
  app.get("/api/customers/duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const customers = await storage.getCustomers();
      
      // Group customers by normalized name (lowercase, trimmed)
      const nameGroups: Record<string, typeof customers> = {};
      
      for (const customer of customers) {
        const normalizedName = customer.name.toLowerCase().trim();
        if (!nameGroups[normalizedName]) {
          nameGroups[normalizedName] = [];
        }
        nameGroups[normalizedName].push(customer);
      }
      
      // Filter to only groups with duplicates
      const duplicateGroups = Object.entries(nameGroups)
        .filter(([_, group]) => group.length > 1)
        .map(([name, customers]) => ({
          name,
          customers: customers.sort((a, b) => 
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          ),
        }));
      
      res.json(duplicateGroups);
    } catch (error) {
      console.error("Error finding duplicate customers:", error);
      res.status(500).json({ message: "Failed to find duplicates" });
    }
  });

  // Bulk delete customers
  app.post("/api/customers/bulk-delete", isAuthenticated, async (req: any, res) => {
    try {
      const { customerIds } = req.body;
      
      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({ message: "No customer IDs provided" });
      }
      
      let deleted = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const id of customerIds) {
        try {
          const customer = await storage.getCustomer(id);
          if (customer) {
            await storage.deleteCustomer(id);
            
            await storage.logActivity({
              entityType: "customer",
              entityId: id,
              action: "deleted",
              description: `Customer deleted (bulk): ${customer.name}`,
              userId: req.user.claims.sub,
            });
            
            deleted++;
          } else {
            failed++;
            errors.push(`Customer ${id} not found`);
          }
        } catch (err) {
          failed++;
          errors.push(`Failed to delete customer ${id}`);
        }
      }
      
      res.json({ deleted, failed, errors });
    } catch (error) {
      console.error("Error bulk deleting customers:", error);
      res.status(500).json({ message: "Failed to bulk delete customers" });
    }
  });

  // Module Master routes
  app.get("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("modules:all");
      if (cached) return res.json(cached);
      const modulesList = await storage.getModules();
      setCached("modules:all", modulesList, 600);
      res.json(modulesList);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  app.get("/api/modules/:id", isAuthenticated, async (req, res) => {
    try {
      const module = await storage.getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json(module);
    } catch (error) {
      console.error("Error fetching module:", error);
      res.status(500).json({ message: "Failed to fetch module" });
    }
  });

  app.post("/api/modules", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertModuleSchema.parse(req.body);
      
      // Check if module name already exists
      const existingModule = await storage.getModuleByName(validatedData.name);
      if (existingModule) {
        return res.status(400).json({ message: "A module with this name already exists" });
      }
      
      const newModule = await storage.createModule(validatedData);
      
      await storage.logActivity({
        entityType: "module",
        entityId: newModule.id,
        action: "created",
        description: `New module created: ${newModule.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("modules:");
      res.json(newModule);
    } catch (error: any) {
      console.error("Error creating module:", error);
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A module with this name already exists" });
      }
      res.status(400).json({ message: "Failed to create module" });
    }
  });

  app.patch("/api/modules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateModule(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "module",
        entityId: updated.id,
        action: "updated",
        description: `Module updated: ${updated.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("modules:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating module:", error);
      res.status(400).json({ message: "Failed to update module" });
    }
  });

  app.delete("/api/modules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const module = await storage.getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      
      await storage.deleteModule(req.params.id);
      
      await storage.logActivity({
        entityType: "module",
        entityId: req.params.id,
        action: "deleted",
        description: `Module deleted: ${module.name}`,
        userId: req.user.claims.sub,
      });
      
      res.json({ message: "Module deleted successfully" });
    } catch (error) {
      console.error("Error deleting module:", error);
      res.status(500).json({ message: "Failed to delete module" });
    }
  });

  // User Management routes (Admin-only CRUD for users)
  // Returns all users - use includeInactive=true for admin views, defaults to active only for dropdowns
  app.get("/api/users/all", isAuthenticated, async (req, res) => {
    try {
      const { includeInactive } = req.query;
      const cacheKey = `users:all:${includeInactive === 'true' ? 'with-inactive' : 'active'}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);
      let usersList = await storage.getUsers();
      if (includeInactive !== 'true') {
        usersList = usersList.filter(u => u.isActive !== false);
      }
      setCached(cacheKey, usersList, 300);
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if email already exists
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser) {
          return res.status(400).json({ message: "A user with this email already exists" });
        }
      }
      
      const newUser = await storage.createUser(validatedData);
      
      await storage.logActivity({
        entityType: "user",
        entityId: newUser.id,
        action: "created",
        description: `New user created: ${newUser.firstName} ${newUser.lastName}`,
        userId: req.user.claims.sub,
      });

      // Send welcome email to new user if email is provided
      if (newUser.email) {
        try {
          await sendWelcomeEmail(newUser.email, newUser.firstName || "User", newUser.role || "user");
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      }

      invalidateCache("users:");
      res.json(newUser);
    } catch (error: any) {
      console.error("Error creating user:", error);
      // Check for unique constraint violation
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("[User Update] ID:", req.params.id, "Data:", JSON.stringify(req.body));
      const { role, isActive, firstName, lastName, email, departmentId } = req.body;
      
      // Get target user
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Protect super admin from role/status changes
      if (targetUser.email === SUPER_ADMIN_EMAIL) {
        if (role && role !== "admin") {
          return res.status(403).json({ message: "Cannot change super admin role" });
        }
        if (isActive === false) {
          return res.status(403).json({ message: "Cannot deactivate super admin account" });
        }
      }
      
      // Check for duplicate email if email is being updated
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== req.params.id) {
          return res.status(400).json({ message: "A user with this email already exists" });
        }
      }
      
      // Build update object with validated fields
      const updates: any = {};
      
      if (typeof isActive === "boolean") {
        updates.isActive = isActive;
      }
      // Validate role against user_roles master table
      if (role) {
        const validRoles = await storage.getUserRoles();
        const roleExists = validRoles.some(r => r.name === role && r.isActive);
        if (!roleExists) {
          return res.status(400).json({ message: `Invalid role: "${role}". Role must exist in User Roles master.` });
        }
        updates.role = role;
      }
      if (firstName !== undefined) {
        updates.firstName = firstName;
      }
      if (lastName !== undefined) {
        updates.lastName = lastName;
      }
      if (email !== undefined) {
        updates.email = email;
      }
      if (departmentId !== undefined) {
        updates.departmentId = departmentId || null;
      }
      
      const updated = await storage.updateUser(req.params.id, updates);
      console.log("[User Update] Result role:", updated.role);
      
      await storage.logActivity({
        entityType: "user",
        entityId: updated.id,
        action: "updated",
        description: `User updated: ${updated.firstName} ${updated.lastName}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("users:");
      invalidateAccessControlCache(req.params.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating user:", error);
      // Check for unique constraint violation
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  // Get user assignments count (leads, tasks, tickets, projects)
  app.get("/api/users/:id/assignments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const assignments = await storage.getUserAssignments(userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error getting user assignments:", error);
      res.status(500).json({ message: "Failed to get user assignments" });
    }
  });

  // Reassign user's items to another user
  app.post("/api/users/:id/reassign", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fromUserId = req.params.id;
      const { toUserId } = req.body;
      
      if (!toUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      const targetUser = await storage.getUser(toUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      if (!targetUser.isActive) {
        return res.status(400).json({ message: "Cannot reassign to an inactive user" });
      }

      const result = await storage.reassignUserItems(fromUserId, toUserId);
      
      await storage.logActivity({
        entityType: "user",
        entityId: fromUserId,
        action: "reassigned",
        description: `User items reassigned to ${targetUser.firstName} ${targetUser.lastName}: ${result.leads} leads, ${result.tasks} tasks, ${result.tickets} tickets, ${result.projects} projects`,
        userId: req.user.claims.sub,
      });

      res.json({ 
        success: true, 
        message: `Successfully reassigned ${result.leads} leads, ${result.tasks} tasks, ${result.tickets} tickets, ${result.projects} projects`,
        ...result
      });
    } catch (error) {
      console.error("Error reassigning user items:", error);
      res.status(500).json({ message: "Failed to reassign user items" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await storage.deleteUser(req.params.id);
      
      await storage.logActivity({
        entityType: "user",
        entityId: req.params.id,
        action: "deleted",
        description: `User deleted: ${user.firstName} ${user.lastName}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("users:");
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      // Handle foreign key constraint violation - auto-deactivate user instead
      if (error.code === '23503') {
        const constraintMap: Record<string, string> = {
          'leads_sales_executive_id_users_id_fk': 'leads',
          'leads_assigned_to_users_id_fk': 'leads',
          'projects_assigned_to_users_id_fk': 'projects',
          'tickets_assigned_to_users_id_fk': 'support tickets',
          'tickets_created_by_users_id_fk': 'support tickets',
          'tasks_assigned_to_users_id_fk': 'tasks',
          'tasks_created_by_users_id_fk': 'tasks',
          'follow_ups_created_by_users_id_fk': 'follow-ups',
          'training_records_conducted_by_users_id_fk': 'training records',
        };
        
        const constraint = error.constraint || '';
        const reason = constraintMap[constraint] || 'records';
        
        try {
          // Get the user again to ensure we have latest data
          const userToDeactivate = await storage.getUser(req.params.id);
          if (userToDeactivate) {
            // Deactivate the user instead of deleting
            await storage.updateUser(req.params.id, { isActive: false });
            
            await storage.logActivity({
              entityType: "user",
              entityId: req.params.id,
              action: "deactivated",
              description: `User deactivated (has ${reason} assigned): ${userToDeactivate.firstName} ${userToDeactivate.lastName}`,
              userId: req.user.claims.sub,
            });
            
            return res.json({ 
              message: `User has ${reason} assigned and cannot be deleted. The user has been deactivated instead.`,
              deactivated: true
            });
          }
        } catch (deactivateError) {
          console.error("Error deactivating user:", deactivateError);
        }
        
        return res.status(400).json({ 
          message: `Cannot delete user: This user has ${reason} assigned. Please try again.` 
        });
      }
      
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // User Approval routes (Admin only)
  app.post("/api/users/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminUserId = req.user?.claims?.sub;
      
      console.log(`[User Approval] Approving user ${userId} by admin ${adminUserId}`);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updated = await storage.updateUser(userId, {
        isApproved: true,
        isActive: true,
        approvedAt: new Date(),
        approvedBy: adminUserId,
      });

      // Log activity - don't block on failure
      try {
        await storage.logActivity({
          entityType: "user",
          entityId: updated.id,
          action: "approved",
          description: `User approved: ${updated.firstName} ${updated.lastName}`,
          userId: adminUserId,
        });
      } catch (logError) {
        console.error("Failed to log approval activity:", logError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: error?.message || "Failed to approve user" });
    }
  });

  app.post("/api/users/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminUserId = req.user?.claims?.sub;
      
      console.log(`[User Rejection] Rejecting user ${userId} by admin ${adminUserId}`);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updated = await storage.updateUser(userId, {
        isApproved: false,
        isActive: false,
      });

      // Log activity - don't block on failure
      try {
        await storage.logActivity({
          entityType: "user",
          entityId: updated.id,
          action: "rejected",
          description: `User rejected: ${updated.firstName} ${updated.lastName}. Reason: ${req.body.reason || "No reason provided"}`,
          userId: adminUserId,
        });
      } catch (logError) {
        console.error("Failed to log rejection activity:", logError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: error?.message || "Failed to reject user" });
    }
  });

  app.post("/api/users/:id/revoke-approval", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminUserId = req.user?.claims?.sub;
      
      console.log(`[User Revoke] Revoking approval for user ${userId} by admin ${adminUserId}`);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent revoking super admin approval
      if (user.email === "senthil@microgenn.com") {
        return res.status(403).json({ message: "Cannot revoke super admin approval" });
      }

      const updated = await storage.updateUser(userId, {
        isApproved: false,
      });

      // Log activity - don't block on failure
      try {
        await storage.logActivity({
          entityType: "user",
          entityId: updated.id,
          action: "approval_revoked",
          description: `User approval revoked: ${updated.firstName} ${updated.lastName}`,
          userId: adminUserId,
        });
      } catch (logError) {
        console.error("Failed to log revoke activity:", logError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error revoking user approval:", error);
      res.status(500).json({ message: error?.message || "Failed to revoke user approval" });
    }
  });

  // User Role routes (admin only for write operations)
  app.get("/api/user-roles", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("user-roles:all");
      if (cached) return res.json(cached);
      const rolesList = await storage.getUserRoles();
      setCached("user-roles:all", rolesList, 300);
      res.json(rolesList);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  app.get("/api/user-roles/:id", isAuthenticated, async (req, res) => {
    try {
      const role = await storage.getUserRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "User role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ message: "Failed to fetch user role" });
    }
  });

  app.post("/api/user-roles", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertUserRoleSchema.parse(req.body);
      
      // Check if role name already exists
      const existingRole = await storage.getUserRoleByName(validatedData.name);
      if (existingRole) {
        return res.status(400).json({ message: "A role with this name already exists" });
      }
      
      const newRole = await storage.createUserRole(validatedData);
      
      // Automatically create rights entries for all system modules
      // This ensures the new role appears in User Rights with all modules listed
      const rightsCreated = await storage.ensureRoleHasAllModuleRights(newRole.id);
      console.log(`[RoleCreate] Created ${rightsCreated} module rights entries for new role: ${newRole.displayName}`);
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: newRole.id,
        action: "created",
        description: `New user role created: ${newRole.displayName}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("user-roles:");
      invalidateCache("roles:all");
      res.json(newRole);
    } catch (error: any) {
      console.error("Error creating user role:", error);
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A role with this name already exists" });
      }
      res.status(400).json({ message: "Failed to create user role" });
    }
  });

  app.patch("/api/user-roles/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateUserRole(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: updated.id,
        action: "updated",
        description: `User role updated: ${updated.displayName}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("user-roles:");
      invalidateCache("roles:all");
      res.json(updated);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(400).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/user-roles/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const role = await storage.getUserRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "User role not found" });
      }
      
      await storage.deleteUserRole(req.params.id);
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: req.params.id,
        action: "deleted",
        description: `User role deleted: ${role.displayName}`,
        userId: req.user.claims.sub,
      });
      
      res.json({ message: "User role deleted successfully" });
    } catch (error) {
      console.error("Error deleting user role:", error);
      res.status(500).json({ message: "Failed to delete user role" });
    }
  });

  // User Role Rights routes (admin only for write operations)
  app.get("/api/user-role-rights", isAuthenticated, async (req, res) => {
    try {
      const { roleId } = req.query;
      const rightsList = await storage.getUserRoleRights(roleId as string);
      res.json(rightsList);
    } catch (error) {
      console.error("Error fetching user role rights:", error);
      res.status(500).json({ message: "Failed to fetch user role rights" });
    }
  });

  app.get("/api/user-role-rights/:id", isAuthenticated, async (req, res) => {
    try {
      const right = await storage.getUserRoleRight(req.params.id);
      if (!right) {
        return res.status(404).json({ message: "User role right not found" });
      }
      res.json(right);
    } catch (error) {
      console.error("Error fetching user role right:", error);
      res.status(500).json({ message: "Failed to fetch user role right" });
    }
  });

  app.post("/api/user-role-rights", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertUserRoleRightSchema.parse(req.body);
      const newRight = await storage.createUserRoleRight(validatedData);
      
      await storage.logActivity({
        entityType: "user_role_right",
        entityId: newRight.id,
        action: "created",
        description: `New user role right created for module: ${newRight.module}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newRight);
    } catch (error) {
      console.error("Error creating user role right:", error);
      res.status(400).json({ message: "Failed to create user role right" });
    }
  });

  app.patch("/api/user-role-rights/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateUserRoleRight(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "user_role_right",
        entityId: updated.id,
        action: "updated",
        description: `User role right updated for module: ${updated.module}`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating user role right:", error);
      res.status(400).json({ message: "Failed to update user role right" });
    }
  });

  app.delete("/api/user-role-rights/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const right = await storage.getUserRoleRight(req.params.id);
      if (!right) {
        return res.status(404).json({ message: "User role right not found" });
      }
      
      await storage.deleteUserRoleRight(req.params.id);
      
      await storage.logActivity({
        entityType: "user_role_right",
        entityId: req.params.id,
        action: "deleted",
        description: `User role right deleted for module: ${right.module}`,
        userId: req.user.claims.sub,
      });
      
      res.json({ message: "User role right deleted successfully" });
    } catch (error) {
      console.error("Error deleting user role right:", error);
      res.status(500).json({ message: "Failed to delete user role right" });
    }
  });

  // Bulk update role rights for a role (admin only)
  app.post("/api/user-roles/:roleId/rights/bulk", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { roleId } = req.params;
      const { rights } = req.body;
      
      if (!Array.isArray(rights)) {
        return res.status(400).json({ message: "Rights must be an array" });
      }
      
      // Get existing rights for this role
      const existingRights = await storage.getUserRoleRights(roleId);
      
      // Process each module permission
      for (const right of rights) {
        // Match by 'module' field (which stores the module ID) - database uses 'module' not 'moduleId'
        const existingRight = existingRights.find((r: any) => r.module === right.moduleId);
        
        if (existingRight) {
          // Update existing right
          await storage.updateUserRoleRight(existingRight.id, {
            canView: right.canView,
            canCreate: right.canCreate,
            canEdit: right.canEdit,
            canDelete: right.canDelete,
          });
        } else {
          // Create new right
          await storage.createUserRoleRight({
            roleId,
            module: right.moduleId, // moduleId from frontend maps to module field
            canView: right.canView,
            canCreate: right.canCreate,
            canEdit: right.canEdit,
            canDelete: right.canDelete,
          });
        }
      }
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: roleId,
        action: "permissions_updated",
        description: `Role permissions updated for ${rights.length} modules`,
        userId: req.user.claims.sub,
      });
      
      // Clear all permission caches since role rights changed
      clearAllPermissionCaches();
      
      res.json({ message: "Role permissions updated successfully" });
    } catch (error) {
      console.error("Error updating role permissions:", error);
      res.status(500).json({ message: "Failed to update role permissions" });
    }
  });

  // =============================================
  // DEPARTMENT ROUTES (admin only for write operations)
  // =============================================

  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("departments:all");
      if (cached) return res.json(cached);
      const departmentsList = await storage.getDepartments();
      setCached("departments:all", departmentsList, 300);
      res.json(departmentsList);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const dept = await storage.getDepartment(req.params.id);
      if (!dept) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(dept);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({ message: "Failed to fetch department" });
    }
  });

  app.post("/api/departments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      
      // Check if department name already exists
      const existingDept = await storage.getDepartmentByName(validatedData.name);
      if (existingDept) {
        return res.status(400).json({ message: "A department with this name already exists" });
      }
      
      const newDept = await storage.createDepartment(validatedData);
      
      await storage.logActivity({
        entityType: "department",
        entityId: newDept.id,
        action: "created",
        description: `New department created: ${newDept.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("departments:");
      res.json(newDept);
    } catch (error: any) {
      console.error("Error creating department:", error);
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "A department with this name already exists" });
      }
      res.status(400).json({ message: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateDepartment(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "department",
        entityId: updated.id,
        action: "updated",
        description: `Department updated: ${updated.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("departments:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(400).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const dept = await storage.getDepartment(req.params.id);
      if (!dept) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await storage.deleteDepartment(req.params.id);
      
      await storage.logActivity({
        entityType: "department",
        entityId: req.params.id,
        action: "deleted",
        description: `Department deleted: ${dept.name}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("departments:");
      res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // =============================================
  // DEPARTMENT HEADS ROUTES (multiple heads per department)
  // =============================================

  // Get all heads for a department
  app.get("/api/departments/:id/heads", isAuthenticated, async (req, res) => {
    try {
      const heads = await storage.getDepartmentHeads(req.params.id);
      res.json(heads);
    } catch (error) {
      console.error("Error fetching department heads:", error);
      res.status(500).json({ message: "Failed to fetch department heads" });
    }
  });

  // Set heads for a department (admin only)
  app.put("/api/departments/:id/heads", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userIds, primaryUserId } = req.body;
      
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds must be an array" });
      }
      
      await storage.setDepartmentHeads(req.params.id, userIds, primaryUserId);
      
      const dept = await storage.getDepartment(req.params.id);
      
      await storage.logActivity({
        entityType: "department",
        entityId: req.params.id,
        action: "heads_updated",
        description: `Department heads updated for: ${dept?.name}. Head count: ${userIds.length}`,
        userId: req.user.claims.sub,
      });
      
      res.json({ message: "Department heads updated successfully" });
    } catch (error) {
      console.error("Error updating department heads:", error);
      res.status(500).json({ message: "Failed to update department heads" });
    }
  });

  // Check if current user is a department head
  app.get("/api/auth/is-department-head", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.isUserDepartmentHead(userId);
      res.json(result);
    } catch (error) {
      console.error("Error checking department head status:", error);
      res.status(500).json({ message: "Failed to check department head status" });
    }
  });

  // =============================================
  // SYSTEM MODULE ROUTES (admin only for write operations)
  // =============================================

  app.get("/api/system-modules", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("system-modules:all");
      if (cached) return res.json(cached);
      const modulesList = await storage.getSystemModules();
      setCached("system-modules:all", modulesList, 600);
      res.json(modulesList);
    } catch (error) {
      console.error("Error fetching system modules:", error);
      res.status(500).json({ message: "Failed to fetch system modules" });
    }
  });

  app.get("/api/system-modules/:id", isAuthenticated, async (req, res) => {
    try {
      const module = await storage.getSystemModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "System module not found" });
      }
      res.json(module);
    } catch (error) {
      console.error("Error fetching system module:", error);
      res.status(500).json({ message: "Failed to fetch system module" });
    }
  });

  app.post("/api/system-modules", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertSystemModuleSchema.parse(req.body);
      const newModule = await storage.createSystemModule(validatedData);
      
      await storage.logActivity({
        entityType: "system_module",
        entityId: newModule.id,
        action: "created",
        description: `New system module created: ${newModule.displayName}`,
        userId: req.user.claims.sub,
      });
      
      invalidateCache("modules:all");
      res.json(newModule);
    } catch (error) {
      console.error("Error creating system module:", error);
      res.status(400).json({ message: "Failed to create system module" });
    }
  });

  app.patch("/api/system-modules/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateSystemModule(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "system_module",
        entityId: updated.id,
        action: "updated",
        description: `System module updated: ${updated.displayName}`,
        userId: req.user.claims.sub,
      });
      
      invalidateCache("modules:all");
      res.json(updated);
    } catch (error) {
      console.error("Error updating system module:", error);
      res.status(400).json({ message: "Failed to update system module" });
    }
  });

  app.delete("/api/system-modules/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const module = await storage.getSystemModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "System module not found" });
      }
      
      await storage.deleteSystemModule(req.params.id);
      
      await storage.logActivity({
        entityType: "system_module",
        entityId: req.params.id,
        action: "deleted",
        description: `System module deleted: ${module.displayName}`,
        userId: req.user.claims.sub,
      });
      
      invalidateCache("modules:all");
      res.json({ message: "System module deleted successfully" });
    } catch (error) {
      console.error("Error deleting system module:", error);
      res.status(500).json({ message: "Failed to delete system module" });
    }
  });

  // Seed/Sync system modules from manifest (admin only)
  // This now uses the same sync function as server startup for consistency
  app.post("/api/system-modules/seed", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const syncResult = await storage.syncSystemModulesFromManifest();
      
      if (syncResult.created > 0 || syncResult.updated > 0) {
        await storage.logActivity({
          entityType: "system_module",
          entityId: "sync",
          action: "synced",
          description: `System modules synced: ${syncResult.created} created, ${syncResult.updated} updated`,
          userId: req.user.claims.sub,
        });
      }
      
      res.json({ 
        message: `Created ${syncResult.created} new modules, updated ${syncResult.updated} existing modules`,
        created: syncResult.created,
        updated: syncResult.updated
      });
    } catch (error) {
      console.error("Error syncing system modules:", error);
      res.status(500).json({ message: "Failed to sync system modules" });
    }
  });

  // =============================================
  // USER ROLE ASSIGNMENT ROUTES (admin only for write operations)
  // =============================================

  app.get("/api/user-role-assignments", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.query;
      const assignments = await storage.getUserRoleAssignments(userId as string);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user role assignments:", error);
      res.status(500).json({ message: "Failed to fetch user role assignments" });
    }
  });

  app.get("/api/user-role-assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const assignment = await storage.getUserRoleAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      console.error("Error fetching user role assignment:", error);
      res.status(500).json({ message: "Failed to fetch user role assignment" });
    }
  });

  app.post("/api/user-role-assignments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertUserRoleAssignmentSchema.parse(req.body);
      
      // Record the previous role if this is a role change
      const existingAssignments = await storage.getUserRoleAssignments(validatedData.userId);
      const previousPrimaryRole = existingAssignments.find(a => a.isPrimary);
      
      const newAssignment = await storage.assignRoleToUser({
        ...validatedData,
        assignedBy: req.user.claims.sub,
      });
      
      // If this is a primary role change, create history record
      if (validatedData.isPrimary && previousPrimaryRole && previousPrimaryRole.roleId !== validatedData.roleId) {
        await storage.createRoleChangeHistory({
          userId: validatedData.userId,
          previousRoleId: previousPrimaryRole.roleId,
          newRoleId: validatedData.roleId,
          changedBy: req.user.claims.sub,
          reason: req.body.reason || "Role assignment",
        });
        
        // Deactivate previous primary role
        await storage.removeRoleFromUser(previousPrimaryRole.id);
      }
      
      const role = await storage.getUserRole(validatedData.roleId);
      await storage.logActivity({
        entityType: "user_role_assignment",
        entityId: newAssignment.id,
        action: "created",
        description: `Role ${role?.displayName} assigned to user`,
        userId: req.user.claims.sub,
      });
      
      // Clear permission cache for the affected user
      clearPermissionCache(validatedData.userId);
      
      res.json(newAssignment);
    } catch (error) {
      console.error("Error assigning role to user:", error);
      res.status(400).json({ message: "Failed to assign role to user" });
    }
  });

  app.delete("/api/user-role-assignments/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const assignment = await storage.getUserRoleAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      
      await storage.removeRoleFromUser(req.params.id);
      
      const role = await storage.getUserRole(assignment.roleId);
      await storage.logActivity({
        entityType: "user_role_assignment",
        entityId: req.params.id,
        action: "deleted",
        description: `Role ${role?.displayName} removed from user`,
        userId: req.user.claims.sub,
      });
      
      // Clear permission cache for the affected user
      clearPermissionCache(assignment.userId);
      
      res.json({ message: "Role removed from user successfully" });
    } catch (error) {
      console.error("Error removing role from user:", error);
      res.status(500).json({ message: "Failed to remove role from user" });
    }
  });

  // Get user with all assigned roles and effective permissions
  app.get("/api/users/:id/roles", isAuthenticated, async (req, res) => {
    try {
      const userWithRoles = await storage.getUserWithRoles(req.params.id);
      if (!userWithRoles) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(userWithRoles);
    } catch (error) {
      console.error("Error fetching user with roles:", error);
      res.status(500).json({ message: "Failed to fetch user with roles" });
    }
  });

  // =============================================
  // ROLE CHANGE HISTORY ROUTES
  // =============================================

  app.get("/api/role-change-history", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.query;
      const history = await storage.getRoleChangeHistory(userId as string);
      res.json(history);
    } catch (error) {
      console.error("Error fetching role change history:", error);
      res.status(500).json({ message: "Failed to fetch role change history" });
    }
  });

  // =============================================
  // USER MODULE PERMISSION ROUTES
  // =============================================

  app.get("/api/user-module-permissions", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      const permissions = await storage.getUserModulePermissions(userId as string);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user module permissions:", error);
      res.status(500).json({ message: "Failed to fetch user module permissions" });
    }
  });

  app.get("/api/user-module-permissions/:id", isAuthenticated, async (req, res) => {
    try {
      const permission = await storage.getUserModulePermission(req.params.id);
      if (!permission) {
        return res.status(404).json({ message: "User module permission not found" });
      }
      res.json(permission);
    } catch (error) {
      console.error("Error fetching user module permission:", error);
      res.status(500).json({ message: "Failed to fetch user module permission" });
    }
  });

  app.post("/api/user-module-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertUserModulePermissionSchema.parse(req.body);
      const newPermission = await storage.setUserModulePermission(validatedData);
      
      const module = await storage.getSystemModule(validatedData.moduleId);
      await storage.logActivity({
        entityType: "user_module_permission",
        entityId: newPermission.id,
        action: "created",
        description: `Permission set for module: ${module?.displayName}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newPermission);
    } catch (error) {
      console.error("Error setting user module permission:", error);
      res.status(400).json({ message: "Failed to set user module permission" });
    }
  });

  app.patch("/api/user-module-permissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateUserModulePermission(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "user_module_permission",
        entityId: updated.id,
        action: "updated",
        description: `User module permission updated`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating user module permission:", error);
      res.status(400).json({ message: "Failed to update user module permission" });
    }
  });

  app.delete("/api/user-module-permissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const permission = await storage.getUserModulePermission(req.params.id);
      if (!permission) {
        return res.status(404).json({ message: "User module permission not found" });
      }
      
      await storage.deleteUserModulePermission(req.params.id);
      
      await storage.logActivity({
        entityType: "user_module_permission",
        entityId: req.params.id,
        action: "deleted",
        description: `User module permission deleted`,
        userId: req.user.claims.sub,
      });
      
      res.json({ message: "User module permission deleted successfully" });
    } catch (error) {
      console.error("Error deleting user module permission:", error);
      res.status(500).json({ message: "Failed to delete user module permission" });
    }
  });

  // Get user's effective permissions (combined from roles and individual overrides)
  app.get("/api/users/:id/effective-permissions", isAuthenticated, async (req, res) => {
    try {
      const permissions = await storage.getUserEffectivePermissions(req.params.id);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user effective permissions:", error);
      res.status(500).json({ message: "Failed to fetch user effective permissions" });
    }
  });

  // Get role with all its rights
  app.get("/api/user-roles/:id/rights", isAuthenticated, async (req, res) => {
    try {
      const roleWithRights = await storage.getRoleWithRights(req.params.id);
      if (!roleWithRights) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(roleWithRights);
    } catch (error) {
      console.error("Error fetching role with rights:", error);
      res.status(500).json({ message: "Failed to fetch role with rights" });
    }
  });

  // =============================================
  // END MASTER DATA ROUTES
  // =============================================

  // Sales Dashboard Stats - Returns follow-ups for Today's Calls feature
  app.get("/api/sales-dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Get access control for the user
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      // Get only the most recent follow-up per lead using a window function
      // Exclude closed deals (closed_won, closed_lost) as they don't need follow-up calls
      const followUpsWithLeads = await db.execute(sql`
        WITH ranked_followups AS (
          SELECT 
            f.id,
            f.lead_id as "leadId",
            f.notes,
            f.follow_up_date as "followUpDate",
            f.completed,
            f.created_at as "createdAt",
            l.company_name as "leadCompanyName",
            l.contact_person as "leadContactPerson",
            l.contact_phone as "leadContactPhone",
            l.stage as "leadStage",
            l.sales_executive_id as "salesExecutiveId",
            ROW_NUMBER() OVER (PARTITION BY f.lead_id ORDER BY f.follow_up_date DESC) as rn
          FROM follow_ups f
          LEFT JOIN leads l ON f.lead_id = l.id
          WHERE (l.stage NOT IN ('closed_won', 'closed_lost') OR l.stage IS NULL)
            AND (l.interest_status IS NULL OR l.interest_status != 'not_interested')
        )
        SELECT id, "leadId", notes, "followUpDate", completed, "createdAt",
               "leadCompanyName", "leadContactPerson", "leadContactPhone", "leadStage", "salesExecutiveId"
        FROM ranked_followups
        WHERE rn = 1
        ORDER BY "followUpDate" DESC
      `);
      
      // Filter by access control
      const enrichedFollowUps = (followUpsWithLeads.rows as any[]).filter(followUp => {
        // Super admin, admin, or department heads have full access
        if (accessControl.hasFullAccess) return true;
        if (accessControl.allowedUserIds) {
          return accessControl.allowedUserIds.includes(followUp.salesExecutiveId || '');
        }
        return followUp.salesExecutiveId === currentUser.id;
      });
      
      res.json({
        followUps: enrichedFollowUps,
      });
    } catch (error) {
      console.error("Error fetching sales dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch sales dashboard stats" });
    }
  });

  // =============================================
  // SALES PLANNING AND PERFORMANCE ROUTES
  // =============================================

  // Get sales plans (weekly stage targets)
  app.get("/api/sales-plans", isAuthenticated, async (req: any, res) => {
    try {
      const { month, userId } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      // Build filters based on access control
      const filters: { userId?: string; month?: string; userIds?: string[] } = {
        month: month as string,
      };
      
      if (userId && accessControl.hasFullAccess) {
        filters.userId = userId as string;
      } else if (!accessControl.hasFullAccess) {
        filters.userId = currentUser.id;
      }
      
      const plans = await storage.getSalesPlans(filters);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching sales plans:", error);
      res.status(500).json({ message: "Failed to fetch sales plans" });
    }
  });

  // Upsert sales plan
  app.post("/api/sales-plans", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Validate request body
      const parseResult = insertSalesPlanSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.errors });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const planData = parseResult.data;
      
      // Check if user can create plan for the target user
      if (planData.userId !== currentUser.id && !accessControl.hasFullAccess) {
        return res.status(403).json({ message: "You can only create plans for yourself" });
      }
      
      // For department heads (not super admin), verify the target user is in their department
      if (accessControl.hasFullAccess && accessControl.allowedUserIds && planData.userId !== currentUser.id) {
        if (!accessControl.allowedUserIds.includes(planData.userId)) {
          return res.status(403).json({ message: "You can only create plans for users in your department" });
        }
      }
      
      const plan = await storage.upsertSalesPlan(planData);
      
      await storage.logActivity({
        entityType: "sales_plan",
        entityId: plan.id,
        action: "upserted",
        description: `Sales plan updated for ${plan.month} week ${plan.weekNumber} stage ${plan.stage}`,
        userId: currentUser.id,
      });
      
      res.json(plan);
    } catch (error) {
      console.error("Error upserting sales plan:", error);
      res.status(500).json({ message: "Failed to save sales plan" });
    }
  });

  // Batch upsert sales plans
  app.post("/api/sales-plans/batch", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const { plans } = req.body;
      
      if (!Array.isArray(plans)) {
        return res.status(400).json({ message: "plans must be an array" });
      }
      
      const results = [];
      for (const planData of plans) {
        // Validate each plan
        const parseResult = insertSalesPlanSchema.safeParse(planData);
        if (!parseResult.success) {
          continue; // Skip invalid plans
        }
        
        const validPlan = parseResult.data;
        
        // Check permission for each plan
        if (validPlan.userId !== currentUser.id && !accessControl.hasFullAccess) {
          continue;
        }
        
        // For department heads, verify target user is in their department
        if (accessControl.hasFullAccess && accessControl.allowedUserIds && validPlan.userId !== currentUser.id) {
          if (!accessControl.allowedUserIds.includes(validPlan.userId)) {
            continue;
          }
        }
        
        const plan = await storage.upsertSalesPlan(validPlan);
        results.push(plan);
      }
      
      await storage.logActivity({
        entityType: "sales_plan",
        entityId: "batch",
        action: "batch_upserted",
        description: `${results.length} sales plans updated`,
        userId: currentUser.id,
      });
      
      res.json(results);
    } catch (error) {
      console.error("Error batch upserting sales plans:", error);
      res.status(500).json({ message: "Failed to save sales plans" });
    }
  });

  // Delete sales plan
  app.delete("/api/sales-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const plan = await storage.getSalesPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Sales plan not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      if (plan.userId !== currentUser.id && !accessControl.hasFullAccess) {
        return res.status(403).json({ message: "You can only delete your own plans" });
      }
      
      await storage.deleteSalesPlan(req.params.id);
      res.json({ message: "Sales plan deleted" });
    } catch (error) {
      console.error("Error deleting sales plan:", error);
      res.status(500).json({ message: "Failed to delete sales plan" });
    }
  });

  // Get monthly targets
  app.get("/api/sales-monthly-targets", isAuthenticated, async (req: any, res) => {
    try {
      const { month, userId } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      const filters: { userId?: string; month?: string; userIds?: string[] } = {
        month: month as string,
      };
      
      if (userId && accessControl.hasFullAccess) {
        filters.userId = userId as string;
      } else if (!accessControl.hasFullAccess) {
        filters.userId = currentUser.id;
      }
      
      const targets = await storage.getSalesMonthlyTargets(filters);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching monthly targets:", error);
      res.status(500).json({ message: "Failed to fetch monthly targets" });
    }
  });

  // Upsert monthly target
  app.post("/api/sales-monthly-targets", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Validate request body
      const parseResult = insertSalesMonthlyTargetSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.errors });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const targetData = { ...parseResult.data, createdById: currentUser.id };
      
      if (targetData.userId !== currentUser.id && !accessControl.hasFullAccess) {
        return res.status(403).json({ message: "You can only set targets for yourself" });
      }
      
      // For department heads, verify target user is in their department
      if (accessControl.hasFullAccess && accessControl.allowedUserIds && targetData.userId !== currentUser.id) {
        if (!accessControl.allowedUserIds.includes(targetData.userId)) {
          return res.status(403).json({ message: "You can only set targets for users in your department" });
        }
      }
      
      const target = await storage.upsertSalesMonthlyTarget(targetData);
      
      await storage.logActivity({
        entityType: "sales_monthly_target",
        entityId: target.id,
        action: "upserted",
        description: `Monthly target updated for ${target.month}`,
        userId: currentUser.id,
      });
      
      res.json(target);
    } catch (error) {
      console.error("Error upserting monthly target:", error);
      res.status(500).json({ message: "Failed to save monthly target" });
    }
  });

  // Get sales performance (achievements, comparison, prediction)
  app.get("/api/sales-performance", isAuthenticated, async (req: any, res) => {
    try {
      const { month, userId } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      const filters: { userId?: string; userIds?: string[]; month?: string } = {
        month: month as string || new Date().toISOString().substring(0, 7),
      };
      
      if (userId && accessControl.hasFullAccess) {
        filters.userId = userId as string;
      } else if (!accessControl.hasFullAccess) {
        filters.userId = currentUser.id;
      }
      
      const performance = await storage.getSalesPerformance(filters);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching sales performance:", error);
      res.status(500).json({ message: "Failed to fetch sales performance" });
    }
  });

  // Get team comparison (for department heads and admins)
  app.get("/api/sales-performance/compare", isAuthenticated, async (req: any, res) => {
    try {
      const { month } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      if (!accessControl.hasFullAccess) {
        return res.status(403).json({ message: "Only department heads and admins can view team comparison" });
      }
      
      const targetMonth = month as string || new Date().toISOString().substring(0, 7);
      
      // Get all sales executives in the department or all (for super admin)
      const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser.role === "admin";
      
      let salesUsers: User[] = [];
      if (isSuperAdmin || isAdmin) {
        // Get all sales executives
        salesUsers = await storage.getUsersByRole("sales_executive");
        // Also include sales heads
        const salesHeads = await storage.getUsersByRole("sales_head");
        salesUsers = [...salesUsers, ...salesHeads];
      } else {
        // Get users from managed departments
        const managedDepts = await storage.getDepartmentsByHead(currentUser.id);
        for (const dept of managedDepts) {
          const deptUsers = await storage.getUsersByDepartment(dept.id);
          salesUsers = [...salesUsers, ...deptUsers];
        }
      }
      
      // Get performance for each user
      const comparison = await Promise.all(
        salesUsers.map(async (user) => {
          const performance = await storage.getSalesPerformance({
            userId: user.id,
            month: targetMonth,
          });
          
          // Calculate totals
          const totalTargetQty = performance.plans.reduce((sum, p) => sum + (p.targetQty || 0), 0);
          const totalTargetValue = performance.plans.reduce((sum, p) => sum + (p.targetValue || 0), 0);
          const totalAchievedQty = performance.achievements.reduce((sum, a) => sum + a.qty, 0);
          const totalAchievedValue = performance.achievements.reduce((sum, a) => sum + a.value, 0);
          
          return {
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            userEmail: user.email,
            targetQty: performance.monthlyTarget?.targetQtyTotal || totalTargetQty,
            targetValue: performance.monthlyTarget?.targetValueTotal || totalTargetValue,
            achievedQty: totalAchievedQty,
            achievedValue: totalAchievedValue,
            achievementPercentQty: totalTargetQty > 0 ? Math.round((totalAchievedQty / totalTargetQty) * 100) : 0,
            achievementPercentValue: totalTargetValue > 0 ? Math.round((totalAchievedValue / totalTargetValue) * 100) : 0,
            prediction: performance.prediction,
          };
        })
      );
      
      // Sort by achievement percentage descending
      comparison.sort((a, b) => b.achievementPercentValue - a.achievementPercentValue);
      
      res.json({
        month: targetMonth,
        comparison,
      });
    } catch (error) {
      console.error("Error fetching team comparison:", error);
      res.status(500).json({ message: "Failed to fetch team comparison" });
    }
  });

  // Check if user has completed monthly planning (mandatory check)
  app.get("/api/sales-planning/status", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, month } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const targetUserId = userId && accessControl.hasFullAccess ? userId as string : currentUser.id;
      
      const status = await storage.hasCompletedMonthlyPlanning(targetUserId, month as string);
      res.json(status);
    } catch (error) {
      console.error("Error checking planning status:", error);
      res.status(500).json({ message: "Failed to check planning status" });
    }
  });

  // Get monthly comparison (individual or team)
  app.get("/api/sales-performance/monthly-comparison", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, monthCount } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const targetUserId = userId && accessControl.hasFullAccess ? userId as string : currentUser.id;
      
      // Generate last N months (default 6)
      const count = parseInt(monthCount as string) || 6;
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toISOString().substring(0, 7));
      }
      
      const comparison = await storage.getMonthlyComparison({
        userId: targetUserId,
        months,
      });
      
      res.json({ userId: targetUserId, comparison });
    } catch (error) {
      console.error("Error fetching monthly comparison:", error);
      res.status(500).json({ message: "Failed to fetch monthly comparison" });
    }
  });

  // Get team monthly comparison (for department heads and admins)
  app.get("/api/sales-performance/team-monthly-comparison", isAuthenticated, async (req: any, res) => {
    try {
      const { monthCount } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      if (!accessControl.hasFullAccess) {
        return res.status(403).json({ message: "Only department heads and admins can view team comparison" });
      }
      
      // Generate last N months (default 6)
      const count = parseInt(monthCount as string) || 6;
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toISOString().substring(0, 7));
      }
      
      // Get all sales users
      const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser.role === "admin";
      
      let salesUsers: User[] = [];
      if (isSuperAdmin || isAdmin) {
        salesUsers = await storage.getUsersByRole("sales_executive");
        const salesHeads = await storage.getUsersByRole("sales_head");
        salesUsers = [...salesUsers, ...salesHeads];
      } else {
        const managedDepts = await storage.getDepartmentsByHead(currentUser.id);
        for (const dept of managedDepts) {
          const deptUsers = await storage.getUsersByDepartment(dept.id);
          salesUsers = [...salesUsers, ...deptUsers];
        }
      }
      
      // Get monthly comparison for each user
      const teamComparison = await Promise.all(
        salesUsers.map(async (user) => {
          const comparison = await storage.getMonthlyComparison({
            userId: user.id,
            months,
          });
          return {
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            userEmail: user.email,
            monthlyData: comparison,
          };
        })
      );
      
      // Also get team totals for each month
      const teamTotals = await Promise.all(
        months.map(async (month) => {
          let totalTargetQty = 0;
          let totalTargetValue = 0;
          let totalAchievedQty = 0;
          let totalAchievedValue = 0;
          
          for (const user of salesUsers) {
            const performance = await storage.getSalesPerformance({ userId: user.id, month });
            const targetQty = performance.monthlyTarget?.targetQtyTotal || 
              performance.plans.reduce((sum, p) => sum + (p.targetQty || 0), 0);
            const targetValue = performance.monthlyTarget?.targetValueTotal || 
              performance.plans.reduce((sum, p) => sum + (p.targetValue || 0), 0);
            const achievedQty = performance.achievements.reduce((sum, a) => sum + a.qty, 0);
            const achievedValue = performance.achievements.reduce((sum, a) => sum + a.value, 0);
            
            totalTargetQty += targetQty;
            totalTargetValue += targetValue;
            totalAchievedQty += achievedQty;
            totalAchievedValue += achievedValue;
          }
          
          return {
            month,
            targetQty: totalTargetQty,
            targetValue: totalTargetValue,
            achievedQty: totalAchievedQty,
            achievedValue: totalAchievedValue,
            achievementPercentQty: totalTargetQty > 0 ? Math.round((totalAchievedQty / totalTargetQty) * 100) : 0,
            achievementPercentValue: totalTargetValue > 0 ? Math.round((totalAchievedValue / totalTargetValue) * 100) : 0,
          };
        })
      );
      
      res.json({ 
        months,
        teamComparison,
        teamTotals,
      });
    } catch (error) {
      console.error("Error fetching team monthly comparison:", error);
      res.status(500).json({ message: "Failed to fetch team monthly comparison" });
    }
  });

  // Get 25th-to-25th cycle progress for motivational dashboard
  app.get("/api/sales-performance/cycle-progress", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const targetUserId = userId && accessControl.hasFullAccess ? userId as string : currentUser.id;
      
      // Calculate current 25th-to-25th cycle
      const now = new Date();
      const currentDay = now.getDate();
      let cycleStart: Date;
      let cycleEnd: Date;
      
      if (currentDay >= 25) {
        // We're in the cycle that started this month's 25th
        cycleStart = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0);
        cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 24, 23, 59, 59, 999);
      } else {
        // We're in the cycle that started last month's 25th
        cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 25, 0, 0, 0, 0);
        cycleEnd = new Date(now.getFullYear(), now.getMonth(), 24, 23, 59, 59, 999);
      }
      
      // Get all closed won leads for this user within the cycle
      const allLeads = await storage.getLeads({ salesExecutiveId: targetUserId });
      const cycleLeads = allLeads.filter(l => {
        if (l.stage !== 'closed_won' || !l.closedDate) return false;
        const closedDate = new Date(l.closedDate);
        return closedDate >= cycleStart && closedDate <= cycleEnd;
      });
      
      // Sum up advance amounts
      const totalAdvance = cycleLeads.reduce((sum, l) => sum + ((l as any).advanceAmount || 0), 0);
      const totalOrderValue = cycleLeads.reduce((sum, l) => sum + (l.confirmedOrderValue || 0), 0);
      const dealsWon = cycleLeads.length;
      
      // Get the monthly target - use the cycle start month for target
      const cycleMonth = cycleStart.toISOString().substring(0, 7);
      const performance = await storage.getSalesPerformance({ userId: targetUserId, month: cycleMonth });
      const targetValue = performance.monthlyTarget?.targetValueTotal || 
        performance.plans.reduce((sum, p) => sum + (p.targetValue || 0), 0);
      
      // Calculate days in cycle and days remaining
      const totalDaysInCycle = Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysElapsed = Math.ceil((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, totalDaysInCycle - daysElapsed);
      
      // Calculate progress percentage
      const progressPercent = targetValue > 0 ? Math.min(100, Math.round((totalAdvance / targetValue) * 100)) : 0;
      
      // Calculate run rate and predicted achievement
      const dailyRate = daysElapsed > 0 ? totalAdvance / daysElapsed : 0;
      const predictedTotal = dailyRate * totalDaysInCycle;
      const predictedPercent = targetValue > 0 ? Math.min(200, Math.round((predictedTotal / targetValue) * 100)) : 0;
      
      // Generate motivational message
      let motivationalMessage = "";
      let status: "on_track" | "ahead" | "behind" | "no_target" = "no_target";
      
      if (targetValue > 0) {
        const expectedProgress = (daysElapsed / totalDaysInCycle) * 100;
        if (progressPercent >= 100) {
          status = "ahead";
          motivationalMessage = "Congratulations! You've exceeded your target! Keep the momentum going!";
        } else if (progressPercent >= expectedProgress) {
          status = "on_track";
          const gap = progressPercent - expectedProgress;
          if (gap > 10) {
            motivationalMessage = "Excellent! You're ahead of schedule! You're on fire!";
          } else {
            motivationalMessage = "Good progress! You're on track to meet your target. Keep it up!";
          }
        } else {
          status = "behind";
          const gap = expectedProgress - progressPercent;
          const amountNeeded = targetValue - totalAdvance;
          if (gap > 30) {
            motivationalMessage = `Push harder! You need ${amountNeeded.toLocaleString()} more in ${daysRemaining} days. Every call counts!`;
          } else {
            motivationalMessage = `Almost there! Just ${amountNeeded.toLocaleString()} more to reach your target. You can do it!`;
          }
        }
      } else {
        motivationalMessage = "Set your monthly target in Sales Planning to track your progress!";
      }
      
      res.json({
        cycleStart: cycleStart.toISOString(),
        cycleEnd: cycleEnd.toISOString(),
        totalAdvance,
        totalOrderValue,
        dealsWon,
        targetValue,
        progressPercent,
        daysRemaining,
        daysElapsed,
        totalDaysInCycle,
        dailyRate: Math.round(dailyRate),
        predictedTotal: Math.round(predictedTotal),
        predictedPercent,
        status,
        motivationalMessage,
        cycleMonth,
      });
    } catch (error) {
      console.error("Error fetching cycle progress:", error);
      res.status(500).json({ message: "Failed to fetch cycle progress" });
    }
  });

  // Lead routes
  app.get("/api/leads", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const { stage, salesExecutiveId, search, city, area, leadSource, fromDate, toDate, page, pageSize } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;

      const currentUser = await storage.getUser(authId);
      if (!currentUser) return res.status(401).json({ message: "User not found" });

      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const cachePrefix = accessControl.hasFullAccess ? 'shared' : authId;
      const cacheKey = `leads:list:${cachePrefix}:${stage||''}:${salesExecutiveId||''}:${search||''}:${city||''}:${area||''}:${leadSource||''}:${fromDate||''}:${toDate||''}:${page||1}:${pageSize||50}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);
      const userFilter = filterAllowedUserId(accessControl, salesExecutiveId as string);

      const result = await storage.getLeadsPaginated({
        stage: stage as string || undefined,
        salesExecutiveId: userFilter.userId,
        salesExecutiveIds: userFilter.userIds,
        search: search as string || undefined,
        city: city && city !== "all" ? city as string : undefined,
        area: area && area !== "all" ? area as string : undefined,
        leadSource: leadSource && leadSource !== "all" ? leadSource as string : undefined,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
      });

      setCached(cacheKey, result, 600);
      res.json(result);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Distinct filter options (cities, areas, lead sources) for dropdown population
  app.get("/api/leads/filter-options", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const cacheKey = "leads:filter-options";
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const [cities, areas, sources] = await Promise.all([
        db.selectDistinct({ city: leads.city }).from(leads).where(isNotNull(leads.city)).orderBy(leads.city),
        db.selectDistinct({ area: leads.area }).from(leads).where(isNotNull(leads.area)).orderBy(leads.area),
        db.selectDistinct({ leadSource: leads.leadSource, customLeadSource: leads.customLeadSource }).from(leads).where(isNotNull(leads.leadSource)),
      ]);

      const result = {
        cities: cities.map(r => r.city).filter(Boolean),
        areas: areas.map(r => r.area).filter(Boolean),
        leadSources: [...new Set(sources.map(r =>
          r.leadSource === "other" && r.customLeadSource ? r.customLeadSource.trim() : r.leadSource?.trim()
        ).filter(Boolean))].sort(),
      };

      setCached(cacheKey, result, 120); // cache for 2 minutes
      res.json(result);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Kanban-optimised endpoint: max 50 per stage + real total counts via parallel COUNT queries
  app.get("/api/leads/kanban", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const { search, city, area, leadSource, salesExecutiveId, stageLimit } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;

      const currentUser = await storage.getUser(authId);
      if (!currentUser) return res.status(401).json({ message: "User not found" });

      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const kanbanCachePrefix = accessControl.hasFullAccess ? 'shared' : authId;
      const cacheKey = `leads:kanban:${kanbanCachePrefix}:${search||''}:${city||''}:${area||''}:${leadSource||''}:${salesExecutiveId||''}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);
      const userFilter = filterAllowedUserId(accessControl, salesExecutiveId as string);

      const result = await storage.getLeadsKanban({
        search: search as string || undefined,
        city: city && city !== "all" ? city as string : undefined,
        area: area && area !== "all" ? area as string : undefined,
        leadSource: leadSource && leadSource !== "all" ? leadSource as string : undefined,
        salesExecutiveId: userFilter.userId,
        salesExecutiveIds: userFilter.userIds,
        stageLimit: stageLimit ? parseInt(stageLimit as string) : 50,
      });

      setCached(cacheKey, result, 600);
      res.json(result);
    } catch (error) {
      console.error("Error fetching kanban leads:", error);
      res.status(500).json({ message: "Failed to fetch kanban data" });
    }
  });

  // Load more for a specific stage
  app.get("/api/leads/stage", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const { stage, search, city, area, leadSource, salesExecutiveId, limit = "50", offset = "0" } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      if (!currentUser) return res.status(401).json({ message: "User not found" });

      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const userFilter = filterAllowedUserId(accessControl, salesExecutiveId as string);

      const result = await storage.getLeads({
        stage: stage as string,
        salesExecutiveId: userFilter.userId,
        salesExecutiveIds: userFilter.userIds,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        search: search as string || undefined,
        city: city && city !== "all" ? city as string : undefined,
        area: area && area !== "all" ? area as string : undefined,
        leadSource: leadSource && leadSource !== "all" ? leadSource as string : undefined,
      } as any);

      res.json(result);
    } catch (error) {
      console.error("Error fetching stage leads:", error);
      res.status(500).json({ message: "Failed to fetch stage leads" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check access control
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;
      const isAdminRole = currentUser.role === "admin";
      
      // Super admin and admin can access all leads
      if (!isSuperAdmin && !isAdminRole) {
        // Check if lead is assigned to the user
        if (lead.salesExecutiveId !== currentUserId) {
          // Check if user is a department manager and the lead's assignee is in their department
          const managedDepartments = await storage.getDepartmentsByHead(currentUserId);
          
          let hasAccess = false;
          if (managedDepartments.length > 0 && lead.salesExecutiveId) {
            const leadAssignee = await storage.getUser(lead.salesExecutiveId);
            if (leadAssignee && leadAssignee.departmentId) {
              for (const dept of managedDepartments) {
                if (leadAssignee.departmentId === dept.id) {
                  hasAccess = true;
                  break;
                }
              }
            }
          }
          
          if (!hasAccess) {
            return res.status(403).json({ message: "You do not have access to this lead" });
          }
        }
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const authId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Check mandatory planning requirement for sales executives
      if (currentUser.role === "sales_executive" || currentUser.role === "sales_head") {
        const planningStatus = await storage.hasCompletedMonthlyPlanning(currentUser.id);
        if (!planningStatus.hasPlanned) {
          return res.status(403).json({ 
            message: planningStatus.message,
            code: "PLANNING_REQUIRED",
            redirectTo: "/sales-planning"
          });
        }
      }
      
      let leadData = { ...req.body };
      
      // Auto-assignment if not specified - use configurable assignment settings
      if (!leadData.salesExecutiveId) {
        const nextUser = await storage.getNextAssignableUser("leads");
        if (nextUser) {
          leadData.salesExecutiveId = nextUser.id;
          await storage.updateLastAssignedUser("leads", nextUser.id);
        }
      }
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changedById: req.user.claims.sub,
        changeReason: 'Lead created by user',
      });
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "created",
        description: `New lead created: ${newLead.companyName}`,
        userId: req.user.claims.sub,
      });

      // Invalidate list/filter caches so next load reflects new lead
      invalidateCache("leads:list:");
      invalidateCache("leads:filter-options");
      
      res.json(newLead);
    } catch (error: any) {
      console.error("Error creating lead:", error);
      const message = error?.errors?.[0]?.message || error?.message || "Failed to create lead";
      res.status(400).json({ message, details: error?.errors || error?.message });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, requirePermission('leads', 'edit'), async (req: any, res) => {
    try {
      let updateData = { ...req.body };
      
      // Convert date strings to Date objects
      if (updateData.demoDate) {
        updateData.demoDate = new Date(updateData.demoDate);
      }
      if (updateData.quoteSentDate) {
        updateData.quoteSentDate = new Date(updateData.quoteSentDate);
      }
      if (updateData.negotiationDate) {
        updateData.negotiationDate = new Date(updateData.negotiationDate);
      }
      if (updateData.closedDate) {
        updateData.closedDate = new Date(updateData.closedDate);
      }
      
      // Get current lead to check stage
      const currentLead = await storage.getLead(req.params.id);
      
      let activityAction = "updated";
      let activityDescription = "";
      
      // Auto-transition to demo_scheduled when demo date is set and lead is in seed/lead stage
      if (updateData.demoDate && currentLead && (currentLead.stage === "seed" || currentLead.stage === "lead")) {
        updateData.stage = "demo_scheduled";
        activityAction = "demo_scheduled";
        activityDescription = `Demo scheduled for ${currentLead.companyName} on ${new Date(updateData.demoDate).toLocaleString()}`;
      }
      
      // Track demo date changes in history
      if (updateData.demoDate && currentLead) {
        await storage.createDemoDateHistory({
          leadId: req.params.id,
          demoDate: updateData.demoDate,
          changedById: req.user.claims.sub,
          changeReason: currentLead.demoDate ? "Rescheduled" : "Initial scheduling",
        });
      }
      
      // Auto-transition to quote_sent when quote is sent
      if (updateData.quoteSentDate && currentLead && 
          (currentLead.stage === "demo_scheduled" || currentLead.stage === "seed" || currentLead.stage === "lead")) {
        updateData.stage = "quote_sent";
        activityAction = "quote_sent";
        const modulesList = updateData.selectedModules?.join(", ") || "No modules";
        activityDescription = `Quote sent to ${currentLead.companyName} - Value: $${updateData.quoteValue?.toLocaleString() || 0} - Modules: ${modulesList}`;
      }
      
      // Auto-transition to negotiation when negotiation date is set
      if (updateData.negotiationDate && currentLead && 
          (currentLead.stage === "quote_sent" || currentLead.stage === "demo_scheduled")) {
        updateData.stage = "negotiation";
        activityAction = "negotiation_started";
        activityDescription = `Negotiation started with ${currentLead.companyName} on ${new Date(updateData.negotiationDate).toLocaleString()}`;
      }
      
      // Track negotiation date changes in history
      if (updateData.negotiationDate && currentLead) {
        await storage.createNegotiationDateHistory({
          leadId: req.params.id,
          negotiationDate: updateData.negotiationDate,
          changedById: req.user.claims.sub,
          notes: currentLead.negotiationDate ? "Follow-up negotiation" : "Initial negotiation",
        });
      }
      
      // Track stage changes in history
      if (updateData.stage && currentLead && updateData.stage !== currentLead.stage) {
        const stageLabels: Record<string, string> = {
          seed: "Seed",
          lead: "Lead",
          demo_scheduled: "Demo Scheduled",
          quote_sent: "Quote Sent",
          negotiation: "Negotiation",
          closed_won: "Closed Won",
          closed_lost: "Closed Lost",
        };
        const fromLabel = stageLabels[currentLead.stage] || currentLead.stage;
        const toLabel = stageLabels[updateData.stage] || updateData.stage;
        
        await storage.createLeadStageHistory({
          leadId: req.params.id,
          fromStage: currentLead.stage,
          toStage: updateData.stage,
          changedById: req.user.claims.sub,
          changeReason: `Stage changed from ${fromLabel} to ${toLabel}`,
        });
      }
      
      // Handle deal closure (won or lost)
      if (updateData.closedDate && updateData.stage) {
        if (updateData.stage === "closed_won") {
          if (!updateData.confirmedOrderValue) {
            return res.status(400).json({ message: "Confirmed order value is required to close the deal" });
          }
          // Server-side validation: advanceAmount is mandatory for won deals
          if (updateData.advanceAmount === undefined || updateData.advanceAmount === null || updateData.advanceAmount <= 0) {
            return res.status(400).json({ message: "Advance amount is required and must be greater than 0 to close the deal as won" });
          }
          activityAction = "deal_won";
          activityDescription = `Deal won with ${currentLead?.companyName} - Confirmed Value: $${updateData.confirmedOrderValue?.toLocaleString()} - Advance: $${updateData.advanceAmount?.toLocaleString()}`;
        } else if (updateData.stage === "closed_lost") {
          activityAction = "deal_lost";
          activityDescription = `Deal lost with ${currentLead?.companyName}${updateData.closedReason ? ` - Reason: ${updateData.closedReason}` : ""}`;
        }
      }
      
      const updated = await storage.updateLead(req.params.id, updateData);
      
      // Auto-create customer record when existing customer flag is set
      if (updateData.isExistingCustomer === true && !currentLead?.isExistingCustomer && !updated.customerId) {
        try {
          // Check if a customer with same name already exists
          const existingCustomers = await storage.getCustomers();
          const existingCustomer = existingCustomers.find(
            c => c.name.toLowerCase().trim() === updated.companyName.toLowerCase().trim()
          );
          
          let customerId: string;
          
          if (existingCustomer) {
            // Link to existing customer
            customerId = existingCustomer.id;
            console.log(`[Existing Customer] Linked seed to existing customer: ${updated.companyName}`);
          } else {
            // Create new customer record
            const newCustomer = await storage.createCustomer({
              name: updated.companyName,
              contactPerson: updated.contactPerson || null,
              email: updated.contactEmail || null,
              phone: updated.contactPhone || null,
              customerType: "customer",
              status: "active",
              selectedModules: updated.selectedModules || [],
            });
            
            customerId = newCustomer.id;
            
            // Log customer creation activity
            await storage.logActivity({
              entityType: "customer",
              entityId: newCustomer.id,
              action: "created",
              description: `Customer auto-created from existing customer seed: ${updated.companyName}`,
              userId: req.user.claims.sub,
            });
            
            console.log(`[Existing Customer] Created customer record from seed: ${updated.companyName}`);
          }
          
          // Link customer to seed
          await storage.updateLead(req.params.id, { customerId });
        } catch (customerError) {
          console.error("[Existing Customer] Error creating/linking customer:", customerError);
          // Don't fail the whole update if customer creation fails
        }
      }
      
      // Handle points for sales executive assignment changes
      if (updateData.salesExecutiveId !== undefined && 
          currentLead && 
          updateData.salesExecutiveId !== currentLead.salesExecutiveId) {
        if (updateData.salesExecutiveId) {
          await handleAssignment({
            module: "leads",
            entityId: req.params.id,
            newAssigneeId: updateData.salesExecutiveId,
            previousAssigneeId: currentLead.salesExecutiveId,
            assignedById: req.user.claims.sub,
          });
        }
      }
      
      // Handle completion bonus for closed_won
      if (updateData.stage === "closed_won" && currentLead?.stage !== "closed_won" && updated.salesExecutiveId) {
        await handleCompletion({
          module: "leads",
          entityId: req.params.id,
          completedById: updated.salesExecutiveId,
        });
      }
      
      // Automatically create customer and implementation project when deal is won
      if (updateData.stage === "closed_won" && currentLead?.stage !== "closed_won") {
        try {
          let customerId = updated.customerId;
          
          // Create customer record if it doesn't exist
          if (!customerId) {
            const newCustomer = await storage.createCustomer({
              name: updated.companyName,
              contactPerson: updated.contactPerson || null,
              email: updated.contactEmail || null,
              phone: updated.contactPhone || null,
              customerType: "customer",
              status: "active",
              selectedModules: updated.selectedModules || [],
            });
            
            customerId = newCustomer.id;
            
            // Link customer to lead
            await storage.updateLead(req.params.id, { customerId });
            
            // Log customer creation activity
            await storage.logActivity({
              entityType: "customer",
              entityId: newCustomer.id,
              action: "created",
              description: `Customer auto-created from won deal: ${updated.companyName}`,
              userId: req.user.claims.sub,
            });
            
            console.log(`[Auto-Customer] Created customer record for won deal: ${updated.companyName}`);
          }
          
          // Check if project already exists for this lead
          const existingProjects = await storage.getProjects();
          const projectExists = existingProjects.some(p => p.leadId === req.params.id);
          
          if (!projectExists) {
            // Create new project from the won lead with customer link
            const projectData = {
              customerId: customerId,
              leadId: updated.id,
              clientName: updated.companyName,
              status: "not_started" as const,
              completionPercentage: 0,
            };
            
            // Get selected modules from the lead
            const selectedModules = updated.selectedModules || [];
            
            const newProject = await storage.createProject(projectData, selectedModules.length > 0 ? selectedModules : undefined);
            
            // Log project creation activity
            await storage.logActivity({
              entityType: "project",
              entityId: newProject.id,
              action: "created",
              description: `Implementation project auto-created from won deal: ${updated.companyName}`,
              userId: req.user.claims.sub,
            });
            
            console.log(`[Auto-Project] Created implementation project for won deal: ${updated.companyName}`);
          }
        } catch (projectError) {
          console.error("Error auto-creating customer/project from won lead:", projectError);
          // Don't fail the lead update if creation fails
        }
      }
      
      // Default activity description if not set
      if (!activityDescription) {
        activityDescription = `Lead updated: ${updated.companyName} - Stage: ${updated.stage}`;
      }
      
      await storage.logActivity({
        entityType: "lead",
        entityId: updated.id,
        action: activityAction,
        description: activityDescription,
        userId: req.user.claims.sub,
      });

      invalidateCache("leads:list:");
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(400).json({ message: "Failed to update lead" });
    }
  });

  // Delete seed (allows re-import of the same place from extractor)
  app.delete("/api/leads/:id", isAuthenticated, requirePermission('leads', 'delete'), async (req: any, res) => {
    try {
      const leadId = req.params.id;
      
      // Get the lead to verify it exists and check if it's a seed
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Only allow deletion of seeds (not leads in other stages)
      if (lead.stage !== "seed") {
        return res.status(400).json({ 
          message: "Only seeds can be deleted. Leads in other stages cannot be removed." 
        });
      }
      
      // First, reset any extracted places that reference this lead
      // This removes the foreign key reference before we delete the lead
      await storage.resetExtractedPlaceImportByLeadId(leadId);
      
      // Now delete the lead (safe because FK reference is cleared)
      await storage.deleteLead(leadId);
      
      // Log the activity
      await storage.logActivity({
        entityType: "lead",
        entityId: leadId,
        action: "deleted",
        description: `Seed deleted: ${lead.companyName}`,
        userId: req.user.claims.sub,
      });
      
      console.log(`[Seed Delete] Deleted seed ${lead.companyName} (${leadId}), import status reset for re-import`);

      invalidateCache("leads:list:");
      invalidateCache("leads:filter-options");
      
      res.json({ success: true, message: "Seed deleted successfully" });
    } catch (error) {
      console.error("Error deleting seed:", error);
      res.status(500).json({ message: "Failed to delete seed" });
    }
  });

  // Upload photo for lead (seeds page camera feature)
  app.post("/api/leads/photo-upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { leadId } = req.body;
      
      // Generate a unique file name for the photo
      const timestamp = Date.now();
      const fileName = `lead_photo_${userId}_${leadId || 'new'}_${timestamp}.jpg`;
      
      // Get upload URL using the object storage service
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName);
      
      res.json({ 
        uploadURL, 
        objectPath,
        photoUrl: `/objects/${objectPath}`,
      });
    } catch (error) {
      console.error("Error getting lead photo upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Bulk import leads (authenticated)
  app.post("/api/leads/bulk-import", isAuthenticated, async (req: any, res) => {
    try {
      const { leads: leadsData } = req.body;
      
      if (!Array.isArray(leadsData) || leadsData.length === 0) {
        return res.status(400).json({ message: "No leads data provided" });
      }
      
      const createdLeads = [];
      const errors: string[] = [];
      
      for (let i = 0; i < leadsData.length; i++) {
        try {
          const leadRow = leadsData[i];
          const validatedData = insertLeadSchema.parse({
            companyName: leadRow.companyName || leadRow.company_name || leadRow["Company Name"] || "",
            contactPerson: leadRow.contactPerson || leadRow.contact_person || leadRow["Contact Person"] || "",
            contactEmail: leadRow.contactEmail || leadRow.contact_email || leadRow["Email"] || "",
            contactPhone: leadRow.contactPhone || leadRow.contact_phone || leadRow["Phone"] || "",
            leadSource: leadRow.leadSource || leadRow.lead_source || leadRow["Source"] || "website",
            stage: "seed",
            estimatedValue: parseFloat(leadRow.estimatedValue || leadRow.estimated_value || leadRow["Value"]) || 0,
            notes: leadRow.notes || leadRow["Notes"] || "",
          });
          
          const newLead = await storage.createLead(validatedData, {
            changedById: req.user.claims.sub,
            changeReason: 'Lead imported via bulk import',
          });
          createdLeads.push(newLead);
          
          // Log activity
          await storage.logActivity({
            entityType: "lead",
            entityId: newLead.id,
            action: "imported",
            description: `Lead imported via bulk import: ${newLead.companyName}`,
            userId: req.user.claims.sub,
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Invalid data"}`);
        }
      }
      
      res.json({
        success: createdLeads.length,
        failed: errors.length,
        errors: errors.slice(0, 10), // Return first 10 errors
        leads: createdLeads,
      });
    } catch (error) {
      console.error("Error bulk importing leads:", error);
      res.status(400).json({ message: "Failed to import leads" });
    }
  });

  // =============================================
  // WEBHOOK AUTHENTICATION SETTINGS ROUTES
  // =============================================
  
  // Get webhook auth settings
  app.get("/api/settings/webhook-auth", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const enabled = await storage.getSystemSetting("webhook_auth_enabled");
      const username = await storage.getSystemSetting("webhook_auth_username");
      // Don't return the actual password for security
      const password = await storage.getSystemSetting("webhook_auth_password");
      // Get Facebook verification token status (don't return actual value for security)
      const fbVerifyToken = await storage.getSystemSetting("fb_webhook_verify_token");
      
      res.json({
        enabled: enabled?.settingValue === "true",
        username: username?.settingValue || "",
        hasPassword: !!password?.settingValue,
        hasFbVerifyToken: !!fbVerifyToken?.settingValue,
      });
    } catch (error) {
      console.error("Error fetching webhook auth settings:", error);
      res.status(500).json({ message: "Failed to fetch webhook auth settings" });
    }
  });
  
  // Save webhook auth settings
  app.post("/api/settings/webhook-auth", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { enabled, username, password, fbVerifyToken } = req.body;
      
      // Validate inputs if enabling
      if (enabled && (!username || !password)) {
        return res.status(400).json({ message: "Username and password are required when enabling webhook authentication" });
      }
      
      // Get auth user ID
      const authId = (req as any).user?.claims?.sub || (req as any).user?.id;
      
      // Save enabled setting
      await storage.upsertSystemSetting({
        settingKey: "webhook_auth_enabled",
        settingValue: enabled ? "true" : "false",
        settingType: "boolean",
        category: "webhook",
        description: "Enable/disable webhook authentication",
        isSecret: false,
        updatedBy: authId,
      });
      
      // Save username
      if (username !== undefined) {
        await storage.upsertSystemSetting({
          settingKey: "webhook_auth_username",
          settingValue: username,
          settingType: "string",
          category: "webhook",
          description: "Webhook authentication username",
          isSecret: false,
          updatedBy: authId,
        });
      }
      
      // Save password (only if provided)
      if (password) {
        await storage.upsertSystemSetting({
          settingKey: "webhook_auth_password",
          settingValue: password,
          settingType: "string",
          category: "webhook",
          description: "Webhook authentication password",
          isSecret: true,
          updatedBy: authId,
        });
      }
      
      // Save Facebook webhook verification token (only if provided)
      if (fbVerifyToken) {
        await storage.upsertSystemSetting({
          settingKey: "fb_webhook_verify_token",
          settingValue: fbVerifyToken,
          settingType: "string",
          category: "webhook",
          description: "Facebook/Meta webhook verification token",
          isSecret: true,
          updatedBy: authId,
        });
      }
      
      res.json({ success: true, message: "Webhook authentication settings saved" });
    } catch (error) {
      console.error("Error saving webhook auth settings:", error);
      res.status(500).json({ message: "Failed to save webhook auth settings" });
    }
  });

  // =============================================
  // GOOGLE SHEETS INTEGRATION ROUTES
  // =============================================
  
  // List available Google Spreadsheets
  app.get("/api/google-sheets/spreadsheets", isAuthenticated, requirePermission('leads', 'view'), async (req, res) => {
    try {
      const { listSpreadsheets } = await import("./google-sheets");
      const spreadsheets = await listSpreadsheets();
      res.json(spreadsheets);
    } catch (error: any) {
      console.error("Error listing spreadsheets:", error);
      if (error.message?.includes('not connected')) {
        res.status(400).json({ message: "Google Sheets is not connected. Please set up the integration first." });
      } else {
        res.status(500).json({ message: "Failed to list spreadsheets" });
      }
    }
  });

  // Get sheet names from a spreadsheet
  app.get("/api/google-sheets/:spreadsheetId/sheets", isAuthenticated, requirePermission('leads', 'view'), async (req, res) => {
    try {
      const { spreadsheetId } = req.params;
      const { getSheetNames } = await import("./google-sheets");
      const sheets = await getSheetNames(spreadsheetId);
      res.json(sheets);
    } catch (error: any) {
      console.error("Error getting sheet names:", error);
      res.status(500).json({ message: "Failed to get sheet names" });
    }
  });

  // Get sheet data preview (first 10 rows)
  app.get("/api/google-sheets/:spreadsheetId/:sheetName/preview", isAuthenticated, requirePermission('leads', 'view'), async (req, res) => {
    try {
      const { spreadsheetId, sheetName } = req.params;
      const { readSheetData } = await import("./google-sheets");
      const data = await readSheetData(spreadsheetId, decodeURIComponent(sheetName), "A1:Z10");
      res.json(data);
    } catch (error: any) {
      console.error("Error reading sheet preview:", error);
      res.status(500).json({ message: "Failed to read sheet data" });
    }
  });

  // Import leads from Google Sheet
  app.post("/api/google-sheets/import-leads", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const { spreadsheetId, sheetName, columnMapping, skipHeader = true } = req.body;
      
      if (!spreadsheetId || !sheetName || !columnMapping) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      const { readSheetData, parseLeadsFromSheetData } = await import("./google-sheets");
      
      // Read all data from the sheet
      const data = await readSheetData(spreadsheetId, sheetName);
      
      if (!data || data.length === 0) {
        return res.status(400).json({ message: "No data found in the sheet" });
      }
      
      // Parse leads from sheet data
      const parsedLeads = parseLeadsFromSheetData(data, columnMapping, skipHeader);
      
      if (parsedLeads.length === 0) {
        return res.status(400).json({ message: "No valid leads found in the sheet" });
      }
      
      const createdLeads = [];
      const errors: string[] = [];
      
      for (let i = 0; i < parsedLeads.length; i++) {
        try {
          const lead = parsedLeads[i];
          const validatedData = insertLeadSchema.parse({
            companyName: lead.companyName || "Unknown Company",
            contactPerson: lead.contactPerson || "Unknown",
            contactEmail: lead.email || "",
            contactPhone: lead.phone || "",
            leadSource: lead.source || "google_sheet",
            stage: "seed",
            estimatedValue: 0,
            notes: lead.notes || `Imported from Google Sheet: ${sheetName}`,
          });
          
          const newLead = await storage.createLead(validatedData, {
            changedById: req.user.claims.sub,
            changeReason: 'Lead imported from Google Sheets',
          });
          createdLeads.push(newLead);
          
          await storage.logActivity({
            entityType: "lead",
            entityId: newLead.id,
            action: "imported",
            description: `Lead imported from Google Sheets: ${newLead.companyName}`,
            userId: req.user.claims.sub,
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Invalid data"}`);
        }
      }
      
      res.json({
        success: createdLeads.length,
        failed: errors.length,
        errors: errors.slice(0, 10),
        leads: createdLeads,
      });
    } catch (error: any) {
      console.error("Error importing leads from Google Sheets:", error);
      res.status(500).json({ message: error.message || "Failed to import leads" });
    }
  });

  // Social Media Webhook Endpoints (public - no auth required for webhooks)
  // These endpoints receive lead data from social media platforms

  // Facebook Lead Ads Webhook
  app.post("/api/webhooks/facebook", validateWebhookAuth, async (req, res) => {
    try {
      const { leadgen_id, form_id, field_data, created_time, ad_id, page_id } = req.body;
      
      // Parse Facebook's field_data array format
      const fieldMap = new Map();
      if (Array.isArray(field_data)) {
        field_data.forEach((field: { name: string; values: string[] }) => {
          fieldMap.set(field.name, field.values?.[0] || "");
        });
      }
      
      const leadData = {
        companyName: fieldMap.get("company") || fieldMap.get("company_name") || "Facebook Lead",
        contactPerson: fieldMap.get("full_name") || `${fieldMap.get("first_name") || ""} ${fieldMap.get("last_name") || ""}`.trim() || "Unknown",
        contactEmail: fieldMap.get("email") || "",
        contactPhone: fieldMap.get("phone_number") || fieldMap.get("phone") || "",
        leadSource: "facebook",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Facebook Lead Ad - Form ID: ${form_id || "N/A"}, Ad ID: ${ad_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Facebook Lead Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Facebook Lead Ads: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Facebook webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Facebook Webhook Verification (GET request for initial setup)
  app.get("/api/webhooks/facebook", async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Try to get verify token from database first, then fall back to environment variable
    let verifyToken: string | undefined;
    try {
      const dbToken = await storage.getSystemSetting("fb_webhook_verify_token");
      verifyToken = dbToken?.settingValue || process.env.FB_WEBHOOK_VERIFY_TOKEN;
    } catch (error) {
      console.error("[Facebook Webhook] Error fetching token from database:", error);
      verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    }
    
    // If no verify token is configured, show helpful message
    if (!verifyToken) {
      console.warn("[Facebook Webhook] Verification token not configured");
      return res.status(500).send("Webhook not configured. Please configure the Facebook Verification Token in Webhook Settings or set FB_WEBHOOK_VERIFY_TOKEN environment variable.");
    }
    
    // Handle Facebook verification challenge
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Facebook Webhook] Verification successful");
      res.status(200).send(challenge);
    } else if (mode && token) {
      console.warn(`[Facebook Webhook] Verification failed. Mode: ${mode}, Token mismatch`);
      res.status(403).send("Verification failed - token mismatch");
    } else {
      // Direct browser access without Facebook parameters
      res.status(200).send("Facebook Webhook endpoint ready. Configure this URL in Facebook Developers Console.");
    }
  });

  // LinkedIn Lead Gen Webhook
  app.post("/api/webhooks/linkedin", validateWebhookAuth, async (req, res) => {
    try {
      const { lead, campaign, form } = req.body;
      
      const leadData = {
        companyName: lead?.company || lead?.organization || "LinkedIn Lead",
        contactPerson: `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim() || "Unknown",
        contactEmail: lead?.email || "",
        contactPhone: lead?.phone || "",
        leadSource: "linkedin",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `LinkedIn Lead Gen Form - Campaign: ${campaign?.name || "N/A"}, Form: ${form?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via LinkedIn Lead Gen webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from LinkedIn: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("LinkedIn webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Instagram Lead Ads Webhook Verification (uses Facebook's API)
  app.get("/api/webhooks/instagram", async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Instagram uses the same Meta/Facebook API, so shares the same verify token
    let verifyToken: string | undefined;
    try {
      const dbToken = await storage.getSystemSetting("fb_webhook_verify_token");
      verifyToken = dbToken?.settingValue || process.env.FB_WEBHOOK_VERIFY_TOKEN;
    } catch (error) {
      console.error("[Instagram Webhook] Error fetching token from database:", error);
      verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    }
    
    if (mode === "subscribe" && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: "Verification failed" });
    }
  });

  // Instagram Lead Ads Webhook (uses Facebook's API)
  app.post("/api/webhooks/instagram", validateWebhookAuth, async (req, res) => {
    try {
      const { leadgen_id, form_id, field_data, instagram_user_id } = req.body;
      
      const fieldMap = new Map();
      if (Array.isArray(field_data)) {
        field_data.forEach((field: { name: string; values: string[] }) => {
          fieldMap.set(field.name, field.values?.[0] || "");
        });
      }
      
      const leadData = {
        companyName: fieldMap.get("company") || "Instagram Lead",
        contactPerson: fieldMap.get("full_name") || `${fieldMap.get("first_name") || ""} ${fieldMap.get("last_name") || ""}`.trim() || "Unknown",
        contactEmail: fieldMap.get("email") || "",
        contactPhone: fieldMap.get("phone_number") || fieldMap.get("phone") || "",
        leadSource: "instagram",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Instagram Lead Ad - Form ID: ${form_id || "N/A"}, Instagram User: ${instagram_user_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Instagram Lead Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Instagram: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Instagram webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Twitter/X Lead Ads Webhook
  app.post("/api/webhooks/twitter", validateWebhookAuth, async (req, res) => {
    try {
      const { card_data, user_data } = req.body;
      
      const leadData = {
        companyName: user_data?.company || card_data?.company_name || "Twitter Lead",
        contactPerson: user_data?.name || card_data?.full_name || "Unknown",
        contactEmail: user_data?.email || card_data?.email || "",
        contactPhone: user_data?.phone || card_data?.phone_number || "",
        leadSource: "twitter",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Twitter/X Lead Card`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Twitter/X Lead Cards webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Twitter/X: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Twitter webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Google Ads Lead Form Extension Webhook
  app.post("/api/webhooks/google", validateWebhookAuth, async (req, res) => {
    try {
      const { lead_id, campaign_id, adgroup_id, form_id, gcl_id, google_key, is_test, user_column_data } = req.body;
      
      // Parse Google's user_column_data array format
      const fieldMap = new Map();
      if (Array.isArray(user_column_data)) {
        user_column_data.forEach((field: { column_id: string; column_name: string; string_value: string }) => {
          fieldMap.set(field.column_id, field.string_value || "");
        });
      }
      
      // Skip test leads but return success
      if (is_test) {
        return res.json({ success: true, message: "Test lead received" });
      }
      
      const leadData = {
        companyName: fieldMap.get("COMPANY_NAME") || fieldMap.get("COMPANY") || "Google Ads Lead",
        contactPerson: fieldMap.get("FULL_NAME") || `${fieldMap.get("FIRST_NAME") || ""} ${fieldMap.get("LAST_NAME") || ""}`.trim() || "Unknown",
        contactEmail: fieldMap.get("EMAIL") || "",
        contactPhone: fieldMap.get("PHONE_NUMBER") || "",
        leadSource: "google_ads",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Google Ads Lead Form - Campaign ID: ${campaign_id || "N/A"}, Form ID: ${form_id || "N/A"}, Lead ID: ${lead_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Google Ads Lead Form webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Google Ads: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Google Ads webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // YouTube Lead Form Webhook (via Google Ads infrastructure)
  app.post("/api/webhooks/youtube", validateWebhookAuth, async (req, res) => {
    try {
      const { lead_id, campaign_id, video_id, form_id, user_column_data } = req.body;
      
      const fieldMap = new Map();
      if (Array.isArray(user_column_data)) {
        user_column_data.forEach((field: { column_id: string; string_value: string }) => {
          fieldMap.set(field.column_id, field.string_value || "");
        });
      }
      
      const leadData = {
        companyName: fieldMap.get("COMPANY_NAME") || fieldMap.get("COMPANY") || "YouTube Lead",
        contactPerson: fieldMap.get("FULL_NAME") || `${fieldMap.get("FIRST_NAME") || ""} ${fieldMap.get("LAST_NAME") || ""}`.trim() || "Unknown",
        contactEmail: fieldMap.get("EMAIL") || "",
        contactPhone: fieldMap.get("PHONE_NUMBER") || "",
        leadSource: "youtube",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `YouTube Lead Form - Video ID: ${video_id || "N/A"}, Campaign: ${campaign_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via YouTube Lead Form webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from YouTube: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("YouTube webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // TikTok Lead Generation Webhook
  app.post("/api/webhooks/tiktok", validateWebhookAuth, async (req, res) => {
    try {
      const { event, lead_info, page_info, ad_info } = req.body;
      
      const leadData = {
        companyName: lead_info?.company || lead_info?.business_name || "TikTok Lead",
        contactPerson: lead_info?.name || lead_info?.full_name || `${lead_info?.first_name || ""} ${lead_info?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead_info?.email || "",
        contactPhone: lead_info?.phone_number || lead_info?.phone || "",
        leadSource: "tiktok",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `TikTok Lead Ad - Page: ${page_info?.page_name || "N/A"}, Ad: ${ad_info?.ad_name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via TikTok Lead Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from TikTok: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("TikTok webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Pinterest Lead Ads Webhook
  app.post("/api/webhooks/pinterest", validateWebhookAuth, async (req, res) => {
    try {
      const { lead_data, pin_info, campaign_info } = req.body;
      
      const leadData = {
        companyName: lead_data?.company || lead_data?.business || "Pinterest Lead",
        contactPerson: lead_data?.full_name || lead_data?.name || `${lead_data?.first_name || ""} ${lead_data?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead_data?.email || "",
        contactPhone: lead_data?.phone || "",
        leadSource: "pinterest",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Pinterest Lead Ad - Pin: ${pin_info?.pin_id || "N/A"}, Campaign: ${campaign_info?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Pinterest Lead Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Pinterest: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Pinterest webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Snapchat Lead Ads Webhook
  app.post("/api/webhooks/snapchat", validateWebhookAuth, async (req, res) => {
    try {
      const { lead, campaign, ad_squad } = req.body;
      
      const leadData = {
        companyName: lead?.company || lead?.organization || "Snapchat Lead",
        contactPerson: lead?.full_name || lead?.name || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead?.email || "",
        contactPhone: lead?.phone_number || lead?.phone || "",
        leadSource: "snapchat",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Snapchat Lead Ad - Campaign: ${campaign?.name || "N/A"}, Ad Squad: ${ad_squad?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Snapchat Lead Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Snapchat: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Snapchat webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // WhatsApp Click-to-Message Webhook (via Facebook Business API)
  app.post("/api/webhooks/whatsapp", validateWebhookAuth, async (req, res) => {
    try {
      const { entry } = req.body;
      
      // Parse WhatsApp message format (Facebook Webhook structure)
      const message = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const contact = entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
      
      if (!message || !contact) {
        return res.json({ success: true, message: "No lead data in webhook" });
      }
      
      const leadData = {
        companyName: contact?.profile?.name || "WhatsApp Lead",
        contactPerson: contact?.profile?.name || "Unknown",
        contactEmail: "",
        contactPhone: contact?.wa_id || message?.from || "",
        leadSource: "whatsapp",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `WhatsApp Lead - Message: ${message?.text?.body || "Click-to-WhatsApp inquiry"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via WhatsApp webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from WhatsApp: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // WhatsApp Webhook Verification (GET request for initial setup)
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    const verifyToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
    
    if (mode === "subscribe" && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Verification failed");
    }
  });

  // Microsoft/Bing Ads Lead Form Extension Webhook
  app.post("/api/webhooks/microsoft", validateWebhookAuth, async (req, res) => {
    try {
      const { leadFormId, campaignId, adGroupId, leadId, formData } = req.body;
      
      // Parse Microsoft Ads form data
      const fieldMap = new Map();
      if (Array.isArray(formData)) {
        formData.forEach((field: { fieldName: string; value: string }) => {
          fieldMap.set(field.fieldName?.toLowerCase(), field.value || "");
        });
      }
      
      const leadData = {
        companyName: fieldMap.get("company") || fieldMap.get("companyname") || "Microsoft Ads Lead",
        contactPerson: fieldMap.get("fullname") || fieldMap.get("name") || `${fieldMap.get("firstname") || ""} ${fieldMap.get("lastname") || ""}`.trim() || "Unknown",
        contactEmail: fieldMap.get("email") || "",
        contactPhone: fieldMap.get("phone") || fieldMap.get("phonenumber") || "",
        leadSource: "microsoft_ads",
        stage: "seed" as const,
        estimatedValue: 0,
        notes: `Microsoft/Bing Ads Lead Form - Campaign ID: ${campaignId || "N/A"}, Lead Form ID: ${leadFormId || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via Microsoft/Bing Ads webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from Microsoft/Bing Ads: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Microsoft Ads webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Generic Website Form Webhook (for custom integrations)
  app.post("/api/webhooks/website", validateWebhookAuth, async (req, res) => {
    try {
      const { company, name, email, phone, source, notes } = req.body;
      
      const leadData = {
        companyName: company || req.body.companyName || "Website Lead",
        contactPerson: name || req.body.contactPerson || "Unknown",
        contactEmail: email || req.body.contactEmail || "",
        contactPhone: phone || req.body.contactPhone || "",
        leadSource: source || "website",
        stage: "seed" as const,
        estimatedValue: parseFloat(req.body.value) || 0,
        notes: notes || req.body.notes || "Submitted via website form",
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData, {
        changeReason: 'Lead captured via website form webhook',
      });
      
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "webhook_created",
        description: `Lead captured from website form: ${newLead.companyName}`,
        userId: null,
      });
      
      res.json({ success: true, leadId: newLead.id });
    } catch (error) {
      console.error("Website webhook error:", error);
      res.status(200).json({ success: false, error: "Failed to process lead" });
    }
  });

  // Helper function to check if user has access to a lead
  async function userHasLeadAccess(userId: string, leadId: string): Promise<boolean> {
    const lead = await storage.getLead(leadId);
    if (!lead) return false;
    
    const user = await storage.getUser(userId);
    if (!user) return false;
    
    // Super admin or admin can access all leads
    if (user.email === SUPER_ADMIN_EMAIL || user.role === "admin") {
      return true;
    }
    
    // Check if lead is assigned to the user (check both auth ID and internal user ID)
    if (lead.salesExecutiveId === userId || lead.salesExecutiveId === user.id) {
      return true;
    }
    
    // Check if user is a department head (using junction table)
    const managedDepartments = await storage.getDepartmentsByHead(user.id);
    
    if (managedDepartments.length > 0) {
      // Department heads can access all leads assigned to users in their department
      if (lead.salesExecutiveId) {
        const leadAssignee = await storage.getUser(lead.salesExecutiveId);
        if (leadAssignee && leadAssignee.departmentId) {
          for (const dept of managedDepartments) {
            if (leadAssignee.departmentId === dept.id) {
              return true;
            }
          }
        }
      }
      
      // Department heads in Sales department can also access unassigned leads
      const salesDept = managedDepartments.find(d => d.name.toLowerCase() === 'sales');
      if (salesDept && !lead.salesExecutiveId) {
        return true;
      }
    }
    
    return false;
  }

  // Update seed interest status
  app.patch("/api/leads/:id/interest", isAuthenticated, requirePermission('leads', 'edit'), async (req: any, res) => {
    try {
      const { interestStatus, notInterestedReason, nextFollowupDate } = req.body;
      
      if (!interestStatus || !["interested", "not_interested", "followup"].includes(interestStatus)) {
        return res.status(400).json({ message: "Valid interest status (interested/not_interested/followup) is required" });
      }
      
      const updateData: any = {
        interestStatus,
        interestUpdatedAt: new Date(),
      };
      
      if (interestStatus === "not_interested") {
        updateData.notInterestedReason = notInterestedReason || null;
        updateData.nextFollowupDate = null;
      } else if (interestStatus === "interested" || interestStatus === "followup") {
        updateData.notInterestedReason = null;
        if (nextFollowupDate) {
          updateData.nextFollowupDate = new Date(nextFollowupDate);
        }
      }
      
      const updated = await storage.updateLead(req.params.id, updateData);
      
      // Log activity
      const lead = await storage.getLead(req.params.id);
      const actionMap: Record<string, string> = {
        interested: "seed_interested",
        followup: "seed_followup",
        not_interested: "seed_not_interested",
      };
      const descMap: Record<string, string> = {
        interested: `Seed "${lead?.companyName}" marked as interested${nextFollowupDate ? `, followup scheduled for ${new Date(nextFollowupDate).toLocaleDateString()}` : ""}`,
        followup: `Seed "${lead?.companyName}" marked for followup${nextFollowupDate ? `, reminder set for ${new Date(nextFollowupDate).toLocaleDateString()}` : ""}`,
        not_interested: `Seed "${lead?.companyName}" marked as not interested${notInterestedReason ? `: ${notInterestedReason}` : ""}`,
      };
      await storage.logActivity({
        entityType: "lead",
        entityId: req.params.id,
        action: actionMap[interestStatus] || "seed_updated",
        description: descMap[interestStatus] || `Seed "${lead?.companyName}" interest status updated`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating interest status:", error);
      res.status(500).json({ message: "Failed to update interest status" });
    }
  });

  // Seeds Report - Get seeds with interest status filtering
  app.get("/api/seeds/report", isAuthenticated, async (req: any, res) => {
    try {
      const { interestStatus, fromDate, toDate, stage } = req.query;

      const cacheKey = `seeds:report:${stage||'seed'}:${interestStatus||''}:${fromDate||''}:${toDate||''}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      // Build SQL filters — no more loading all 3873 leads into memory
      const stageFilter = (stage && stage !== "all") ? stage as string : "seed";
      const interestFilter = interestStatus as string | undefined;

      const seeds = await storage.getLeads({
        stage: stageFilter,
        interestStatus: interestFilter === "undecided" ? null : (interestFilter || undefined),
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
      });

      // Single query for all users needed
      const salesExecIds = [...new Set(seeds.map(s => s.salesExecutiveId).filter(Boolean) as string[])];
      const allUsers = salesExecIds.length > 0 ? await storage.getUsersByIds(salesExecIds) : [];
      const usersMap = new Map(allUsers.map(u => [u.id, u]));

      const result = seeds.map(seed => ({
        ...seed,
        salesExecutive: seed.salesExecutiveId ? usersMap.get(seed.salesExecutiveId) : null,
      }));

      setCached(cacheKey, result, 120); // 2 min cache
      res.json(result);
    } catch (error) {
      console.error("Error fetching seeds report:", error);
      res.status(500).json({ message: "Failed to fetch seeds report" });
    }
  });

  // Seed followup reminders - Get seeds with upcoming followups
  app.get("/api/seeds/followup-reminders", isAuthenticated, async (req: any, res) => {
    try {
      const { days = "7" } = req.query;
      const daysAhead = parseInt(days as string) || 7;

      const cacheKey = `seeds:followup:${daysAhead}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + daysAhead);

      // SQL filtering: stage=seed, has followup date in range, interested or followup status
      const seedsWithFollowups = await storage.getLeads({
        stage: "seed",
        hasFollowupDate: true,
        followupFrom: today,
        followupTo: futureDate,
      });

      // Post-filter: exclude existing customers and non-interested statuses (not worth extra SQL join)
      const filtered = seedsWithFollowups.filter(lead =>
        ((lead as any).interestStatus === "interested" || (lead as any).interestStatus === "followup") &&
        (lead as any).isExistingCustomer !== true
      );

      const salesExecIds = [...new Set(filtered.map(s => s.salesExecutiveId).filter(Boolean) as string[])];
      const allUsers = salesExecIds.length > 0 ? await storage.getUsersByIds(salesExecIds) : [];
      const usersMap = new Map(allUsers.map(u => [u.id, u]));

      const result = filtered
        .map(seed => ({
          ...seed,
          salesExecutive: seed.salesExecutiveId ? usersMap.get(seed.salesExecutiveId) : null,
        }))
        .sort((a, b) =>
          new Date((a as any).nextFollowupDate).getTime() - new Date((b as any).nextFollowupDate).getTime()
        );

      setCached(cacheKey, result, 120); // 2 min cache
      res.json(result);
    } catch (error) {
      console.error("Error fetching seed followup reminders:", error);
      res.status(500).json({ message: "Failed to fetch followup reminders" });
    }
  });

  // Follow-up routes
  app.get("/api/leads/:id/follow-ups", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      
      // Check if user has access to this lead
      const hasAccess = await userHasLeadAccess(currentUserId, req.params.id);
      if (!hasAccess) {
        return res.status(403).json({ message: "You do not have access to this lead's follow-ups" });
      }
      
      const followUpsList = await storage.getFollowUpsByLead(req.params.id);
      res.json(followUpsList);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ message: "Failed to fetch follow-ups" });
    }
  });

  app.post("/api/leads/:id/follow-ups", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub || (req.session as any).userId;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Check mandatory planning requirement for sales executives
      if (currentUser.role === "sales_executive" || currentUser.role === "sales_head") {
        const planningStatus = await storage.hasCompletedMonthlyPlanning(currentUser.id);
        if (!planningStatus.hasPlanned) {
          return res.status(403).json({ 
            message: planningStatus.message,
            code: "PLANNING_REQUIRED",
            redirectTo: "/sales-planning"
          });
        }
      }
      
      // Check if user has access to this lead
      const hasAccess = await userHasLeadAccess(currentUserId, req.params.id);
      if (!hasAccess) {
        return res.status(403).json({ message: "You do not have access to this lead" });
      }
      
      // Convert date string to Date object
      const followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : undefined;
      const validatedData = insertFollowUpSchema.parse({
        ...req.body,
        followUpDate,
        leadId: req.params.id,
      });
      const newFollowUp = await storage.createFollowUp(validatedData);
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: req.params.id,
        action: "follow_up_added",
        description: `Follow-up scheduled for ${new Date(validatedData.followUpDate).toLocaleDateString()}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newFollowUp);
    } catch (error) {
      console.error("Error creating follow-up:", error);
      res.status(400).json({ message: "Failed to create follow-up" });
    }
  });

  app.patch("/api/follow-ups/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateFollowUp(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating follow-up:", error);
      res.status(400).json({ message: "Failed to update follow-up" });
    }
  });

  // Get next followup date for a lead (for task integration)
  app.get("/api/leads/:id/next-followup", isAuthenticated, async (req, res) => {
    try {
      const followUps = await storage.getFollowUpsByLead(req.params.id);
      const now = new Date();
      
      // Only consider uncompleted followups
      const uncompletedFollowUps = followUps.filter(f => !f.completed);
      
      if (uncompletedFollowUps.length === 0) {
        // No uncompleted followups exist
        return res.json({ nextFollowUpDate: null, message: "No pending followups" });
      }
      
      // Find the next upcoming uncompleted followup (future dates)
      const futureFollowUp = uncompletedFollowUps
        .filter(f => new Date(f.followUpDate) >= now)
        .sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime())[0];
      
      if (futureFollowUp) {
        return res.json({ nextFollowUpDate: futureFollowUp.followUpDate, notes: futureFollowUp.notes });
      }
      
      // If no future uncompleted followups, return the most recent past uncompleted one
      const pastFollowUp = uncompletedFollowUps
        .sort((a, b) => new Date(b.followUpDate).getTime() - new Date(a.followUpDate).getTime())[0];
      
      if (pastFollowUp) {
        return res.json({ nextFollowUpDate: pastFollowUp.followUpDate, notes: pastFollowUp.notes, isPast: true });
      }
      
      res.json({ nextFollowUpDate: null });
    } catch (error) {
      console.error("Error fetching next follow-up:", error);
      res.status(500).json({ message: "Failed to fetch next follow-up" });
    }
  });

  // Demo Date History routes
  app.get("/api/leads/:id/demo-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getDemoDateHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching demo date history:", error);
      res.status(500).json({ message: "Failed to fetch demo date history" });
    }
  });

  // Negotiation Date History routes
  app.get("/api/leads/:id/negotiation-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getNegotiationDateHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching negotiation date history:", error);
      res.status(500).json({ message: "Failed to fetch negotiation date history" });
    }
  });

  // Lead Stage History routes
  app.get("/api/leads/:id/stage-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getLeadStageHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching lead stage history:", error);
      res.status(500).json({ message: "Failed to fetch lead stage history" });
    }
  });

  // Lead Assignment History routes
  app.get("/api/leads/:id/assignment-history", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || (req.session as any)?.userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the lead to check visibility
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Fetch assignment history once for both authorization and response
      const history = await storage.getLeadAssignmentHistory(req.params.id);
      
      // Check if user has access to this lead using access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const allowedIds = accessControl.allowedUserIds || [];
      
      // If not admin with full access, verify user can access this lead
      if (!accessControl.hasFullAccess) {
        // User can access if they are the current assignee
        const isCurrentAssignee = lead.salesExecutiveId === currentUser.id;
        
        // Or if they were ever directly assigned to this lead (fromUserId or toUserId)
        const wasDirectlyAssigned = history.some(h => 
          h.fromUserId === currentUser.id || h.toUserId === currentUser.id
        );
        
        // Or if the lead is currently assigned to someone in their allowed list
        const isInAllowedScope = lead.salesExecutiveId && allowedIds.includes(lead.salesExecutiveId);
        
        if (!isCurrentAssignee && !wasDirectlyAssigned && !isInAllowedScope) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(history);
    } catch (error) {
      console.error("Error fetching lead assignment history:", error);
      res.status(500).json({ message: "Failed to fetch lead assignment history" });
    }
  });

  // Reassign lead to another sales executive
  app.post("/api/leads/:id/reassign", isAuthenticated, requirePermission('leads', 'edit'), async (req: any, res) => {
    try {
      const { newSalesExecutiveId, reason } = req.body;
      
      if (!newSalesExecutiveId) {
        return res.status(400).json({ message: "New sales executive ID is required" });
      }

      const authId = req.user?.claims?.sub || (req.session as any)?.userId;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Verify the new sales executive exists
      const newSalesExec = await storage.getUser(newSalesExecutiveId);
      if (!newSalesExec) {
        return res.status(400).json({ message: "New sales executive not found" });
      }

      // Perform the reassignment
      const updatedLead = await storage.reassignLead(
        req.params.id,
        newSalesExecutiveId,
        currentUser.id,
        reason
      );

      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: req.params.id,
        action: "reassigned",
        description: `Lead reassigned to ${newSalesExec.firstName} ${newSalesExec.lastName}${reason ? `: ${reason}` : ""}`,
        userId: currentUser.id,
      });

      res.json(updatedLead);
    } catch (error) {
      console.error("Error reassigning lead:", error);
      res.status(500).json({ message: "Failed to reassign lead" });
    }
  });

  // Quote routes
  app.get("/api/leads/:id/quotes", isAuthenticated, async (req, res) => {
    try {
      const quotesList = await storage.getQuotesByLead(req.params.id);
      res.json(quotesList);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/leads/:id/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertQuoteSchema.parse({
        ...req.body,
        leadId: req.params.id,
      });
      const newQuote = await storage.createQuote(validatedData);
      
      // Get lead details for email
      const lead = await storage.getLead(req.params.id);
      
      if (lead && newQuote.validUntil) {
        // Send quote email
        await sendQuoteEmail(
          lead.contactEmail,
          lead.contactPerson,
          lead.companyName,
          newQuote.amount,
          newQuote.validUntil
        );
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: req.params.id,
        action: "quote_created",
        description: `Quote sent: $${newQuote.amount.toLocaleString()}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newQuote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(400).json({ message: "Failed to create quote" });
    }
  });

  // Project routes
  app.get("/api/projects", isAuthenticated, requirePermission('projects', 'view'), async (req: any, res) => {
    try {
      const { status, fromDate, toDate } = req.query;
      const authId = req.user.claims.sub || (req.session as any).userId;

      // Fetch database user first - required for proper ID resolution
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Use the database user ID (not auth ID) for access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const cachePrefix = accessControl.hasFullAccess ? 'shared' : authId;
      const cacheKey = `projects:list:${cachePrefix}:${status||''}:${fromDate||''}:${toDate||''}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);
      
      // Build filters with access control
      const filters: { status?: string; engineerIds?: string[]; fromDate?: Date; toDate?: Date } = {
        status: status as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
      };
      
      if (!accessControl.hasFullAccess && accessControl.allowedUserIds) {
        filters.engineerIds = accessControl.allowedUserIds;
      }
      
      const projectsList = await storage.getProjects(filters);

      // Single query for ALL project engineers, then single query for ALL user records
      const projectIds = projectsList.map((p) => p.id);
      const [allAssignments, ] = await Promise.all([
        storage.getProjectEngineersForProjects(projectIds),
        Promise.resolve(),
      ]);
      const allEngineerIds = [...new Set(allAssignments.map((a) => a.engineerId))];
      const allEngineers = await storage.getUsersByIds(allEngineerIds);
      const engineerMap = new Map(allEngineers.map((u) => [u.id, u]));

      // Group assignments by project
      const assignmentsByProject = new Map<string, typeof allAssignments>();
      for (const a of allAssignments) {
        if (!assignmentsByProject.has(a.projectId)) assignmentsByProject.set(a.projectId, []);
        assignmentsByProject.get(a.projectId)!.push(a);
      }

      const projectsWithEngineers = projectsList.map((project) => ({
        ...project,
        engineers: (assignmentsByProject.get(project.id) || [])
          .map((a) => engineerMap.get(a.engineerId))
          .filter(Boolean),
      }));

      setCached(cacheKey, projectsWithEngineers, 900); // 15 min cache
      res.json(projectsWithEngineers);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, requirePermission('projects', 'view'), async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, requirePermission('projects', 'create'), async (req: any, res) => {
    try {
      // Extract selectedModules before validation (it's not part of the project schema)
      const { selectedModules: clientModules, ...projectData } = req.body;
      
      // Convert date string to Date object if present
      if (projectData.implementationDate) {
        projectData.implementationDate = new Date(projectData.implementationDate);
      }
      
      const validatedData = insertProjectSchema.parse(projectData);
      
      // Server-side derivation of selectedModules from lead or customer
      // This is the source of truth - don't trust client-provided modules
      let selectedModules: string[] = [];
      
      // First try to get modules from the associated lead
      if (validatedData.leadId) {
        const lead = await storage.getLead(validatedData.leadId);
        if (lead?.selectedModules?.length) {
          selectedModules = lead.selectedModules;
        }
      }
      
      // Fall back to customer's selected modules if no lead modules
      if (selectedModules.length === 0 && validatedData.customerId) {
        const customer = await storage.getCustomer(validatedData.customerId);
        if (customer?.selectedModules?.length) {
          selectedModules = customer.selectedModules;
        }
      }
      
      // Pass server-derived selectedModules to createProject
      const newProject = await storage.createProject(
        validatedData, 
        selectedModules.length > 0 ? selectedModules : undefined
      );
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: newProject.id,
        action: "created",
        description: `New project created: ${newProject.clientName}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, requirePermission('projects', 'edit'), async (req: any, res) => {
    try {
      const updated = await storage.updateProject(req.params.id, req.body);
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        description: `Project updated: ${updated.clientName} - Status: ${updated.status}`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Failed to update project" });
    }
  });

  // Project Module routes
  app.get("/api/projects/:id/modules", isAuthenticated, async (req, res) => {
    try {
      const projectModulesList = await storage.getProjectModules(req.params.id);
      
      // Attach module details
      const withModules = await Promise.all(
        projectModulesList.map(async (pm) => {
          const module = await storage.getModule(pm.moduleId);
          return { ...pm, module };
        })
      );
      
      res.json(withModules);
    } catch (error) {
      console.error("Error fetching project modules:", error);
      res.status(500).json({ message: "Failed to fetch project modules" });
    }
  });

  app.patch("/api/project-modules/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Get current module data for comparison
      const currentModule = await storage.getProjectModule(req.params.id);
      if (!currentModule) {
        return res.status(404).json({ message: "Project module not found" });
      }
      
      let updateData = { ...req.body };
      
      // Convert date strings to Date objects
      if (updateData.completedAt) {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      if (updateData.scheduledStartDate) {
        updateData.scheduledStartDate = new Date(updateData.scheduledStartDate);
      }
      if (updateData.scheduledEndDate) {
        updateData.scheduledEndDate = new Date(updateData.scheduledEndDate);
      }
      if (updateData.actualVisitDate) {
        updateData.actualVisitDate = new Date(updateData.actualVisitDate);
      }
      
      // Track planning changes for audit log
      const changedBy = req.user?.claims?.sub;
      const trackableFields = [
        { field: 'assignedEngineerId', label: 'Planned Engineer', type: 'engineer' },
        { field: 'actualEngineerId', label: 'Visiting Engineer', type: 'engineer' },
        { field: 'scheduledStartDate', label: 'Scheduled Start Date', type: 'date' },
        { field: 'scheduledEndDate', label: 'Scheduled End Date', type: 'date' },
        { field: 'actualVisitDate', label: 'Actual Visit Date', type: 'date' },
        { field: 'installationStatus', label: 'Status', type: 'text' },
        { field: 'departmentName', label: 'Department', type: 'text' },
      ];
      
      // Log each change
      for (const { field, label, type } of trackableFields) {
        const oldValue = (currentModule as any)[field];
        const newValue = updateData[field];
        
        // Skip if field not being updated or value unchanged
        if (newValue === undefined) continue;
        
        const oldStr = oldValue ? (type === 'date' ? new Date(oldValue).toISOString().split('T')[0] : String(oldValue)) : null;
        const newStr = newValue ? (type === 'date' ? new Date(newValue).toISOString().split('T')[0] : String(newValue)) : null;
        
        if (oldStr !== newStr) {
          await storage.createPlanningChangeLog({
            projectModuleId: req.params.id,
            projectId: currentModule.projectId,
            changedBy,
            changeType: type === 'engineer' ? 'engineer_changed' : type === 'date' ? 'date_changed' : 'field_changed',
            fieldName: label,
            oldValue: oldStr,
            newValue: newStr,
            oldEngineerId: type === 'engineer' ? oldValue : null,
            newEngineerId: type === 'engineer' ? newValue : null,
          });
        }
      }
      
      const updated = await storage.updateProjectModule(req.params.id, updateData);
      
      // Handle points for engineer assignment changes
      if (updateData.assignedEngineerId !== undefined && 
          updateData.assignedEngineerId !== currentModule.assignedEngineerId) {
        if (updateData.assignedEngineerId) {
          await handleAssignment({
            module: "projects",
            entityId: req.params.id,
            newAssigneeId: updateData.assignedEngineerId,
            previousAssigneeId: currentModule.assignedEngineerId,
            assignedById: changedBy || '',
            department: currentModule.departmentName,
          });
        }
      }
      
      // Handle completion bonus for module completion
      if (updateData.completed && !currentModule.completed && updated.assignedEngineerId) {
        await handleCompletion({
          module: "projects",
          entityId: req.params.id,
          completedById: updated.assignedEngineerId,
          department: updated.departmentName,
        });
      }
      
      // Recalculate project completion percentage based on purchased modules only
      if (updated.projectId) {
        const project = await storage.getProject(updated.projectId);
        const lead = project?.leadId ? await storage.getLead(project.leadId) : null;
        const purchasedModuleNames = lead?.selectedModules || [];
        
        const allModules = await storage.getProjectModules(updated.projectId);
        
        // Get module names for filtering
        const modulesWithNames = await Promise.all(
          allModules.map(async (pm) => {
            const module = await storage.getModule(pm.moduleId);
            return { ...pm, moduleName: module?.name || '' };
          })
        );
        
        // Filter to purchased modules only
        const purchasedModules = modulesWithNames.filter(m => 
          purchasedModuleNames.includes(m.moduleName)
        );
        
        const completedCount = purchasedModules.filter(m => m.completed).length;
        const totalCount = purchasedModules.length;
        const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        await storage.updateProject(updated.projectId, { completionPercentage });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating project module:", error);
      res.status(400).json({ message: "Failed to update project module" });
    }
  });

  // Project Progress Entry routes - Daily implementation progress tracking
  app.get("/api/projects/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const progressEntries = await storage.getProjectProgressEntries(req.params.id);
      res.json(progressEntries);
    } catch (error) {
      console.error("Error fetching project progress entries:", error);
      res.status(500).json({ message: "Failed to fetch progress entries" });
    }
  });

  app.post("/api/projects/:id/progress", isAuthenticated, async (req: any, res) => {
    try {
      // Auto-set progressDate to current timestamp (recording date becomes progress date)
      const now = new Date();
      const validatedData = insertProjectProgressEntrySchema.parse({
        ...req.body,
        projectId: req.params.id,
        engineerId: req.user.claims.sub,
        progressDate: now,
        progressType: req.body.progressType || "installation",
      });
      
      const newEntry = await storage.createProjectProgressEntry(validatedData);
      
      const progressTypeLabel = validatedData.progressType === "installation" ? "Installation" :
                                validatedData.progressType === "training" ? "Training" : "Handoff";
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: req.params.id,
        action: "progress_added",
        description: `${progressTypeLabel} progress recorded at ${now.toLocaleString()}`,
        userId: req.user.claims.sub,
      });
      
      res.status(201).json(newEntry);
    } catch (error) {
      console.error("Error creating progress entry:", error);
      res.status(400).json({ message: "Failed to create progress entry" });
    }
  });

  app.patch("/api/projects/:projectId/progress/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.progressDate) {
        updateData.progressDate = new Date(updateData.progressDate);
      }
      
      const updated = await storage.updateProjectProgressEntry(req.params.id, updateData);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating progress entry:", error);
      res.status(400).json({ message: "Failed to update progress entry" });
    }
  });

  app.delete("/api/projects/:projectId/progress/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteProjectProgressEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting progress entry:", error);
      res.status(400).json({ message: "Failed to delete progress entry" });
    }
  });

  // Planning Change Log routes - Audit trail for module scheduling changes
  app.get("/api/projects/:id/planning-changes", isAuthenticated, async (req, res) => {
    try {
      const changeLogs = await storage.getProjectPlanningChangeLogs(req.params.id);
      
      // Enrich with user names for changedBy, oldEngineerId, newEngineerId
      const enrichedLogs = await Promise.all(
        changeLogs.map(async (log) => {
          const changedByUser = log.changedBy ? await storage.getUser(log.changedBy) : null;
          const oldEngineer = log.oldEngineerId ? await storage.getUser(log.oldEngineerId) : null;
          const newEngineer = log.newEngineerId ? await storage.getUser(log.newEngineerId) : null;
          const projectModule = await storage.getProjectModule(log.projectModuleId);
          const module = projectModule?.moduleId ? await storage.getModule(projectModule.moduleId) : null;
          
          return {
            ...log,
            changedByUser: changedByUser ? { id: changedByUser.id, firstName: changedByUser.firstName, lastName: changedByUser.lastName, email: changedByUser.email } : null,
            oldEngineerName: oldEngineer ? `${oldEngineer.firstName || ''} ${oldEngineer.lastName || ''}`.trim() || oldEngineer.email : null,
            newEngineerName: newEngineer ? `${newEngineer.firstName || ''} ${newEngineer.lastName || ''}`.trim() || newEngineer.email : null,
            moduleName: module?.name || 'Unknown Module',
          };
        })
      );
      
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching planning change logs:", error);
      res.status(500).json({ message: "Failed to fetch planning change logs" });
    }
  });

  app.get("/api/project-modules/:id/planning-changes", isAuthenticated, async (req, res) => {
    try {
      const changeLogs = await storage.getPlanningChangeLogs(req.params.id);
      
      // Enrich with user names
      const enrichedLogs = await Promise.all(
        changeLogs.map(async (log) => {
          const changedByUser = log.changedBy ? await storage.getUser(log.changedBy) : null;
          const oldEngineer = log.oldEngineerId ? await storage.getUser(log.oldEngineerId) : null;
          const newEngineer = log.newEngineerId ? await storage.getUser(log.newEngineerId) : null;
          
          return {
            ...log,
            changedByUser: changedByUser ? { id: changedByUser.id, firstName: changedByUser.firstName, lastName: changedByUser.lastName, email: changedByUser.email } : null,
            oldEngineerName: oldEngineer ? `${oldEngineer.firstName || ''} ${oldEngineer.lastName || ''}`.trim() || oldEngineer.email : null,
            newEngineerName: newEngineer ? `${newEngineer.firstName || ''} ${newEngineer.lastName || ''}`.trim() || newEngineer.email : null,
          };
        })
      );
      
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching module planning change logs:", error);
      res.status(500).json({ message: "Failed to fetch planning change logs" });
    }
  });

  // Training routes
  app.get("/api/projects/:id/training", isAuthenticated, async (req, res) => {
    try {
      const trainingList = await storage.getTrainingRecords(req.params.id);
      res.json(trainingList);
    } catch (error) {
      console.error("Error fetching training records:", error);
      res.status(500).json({ message: "Failed to fetch training records" });
    }
  });

  app.post("/api/projects/:id/training", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertTrainingRecordSchema.parse({
        ...req.body,
        projectId: req.params.id,
      });
      const newTraining = await storage.createTrainingRecord(validatedData);
      
      // Send training confirmation email by deriving recipient email from project's lead
      try {
        const project = await storage.getProject(req.params.id);
        
        if (project && project.leadId) {
          const lead = await storage.getLead(project.leadId);
          const module = await storage.getModule(newTraining.moduleId);
          
          if (lead && lead.contactEmail && module) {
            await sendTrainingConfirmationEmail(
              lead.contactEmail,
              lead.contactPerson,
              project.clientName,
              module.name,
              newTraining.trainingDate
            );
          }
        }
      } catch (emailError) {
        // Log error but don't block training record creation
        console.error("Failed to send training confirmation email:", emailError);
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: req.params.id,
        action: "training_logged",
        description: `Training completed: ${newTraining.recipientName} - ${newTraining.trainingHours}h`,
        userId: req.user.claims.sub,
      });
      
      res.json(newTraining);
    } catch (error) {
      console.error("Error creating training record:", error);
      res.status(400).json({ message: "Failed to create training record" });
    }
  });

  // Training Session routes (scheduled training)
  app.get("/api/projects/:id/training-sessions", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getTrainingSessions(req.params.id);
      
      // Attach module and engineer details
      const withDetails = await Promise.all(
        sessions.map(async (session) => {
          const module = await storage.getModule(session.moduleId);
          const engineer = session.assignedEngineerId 
            ? await storage.getUser(session.assignedEngineerId) 
            : undefined;
          return { ...session, module, engineer };
        })
      );
      
      res.json(withDetails);
    } catch (error) {
      console.error("Error fetching training sessions:", error);
      res.status(500).json({ message: "Failed to fetch training sessions" });
    }
  });

  app.post("/api/projects/:id/training-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const sessionData = {
        ...req.body,
        projectId: req.params.id,
        scheduledDate: new Date(req.body.scheduledDate),
      };
      
      const newSession = await storage.createTrainingSession(sessionData);
      
      // Send training confirmation email
      try {
        const project = await storage.getProject(req.params.id);
        const module = await storage.getModule(newSession.moduleId);
        
        if (sessionData.recipientEmail && module && project) {
          await sendTrainingConfirmationEmail(
            sessionData.recipientEmail,
            sessionData.recipientName,
            project.clientName,
            module.name,
            newSession.scheduledDate
          );
        }
      } catch (emailError) {
        console.error("Failed to send training confirmation email:", emailError);
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: req.params.id,
        action: "training_scheduled",
        description: `Training scheduled for ${newSession.recipientName} on ${new Date(newSession.scheduledDate).toLocaleDateString()}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newSession);
    } catch (error) {
      console.error("Error creating training session:", error);
      res.status(400).json({ message: "Failed to create training session" });
    }
  });

  app.patch("/api/training-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.scheduledDate) {
        updateData.scheduledDate = new Date(updateData.scheduledDate);
      }
      if (updateData.completedAt) {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      
      const updated = await storage.updateTrainingSession(req.params.id, updateData);
      
      // If completed, create a training record
      if (updateData.status === 'completed' && updateData.completedAt) {
        const session = await storage.getTrainingSession(req.params.id);
        if (session) {
          await storage.createTrainingRecord({
            projectId: session.projectId,
            moduleId: session.moduleId,
            trainingSessionId: session.id,
            recipientName: session.recipientName,
            trainingHours: session.scheduledHours,
            trainingDate: updateData.completedAt,
            notes: session.notes,
          });
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating training session:", error);
      res.status(400).json({ message: "Failed to update training session" });
    }
  });

  app.delete("/api/training-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTrainingSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training session:", error);
      res.status(400).json({ message: "Failed to delete training session" });
    }
  });

  // Project Handoff routes
  app.get("/api/projects/:id/handoff", isAuthenticated, async (req, res) => {
    try {
      const handoff = await storage.getProjectHandoff(req.params.id);
      res.json(handoff || null);
    } catch (error) {
      console.error("Error fetching project handoff:", error);
      res.status(500).json({ message: "Failed to fetch project handoff" });
    }
  });

  app.post("/api/projects/:id/handoff", isAuthenticated, async (req: any, res) => {
    try {
      // Convert date strings to Date objects
      const requestData = { ...req.body };
      if (requestData.completionCertificateDate) {
        requestData.completionCertificateDate = new Date(requestData.completionCertificateDate);
      }
      if (requestData.handoffDate) {
        requestData.handoffDate = new Date(requestData.handoffDate);
      }
      
      const handoffData = {
        ...requestData,
        projectId: req.params.id,
        handoffById: req.user.claims.sub,
      };
      
      // Check if handoff already exists
      const existing = await storage.getProjectHandoff(req.params.id);
      
      let handoff;
      if (existing) {
        handoff = await storage.updateProjectHandoff(existing.id, handoffData);
      } else {
        handoff = await storage.createProjectHandoff(handoffData);
      }
      
      // Update project status if handed off
      if (handoffData.status === 'handed_off') {
        await storage.updateProject(req.params.id, { 
          status: 'completed',
          completionPercentage: 100,
        });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "project",
        entityId: req.params.id,
        action: handoffData.status === 'handed_off' ? "handed_off" : "handoff_updated",
        description: handoffData.status === 'handed_off' 
          ? `Project handed off to ${handoffData.handoffToTeam} team`
          : `Project handoff status updated`,
        userId: req.user.claims.sub,
      });
      
      res.json(handoff);
    } catch (error) {
      console.error("Error creating/updating project handoff:", error);
      res.status(400).json({ message: "Failed to create/update project handoff" });
    }
  });

  // Ticket reopen route
  app.post("/api/tickets/:id/reopen", isAuthenticated, async (req: any, res) => {
    try {
      const originalTicket = await storage.getTicket(req.params.id);
      if (!originalTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Create new ticket as reopened from original
      const newTicketData = {
        customerId: originalTicket.customerId,
        projectId: originalTicket.projectId,
        moduleId: originalTicket.moduleId,
        customerName: originalTicket.customerName,
        customerEmail: originalTicket.customerEmail,
        customerPhone: originalTicket.customerPhone,
        issueSummary: `[REOPENED] ${originalTicket.issueSummary}`,
        issueDescription: req.body.reopenReason || originalTicket.issueDescription,
        priority: originalTicket.priority,
        status: 'open',
        reopenedFromTicketId: originalTicket.id,
        reopenReason: req.body.reopenReason,
        reopenedAt: new Date(),
      };
      
      const newTicket = await storage.createTicket(newTicketData);
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: newTicket.id,
        action: "reopened",
        description: `Ticket reopened from ${originalTicket.ticketNumber}: ${req.body.reopenReason || 'No reason provided'}`,
        userId: req.user.claims.sub,
      });
      
      invalidateCache("tickets:");
      invalidateCache("dashboard:");
      res.json(newTicket);
    } catch (error) {
      console.error("Error reopening ticket:", error);
      res.status(400).json({ message: "Failed to reopen ticket" });
    }
  });

  // Sales Dashboard API - restricted to admin and sales_executive roles
  app.get("/api/dashboard/sales", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Get filter parameters
      const executiveIdFilter = req.query.executiveId as string | undefined;
      const startDateFilter = req.query.startDate as string | undefined;
      const endDateFilter = req.query.endDate as string | undefined;
      
      // Parse date filters
      const filterStartDate = startDateFilter ? new Date(startDateFilter + 'T00:00:00') : null;
      const filterEndDate = endDateFilter ? new Date(endDateFilter + 'T23:59:59.999') : null;
      
      // Check if user has access to sales dashboard (admin, sales_executive, sales_head, or super admin)
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser?.role === 'admin';
      const isSalesExec = currentUser?.role === 'sales_executive';
      const isSalesHead = currentUser?.role === 'sales_head';
      
      // Check if user is a department head and get their departments (using junction table)
      const managedDepartments = await storage.getDepartmentsByHead(userId);
      const isDeptHead = managedDepartments.length > 0;
      
      if (!isSuperAdmin && !isAdmin && !isSalesExec && !isSalesHead && !isDeptHead) {
        return res.status(403).json({ message: "Access denied. Sales dashboard requires admin, sales executive, sales head, or department head role." });
      }

      // Check cache (key is per-user + filters)
      const salesCacheKey = `dashboard:sales:${userId}:${executiveIdFilter || ''}:${startDateFilter || ''}:${endDateFilter || ''}`;
      const salesCached = getCached<any>(salesCacheKey);
      if (salesCached) return res.json(salesCached);
      
      // Get users first for department filtering
      const allUsers = await storage.getUsers();
      
      // Get leads - filter based on role/department
      let allLeads = await storage.getLeads({});
      
      // Non-admin sales executives only see their own leads
      if (!isSuperAdmin && !isAdmin && isSalesExec && !isDeptHead) {
        allLeads = allLeads.filter(l => l.salesExecutiveId === userId);
      }
      // Department heads see leads assigned to users in their departments + unassigned leads
      else if (!isSuperAdmin && !isAdmin && isDeptHead) {
        // Get all users in the department head's departments
        const managedDeptIds = new Set(managedDepartments.map(d => d.id));
        const deptUsers = allUsers.filter(u => u.departmentId && managedDeptIds.has(u.departmentId));
        const deptUserIds = new Set(deptUsers.map(u => u.id));
        // Include leads assigned to department users OR unassigned leads (no salesExecutiveId)
        allLeads = allLeads.filter(l => !l.salesExecutiveId || deptUserIds.has(l.salesExecutiveId));
      }
      
      // Apply executive filter if provided
      if (executiveIdFilter) {
        allLeads = allLeads.filter(l => l.salesExecutiveId === executiveIdFilter);
      }
      
      // Apply date range filter if provided (filter by createdAt)
      if (filterStartDate && filterEndDate) {
        allLeads = allLeads.filter(l => {
          if (!l.createdAt) return false;
          const leadDate = new Date(l.createdAt);
          return leadDate >= filterStartDate && leadDate <= filterEndDate;
        });
      }
      
      const allFollowUps = await storage.getAllFollowUps();
      // Filter followups to only those for visible leads
      const leadIds = new Set(allLeads.map(l => l.id));
      let filteredFollowUps = allFollowUps.filter(f => leadIds.has(f.leadId));
      
      // Apply date range filter to followups
      if (filterStartDate && filterEndDate) {
        filteredFollowUps = filteredFollowUps.filter(f => {
          const fDate = new Date(f.followUpDate);
          return fDate >= filterStartDate && fDate <= filterEndDate;
        });
      }
      
      // Get current date boundaries
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // This month start and end
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // This year start and end
      const thisYearStart = new Date(now.getFullYear(), 0, 1);
      const thisYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      // Helper function to calculate lead value
      const getLeadValue = (lead: any) => lead.confirmedOrderValue || lead.estimatedValue || 0;
      
      // ============= SEED STATS (Cold Calls) =============
      const seedStageLeads = allLeads.filter(l => l.stage === 'seed');
      
      // Today's seeds (created today with stage = seed)
      const todaySeeds = seedStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= today && new Date(l.createdAt) < tomorrow
      );
      const seedToday = {
        qty: todaySeeds.length,
        amount: todaySeeds.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This month seeds
      const thisMonthSeeds = seedStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= thisMonthStart && new Date(l.createdAt) <= thisMonthEnd
      );
      const seedMonth = {
        qty: thisMonthSeeds.length,
        amount: thisMonthSeeds.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This year seeds (or all current seeds)
      const thisYearSeeds = seedStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= thisYearStart && new Date(l.createdAt) <= thisYearEnd
      );
      const seedYear = {
        qty: thisYearSeeds.length,
        amount: thisYearSeeds.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // ============= LEAD STATS (Hot - converted from seeds) =============
      const leadStageLeads = allLeads.filter(l => l.stage === 'lead');
      
      // Today's leads (converted to lead stage today - check updatedAt or createdAt)
      const todayLeads = leadStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= today && new Date(l.createdAt) < tomorrow
      );
      const leadToday = {
        qty: todayLeads.length,
        amount: todayLeads.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This month leads
      const thisMonthLeads = leadStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= thisMonthStart && new Date(l.createdAt) <= thisMonthEnd
      );
      const leadMonth = {
        qty: thisMonthLeads.length,
        amount: thisMonthLeads.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This year leads (or all current leads in lead stage)
      const thisYearLeads = leadStageLeads.filter(l => 
        l.createdAt && new Date(l.createdAt) >= thisYearStart && new Date(l.createdAt) <= thisYearEnd
      );
      const leadYear = {
        qty: thisYearLeads.length,
        amount: thisYearLeads.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // ============= FOLLOWUP STATS =============
      // Overdue followups (pending from past days - should show on dashboard until completed)
      const overdueFollowups = filteredFollowUps.filter(f => {
        if (f.completed) return false;
        const fDate = new Date(f.followUpDate);
        return fDate < today; // Past due and not completed
      });
      
      // Today's followups
      const todayFollowups = filteredFollowUps.filter(f => {
        const fDate = new Date(f.followUpDate);
        return fDate >= today && fDate < tomorrow;
      });
      
      // Combined pending: today's pending + all overdue (yesterday's and before)
      const totalPendingFollowups = todayFollowups.filter(f => !f.completed).length + overdueFollowups.length;
      
      const followupToday = {
        qty: todayFollowups.length + overdueFollowups.length, // Include overdue in today's view
        pending: totalPendingFollowups,
        completed: todayFollowups.filter(f => f.completed).length,
        overdue: overdueFollowups.length, // Separately track overdue count
      };
      
      // This month followups
      const thisMonthFollowups = filteredFollowUps.filter(f => {
        const fDate = new Date(f.followUpDate);
        return fDate >= thisMonthStart && fDate <= thisMonthEnd;
      });
      const followupMonth = {
        qty: thisMonthFollowups.length,
        pending: thisMonthFollowups.filter(f => !f.completed).length,
        completed: thisMonthFollowups.filter(f => f.completed).length,
        overdue: thisMonthFollowups.filter(f => !f.completed && new Date(f.followUpDate) < today).length,
      };
      
      // This year followups
      const thisYearFollowups = filteredFollowUps.filter(f => {
        const fDate = new Date(f.followUpDate);
        return fDate >= thisYearStart && fDate <= thisYearEnd;
      });
      const followupYear = {
        qty: thisYearFollowups.length,
        pending: thisYearFollowups.filter(f => !f.completed).length,
        completed: thisYearFollowups.filter(f => f.completed).length,
        overdue: thisYearFollowups.filter(f => !f.completed && new Date(f.followUpDate) < today).length,
      };
      
      // ============= DEAL STATS (Closed Won) =============
      const closedWonLeads = allLeads.filter(l => l.stage === 'closed_won');
      
      // Today's deals
      const todayDeals = closedWonLeads.filter(l => 
        l.closedDate && new Date(l.closedDate) >= today && new Date(l.closedDate) < tomorrow
      );
      const dealToday = {
        qty: todayDeals.length,
        amount: todayDeals.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This month deals
      const thisMonthDeals = closedWonLeads.filter(l => 
        l.closedDate && new Date(l.closedDate) >= thisMonthStart && new Date(l.closedDate) <= thisMonthEnd
      );
      const dealMonth = {
        qty: thisMonthDeals.length,
        amount: thisMonthDeals.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This year deals
      const thisYearDeals = closedWonLeads.filter(l => 
        l.closedDate && new Date(l.closedDate) >= thisYearStart && new Date(l.closedDate) <= thisYearEnd
      );
      const dealYear = {
        qty: thisYearDeals.length,
        amount: thisYearDeals.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // ============= NEGOTIATION STATS =============
      const negotiationLeads = allLeads.filter(l => l.stage === 'negotiation');
      
      // Today's negotiation (entered negotiation today)
      const todayNegotiations = negotiationLeads.filter(l => {
        if (!l.negotiationDate) return false;
        const negDate = new Date(l.negotiationDate);
        return negDate >= today && negDate < tomorrow;
      });
      const negotiationToday = {
        qty: todayNegotiations.length,
        amount: todayNegotiations.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This month negotiation
      const thisMonthNegotiations = negotiationLeads.filter(l => {
        if (!l.negotiationDate) return false;
        const negDate = new Date(l.negotiationDate);
        return negDate >= thisMonthStart && negDate <= thisMonthEnd;
      });
      const negotiationMonth = {
        qty: thisMonthNegotiations.length,
        amount: thisMonthNegotiations.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // This year negotiation (or all current negotiations)
      const thisYearNegotiations = negotiationLeads.filter(l => {
        if (!l.negotiationDate) return true; // Include all active negotiations
        const negDate = new Date(l.negotiationDate);
        return negDate >= thisYearStart && negDate <= thisYearEnd;
      });
      const negotiationYear = {
        qty: thisYearNegotiations.length,
        amount: thisYearNegotiations.reduce((sum, l) => sum + getLeadValue(l), 0),
      };
      
      // ============= LEGACY STATS (for backwards compatibility) =============
      const totalLeadsCount = allLeads.length;
      const totalFollowupCount = filteredFollowUps.length;
      const totalSalesCount = closedWonLeads.length;
      const totalSalesValue = closedWonLeads.reduce((sum, l) => sum + getLeadValue(l), 0);
      const totalExpClosingCount = negotiationLeads.length;
      const closedLostLeads = allLeads.filter(l => l.stage === 'closed_lost');
      const todayLossCount = closedLostLeads.filter(l => 
        l.closedDate && new Date(l.closedDate) >= today && new Date(l.closedDate) < tomorrow
      ).length;
      
      // Add user info to leads for display, including overdue followup indicators
      const leadsWithSalesExec = allLeads.map(lead => {
        const salesExec = allUsers.find(u => u.id === lead.salesExecutiveId);
        // Check if this lead has any overdue followups
        const leadFollowups = filteredFollowUps.filter(f => f.leadId === lead.id);
        const overdueLeadFollowups = leadFollowups.filter(f => {
          if (f.completed) return false;
          const fDate = new Date(f.followUpDate);
          return fDate < today;
        });
        const hasOverdueFollowup = overdueLeadFollowups.length > 0;
        const oldestOverdueDays = hasOverdueFollowup 
          ? Math.max(...overdueLeadFollowups.map(f => Math.floor((today.getTime() - new Date(f.followUpDate).getTime()) / (1000 * 60 * 60 * 24))))
          : 0;
          
        return {
          ...lead,
          salesExecutiveName: salesExec ? `${salesExec.firstName || ''} ${salesExec.lastName || ''}`.trim() || salesExec.email : null,
          hasOverdueFollowup,
          overdueFollowupCount: overdueLeadFollowups.length,
          oldestOverdueDays,
        };
      }).sort((a, b) => {
        // Sort leads with overdue followups first
        if (a.hasOverdueFollowup && !b.hasOverdueFollowup) return -1;
        if (!a.hasOverdueFollowup && b.hasOverdueFollowup) return 1;
        return 0;
      });
      
      // Add lead info to followups, mark overdue ones, and filter to show relevant ones
      const relevantFollowUps = filteredFollowUps.filter(f => {
        // Include: overdue (pending from past) OR today's followups OR future pending
        if (!f.completed) return true; // All incomplete followups should show
        // For completed, only show today's completed
        const fDate = new Date(f.followUpDate);
        return fDate >= today && fDate < tomorrow;
      });
      
      const followUpsWithLead = relevantFollowUps.map(followUp => {
        const lead = allLeads.find(l => l.id === followUp.leadId);
        const fDate = new Date(followUp.followUpDate);
        const isOverdue = !followUp.completed && fDate < today;
        return {
          ...followUp,
          leadCompanyName: lead?.companyName || null,
          leadContactPerson: lead?.contactPerson || null,
          leadStage: lead?.stage || null,
          isOverdue,
          daysOverdue: isOverdue ? Math.floor((today.getTime() - fDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        };
      }).sort((a, b) => {
        // Sort: overdue first, then by date
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime();
      });
      
      const salesDashResult = {
        stats: {
          totalSalesCount,
          totalSalesValue,
          totalLeadsCount,
          totalFollowupCount,
          totalExpClosingCount,
          todayLossCount,
        },
        grouped: {
          seed: {
            today: seedToday,
            month: seedMonth,
            year: seedYear,
          },
          lead: {
            today: leadToday,
            month: leadMonth,
            year: leadYear,
          },
          followup: {
            today: followupToday,
            month: followupMonth,
            year: followupYear,
          },
          deal: {
            today: dealToday,
            month: dealMonth,
            year: dealYear,
          },
          negotiation: {
            today: negotiationToday,
            month: negotiationMonth,
            year: negotiationYear,
          },
        },
        leads: leadsWithSalesExec,
        followUps: followUpsWithLead,
      };
      // Cache per-user (with filters) for 5 minutes
      setCached(salesCacheKey, salesDashResult, 300);
      res.json(salesDashResult);
    } catch (error) {
      console.error("Error fetching sales dashboard:", error);
      res.status(500).json({ message: "Failed to fetch sales dashboard" });
    }
  });

  // Lead Comments API - with authorization
  app.get("/api/leads/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Get the lead to check authorization
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Authorization check (same as history)
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser?.role === 'admin';
      const isSalesExec = currentUser?.role === 'sales_executive';
      
      const managedDepartments = await storage.getDepartmentsByHead(userId);
      const isDeptHead = managedDepartments.length > 0;
      
      // Get users to check department membership
      const users = await storage.getUsers();
      
      if (!isSuperAdmin && !isAdmin) {
        if (isDeptHead) {
          // Get users in department head's departments
          const managedDeptIds = new Set(managedDepartments.map(d => d.id));
          const deptUsers = users.filter(u => u.departmentId && managedDeptIds.has(u.departmentId));
          const deptUserIds = new Set(deptUsers.map(u => u.id));
          if (!lead.salesExecutiveId || !deptUserIds.has(lead.salesExecutiveId)) {
            return res.status(403).json({ message: "You can only view comments for leads in your department" });
          }
        } else if (isSalesExec) {
          if (lead.salesExecutiveId !== userId) {
            return res.status(403).json({ message: "You can only view comments for your own leads" });
          }
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const comments = await storage.getLeadComments(req.params.id);
      
      // Add user info to comments (users already fetched above)
      const commentsWithUser = comments.map(comment => {
        const user = users.find(u => u.id === comment.userId);
        return {
          ...comment,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          userRole: user?.role || null,
        };
      });
      
      res.json(commentsWithUser);
    } catch (error) {
      console.error("Error fetching lead comments:", error);
      res.status(500).json({ message: "Failed to fetch lead comments" });
    }
  });

  app.post("/api/leads/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Validate comment field
      if (!req.body.comment || typeof req.body.comment !== 'string' || req.body.comment.trim().length === 0) {
        return res.status(400).json({ message: "Comment is required and must be a non-empty string" });
      }
      
      // Check if user is super admin or department head
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
      
      // Check if user is a department head (using junction table)
      const isDeptHeadResult = await storage.isUserDepartmentHead(userId);
      
      if (!isSuperAdmin && !isDeptHeadResult.isDeptHead) {
        return res.status(403).json({ message: "Only super admin and department heads can add comments" });
      }
      
      const newComment = await storage.createLeadComment({
        leadId: req.params.id,
        userId,
        comment: req.body.comment.trim(),
      });
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: req.params.id,
        action: "comment_added",
        description: `Comment added on lead: ${req.body.comment.substring(0, 50)}...`,
        userId,
      });
      
      res.json(newComment);
    } catch (error) {
      console.error("Error creating lead comment:", error);
      res.status(400).json({ message: "Failed to create lead comment" });
    }
  });

  app.delete("/api/leads/:leadId/comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only super admin can delete comments
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      if (user?.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Only super admin can delete comments" });
      }
      
      await storage.deleteLeadComment(req.params.commentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting lead comment:", error);
      res.status(400).json({ message: "Failed to delete lead comment" });
    }
  });

  // Lead full history API - with authorization check
  app.get("/api/leads/:id/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Authorization check: admin, sales exec (own leads), dept head (own department)
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser?.role === 'admin';
      const isSalesExec = currentUser?.role === 'sales_executive';
      
      const managedDepartments = await storage.getDepartmentsByHead(userId);
      const isDeptHead = managedDepartments.length > 0;
      
      // Get users to check department membership
      const users = await storage.getUsers();
      
      // Authorization:
      // - Super admin and admin can see all
      // - Department heads can see leads assigned to users in their department
      // - Sales executives can only view their own leads
      if (!isSuperAdmin && !isAdmin) {
        if (isDeptHead) {
          // Get users in department head's departments
          const managedDeptIds = new Set(managedDepartments.map(d => d.id));
          const deptUsers = users.filter(u => u.departmentId && managedDeptIds.has(u.departmentId));
          const deptUserIds = new Set(deptUsers.map(u => u.id));
          // Check if lead's sales exec is in department
          if (!lead.salesExecutiveId || !deptUserIds.has(lead.salesExecutiveId)) {
            return res.status(403).json({ message: "You can only view history for leads in your department" });
          }
        } else if (isSalesExec) {
          // Sales exec can only see their own leads
          if (lead.salesExecutiveId !== userId) {
            return res.status(403).json({ message: "You can only view history for your own leads" });
          }
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Get all related data
      const [followUps, demoHistory, negotiationHistory, quotes, comments, allTasks] = await Promise.all([
        storage.getFollowUpsByLead(req.params.id),
        storage.getDemoDateHistory(req.params.id),
        storage.getNegotiationDateHistory(req.params.id),
        storage.getQuotesByLead(req.params.id),
        storage.getLeadComments(req.params.id),
        storage.getTasks({ includeAll: true }),
      ]);
      
      // Filter tasks related to this lead
      const tasks = allTasks.filter(t => 
        t.relatedEntityType === 'lead' && t.relatedEntityId === req.params.id
      );
      
      // users already fetched above for authorization check
      // Add user info to comments
      const commentsWithUser = comments.map((comment: any) => {
        const user = users.find(u => u.id === comment.userId);
        return {
          ...comment,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          userRole: user?.role || null,
        };
      });
      
      // Get sales executive info
      const salesExec = users.find(u => u.id === lead.salesExecutiveId);
      
      res.json({
        lead: {
          ...lead,
          salesExecutiveName: salesExec ? `${salesExec.firstName || ''} ${salesExec.lastName || ''}`.trim() || salesExec.email : null,
        },
        followUps,
        demoHistory,
        negotiationHistory,
        quotes,
        comments: commentsWithUser,
        tasks,
      });
    } catch (error) {
      console.error("Error fetching lead history:", error);
      res.status(500).json({ message: "Failed to fetch lead history" });
    }
  });

  // Implementation Dashboard stats
  app.get("/api/dashboard/implementation", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("dashboard:implementation");
      if (cached) return res.json(cached);

      // Get all projects with modules and engineers
      const projectsList = await storage.getProjects({});
      
      const projectsWithDetails = await Promise.all(
        projectsList.map(async (project) => {
          const modulesList = await storage.getProjectModules(project.id);
          const engineerAssignments = await storage.getProjectEngineers(project.id);
          const trainingSessions = await storage.getTrainingSessions(project.id);
          const handoff = await storage.getProjectHandoff(project.id);
          
          // Get lead to find purchased modules
          const lead = project.leadId ? await storage.getLead(project.leadId) : null;
          const purchasedModuleNames = lead?.selectedModules || [];
          
          // Get module details with assigned engineers
          const modulesWithDetails = await Promise.all(
            modulesList.map(async (pm) => {
              const module = await storage.getModule(pm.moduleId);
              const assignedEngineer = pm.assignedEngineerId 
                ? await storage.getUser(pm.assignedEngineerId) 
                : undefined;
              return { ...pm, module, assignedEngineer };
            })
          );
          
          // Filter to only purchased modules for progress calculation
          const purchasedModules = modulesWithDetails.filter(m => 
            purchasedModuleNames.includes(m.module?.name || '')
          );
          
          // Recalculate completion percentage based on purchased modules only
          const completedPurchasedModules = purchasedModules.filter(m => m.completed).length;
          const totalPurchasedModules = purchasedModules.length;
          const calculatedPercentage = totalPurchasedModules > 0 
            ? Math.round((completedPurchasedModules / totalPurchasedModules) * 100) 
            : 0;
          
          // Update project if stored percentage differs from calculated
          if (project.completionPercentage !== calculatedPercentage) {
            await storage.updateProject(project.id, { completionPercentage: calculatedPercentage });
            project.completionPercentage = calculatedPercentage;
          }
          
          // Get engineer details
          const engineers = await Promise.all(
            engineerAssignments.map(async (a) => storage.getUser(a.engineerId))
          );
          
          return {
            ...project,
            completionPercentage: calculatedPercentage,
            modules: modulesWithDetails,
            purchasedModules: purchasedModuleNames,
            engineers: engineers.filter(Boolean),
            trainingSessions,
            handoff,
          };
        })
      );
      
      // Calculate summary stats
      const totalProjects = projectsList.length;
      const inProgress = projectsList.filter(p => p.status === 'in_progress').length;
      const inTraining = projectsList.filter(p => p.status === 'training').length;
      const completed = projectsList.filter(p => p.status === 'completed').length;
      const pendingHandoff = projectsWithDetails.filter(p => 
        p.completionPercentage === 100 && (!p.handoff || p.handoff.status !== 'handed_off')
      ).length;
      
      const result = {
        projects: projectsWithDetails,
        stats: {
          totalProjects,
          inProgress,
          inTraining,
          completed,
          pendingHandoff,
        },
      };
      setCached("dashboard:implementation", result, 900);
      res.json(result);
    } catch (error) {
      console.error("Error fetching implementation dashboard:", error);
      res.status(500).json({ message: "Failed to fetch implementation dashboard" });
    }
  });

  // Progress entries across all projects - for Work Tracking dashboard
  app.get("/api/dashboard/progress-entries", isAuthenticated, async (req, res) => {
    try {
      // Get all projects
      const projectsList = await storage.getProjects({});
      
      // Get all progress entries from all projects
      const allEntries = await Promise.all(
        projectsList.map(async (project) => {
          const entries = await storage.getProjectProgressEntries(project.id);
          return entries.map(entry => ({
            ...entry,
            project: { id: project.id, clientName: project.clientName },
          }));
        })
      );
      
      // Flatten and sort by date (most recent first)
      const flatEntries = allEntries
        .flat()
        .sort((a, b) => new Date(b.progressDate).getTime() - new Date(a.progressDate).getTime());
      
      res.json(flatEntries);
    } catch (error) {
      console.error("Error fetching progress entries:", error);
      res.status(500).json({ message: "Failed to fetch progress entries" });
    }
  });

  // Support Dashboard API
  app.get("/api/dashboard/support", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("dashboard:support");
      if (cached) return res.json(cached);

      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      // Single aggregate query for all stats — avoids fetching 2800+ rows into JS
      const [statsRows, recentTickets, users, devTaskRows] = await Promise.all([
        db.select({
          totalTickets: sql<number>`COUNT(*)`,
          assignedCount: sql<number>`COUNT(CASE WHEN assigned_engineer_id IS NOT NULL THEN 1 END)`,
          unassignedCount: sql<number>`COUNT(CASE WHEN assigned_engineer_id IS NULL AND status NOT IN ('closed','resolved','resolved_at_techteam','pending_feedback') THEN 1 END)`,
          openCount: sql<number>`COUNT(CASE WHEN status = 'open' THEN 1 END)`,
          inProcessCount: sql<number>`COUNT(CASE WHEN status = 'in_progress' THEN 1 END)`,
          completedCount: sql<number>`COUNT(CASE WHEN status IN ('closed','resolved','resolved_at_techteam','pending_feedback') THEN 1 END)`,
          completedTodayCount: sql<number>`COUNT(CASE WHEN status IN ('closed','resolved','resolved_at_techteam','pending_feedback') AND (closed_at >= ${todayStart} OR updated_at >= ${todayStart}) THEN 1 END)`,
          reopenedCount: sql<number>`COUNT(CASE WHEN status = 'reopened' OR reopened_from_ticket_id IS NOT NULL THEN 1 END)`,
          pendingCustomerCount: sql<number>`COUNT(CASE WHEN status = 'pending_customer' THEN 1 END)`,
          escalatedCount: sql<number>`COUNT(CASE WHEN status = 'escalated' OR (escalation_level IS NOT NULL AND escalation_level > 1) THEN 1 END)`,
          reassignedCount: sql<number>`COUNT(CASE WHEN assigned_engineer_id IS NOT NULL AND updated_at IS NOT NULL AND created_at IS NOT NULL AND EXTRACT(EPOCH FROM (updated_at - created_at)) > 60 THEN 1 END)`,
          longProcessingCount: sql<number>`COUNT(CASE WHEN status = 'in_progress' AND updated_at < ${thirtyMinAgo} THEN 1 END)`,
        }).from(tickets),
        // Only fetch the 100 most recent tickets for the display list
        db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(100),
        storage.getUsers(),
        db.select({
          sourceId: sql<string>`source_id`,
          status: sql<string>`status`,
          taskNumber: sql<string>`task_number`,
        }).from(sql`development_tasks`).where(sql`source_type = 'support' AND source_id IS NOT NULL`),
      ]);

      const s = statsRows[0];

      // Build dev task map
      const ticketDevTaskMap = new Map<string, { hasPendingDev: boolean; devTaskStatus: string; devTaskNumber: string }>();
      for (const task of devTaskRows) {
        const isPending = task.status !== 'completed' && task.status !== 'cancelled';
        if (!ticketDevTaskMap.has(task.sourceId) || isPending) {
          ticketDevTaskMap.set(task.sourceId, { hasPendingDev: isPending, devTaskStatus: task.status, devTaskNumber: task.taskNumber });
        }
      }

      // Count pending dev tickets from the aggregate (approximate using dev task map)
      const pendingDevTicketIds = new Set([...ticketDevTaskMap.entries()].filter(([, v]) => v.hasPendingDev).map(([k]) => k));
      const pendingDevelopmentCount = pendingDevTicketIds.size;

      // Build user map for display
      const userMap = new Map(users.map(u => [u.id, u]));

      const ticketsWithAssignee = recentTickets.map(ticket => {
        const assignee = ticket.assignedEngineerId ? userMap.get(ticket.assignedEngineerId) : null;
        const devInfo = ticketDevTaskMap.get(ticket.id);
        return {
          ...ticket,
          assigneeName: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email : null,
          hasPendingDevelopment: devInfo?.hasPendingDev || false,
          devTaskStatus: devInfo?.devTaskStatus || null,
          devTaskNumber: devInfo?.devTaskNumber || null,
        };
      });

      const result = {
        stats: {
          totalTickets: Number(s.totalTickets),
          assignedCount: Number(s.assignedCount),
          unassignedCount: Number(s.unassignedCount),
          openCount: Number(s.openCount),
          inProcessCount: Number(s.inProcessCount),
          completedCount: Number(s.completedCount),
          completedTodayCount: Number(s.completedTodayCount),
          pendingCustomerCount: Number(s.pendingCustomerCount),
          escalatedCount: Number(s.escalatedCount),
          reassignedCount: Number(s.reassignedCount),
          reopenedCount: Number(s.reopenedCount),
          longProcessingCount: Number(s.longProcessingCount),
          pendingDevelopmentCount,
        },
        tickets: ticketsWithAssignee,
      };
      setCached("dashboard:support", result, 900);
      res.json(result);
    } catch (error) {
      console.error("Error fetching support dashboard:", error);
      res.status(500).json({ message: "Failed to fetch support dashboard" });
    }
  });

  // Ticket routes
  
  // Get current user's assigned tickets (for dashboard "My Tickets" section)
  app.get("/api/tickets/my-assigned", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUser(authId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const cacheKey = `tickets:my-assigned:${user.id}`;
      const cached = getCached<any>(cacheKey);
      if (cached) {
        console.log(`[Tickets] Found ${cached.length} assigned tickets for user ${user.email} (cached)`);
        return res.json(cached);
      }

      // Filter directly in DB — no need to load all 2800+ tickets
      const myTickets = await db.select().from(tickets)
        .where(eq(tickets.assignedEngineerId, user.id))
        .orderBy(
          sql`CASE WHEN status IN ('closed','resolved','resolved_at_techteam','pending_feedback') THEN 1 ELSE 0 END`,
          desc(tickets.createdAt)
        )
        .limit(200);

      console.log(`[Tickets] Found ${myTickets.length} assigned tickets for user ${user.email} (db id: ${user.id})`);
      setCached(cacheKey, myTickets, 300);
      res.json(myTickets);
    } catch (error) {
      console.error("Error fetching user's assigned tickets:", error);
      res.status(500).json({ message: "Failed to fetch assigned tickets" });
    }
  });
  
  // Get all tickets - Everyone can see their own assigned tickets
  app.get("/api/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const { assignedTo, fromDate, toDate, search, category, statusTab, status, priority, customerId, page, pageSize } = req.query;
      const authId = req.user?.claims?.sub;

      // For full-access users (admin/dept-head) share a single cache so one warm request benefits all
      const accessControl = await getAllowedUserIdsForUser(authId);
      const cachePrefix = accessControl.hasFullAccess ? 'shared' : authId;
      const cacheKey = `tickets:v2:${cachePrefix}:${assignedTo||''}:${fromDate||''}:${toDate||''}:${search||''}:${category||''}:${statusTab||''}:${status||''}:${priority||''}:${customerId||''}:${page||1}:${pageSize||50}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      // Resolve assignedEngineerIds with access control
      let assignedEngineerIds: string[] | undefined;
      if (!accessControl.hasFullAccess && accessControl.allowedUserIds) {
        if (assignedTo && assignedTo !== 'all') {
          assignedEngineerIds = accessControl.allowedUserIds.includes(assignedTo as string)
            ? [assignedTo as string]
            : accessControl.allowedUserIds;
        } else {
          assignedEngineerIds = accessControl.allowedUserIds;
        }
      } else if (assignedTo && assignedTo !== 'all') {
        assignedEngineerIds = [assignedTo as string];
      }

      const result = await storage.getTicketsPaginated({
        assignedEngineerIds,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        search: search as string || undefined,
        category: category as string || undefined,
        statusTab: statusTab as string || undefined,
        status: status && status !== 'all' ? status as string : undefined,
        priority: priority && priority !== 'all' ? priority as string : undefined,
        customerId: customerId && customerId !== 'all' ? customerId as string : undefined,
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
      });

      // Attach dev task info — lightweight query, no user/customer enrichment needed
      let ticketDevTaskMap = getCached<Map<string, { hasActiveDevelopmentTask: boolean; devTaskStatus: string; devTaskNumber: string }>>("devTaskMap");
      if (!ticketDevTaskMap) {
        const devTaskRows = await db
          .select({
            sourceId: sql<string>`source_id`,
            status: sql<string>`status`,
            taskNumber: sql<string>`task_number`,
          })
          .from(sql`development_tasks`)
          .where(sql`source_type = 'support' AND source_id IS NOT NULL`);

        ticketDevTaskMap = new Map();
        for (const task of devTaskRows) {
          const sourceIdStr = String(task.sourceId);
          const isActive = task.status !== 'completed' && task.status !== 'cancelled';
          if (!ticketDevTaskMap.has(sourceIdStr) || isActive) {
            ticketDevTaskMap.set(sourceIdStr, {
              hasActiveDevelopmentTask: isActive,
              devTaskStatus: task.status,
              devTaskNumber: task.taskNumber,
            });
          }
        }
        setCached("devTaskMap", ticketDevTaskMap, 300);
      }

      const ticketsWithDevInfo = result.tickets.map(ticket => {
        const info = ticketDevTaskMap!.get(String(ticket.id));
        return {
          ...ticket,
          hasActiveDevelopmentTask: info?.hasActiveDevelopmentTask || false,
          devTaskStatus: info?.devTaskStatus || null,
          devTaskNumber: info?.devTaskNumber || null,
        };
      });

      const response = { tickets: ticketsWithDevInfo, total: result.total, counts: result.counts };
      setCached(cacheKey, response, 900);
      res.json(response);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", isAuthenticated, requirePermission('tickets', 'view'), async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  app.post("/api/tickets", isAuthenticated, requirePermission('tickets', 'create'), async (req: any, res) => {
    try {
      const validatedData = insertTicketSchema.parse(req.body);
      
      // NO immediate auto-assignment - tickets stay unassigned for 10 minutes
      // to allow manual allocation. After 10 minutes, the scheduler will auto-assign.
      // Only mark as manual assignment if explicitly assigned by user
      if (validatedData.assignedEngineerId) {
        (validatedData as any).assignmentMethod = "manual";
      }
      
      const newTicket = await storage.createTicket(validatedData);
      
      // Award points and record assignment history if ticket is assigned
      // Wrapped in try-catch: these secondary operations must not block ticket creation
      if (newTicket.assignedEngineerId) {
        try {
          await storage.createTicketAssignmentHistory({
            ticketId: newTicket.id,
            engineerId: newTicket.assignedEngineerId,
            assignedAt: new Date(),
          });
        } catch (histErr) {
          console.error("[Ticket] Assignment history insert failed (table may not exist):", histErr);
        }
        
        try {
          await handleAssignment({
            module: "tickets",
            entityId: newTicket.id,
            newAssigneeId: newTicket.assignedEngineerId,
            previousAssigneeId: null,
            assignedById: req.user.claims.sub,
          });
        } catch (assignErr) {
          console.error("[Ticket] handleAssignment failed:", assignErr);
        }
      }
      
      // Log activity
      try {
        await storage.logActivity({
          entityType: "ticket",
          entityId: newTicket.id,
          action: "created",
          description: `New ticket created: ${newTicket.ticketNumber} - ${newTicket.issueSummary}`,
          userId: req.user.claims.sub,
        });
      } catch (logErr) {
        console.error("[Ticket] Activity log failed:", logErr);
      }

      invalidateCache("tickets:");
      invalidateCache("my-department:");
      invalidateCache("dashboard:");
      res.json(newTicket);
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      const detail = error?.message || String(error);
      res.status(400).json({ message: `Failed to create ticket: ${detail}` });
    }
  });

  app.patch("/api/tickets/:id", isAuthenticated, requirePermission('tickets', 'edit'), async (req: any, res) => {
    try {
      // Get current ticket for comparison
      const currentTicket = await storage.getTicket(req.params.id);
      if (!currentTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const updated = await storage.updateTicket(req.params.id, req.body);
      
      // Handle points for engineer assignment changes and record assignment history
      if (req.body.assignedEngineerId !== undefined && 
          req.body.assignedEngineerId !== currentTicket.assignedEngineerId) {
        
        // Close previous assignment in history
        if (currentTicket.assignedEngineerId) {
          const activeAssignment = await storage.getActiveTicketAssignment(req.params.id);
          if (activeAssignment) {
            await storage.updateTicketAssignmentHistory(activeAssignment.id, {
              unassignedAt: new Date(),
              transferredToId: req.body.assignedEngineerId || null,
              transferReason: req.body.transferReason || 'Reassigned',
            });
          }
        }
        
        // Create new assignment history entry
        if (req.body.assignedEngineerId) {
          await storage.createTicketAssignmentHistory({
            ticketId: req.params.id,
            engineerId: req.body.assignedEngineerId,
            assignedAt: new Date(),
          });
          
          await handleAssignment({
            module: "tickets",
            entityId: req.params.id,
            newAssigneeId: req.body.assignedEngineerId,
            previousAssigneeId: currentTicket.assignedEngineerId,
            assignedById: req.user.claims.sub,
          });
        }
      }
      
      // Handle completion bonus for resolved tickets
      if (req.body.status === "resolved" && currentTicket.status !== "resolved" && updated.assignedEngineerId) {
        await handleCompletion({
          module: "tickets",
          entityId: req.params.id,
          completedById: updated.assignedEngineerId,
        });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: updated.id,
        action: "updated",
        description: `Ticket updated: ${updated.ticketNumber} - Status: ${updated.status}`,
        userId: req.user.claims.sub,
      });

      invalidateCache("tickets:");
      invalidateCache("my-department:");
      invalidateCache("dashboard:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(400).json({ message: "Failed to update ticket" });
    }
  });

  // Ticket Comment routes
  app.get("/api/tickets/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const commentsList = await storage.getTicketComments(req.params.id);
      
      // Attach user details
      const withUsers = await Promise.all(
        commentsList.map(async (comment) => {
          const user = comment.userId ? await storage.getUser(comment.userId) : undefined;
          return { ...comment, user };
        })
      );
      
      res.json(withUsers);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/tickets/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertTicketCommentSchema.parse({
        ...req.body,
        ticketId: req.params.id,
        userId: req.user.claims.sub,
      });
      const newComment = await storage.createTicketComment(validatedData);
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: req.params.id,
        action: "comment_added",
        description: `Comment added to ticket`,
        userId: req.user.claims.sub,
      });
      
      res.json(newComment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(400).json({ message: "Failed to create comment" });
    }
  });

  // Escalation routes
  app.get("/api/tickets/:id/escalations", isAuthenticated, async (req, res) => {
    try {
      const escalationsList = await storage.getEscalationHistory(req.params.id);
      res.json(escalationsList);
    } catch (error) {
      console.error("Error fetching escalations:", error);
      res.status(500).json({ message: "Failed to fetch escalations" });
    }
  });

  // Get linked development tasks for a ticket
  app.get("/api/tickets/:id/development-tasks", isAuthenticated, async (req, res) => {
    try {
      const developmentTasksList = await storage.getDevelopmentTasks({
        sourceType: "support",
        sourceId: req.params.id,
      });
      res.json(developmentTasksList);
    } catch (error) {
      console.error("Error fetching linked development tasks:", error);
      res.status(500).json({ message: "Failed to fetch development tasks" });
    }
  });

  // Get HR feedback for a ticket
  app.get("/api/tickets/:id/feedback", isAuthenticated, async (req, res) => {
    try {
      const feedbackList = await storage.getFeedbackListByTicket(req.params.id);
      res.json(feedbackList);
    } catch (error) {
      console.error("Error fetching ticket feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // Get all feedback for reports (with ticket and user details)
  app.get("/api/feedback/all", isAuthenticated, async (req, res) => {
    try {
      const { fromDate, toDate, customerId, workStatus, rating, satisfied } = req.query;

      const cacheKey = `feedback:all:${fromDate||''}:${toDate||''}:${customerId||''}:${workStatus||''}:${rating||''}:${satisfied||''}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      // Build SQL WHERE conditions on the feedback table directly
      const conditions: any[] = [];
      if (fromDate) conditions.push(gte(feedback.submittedAt, new Date(fromDate as string)));
      if (toDate) {
        const end = new Date(toDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(feedback.submittedAt, end));
      }
      if (workStatus) conditions.push(eq(feedback.workStatus, workStatus as string));
      if (rating) conditions.push(eq(feedback.rating, parseInt(rating as string)));
      if (satisfied === "true") conditions.push(eq(feedback.satisfied, true));
      if (satisfied === "false") conditions.push(eq(feedback.satisfied, false));

      let feedbackQuery = db.select().from(feedback).orderBy(desc(feedback.submittedAt)) as any;
      if (conditions.length > 0) feedbackQuery = feedbackQuery.where(and(...conditions));
      const allFeedback = await feedbackQuery;

      // Collect unique IDs for bulk fetches — 4 queries total instead of N×4
      const userIds = [...new Set([
        ...allFeedback.map((f: any) => f.submittedById),
        ...allFeedback.map((f: any) => f.completedById),
      ].filter(Boolean) as string[])];
      const ticketIds = [...new Set(allFeedback.map((f: any) => f.ticketId).filter(Boolean) as string[])];

      const [allUsers, allTickets] = await Promise.all([
        storage.getUsersByIds(userIds),
        storage.getTicketsByIds(ticketIds),
      ]);

      const customerIds = [...new Set(allTickets.map(t => t.customerId).filter(Boolean) as string[])];
      const allCustomers = await storage.getCustomersByIds(customerIds);

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const ticketMap = new Map(allTickets.map(t => [t.id, t]));
      const customerMap = new Map(allCustomers.map(c => [c.id, c]));

      const enrichedFeedback = allFeedback.map((fb: any) => {
        const ticketData = fb.ticketId ? ticketMap.get(fb.ticketId) : undefined;
        return {
          ...fb,
          submittedBy: fb.submittedById ? userMap.get(fb.submittedById) : null,
          completedBy: fb.completedById ? userMap.get(fb.completedById) : null,
          ticket: ticketData
            ? { ...ticketData, customer: ticketData.customerId ? customerMap.get(ticketData.customerId) : undefined }
            : undefined,
        };
      });

      // Filter by customerId after join (since customerId is on the ticket, not feedback)
      const result = customerId
        ? enrichedFeedback.filter((fb: any) => fb.ticket?.customerId === customerId)
        : enrichedFeedback;

      setCached(cacheKey, result, 120); // 2 min cache
      res.json(result);
    } catch (error) {
      console.error("Error fetching all feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post("/api/tickets/:id/escalate", isAuthenticated, async (req: any, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const currentLevel = ticket.escalationLevel || 0;
      
      if (currentLevel >= 3) {
        return res.status(400).json({ message: "Ticket already at maximum escalation level" });
      }
      
      const newLevel = currentLevel + 1;
      
      // Create escalation record
      await storage.createEscalation({
        ticketId: ticket.id,
        fromLevel: currentLevel,
        toLevel: newLevel,
        reason: "Escalated by user",
        escalatedBy: req.user.claims.sub,
      });
      
      // Update ticket
      const updated = await storage.updateTicket(ticket.id, {
        escalationLevel: newLevel,
        status: "escalated",
        escalatedAt: new Date(),
      });
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: ticket.id,
        action: "escalated",
        description: `Ticket escalated to Level ${newLevel}`,
        userId: req.user.claims.sub,
      });
      
      invalidateCache("tickets:");
      invalidateCache("dashboard:");
      res.json(updated);
    } catch (error) {
      console.error("Error escalating ticket:", error);
      res.status(400).json({ message: "Failed to escalate ticket" });
    }
  });

  // Ticket Assignment History routes
  app.get("/api/tickets/:id/assignment-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getTicketAssignmentHistory(req.params.id);
      
      // Transform snake_case to camelCase for frontend
      const transformedHistory = history.map((h: any) => ({
        id: h.id,
        ticketId: h.ticket_id,
        engineerId: h.engineer_id,
        assignedAt: h.assigned_at,
        unassignedAt: h.unassigned_at,
        transferredToId: h.transferred_to_id,
        transferReason: h.transfer_reason,
        actionsTaken: h.actions_taken,
        engineerName: h.engineer_first_name && h.engineer_last_name 
          ? `${h.engineer_first_name} ${h.engineer_last_name}` 
          : 'Unknown',
        engineerEmail: h.engineer_email,
        transferredToName: h.transferred_to_first_name && h.transferred_to_last_name
          ? `${h.transferred_to_first_name} ${h.transferred_to_last_name}`
          : null,
      }));
      
      res.json(transformedHistory);
    } catch (error) {
      console.error("Error fetching assignment history:", error);
      res.status(500).json({ message: "Failed to fetch assignment history" });
    }
  });

  // Enhanced feedback with completion details
  app.post("/api/tickets/:id/feedback-complete", isAuthenticated, async (req: any, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const {
        rating,
        comments,
        satisfied,
        completedById,
        completedAt,
        clientContactPerson,
        clientContactPhone,
        workStatus,
        workDescription,
        reopenedByHr,
        reopenReason,
      } = req.body;

      // Check if feedback already exists
      const existingFeedback = await storage.getFeedbackByTicket(req.params.id);
      
      let feedbackResult;
      if (existingFeedback) {
        // Update existing feedback
        feedbackResult = await storage.updateFeedback(existingFeedback.id, {
          rating,
          comments,
          satisfied,
          completedById,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
          clientContactPerson,
          clientContactPhone,
          workStatus,
          workDescription,
          reopenedByHr,
          reopenReason,
          submittedById: req.user.claims.sub,
        });
      } else {
        // Create new feedback
        feedbackResult = await storage.createFeedback({
          ticketId: req.params.id,
          rating,
          comments,
          satisfied,
          completedById,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
          clientContactPerson,
          clientContactPhone,
          workStatus,
          workDescription,
          reopenedByHr,
          reopenReason,
          submittedById: req.user.claims.sub,
        });
      }

      // If client not satisfied, reopen as Level 2 ticket
      if (reopenedByHr && workStatus === 'not_completed') {
        // Create new Level 2 ticket — use DB count, not full fetch
        const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(tickets);
        const newTicketNumber = `TKT-${String(Number(countRow.count) + 1).padStart(6, '0')}`;
        
        const newTicket = await storage.createTicket({
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          customerPhone: ticket.customerPhone,
          issueSummary: `[Reopened from ${ticket.ticketNumber}] ${ticket.issueSummary}`,
          issueDescription: `Original issue was not completed. Reason: ${reopenReason || 'Client reported incomplete work'}\n\nOriginal Description:\n${ticket.issueDescription}`,
          priority: 'high',
          status: 'open',
          escalationLevel: 2, // Start at Level 2
          reopenedFromTicketId: ticket.id,
          reopenReason: reopenReason || 'Client reported incomplete work',
          reopenedAt: new Date(),
        });

        // Update feedback with new ticket reference
        await storage.updateFeedback(feedbackResult.id, {
          newTicketId: newTicket.id,
        });

        // Log activity
        await storage.logActivity({
          entityType: "ticket",
          entityId: newTicket.id,
          action: "reopened_from_feedback",
          description: `Ticket reopened from ${ticket.ticketNumber} due to incomplete work`,
          userId: req.user.claims.sub,
        });

        invalidateCache("hr:feedback:");
        res.json({ feedback: feedbackResult, newTicket });
      } else {
        invalidateCache("hr:feedback:");
        res.json({ feedback: feedbackResult });
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
      res.status(400).json({ message: "Failed to save feedback" });
    }
  });

  // Get reopened tickets for dashboard notifications
  app.get("/api/tickets/reopened", isAuthenticated, async (req: any, res) => {
    try {
      const cached = getCached<any>("tickets:reopened");
      if (cached) return res.json(cached);

      // Filter directly in DB — no need to load all tickets
      const reopenedTickets = await db.select().from(tickets)
        .where(isNotNull(tickets.reopenedFromTicketId))
        .orderBy(desc(tickets.createdAt))
        .limit(100);

      // Attach engineer details using cached user list
      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const withDetails = reopenedTickets.map(ticket => {
        const assignee = ticket.assignedEngineerId ? userMap.get(ticket.assignedEngineerId) : null;
        return {
          ...ticket,
          assigneeName: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null,
        };
      });

      setCached("tickets:reopened", withDetails, 300);
      res.json(withDetails);
    } catch (error) {
      console.error("Error fetching reopened tickets:", error);
      res.status(500).json({ message: "Failed to fetch reopened tickets" });
    }
  });

  app.post("/api/tickets/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      // Check for active development tasks before allowing closure
      const ticketIdStr = String(req.params.id); // Normalize to string
      const developmentTasks = await storage.getDevelopmentTasks({});
      const activeDevTask = developmentTasks.find(
        task => task.sourceType === 'support' && 
                String(task.sourceId) === ticketIdStr && 
                task.status !== 'completed' && 
                task.status !== 'cancelled'
      );
      
      if (activeDevTask) {
        return res.status(400).json({ 
          message: `Cannot close ticket: Development task ${activeDevTask.taskNumber} is still in progress` 
        });
      }
      
      const { closingNotes } = req.body || {};
      
      const updated = await storage.updateTicket(req.params.id, {
        status: "closed",
        closedAt: new Date(),
        closingNotes: closingNotes || null,
      });
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: updated.id,
        action: "closed",
        description: `Ticket closed: ${updated.ticketNumber}${closingNotes ? ` - ${closingNotes}` : ''}`,
        userId: req.user.claims.sub,
      });
      
      // Send feedback email
      if (updated.customerEmail && updated.customerName && updated.issueSummary) {
        await sendTicketClosureFeedbackEmail(
          updated.customerEmail,
          updated.customerName,
          updated.ticketNumber,
          updated.issueSummary
        );
      }

      // Bust all ticket list caches so the list immediately shows "closed"
      invalidateCache("tickets:");
      invalidateCache("dashboard:");
      res.json(updated);
    } catch (error) {
      console.error("Error closing ticket:", error);
      res.status(400).json({ message: "Failed to close ticket" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("dashboard:stats");
      if (cached) return res.json(cached);
      const stats = await storage.getDashboardStats();
      setCached("dashboard:stats", stats, 300);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Department-specific dashboard stats
  app.get("/api/dashboard/my-department", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cacheKey = `my-department:${userId}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const departmentId = user.departmentId;
      let department = null;
      let isDepartmentHead = false;
      let departmentMembers: any[] = [];
      
      if (departmentId) {
        // Run department fetch and head check in parallel
        const [dept, headResult] = await Promise.all([
          storage.getDepartment(departmentId),
          storage.isUserDepartmentHead(userId),
        ]);
        department = dept;
        isDepartmentHead = headResult.isDeptHead;
        
        // If department head, get all department members for their managed departments
        if (isDepartmentHead) {
          const [allUsers, managedDepts] = await Promise.all([
            storage.getUsers(),
            storage.getDepartmentsByHead(userId),
          ]);
          const managedDeptIds = new Set(managedDepts.map(d => d.id));
          departmentMembers = allUsers.filter(u => u.departmentId && managedDeptIds.has(u.departmentId) && u.id !== userId);
        }
      }

      // Determine department type for stats
      const departmentName = department?.name?.toLowerCase() || '';
      const userRole = user.role?.toLowerCase() || '';
      
      // Department-specific stats
      let departmentStats: any = {
        departmentName: department?.name || 'General',
        isDepartmentHead,
        memberCount: departmentMembers.length,
        members: isDepartmentHead ? departmentMembers.map(m => ({
          id: m.id,
          name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email,
          email: m.email,
          role: m.role
        })) : [],
        stats: {}
      };

      // Sales Department Stats
      if (departmentName.includes('sales') || userRole.includes('sales')) {
        const salesFilter = isDepartmentHead
          ? { salesExecutiveIds: [...departmentMembers.map((m: any) => m.id), user.id] }
          : { salesExecutiveId: user.id };
        const userLeads = await storage.getLeads(salesFilter);

        const pendingFollowups = await storage.countPendingFollowUpsByLeadIds(userLeads.map(l => l.id));
        
        departmentStats.stats = {
          type: 'sales',
          totalLeads: userLeads.length,
          activeLeads: userLeads.filter(l => l.stage !== 'closed_won' && l.stage !== 'closed_lost').length,
          wonLeads: userLeads.filter(l => l.stage === 'closed_won').length,
          lostLeads: userLeads.filter(l => l.stage === 'closed_lost').length,
          pendingFollowups
        };
      }
      
      // Support Department Stats
      else if (departmentName.includes('support') || userRole.includes('support') || userRole.includes('engineer')) {
        const engineerIds = isDepartmentHead
          ? [...departmentMembers.map((m: any) => m.id), user.id]
          : [user.id];
        const userTickets = await storage.getTickets({ assignedEngineerIds: engineerIds });
        
        const resolvedStatuses = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
        departmentStats.stats = {
          type: 'support',
          totalTickets: userTickets.length,
          openTickets: userTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
          resolvedTickets: userTickets.filter(t => resolvedStatuses.includes(t.status)).length,
          criticalTickets: userTickets.filter(t => t.priority === 'critical' && !resolvedStatuses.includes(t.status)).length,
          overdueTickets: userTickets.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !resolvedStatuses.includes(t.status)).length
        };
      }
      
      // Technical/Implementation Department Stats
      else if (departmentName.includes('technical') || departmentName.includes('implementation')) {
        const userProjects = isDepartmentHead
          ? await storage.getProjects()
          : await storage.getProjects({ engineerIds: [user.id] });
        
        departmentStats.stats = {
          type: 'implementation',
          totalProjects: userProjects.length,
          activeProjects: userProjects.filter(p => p.status === 'in_progress').length,
          completedProjects: userProjects.filter(p => p.status === 'completed').length,
          avgCompletion: userProjects.length > 0 
            ? Math.round(userProjects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / userProjects.length)
            : 0
        };
      }
      
      // Development Department Stats
      else if (departmentName.includes('development')) {
        const allDevTasks = await storage.getDevelopmentTasks({});
        const userDevTasks = isDepartmentHead
          ? allDevTasks.filter(t => departmentMembers.some(m => m.id === t.assignedTo) || t.assignedTo === userId)
          : allDevTasks.filter(t => t.assignedTo === userId);
        
        departmentStats.stats = {
          type: 'development',
          totalTasks: userDevTasks.length,
          yetToWork: userDevTasks.filter(t => t.status === 'yet_to_work').length,
          onProcess: userDevTasks.filter(t => t.status === 'on_process').length,
          pending: userDevTasks.filter(t => t.status === 'pending').length,
          completed: userDevTasks.filter(t => t.status === 'completed').length,
          overdue: userDevTasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed').length
        };
      }
      
      // Default/Admin stats
      else {
        const dashboardStats = await storage.getDashboardStats();
        departmentStats.stats = {
          type: 'admin',
          ...dashboardStats
        };
      }

      // Get user's tasks (filtered in DB, not in JS)
      const myTasks = await storage.getTasks({ userId: user.id });
      
      departmentStats.myTasks = {
        total: myTasks.length,
        pending: myTasks.filter(t => t.status === 'pending').length,
        followup: myTasks.filter(t => t.status === 'followup').length,
        completed: myTasks.filter(t => t.status === 'completed').length,
        overdue: myTasks.filter(t => {
          if (t.status === 'completed') return false;
          const dueDate = t.dueDate ? new Date(t.dueDate) : null;
          return dueDate && dueDate < new Date();
        }).length
      };

      console.log(`[Dashboard] Department stats for ${user.email}: ${department?.name || 'No department'}, isHead: ${isDepartmentHead}`);
      
      setCached(cacheKey, departmentStats, 300);
      res.json(departmentStats);
    } catch (error) {
      console.error("Error fetching department dashboard:", error);
      res.status(500).json({ message: "Failed to fetch department dashboard" });
    }
  });

  app.get("/api/dashboard/activities", isAuthenticated, async (req, res) => {
    try {
      const cached = getCached<any>("dashboard:activities");
      if (cached) return res.json(cached);
      const activities = await storage.getRecentActivities(20);
      setCached("dashboard:activities", activities, 300);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // User-wise Call Analytics API - Cold Calls vs Followups
  // Accessible to all users - they see their own data, heads see their team, admins see all
  app.get("/api/analytics/calls", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Check if user is admin/super admin
      const isSuperAdmin = currentUser?.email === "senthil@microgenn.com";
      const isAdmin = currentUser?.role === "admin" || isSuperAdmin;
      
      // Check if user is a department head
      const headDepartments = await storage.getDepartmentsByHead(userId);
      const isDepartmentHead = headDepartments.length > 0;
      
      // User-specific cache key (each user gets their own cached view)
      const cacheKey = `call-analytics-${userId}`;
      const cachedData = getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log(`[Analytics] Serving cached call analytics for user ${userId}`);
        return res.json(cachedData);
      }
      
      // Get all users for the analytics
      const allUsers = await storage.getUsers();
      const activeUsers = allUsers.filter(u => u.isActive);
      
      // Get team member IDs if user is department head
      let teamMemberIds = new Set<string>();
      if (isDepartmentHead) {
        // Get all users who belong to the same departments
        for (const dept of headDepartments) {
          const deptUsers = activeUsers.filter(u => u.departmentId === dept.id);
          deptUsers.forEach(u => teamMemberIds.add(u.id));
        }
      }
      
      // Get all leads (seeds count as cold calls)
      const allLeads = await storage.getLeads({});
      
      // Get all follow-ups
      const allFollowups = await storage.getAllFollowUps();
      
      // Get all customers for customer breakdown
      const allCustomers = await storage.getCustomers();
      
      // Define valid stages for analytics (centralized for consistency)
      const VALID_STAGES = ["seed", "qualified", "demo", "proposal", "negotiation", "won", "lost"];
      const CONVERTED_STAGES = ["qualified", "demo", "proposal", "negotiation", "won", "lost"];
      const DEMO_STAGES = ["demo", "proposal", "negotiation", "won"];
      
      // Build user-wise analytics
      const userAnalytics = activeUsers.map(user => {
        // Cold calls = All leads/seeds created by this user (initial contact at creation time)
        // This counts all leads created, regardless of current stage
        const userLeads = allLeads.filter(l => l.salesExecutiveId === user.id);
        const coldCalls = userLeads.length; // All leads represent cold calls (initial contact)
        
        // Lead conversions = Leads that progressed past "seed" stage (became qualified leads)
        // Only count leads with valid post-seed stages, ignore null/undefined/empty stages
        const leadConversions = userLeads.filter(l => l.stage && CONVERTED_STAGES.includes(l.stage)).length;
        
        // Demo count = Leads that reached "demo" stage (including those that moved past demo)
        // Only count leads with valid demo+ stages
        const demoCount = userLeads.filter(l => l.stage && DEMO_STAGES.includes(l.stage)).length;
        
        // Followup calls = Followups linked to leads assigned to this user
        const userLeadIds = new Set(userLeads.map(l => l.id));
        const followupCalls = allFollowups.filter((f: any) => userLeadIds.has(f.leadId)).length;
        
        // Total calls
        const totalCalls = coldCalls + followupCalls;
        
        // Customer breakdown - unique customers contacted
        const customerBreakdown = new Map<string, { coldCalls: number; followups: number; customerName: string }>();
        
        // Count cold calls per customer (from leads - all leads count as initial contact)
        userLeads.forEach(lead => {
          const customerId = (lead as any).customerId || lead.companyName;
          const customerName = lead.companyName;
          if (!customerBreakdown.has(customerId)) {
            customerBreakdown.set(customerId, { coldCalls: 0, followups: 0, customerName });
          }
          customerBreakdown.get(customerId)!.coldCalls++;
        });
        
        // Count followups per customer
        allFollowups.filter((f: any) => userLeadIds.has(f.leadId)).forEach((followup: any) => {
          const lead = userLeads.find(l => l.id === followup.leadId);
          if (lead) {
            const customerId = (lead as any).customerId || lead.companyName;
            const customerName = lead.companyName;
            if (!customerBreakdown.has(customerId)) {
              customerBreakdown.set(customerId, { coldCalls: 0, followups: 0, customerName });
            }
            customerBreakdown.get(customerId)!.followups++;
          }
        });
        
        return {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          coldCalls,
          followupCalls,
          totalCalls,
          leadConversions,
          demoCount,
          customers: Array.from(customerBreakdown.entries()).map(([id, data]) => ({
            customerId: id,
            customerName: data.customerName,
            coldCalls: data.coldCalls,
            followups: data.followups,
            total: data.coldCalls + data.followups
          })).sort((a, b) => b.total - a.total)
        };
      }).filter(u => u.totalCalls > 0 || isAdmin).sort((a, b) => b.totalCalls - a.totalCalls);
      
      // Filter based on role:
      // - Admin/Super admin: sees all users
      // - Department head: sees their team members
      // - Regular user: sees only their own data
      let filteredAnalytics = userAnalytics;
      let viewScope = 'self'; // 'self', 'team', or 'all'
      
      if (isAdmin) {
        viewScope = 'all';
        // Admin sees all - no filtering needed
      } else if (isDepartmentHead && teamMemberIds.size > 0) {
        viewScope = 'team';
        // Department head sees their team
        filteredAnalytics = userAnalytics.filter(u => teamMemberIds.has(u.userId));
      } else {
        viewScope = 'self';
        // Regular user sees only their own data
        filteredAnalytics = userAnalytics.filter(u => u.userId === userId);
      }
      
      // Calculate totals
      const totals = {
        coldCalls: filteredAnalytics.reduce((sum, u) => sum + u.coldCalls, 0),
        followupCalls: filteredAnalytics.reduce((sum, u) => sum + u.followupCalls, 0),
        totalCalls: filteredAnalytics.reduce((sum, u) => sum + u.totalCalls, 0),
        leadConversions: filteredAnalytics.reduce((sum, u) => sum + u.leadConversions, 0),
        demoCount: filteredAnalytics.reduce((sum, u) => sum + u.demoCount, 0),
        totalUsers: filteredAnalytics.length
      };
      
      // Build day-wise analytics (last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get filtered user IDs for day-wise data
      const filteredUserIds = new Set(filteredAnalytics.map(u => u.userId));
      
      // Create lead lookup map for O(1) access
      const leadLookup = new Map(allLeads.map(l => [l.id, l]));
      
      // Create user lookup map for O(1) access
      const userLookup = new Map(activeUsers.map(u => [u.id, u]));
      
      // Create a map of date -> user -> {coldCalls, followupCalls, leadConversions, demoCount}
      const dailyData = new Map<string, Map<string, { coldCalls: number; followupCalls: number; leadConversions: number; demoCount: number; userName: string }>>();
      
      // Initialize last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        dailyData.set(dateKey, new Map());
      }
      
      // Count cold calls, conversions, and demos per day per user
      // Cold calls = leads/seeds created (at creation time, regardless of current stage)
      // Conversions and demos are based on current stage of leads created on that day
      allLeads.forEach(lead => {
        if (!filteredUserIds.has(lead.salesExecutiveId || '')) return;
        
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
        if (!leadDate || leadDate < thirtyDaysAgo) return;
        
        const dateKey = leadDate.toISOString().split('T')[0];
        const userMap = dailyData.get(dateKey);
        if (!userMap) return;
        
        const user = userLookup.get(lead.salesExecutiveId || '');
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        
        if (!userMap.has(lead.salesExecutiveId || '')) {
          userMap.set(lead.salesExecutiveId || '', { coldCalls: 0, followupCalls: 0, leadConversions: 0, demoCount: 0, userName });
        }
        const userData = userMap.get(lead.salesExecutiveId || '')!;
        userData.coldCalls++;
        
        // Check if this lead converted (has a valid post-seed stage)
        if (lead.stage && CONVERTED_STAGES.includes(lead.stage)) {
          userData.leadConversions++;
        }
        
        // Check if this lead reached demo stage or beyond
        if (lead.stage && DEMO_STAGES.includes(lead.stage)) {
          userData.demoCount++;
        }
      });
      
      // Count followups per day per user
      // Use createdAt (when followup was recorded) for actual activity tracking
      allFollowups.forEach((followup: any) => {
        const lead = leadLookup.get(followup.leadId);
        if (!lead || !filteredUserIds.has(lead.salesExecutiveId || '')) return;
        
        // Use createdAt for when the followup was actually recorded/executed
        // Fall back to followUpDate if createdAt not available
        const activityDate = followup.createdAt 
          ? new Date(followup.createdAt) 
          : (followup.followUpDate ? new Date(followup.followUpDate) : null);
        if (!activityDate || activityDate < thirtyDaysAgo) return;
        
        const dateKey = activityDate.toISOString().split('T')[0];
        const userMap = dailyData.get(dateKey);
        if (!userMap) return;
        
        const user = userLookup.get(lead.salesExecutiveId || '');
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        
        if (!userMap.has(lead.salesExecutiveId || '')) {
          userMap.set(lead.salesExecutiveId || '', { coldCalls: 0, followupCalls: 0, leadConversions: 0, demoCount: 0, userName });
        }
        userMap.get(lead.salesExecutiveId || '')!.followupCalls++;
      });
      
      // Convert to array format for frontend
      const dailyAnalytics = Array.from(dailyData.entries())
        .map(([date, userMap]) => ({
          date,
          dateLabel: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          totalColdCalls: Array.from(userMap.values()).reduce((sum, u) => sum + u.coldCalls, 0),
          totalFollowupCalls: Array.from(userMap.values()).reduce((sum, u) => sum + u.followupCalls, 0),
          totalLeadConversions: Array.from(userMap.values()).reduce((sum, u) => sum + u.leadConversions, 0),
          totalDemoCount: Array.from(userMap.values()).reduce((sum, u) => sum + u.demoCount, 0),
          users: Array.from(userMap.entries()).map(([userId, data]) => ({
            userId,
            userName: data.userName,
            coldCalls: data.coldCalls,
            followupCalls: data.followupCalls,
            leadConversions: data.leadConversions,
            demoCount: data.demoCount
          })).filter(u => u.coldCalls > 0 || u.followupCalls > 0 || u.leadConversions > 0 || u.demoCount > 0)
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      const responseData = {
        userAnalytics: filteredAnalytics,
        dailyAnalytics,
        totals,
        isAdmin,
        isDepartmentHead,
        viewScope // 'self', 'team', or 'all'
      };
      
      // Cache the result for 2 minutes
      setCachedData(cacheKey, responseData);
      console.log(`[Analytics] Computed and cached call analytics for user ${userId} (scope: ${viewScope})`);
      
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching call analytics:", error);
      res.status(500).json({ message: "Failed to fetch call analytics" });
    }
  });

  // Detailed call data endpoint with date/week/month filtering
  app.get("/api/analytics/call-details", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { startDate, endDate, period = 'day', salesExecutiveId } = req.query;
      
      // Calculate date range based on period if not provided
      let dateFrom: Date;
      let dateTo: Date = new Date();
      dateTo.setHours(23, 59, 59, 999);
      
      if (startDate && endDate) {
        dateFrom = new Date(startDate as string);
        dateTo = new Date(endDate as string);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period === 'week') {
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 7);
        dateFrom.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - 1);
        dateFrom.setHours(0, 0, 0, 0);
      } else {
        // Default to today
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
      }
      
      // Check permissions
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL;
      
      // Check if user is admin
      const currentUser = await storage.getUser(userId);
      const isAdmin = isSuperAdmin || currentUser?.role === 'admin';
      
      // Check if user is department head
      const headDepartments = await storage.getDepartmentsByHead(userId);
      const isDepartmentHead = headDepartments.length > 0;
      
      // Get all users and filter based on role
      const allUsers = await storage.getUsers();
      const activeUsers = allUsers.filter((u: any) => u.isActive !== false && u.isApproved !== false);
      
      // Get team member IDs if department head
      const teamMemberIds = new Set<string>();
      if (isDepartmentHead) {
        const deptIds = headDepartments.map(d => d.id);
        activeUsers.forEach((u: any) => {
          if (u.departmentId && deptIds.includes(u.departmentId)) {
            teamMemberIds.add(u.id);
          }
        });
        teamMemberIds.add(userId); // Include self
      }
      
      // Determine which users to include
      let targetUserIds: Set<string>;
      let viewScope = 'self';
      
      if (isAdmin) {
        viewScope = 'all';
        targetUserIds = new Set(activeUsers.map((u: any) => u.id));
      } else if (isDepartmentHead && teamMemberIds.size > 0) {
        viewScope = 'team';
        targetUserIds = teamMemberIds;
      } else {
        viewScope = 'self';
        targetUserIds = new Set([userId]);
      }
      
      // If salesExecutiveId is provided, filter to that user (if authorized)
      // We must validate against the ORIGINAL targetUserIds before any modification
      if (salesExecutiveId && typeof salesExecutiveId === 'string') {
        // Admin can view any user
        // Department head can only view team members
        // Regular user can only view themselves
        const authorizedUserIds = isAdmin 
          ? new Set(activeUsers.map((u: any) => u.id))
          : isDepartmentHead && teamMemberIds.size > 0
            ? teamMemberIds
            : new Set([userId]);
        
        if (!authorizedUserIds.has(salesExecutiveId)) {
          return res.status(403).json({ message: "Not authorized to view this user's data" });
        }
        targetUserIds = new Set([salesExecutiveId]);
      }
      
      // Get all leads within date range for target users
      const allLeads = await storage.getLeads();
      const filteredLeads = allLeads.filter((lead: any) => {
        if (!lead.salesExecutiveId || !targetUserIds.has(lead.salesExecutiveId)) return false;
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
        if (!leadDate) return false;
        return leadDate >= dateFrom && leadDate <= dateTo;
      });
      
      // Get all followups within date range for target users' leads
      const allFollowups = await storage.getAllFollowUps();
      const leadIds = new Set(allLeads.filter((l: any) => l.salesExecutiveId && targetUserIds.has(l.salesExecutiveId)).map((l: any) => l.id));
      const leadLookup = new Map(allLeads.map((l: any) => [l.id, l]));
      
      const filteredFollowups = allFollowups.filter((followup: any) => {
        if (!leadIds.has(followup.leadId)) return false;
        const followupDate = followup.createdAt 
          ? new Date(followup.createdAt) 
          : (followup.followUpDate ? new Date(followup.followUpDate) : null);
        if (!followupDate) return false;
        return followupDate >= dateFrom && followupDate <= dateTo;
      });
      
      // Create user lookup for names
      const userLookup = new Map(activeUsers.map((u: any) => [u.id, u]));
      
      // Build detailed cold calls data
      const coldCalls = filteredLeads.map((lead: any) => {
        const user: any = userLookup.get(lead.salesExecutiveId || '');
        return {
          id: lead.id,
          type: 'cold_call' as const,
          date: lead.createdAt,
          salesExecutiveId: lead.salesExecutiveId,
          salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          companyName: lead.companyName,
          contactPerson: lead.contactPerson,
          contactPhone: lead.contactPhone,
          contactEmail: lead.contactEmail,
          stage: lead.stage,
          source: lead.source,
          city: lead.city,
          area: lead.area,
          isExistingCustomer: lead.isExistingCustomer || false,
          notes: null
        };
      });
      
      // Build detailed followups data
      const followups = filteredFollowups.map((followup: any) => {
        const lead: any = leadLookup.get(followup.leadId);
        const user: any = lead ? userLookup.get(lead.salesExecutiveId || '') : null;
        return {
          id: followup.id,
          type: 'followup' as const,
          date: followup.createdAt || followup.followUpDate,
          salesExecutiveId: lead?.salesExecutiveId,
          salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          companyName: lead?.companyName || 'Unknown',
          contactPerson: lead?.contactPerson || 'Unknown',
          contactPhone: lead?.contactPhone || '',
          contactEmail: lead?.contactEmail || '',
          stage: lead?.stage,
          source: lead?.source,
          city: lead?.city,
          area: lead?.area,
          isExistingCustomer: lead?.isExistingCustomer || false,
          notes: followup.notes,
          completed: followup.completed
        };
      });
      
      // Combine and sort by date (newest first)
      const allCallDetails = [...coldCalls, ...followups].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      
      // Group by date
      const groupedByDate = new Map<string, typeof allCallDetails>();
      allCallDetails.forEach(call => {
        const dateKey = call.date ? new Date(call.date).toISOString().split('T')[0] : 'unknown';
        if (!groupedByDate.has(dateKey)) {
          groupedByDate.set(dateKey, []);
        }
        groupedByDate.get(dateKey)!.push(call);
      });
      
      // Convert to array
      const dailyBreakdown = Array.from(groupedByDate.entries())
        .map(([date, calls]) => ({
          date,
          dateLabel: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          coldCallCount: calls.filter(c => c.type === 'cold_call').length,
          followupCount: calls.filter(c => c.type === 'followup').length,
          totalCount: calls.length,
          calls
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      
      // Group by sales executive
      const byExecutive = new Map<string, typeof allCallDetails>();
      allCallDetails.forEach(call => {
        const execId = call.salesExecutiveId || 'unknown';
        if (!byExecutive.has(execId)) {
          byExecutive.set(execId, []);
        }
        byExecutive.get(execId)!.push(call);
      });
      
      const executiveBreakdown = Array.from(byExecutive.entries())
        .map(([execId, calls]) => {
          const user: any = userLookup.get(execId);
          return {
            salesExecutiveId: execId,
            salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            email: user?.email || '',
            coldCallCount: calls.filter(c => c.type === 'cold_call').length,
            followupCount: calls.filter(c => c.type === 'followup').length,
            totalCount: calls.length
          };
        })
        .sort((a, b) => b.totalCount - a.totalCount);
      
      res.json({
        dateRange: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
          period
        },
        summary: {
          totalColdCalls: coldCalls.length,
          totalFollowups: followups.length,
          totalCalls: allCallDetails.length,
          uniqueCompanies: new Set(allCallDetails.map(c => c.companyName)).size,
          uniqueExecutives: executiveBreakdown.length
        },
        dailyBreakdown,
        executiveBreakdown,
        callDetails: allCallDetails,
        viewScope
      });
    } catch (error) {
      console.error("Error fetching call details:", error);
      res.status(500).json({ message: "Failed to fetch call details" });
    }
  });

  // Stage drill-down endpoint for call analytics table
  app.get("/api/analytics/stage-drilldown", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { date, stageType, salesExecutiveId } = req.query;
      
      if (!date || !stageType) {
        return res.status(400).json({ message: "Date and stageType are required" });
      }
      
      const validStageTypes = ['cold_call', 'followup', 'conversion', 'demo'];
      if (!validStageTypes.includes(stageType as string)) {
        return res.status(400).json({ message: "Invalid stageType" });
      }
      
      // Parse date range for the specific day
      const dateFrom = new Date(date as string);
      dateFrom.setHours(0, 0, 0, 0);
      const dateTo = new Date(date as string);
      dateTo.setHours(23, 59, 59, 999);
      
      // Check permissions
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL;
      
      const currentUser = await storage.getUser(userId);
      const isAdmin = isSuperAdmin || currentUser?.role === 'admin';
      
      const headDepartments = await storage.getDepartmentsByHead(userId);
      const isDepartmentHead = headDepartments.length > 0;
      
      const allUsers = await storage.getUsers();
      const activeUsers = allUsers.filter((u: any) => u.isActive !== false && u.isApproved !== false);
      
      // Get team member IDs if department head
      const teamMemberIds = new Set<string>();
      if (isDepartmentHead) {
        const deptIds = headDepartments.map(d => d.id);
        activeUsers.forEach((u: any) => {
          if (u.departmentId && deptIds.includes(u.departmentId)) {
            teamMemberIds.add(u.id);
          }
        });
        teamMemberIds.add(userId);
      }
      
      // Determine which users to include
      let targetUserIds: Set<string>;
      
      if (isAdmin) {
        targetUserIds = new Set(activeUsers.map((u: any) => u.id));
      } else if (isDepartmentHead && teamMemberIds.size > 0) {
        targetUserIds = teamMemberIds;
      } else {
        targetUserIds = new Set([userId]);
      }
      
      // Filter by specific sales executive if provided
      if (salesExecutiveId && typeof salesExecutiveId === 'string') {
        const authorizedUserIds = isAdmin 
          ? new Set(activeUsers.map((u: any) => u.id))
          : isDepartmentHead && teamMemberIds.size > 0
            ? teamMemberIds
            : new Set([userId]);
        
        if (!authorizedUserIds.has(salesExecutiveId)) {
          return res.status(403).json({ message: "Not authorized to view this user's data" });
        }
        targetUserIds = new Set([salesExecutiveId]);
      }
      
      const userLookup = new Map(activeUsers.map((u: any) => [u.id, u]));
      const allLeads = await storage.getLeads();
      const allFollowups = await storage.getAllFollowUps();
      const leadLookup = new Map(allLeads.map((l: any) => [l.id, l]));
      
      let records: any[] = [];
      const stageTypeStr = stageType as string;
      
      if (stageTypeStr === 'cold_call') {
        // Get cold calls for the date
        records = allLeads
          .filter((lead: any) => {
            if (!lead.salesExecutiveId || !targetUserIds.has(lead.salesExecutiveId)) return false;
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
            if (!leadDate) return false;
            return leadDate >= dateFrom && leadDate <= dateTo;
          })
          .map((lead: any) => {
            const user: any = userLookup.get(lead.salesExecutiveId || '');
            return {
              id: lead.id,
              type: 'cold_call',
              time: lead.createdAt,
              companyName: lead.companyName,
              contactPerson: lead.contactPerson,
              contactPhone: lead.contactPhone,
              contactEmail: lead.contactEmail,
              stage: lead.stage,
              source: lead.source,
              city: lead.city,
              area: lead.area,
              isExistingCustomer: lead.isExistingCustomer || false,
              salesExecutiveId: lead.salesExecutiveId,
              salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
            };
          });
      } else if (stageTypeStr === 'followup') {
        // Get followups for the date
        const leadIds = new Set(allLeads.filter((l: any) => l.salesExecutiveId && targetUserIds.has(l.salesExecutiveId)).map((l: any) => l.id));
        
        records = allFollowups
          .filter((followup: any) => {
            if (!leadIds.has(followup.leadId)) return false;
            const followupDate = followup.createdAt 
              ? new Date(followup.createdAt) 
              : (followup.followUpDate ? new Date(followup.followUpDate) : null);
            if (!followupDate) return false;
            return followupDate >= dateFrom && followupDate <= dateTo;
          })
          .map((followup: any) => {
            const lead: any = leadLookup.get(followup.leadId);
            const user: any = lead ? userLookup.get(lead.salesExecutiveId || '') : null;
            return {
              id: followup.id,
              type: 'followup',
              time: followup.createdAt || followup.followUpDate,
              companyName: lead?.companyName || 'Unknown',
              contactPerson: lead?.contactPerson || 'Unknown',
              contactPhone: lead?.contactPhone || '',
              contactEmail: lead?.contactEmail || '',
              stage: lead?.stage,
              source: lead?.source,
              city: lead?.city,
              area: lead?.area,
              isExistingCustomer: lead?.isExistingCustomer || false,
              notes: followup.notes,
              completed: followup.completed,
              salesExecutiveId: lead?.salesExecutiveId,
              salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
            };
          });
      } else if (stageTypeStr === 'conversion') {
        // Get leads that were converted (stage changed to qualified stages)
        const qualifiedStages = ['qualified', 'proposal', 'negotiation', 'won'];
        records = allLeads
          .filter((lead: any) => {
            if (!lead.salesExecutiveId || !targetUserIds.has(lead.salesExecutiveId)) return false;
            if (!qualifiedStages.includes(lead.stage?.toLowerCase())) return false;
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
            if (!leadDate) return false;
            return leadDate >= dateFrom && leadDate <= dateTo;
          })
          .map((lead: any) => {
            const user: any = userLookup.get(lead.salesExecutiveId || '');
            return {
              id: lead.id,
              type: 'conversion',
              time: lead.createdAt,
              companyName: lead.companyName,
              contactPerson: lead.contactPerson,
              contactPhone: lead.contactPhone,
              contactEmail: lead.contactEmail,
              stage: lead.stage,
              source: lead.source,
              city: lead.city,
              area: lead.area,
              isExistingCustomer: lead.isExistingCustomer || false,
              salesExecutiveId: lead.salesExecutiveId,
              salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
            };
          });
      } else if (stageTypeStr === 'demo') {
        // Get leads that are in demo stage
        records = allLeads
          .filter((lead: any) => {
            if (!lead.salesExecutiveId || !targetUserIds.has(lead.salesExecutiveId)) return false;
            if (lead.stage?.toLowerCase() !== 'demo') return false;
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
            if (!leadDate) return false;
            return leadDate >= dateFrom && leadDate <= dateTo;
          })
          .map((lead: any) => {
            const user: any = userLookup.get(lead.salesExecutiveId || '');
            return {
              id: lead.id,
              type: 'demo',
              time: lead.createdAt,
              companyName: lead.companyName,
              contactPerson: lead.contactPerson,
              contactPhone: lead.contactPhone,
              contactEmail: lead.contactEmail,
              stage: lead.stage,
              source: lead.source,
              city: lead.city,
              area: lead.area,
              isExistingCustomer: lead.isExistingCustomer || false,
              salesExecutiveId: lead.salesExecutiveId,
              salesExecutiveName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
            };
          });
      }
      
      // Sort by time (newest first)
      records.sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA;
      });
      
      res.json({
        date: date,
        stageType,
        count: records.length,
        records
      });
    } catch (error) {
      console.error("Error fetching stage drilldown:", error);
      res.status(500).json({ message: "Failed to fetch stage drilldown" });
    }
  });

  // Reports routes (real analytics)
  app.get("/api/reports/sales", isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getSalesAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching sales reports:", error);
      res.status(500).json({ message: "Failed to fetch sales reports" });
    }
  });

  app.get("/api/reports/projects", isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getProjectAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching project reports:", error);
      res.status(500).json({ message: "Failed to fetch project reports" });
    }
  });

  app.get("/api/reports/tickets", isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getTicketAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching ticket reports:", error);
      res.status(500).json({ message: "Failed to fetch ticket reports" });
    }
  });

  // Advanced analytics routes
  app.get("/api/reports/timeseries", isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getTimeSeriesAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching time series analytics:", error);
      res.status(500).json({ message: "Failed to fetch time series analytics" });
    }
  });

  app.get("/api/reports/productivity", isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getEngineerProductivity();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching engineer productivity:", error);
      res.status(500).json({ message: "Failed to fetch engineer productivity" });
    }
  });

  app.get("/api/reports/export/:type", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getExportData(req.params.type);
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Accounts Reports - Get all contracts with customer and contract type details
  app.get("/api/reports/accounts", isAuthenticated, async (req, res) => {
    try {
      const { fromDate, toDate, customerId, contractTypeId } = req.query;
      const cacheKey = `accounts:report:${fromDate||''}:${toDate||''}:${customerId||''}:${contractTypeId||''}`;
      const cached = getCachedData<any[]>(cacheKey);
      if (cached) return res.json(cached);

      // Build SQL conditions
      const conditions: any[] = [];
      if (fromDate) conditions.push(gte(customerContracts.startDate, new Date(fromDate as string)));
      if (toDate) {
        const end = new Date(toDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(customerContracts.startDate, end));
      }
      if (customerId && customerId !== "all") conditions.push(eq(customerContracts.customerId, customerId as string));
      if (contractTypeId && contractTypeId !== "all") conditions.push(eq(customerContracts.contractTypeId, contractTypeId as string));

      // 1 query: all contracts (SQL filtered)
      let contractQuery = db.select().from(customerContracts).orderBy(desc(customerContracts.createdAt)) as any;
      if (conditions.length > 0) contractQuery = contractQuery.where(and(...conditions));
      const allContracts = await contractQuery;

      if (allContracts.length === 0) {
        setCachedData(cacheKey, []);
        return res.json([]);
      }

      // 3 bulk queries for related data
      const customerIds = [...new Set(allContracts.map((c: any) => c.customerId).filter(Boolean))];
      const contractTypeIds = [...new Set(allContracts.map((c: any) => c.contractTypeId).filter(Boolean))];
      const createdByIds = [...new Set(allContracts.map((c: any) => c.createdBy).filter(Boolean))];

      const [customersData, contractTypesData, usersData] = await Promise.all([
        customerIds.length > 0
          ? db.select().from(customers).where(inArray(customers.id, customerIds as string[]))
          : Promise.resolve([]),
        contractTypeIds.length > 0
          ? db.select().from(contractTypes).where(inArray(contractTypes.id, contractTypeIds as string[]))
          : Promise.resolve([]),
        createdByIds.length > 0
          ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, createdByIds as string[]))
          : Promise.resolve([]),
      ]);

      // Build lookup maps
      const customerMap = new Map(customersData.map((c: any) => [c.id, c]));
      const contractTypeMap = new Map(contractTypesData.map((ct: any) => [ct.id, ct]));
      const userMap = new Map(usersData.map((u: any) => [u.id, u]));

      // Assemble enriched contracts
      const enriched = allContracts.map((contract: any) => ({
        ...contract,
        customer: contract.customerId ? (customerMap.get(contract.customerId) || null) : null,
        contractType: contract.contractTypeId ? (contractTypeMap.get(contract.contractTypeId) || null) : null,
        createdByUser: contract.createdBy ? (userMap.get(contract.createdBy) || null) : null,
      }));

      setCachedData(cacheKey, enriched);
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching accounts reports:", error);
      res.status(500).json({ message: "Failed to fetch accounts reports" });
    }
  });

  // Tasks Reports - Get all tasks with user details
  app.get("/api/reports/tasks", isAuthenticated, async (req, res) => {
    try {
      const { fromDate, toDate, assignedTo, status, priority } = req.query;
      const cacheKey = `tasks:report:${fromDate||''}:${toDate||''}:${assignedTo||''}:${status||''}:${priority||''}`;
      const cached = getCachedData<any[]>(cacheKey);
      if (cached) return res.json(cached);

      // Build SQL conditions
      const conditions: any[] = [];
      if (fromDate) conditions.push(gte(tasks.createdAt, new Date(fromDate as string)));
      if (toDate) {
        const end = new Date(toDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(tasks.createdAt, end));
      }
      if (assignedTo && assignedTo !== "all") conditions.push(eq(tasks.assignedTo, assignedTo as string));
      if (status && status !== "all") conditions.push(eq(tasks.status, status as string));
      if (priority && priority !== "all") conditions.push(eq(tasks.priority, priority as string));

      // 1 query: all tasks (SQL filtered)
      let taskQuery = db.select().from(tasks).orderBy(desc(tasks.createdAt)) as any;
      if (conditions.length > 0) taskQuery = taskQuery.where(and(...conditions));
      const allTasks = await taskQuery;

      if (allTasks.length === 0) {
        setCachedData(cacheKey, []);
        return res.json([]);
      }

      // 1 bulk query for all user lookups (createdBy + assignedTo combined)
      const userIds = [...new Set([
        ...allTasks.map((t: any) => t.createdBy).filter(Boolean),
        ...allTasks.map((t: any) => t.assignedTo).filter(Boolean),
      ])];

      const usersData = userIds.length > 0
        ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds as string[]))
        : [];

      const userMap = new Map(usersData.map((u: any) => [u.id, u]));

      const enriched = allTasks.map((task: any) => ({
        ...task,
        createdByUser: task.createdBy ? (userMap.get(task.createdBy) || null) : null,
        assignedToUser: task.assignedTo ? (userMap.get(task.assignedTo) || null) : null,
      }));

      setCachedData(cacheKey, enriched);
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching tasks reports:", error);
      res.status(500).json({ message: "Failed to fetch tasks reports" });
    }
  });

  // Marketing Reports - Get all marketing daily reports with user details
  app.get("/api/reports/marketing", isAuthenticated, async (req, res) => {
    try {
      const allReports = await db
        .select()
        .from(marketingDailyReports)
        .orderBy(desc(marketingDailyReports.reportDate));
      
      // Enrich with user details
      const enrichedReports = await Promise.all(allReports.map(async (report) => {
        let user, approvedByUser;
        
        if (report.userId) {
          user = await db.select().from(users).where(eq(users.id, report.userId)).limit(1);
        }
        if (report.approvedBy) {
          approvedByUser = await db.select().from(users).where(eq(users.id, report.approvedBy)).limit(1);
        }
        
        return {
          ...report,
          user: user?.[0] || null,
          approvedByUser: approvedByUser?.[0] || null,
        };
      }));
      
      res.json(enrichedReports);
    } catch (error) {
      console.error("Error fetching marketing reports:", error);
      res.status(500).json({ message: "Failed to fetch marketing reports" });
    }
  });

  // Detailed Implementation Report endpoint
  app.get("/api/reports/implementation-detail", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getImplementationDetailReport();
      res.json(data);
    } catch (error) {
      console.error("Error fetching implementation detail report:", error);
      res.status(500).json({ message: "Failed to fetch implementation report" });
    }
  });

  // Email Implementation Report endpoint
  app.post("/api/reports/implementation/email", isAuthenticated, async (req: any, res) => {
    try {
      const { recipientEmail, recipientName, reportData } = req.body;
      
      // Format report data as HTML table
      let tableRows = "";
      for (const project of reportData.projects) {
        tableRows += `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.clientName}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.status}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.completionPercentage}%</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.modulesCompleted}/${project.totalModules}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.assignedEngineers}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${project.dueDate || 'Not set'}</td>
          </tr>
        `;
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Microgenn CRM - Implementation Status Report</h2>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          
          <h3>Summary</h3>
          <table style="border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Total Projects:</strong></td><td>${reportData.summary.totalProjects}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>In Progress:</strong></td><td>${reportData.summary.inProgress}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>In Training:</strong></td><td>${reportData.summary.inTraining}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Completed:</strong></td><td>${reportData.summary.completed}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Pending Handoff:</strong></td><td>${reportData.summary.pendingHandoff}</td></tr>
          </table>

          <h3>Project Details</h3>
          <table style="border-collapse: collapse; width: 100%;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Client</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Progress</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Modules</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Engineers</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
            This report was generated by Microgenn CRM System
          </p>
        </div>
      `;

      await sendEmail({
        to: recipientEmail,
        subject: `Implementation Status Report - ${new Date().toLocaleDateString()}`,
        html: htmlContent,
      });

      res.json({ success: true, message: "Report sent successfully" });
    } catch (error) {
      console.error("Error sending implementation report email:", error);
      res.status(500).json({ message: "Failed to send report email" });
    }
  });

  // File Upload Routes (Document Management)
  const objectStorageService = new ObjectStorageService();

  // Get upload URL for file upload
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    try {
      const { fileName } = req.body;
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Save attachment metadata after upload
  app.post("/api/attachments", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertAttachmentSchema.parse({
        ...req.body,
        uploadedBy: req.user.claims.sub,
      });
      
      // Set ACL policy on the uploaded object - public visibility allows all authenticated users to view
      const userId = req.user.claims.sub;
      if (validatedData.objectPath.startsWith("/objects/")) {
        await objectStorageService.trySetObjectEntityAclPolicy(validatedData.objectPath, {
          owner: userId,
          visibility: "public",
        });
      }
      
      const attachment = await storage.createAttachment(validatedData);
      
      // Log activity
      await storage.logActivity({
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        action: "file_uploaded",
        description: `File uploaded: ${validatedData.fileName}`,
        userId: req.user.claims.sub,
        metadata: { attachmentId: attachment.id, fileName: validatedData.fileName },
      });
      
      res.json(attachment);
    } catch (error) {
      console.error("Error saving attachment:", error);
      res.status(500).json({ message: "Failed to save attachment" });
    }
  });

  // Get attachments for an entity
  app.get("/api/attachments/:entityType/:entityId", isAuthenticated, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const attachmentList = await storage.getAttachments(entityType, entityId);
      res.json(attachmentList);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  // Update attachment visibility to public (admin only) - for existing files
  app.post("/api/attachments/make-public", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allAttachments = await storage.getAllAttachments();
      let updated = 0;
      let errors = 0;
      
      for (const attachment of allAttachments) {
        if (attachment.objectPath?.startsWith("/objects/")) {
          try {
            await objectStorageService.trySetObjectEntityAclPolicy(attachment.objectPath, {
              owner: attachment.uploadedBy || "system",
              visibility: "public",
            });
            updated++;
          } catch (err) {
            console.error(`Error updating ACL for ${attachment.objectPath}:`, err);
            errors++;
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${updated} attachments to public visibility`,
        updated,
        errors
      });
    } catch (error) {
      console.error("Error making attachments public:", error);
      res.status(500).json({ message: "Failed to update attachment visibility" });
    }
  });

  // Delete attachment
  app.delete("/api/attachments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const attachment = await storage.deleteAttachment(req.params.id);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      // Try to delete from object storage
      try {
        await objectStorageService.deleteObject(attachment.objectPath);
      } catch (deleteError) {
        console.error("Error deleting object from storage:", deleteError);
      }
      
      // Log activity
      await storage.logActivity({
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        action: "file_deleted",
        description: `File deleted: ${attachment.fileName}`,
        userId: req.user.claims.sub,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });

  // Serve private objects (with authentication)
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Serve public objects
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================
  // PROFILE MANAGEMENT ROUTES
  // =============================================

  // Get upload URL for profile image
  app.post("/api/profile/upload-image", isAuthenticated, async (req: any, res) => {
    try {
      const { fileName } = req.body;
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName || "profile.jpg");
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error getting profile upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Update profile image after upload
  app.put("/api/profile/image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { objectPath } = req.body;

      if (!objectPath) {
        return res.status(400).json({ message: "objectPath is required" });
      }

      // Set ACL policy - profile images are public so they can be displayed in the app
      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "public",
      });

      // Update user profile with the new image URL
      const updatedUser = await storage.updateUser(userId, {
        profileImageUrl: objectPath,
      });

      res.json({
        success: true,
        profileImageUrl: objectPath,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          profileImageUrl: updatedUser.profileImageUrl,
          role: updatedUser.role,
        },
      });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  // Update profile info (first name, last name)
  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;

      const updateData: Partial<{ firstName: string; lastName: string }> = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          profileImageUrl: updatedUser.profileImageUrl,
          role: updatedUser.role,
        },
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update voice preferences
  app.patch("/api/profile/voice-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voicePreference, voiceAlertsEnabled } = req.body;

      const updateData: Partial<{ voicePreference: string; voiceAlertsEnabled: boolean }> = {};
      
      if (voicePreference !== undefined) {
        if (!['male', 'female'].includes(voicePreference)) {
          return res.status(400).json({ message: "Voice preference must be 'male' or 'female'" });
        }
        updateData.voicePreference = voicePreference;
      }
      
      if (voiceAlertsEnabled !== undefined) {
        updateData.voiceAlertsEnabled = !!voiceAlertsEnabled;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      res.json({
        success: true,
        voicePreference: updatedUser.voicePreference,
        voiceAlertsEnabled: updatedUser.voiceAlertsEnabled,
      });
    } catch (error) {
      console.error("Error updating voice preferences:", error);
      res.status(500).json({ message: "Failed to update voice preferences" });
    }
  });

  // Get user's pending followups for voice alerts
  app.get("/api/followups/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get followups that are due today or overdue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get leads assigned to this user with pending followups
      const leads = await storage.getLeads({ salesExecutiveId: currentUser.id });
      
      const alertFollowups = leads
        .filter(lead => {
          if (!lead.nextFollowupDate) return false;
          const followUpDate = new Date(lead.nextFollowupDate);
          followUpDate.setHours(0, 0, 0, 0);
          return followUpDate <= today; // Due today or overdue
        })
        .map(lead => ({
          id: lead.id,
          companyName: lead.companyName,
          contactPerson: lead.contactPerson,
          followUpDate: lead.nextFollowupDate,
          notes: lead.specialInstructions || null,
          stage: lead.stage,
          isOverdue: new Date(lead.nextFollowupDate!) < today,
        }));

      res.json({
        followups: alertFollowups,
        voicePreference: currentUser.voicePreference || 'female',
        voiceAlertsEnabled: currentUser.voiceAlertsEnabled !== false,
      });
    } catch (error) {
      console.error("Error fetching followup alerts:", error);
      res.status(500).json({ message: "Failed to fetch followup alerts" });
    }
  });

  // Unified voice alerts endpoint - aggregates alerts from all departments
  app.get("/api/alerts/voice", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const currentUser = await storage.getUser(authId);
      
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if voice alerts are enabled
      if (currentUser.voiceAlertsEnabled === false) {
        return res.json({
          alerts: [],
          voicePreference: currentUser.voicePreference || 'female',
          voiceAlertsEnabled: false,
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();

      interface VoiceAlert {
        id: string;
        department: 'sales' | 'support' | 'implementation' | 'tasks' | 'development';
        type: 'new_lead' | 'followup_due' | 'overdue' | 'new_ticket' | 'ticket_escalated' | 'new_task' | 'task_due' | 'project_update' | 'dev_task_assigned';
        entityId: string;
        entityName: string;
        message: string;
        priority: 'high' | 'medium' | 'low';
        dueDate?: string;
        createdAt: string;
      }

      const alerts: VoiceAlert[] = [];

      // 1. SALES ALERTS - New leads and followups
      try {
        const leads = await storage.getLeads({ salesExecutiveId: currentUser.id });
        
        for (const lead of leads) {
          // New leads (created in last 24 hours)
          if (lead.createdAt) {
            const createdAt = new Date(lead.createdAt);
            const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceCreation <= 24 && lead.stage === 'seed') {
              alerts.push({
                id: `sales-new-${lead.id}-${lead.createdAt}`,
                department: 'sales',
                type: 'new_lead',
                entityId: lead.id,
                entityName: lead.companyName,
                message: `Boss, you have a new lead from ${lead.companyName}`,
                priority: 'medium',
                createdAt: lead.createdAt.toString(),
              });
            }
          }

          // Followup due today or overdue
          if (lead.nextFollowupDate) {
            const followUpDate = new Date(lead.nextFollowupDate);
            followUpDate.setHours(0, 0, 0, 0);
            
            if (followUpDate <= today) {
              const isOverdue = followUpDate < today;
              alerts.push({
                id: `sales-followup-${lead.id}-${lead.nextFollowupDate}`,
                department: 'sales',
                type: isOverdue ? 'overdue' : 'followup_due',
                entityId: lead.id,
                entityName: lead.companyName,
                message: isOverdue 
                  ? `Boss, you have an overdue followup. You have to call ${lead.companyName}`
                  : `Boss, you have an appointment. You have to call ${lead.companyName}`,
                priority: isOverdue ? 'high' : 'medium',
                dueDate: lead.nextFollowupDate.toString(),
                createdAt: lead.nextFollowupDate.toString(),
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching sales alerts:", e);
      }

      // 2. SUPPORT ALERTS - New tickets and escalations
      try {
        const tickets = await storage.getTickets({ assignedEngineerIds: [currentUser.id] });
        
        for (const ticket of tickets) {
          // New tickets assigned (in last 24 hours)
          if (ticket.assignedAt && ticket.status !== 'closed' && ticket.status !== 'resolved') {
            const assignedAt = new Date(ticket.assignedAt);
            const hoursSinceAssignment = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceAssignment <= 24) {
              alerts.push({
                id: `support-new-${ticket.id}-${ticket.assignedAt}`,
                department: 'support',
                type: 'new_ticket',
                entityId: ticket.id,
                entityName: ticket.customerName,
                message: `Boss, you have a new support ticket from ${ticket.customerName}. Issue: ${ticket.issueSummary.substring(0, 50)}`,
                priority: ticket.priority === 'critical' || ticket.priority === 'high' ? 'high' : 'medium',
                createdAt: ticket.assignedAt.toString(),
              });
            }
          }

          // Escalated tickets
          if (ticket.escalatedAt && ticket.status === 'escalated') {
            const escalatedAt = new Date(ticket.escalatedAt);
            const hoursSinceEscalation = (now.getTime() - escalatedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceEscalation <= 24) {
              alerts.push({
                id: `support-escalated-${ticket.id}-${ticket.escalatedAt}`,
                department: 'support',
                type: 'ticket_escalated',
                entityId: ticket.id,
                entityName: ticket.customerName,
                message: `Boss, ticket ${ticket.ticketNumber} has been escalated. Customer: ${ticket.customerName}`,
                priority: 'high',
                createdAt: ticket.escalatedAt.toString(),
              });
            }
          }

          // Overdue tickets (due date passed)
          if (ticket.dueDate && ticket.status !== 'closed' && ticket.status !== 'resolved') {
            const dueDate = new Date(ticket.dueDate);
            if (dueDate < now) {
              alerts.push({
                id: `support-overdue-${ticket.id}-${ticket.dueDate}`,
                department: 'support',
                type: 'overdue',
                entityId: ticket.id,
                entityName: ticket.customerName,
                message: `Boss, ticket ${ticket.ticketNumber} is overdue. Customer: ${ticket.customerName}`,
                priority: 'high',
                dueDate: ticket.dueDate.toString(),
                createdAt: ticket.dueDate.toString(),
              });
            }
          }

          // Reminder date alerts
          if (ticket.reminderDate && ticket.status !== 'closed' && ticket.status !== 'resolved') {
            const reminderDate = new Date(ticket.reminderDate);
            reminderDate.setHours(0, 0, 0, 0);
            if (reminderDate <= today) {
              alerts.push({
                id: `support-reminder-${ticket.id}-${ticket.reminderDate}`,
                department: 'support',
                type: 'followup_due',
                entityId: ticket.id,
                entityName: ticket.customerName,
                message: `Boss, reminder to follow up on ticket ${ticket.ticketNumber} for ${ticket.customerName}`,
                priority: 'medium',
                dueDate: ticket.reminderDate.toString(),
                createdAt: ticket.reminderDate.toString(),
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching support alerts:", e);
      }

      // 3. TASK ALERTS - New tasks and due tasks
      try {
        const tasks = await storage.getTasks({ assignedTo: currentUser.id });
        
        for (const task of tasks) {
          if (task.status === 'completed') continue;

          // New tasks assigned (in last 24 hours)
          if (task.assignedAt) {
            const assignedAt = new Date(task.assignedAt);
            const hoursSinceAssignment = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceAssignment <= 24) {
              alerts.push({
                id: `task-new-${task.id}-${task.assignedAt}`,
                department: 'tasks',
                type: 'new_task',
                entityId: task.id,
                entityName: task.title,
                message: `Boss, you have a new task: ${task.title.substring(0, 50)}`,
                priority: task.priority === 'urgent' || task.priority === 'high' ? 'high' : 'medium',
                createdAt: task.assignedAt.toString(),
              });
            }
          }

          // Tasks due today or overdue
          if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            if (dueDate <= today) {
              const isOverdue = dueDate < today;
              alerts.push({
                id: `task-due-${task.id}-${task.dueDate}`,
                department: 'tasks',
                type: isOverdue ? 'overdue' : 'task_due',
                entityId: task.id,
                entityName: task.title,
                message: isOverdue 
                  ? `Boss, task is overdue: ${task.title.substring(0, 50)}`
                  : `Boss, task is due today: ${task.title.substring(0, 50)}`,
                priority: isOverdue ? 'high' : 'medium',
                dueDate: task.dueDate.toString(),
                createdAt: task.dueDate.toString(),
              });
            }
          }

          // Reminder date alerts
          if (task.reminderDate) {
            const reminderDate = new Date(task.reminderDate);
            reminderDate.setHours(0, 0, 0, 0);
            if (reminderDate <= today) {
              alerts.push({
                id: `task-reminder-${task.id}-${task.reminderDate}`,
                department: 'tasks',
                type: 'followup_due',
                entityId: task.id,
                entityName: task.title,
                message: `Boss, reminder for task: ${task.title.substring(0, 50)}`,
                priority: 'medium',
                dueDate: task.reminderDate.toString(),
                createdAt: task.reminderDate.toString(),
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching task alerts:", e);
      }

      // 4. IMPLEMENTATION ALERTS - Project assignments
      try {
        // Get projects where user is assigned as engineer
        const projectEngineers = await storage.getProjectEngineers(undefined);
        const userProjectIds = projectEngineers
          .filter(pe => pe.engineerId === currentUser.id)
          .map(pe => pe.projectId);

        if (userProjectIds.length > 0) {
          // Get projects assigned to user
          const allProjects = await storage.getProjects();
          const userProjects = allProjects.filter(p => userProjectIds.includes(p.id));

          for (const project of userProjects) {
            if (project.status === 'completed') continue;

            // Target go-live date alerts
            if (project.targetGoLiveDate) {
              const goLiveDate = new Date(project.targetGoLiveDate);
              goLiveDate.setHours(0, 0, 0, 0);
              
              if (goLiveDate <= today) {
                const isOverdue = goLiveDate < today;
                alerts.push({
                  id: `impl-golive-${project.id}-${project.targetGoLiveDate}`,
                  department: 'implementation',
                  type: isOverdue ? 'overdue' : 'project_update',
                  entityId: project.id,
                  entityName: project.clientName,
                  message: isOverdue
                    ? `Boss, project for ${project.clientName} is past go-live date`
                    : `Boss, project for ${project.clientName} has go-live target today`,
                  priority: isOverdue ? 'high' : 'medium',
                  dueDate: project.targetGoLiveDate.toString(),
                  createdAt: project.targetGoLiveDate.toString(),
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching implementation alerts:", e);
      }

      // 5. DEVELOPMENT TASK ALERTS
      try {
        const devTasks = await storage.getDevelopmentTasks({ assignedTo: currentUser.id });
        
        for (const devTask of devTasks) {
          if (devTask.status === 'completed' || devTask.status === 'cancelled') continue;

          // New dev tasks assigned (in last 24 hours)
          if (devTask.createdAt) {
            const createdAt = new Date(devTask.createdAt);
            const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceCreation <= 24 && devTask.status === 'pending') {
              alerts.push({
                id: `dev-new-${devTask.id}-${devTask.createdAt}`,
                department: 'development',
                type: 'dev_task_assigned',
                entityId: devTask.id,
                entityName: devTask.title,
                message: `Boss, you have a new development task: ${devTask.title.substring(0, 50)}`,
                priority: devTask.priority === 'critical' || devTask.priority === 'high' ? 'high' : 'medium',
                createdAt: devTask.createdAt.toString(),
              });
            }
          }

          // Deadline alerts
          if (devTask.deadline) {
            const deadline = new Date(devTask.deadline);
            deadline.setHours(0, 0, 0, 0);
            
            if (deadline <= today) {
              const isOverdue = deadline < today || devTask.isOverdue;
              alerts.push({
                id: `dev-due-${devTask.id}-${devTask.deadline}`,
                department: 'development',
                type: isOverdue ? 'overdue' : 'task_due',
                entityId: devTask.id,
                entityName: devTask.title,
                message: isOverdue
                  ? `Boss, development task is overdue: ${devTask.title.substring(0, 50)}`
                  : `Boss, development task is due today: ${devTask.title.substring(0, 50)}`,
                priority: 'high',
                dueDate: devTask.deadline.toString(),
                createdAt: devTask.deadline.toString(),
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching development alerts:", e);
      }

      // Sort alerts by priority (high first) and then by date
      alerts.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Limit to top 20 alerts to prevent overwhelming
      const limitedAlerts = alerts.slice(0, 20);

      res.json({
        alerts: limitedAlerts,
        voicePreference: currentUser.voicePreference || 'female',
        voiceAlertsEnabled: currentUser.voiceAlertsEnabled !== false,
        totalAlerts: alerts.length,
      });
    } catch (error) {
      console.error("Error fetching voice alerts:", error);
      res.status(500).json({ message: "Failed to fetch voice alerts" });
    }
  });

  // =============================================
  // TASK/FOLLOWUP MANAGEMENT ROUTES
  // =============================================

  // Get all tasks (with filters) - Everyone can see their own tasks
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const { status, assignedTo, createdBy, view } = req.query;

      // Fetch database user first - required for proper ID resolution
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Use the database user ID (not auth ID) for access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      const cachePrefix = accessControl.hasFullAccess && view === 'all' ? 'shared' : authId;
      const cacheKey = `tasks:${cachePrefix}:${status||''}:${view||''}:${assignedTo||''}:${createdBy||''}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);
      
      // Only admins/super admins can request view=all (all tasks)
      if (view === 'all' && !accessControl.hasFullAccess) {
        return res.status(403).json({ message: "Access denied: Only admins can view all tasks" });
      }
      
      const includeAll = accessControl.hasFullAccess && view === 'all';
      
      // Build task filters with access control
      const taskFilters: {
        userId?: string;
        userIds?: string[];
        status?: string;
        assignedTo?: string;
        createdBy?: string;
        includeAll?: boolean;
      } = {
        status: status as string || undefined,
        assignedTo: assignedTo as string || undefined,
        createdBy: createdBy as string || undefined,
        includeAll,
      };
      
      // Apply department-based filtering for non-admins
      if (!includeAll) {
        if (accessControl.hasFullAccess) {
          taskFilters.userId = currentUser.id;
        } else if (accessControl.allowedUserIds && accessControl.allowedUserIds.length > 1) {
          taskFilters.userIds = accessControl.allowedUserIds;
        } else {
          taskFilters.userId = currentUser.id;
        }
      }
      
      const taskList = await storage.getTasks(taskFilters);
      
      setCached(cacheKey, taskList, 600);
      res.json(taskList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get today's tasks (for Today's Task page) - MUST be before /api/tasks/:id to avoid route conflict
  app.get("/api/tasks/today", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const { view } = req.query;
      
      // Fetch database user first
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Use centralized access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      // Only admins/super admins can request view=all
      if (view === 'all' && !accessControl.hasFullAccess) {
        return res.status(403).json({ message: "Access denied: Only admins can view all tasks" });
      }
      
      const includeAll = accessControl.hasFullAccess && view === 'all';
      
      // Use the database user ID (not auth ID) since tasks are assigned by database ID
      const todayTasks = await storage.getTodayTasks(currentUser.id, includeAll);
      res.json(todayTasks);
    } catch (error) {
      console.error("Error fetching today's tasks:", error);
      res.status(500).json({ message: "Failed to fetch today's tasks" });
    }
  });

  // Get single task - with proper access control
  app.get("/api/tasks/:id", isAuthenticated, requirePermission('tasks', 'view'), async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check access: user must be creator, assignee, mentioned, department head, or admin
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      // Admins and super admins can view all tasks
      if (!accessControl.hasFullAccess) {
        const allowedIds = accessControl.allowedUserIds || [currentUser.id];
        const isCreator = task.createdBy && allowedIds.includes(task.createdBy);
        const isAssignee = task.assignedTo && allowedIds.includes(task.assignedTo);
        const isMentioned = task.mentionedUsers?.some(uid => allowedIds.includes(uid));
        
        if (!isCreator && !isAssignee && !isMentioned) {
          return res.status(403).json({ message: "Access denied: You don't have permission to view this task" });
        }
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create task
  app.post("/api/tasks", isAuthenticated, requirePermission('tasks', 'create'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Auto-assignment if not specified - use configurable assignment settings
      let assignedTo = req.body.assignedTo;
      if (!assignedTo) {
        const nextUser = await storage.getNextAssignableUser("tasks");
        if (nextUser) {
          assignedTo = nextUser.id;
          await storage.updateLastAssignedUser("tasks", nextUser.id);
        }
      }
      
      // Parse dates properly and set assignedAt if task is assigned
      const taskData = {
        ...req.body,
        createdBy: userId,
        assignedTo,
        reminderDate: req.body.reminderDate ? new Date(req.body.reminderDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        assignedAt: assignedTo ? new Date() : undefined,
      };
      
      const validatedData = insertTaskSchema.parse(taskData);
      const newTask = await storage.createTask(validatedData);
      
      // Save attachments if provided - with proper validation
      const attachments = req.body.attachments;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const attachmentErrors: string[] = [];
        
        for (const attachment of attachments) {
          try {
            // Validate required fields before saving
            const objectPath = attachment.url || attachment.objectPath;
            if (!objectPath) {
              attachmentErrors.push(`Attachment ${attachment.name || 'unknown'} missing objectPath`);
              continue;
            }
            
            const attachmentData = {
              entityType: "task" as const,
              entityId: newTask.id,
              fileName: attachment.name || attachment.fileName || "Unnamed",
              fileType: attachment.mimeType || attachment.type || "application/octet-stream",
              fileSize: attachment.size || 0,
              objectPath,
              uploadedBy: userId,
            };
            
            await storage.createAttachment(attachmentData);
          } catch (attachmentError) {
            console.error("Error saving attachment:", attachmentError);
            attachmentErrors.push(`Failed to save ${attachment.name || 'unknown'}`);
          }
        }
        
        if (attachmentErrors.length > 0) {
          console.warn(`Task ${newTask.id} created with ${attachmentErrors.length} attachment errors:`, attachmentErrors);
        }
      }
      
      // Award points if task is assigned
      if (newTask.assignedTo) {
        await handleAssignment({
          module: "tasks",
          entityId: newTask.id,
          newAssigneeId: newTask.assignedTo,
          previousAssigneeId: null,
          assignedById: userId,
        });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: newTask.id,
        action: "created",
        description: `Task created: ${newTask.title}`,
        userId,
        metadata: { assignedTo: newTask.assignedTo },
      });

      invalidateCache("tasks:");
      invalidateCache("my-department:");
      res.json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task - with proper department-based access control
  app.patch("/api/tasks/:id", isAuthenticated, requirePermission('tasks', 'edit'), async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check access: user must be creator, assignee, mentioned, department head, or admin
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      if (!accessControl.hasFullAccess) {
        const allowedIds = accessControl.allowedUserIds || [currentUser.id];
        const isCreator = task.createdBy && allowedIds.includes(task.createdBy);
        const isAssignee = task.assignedTo && allowedIds.includes(task.assignedTo);
        const isMentioned = task.mentionedUsers?.some(uid => allowedIds.includes(uid));
        
        if (!isCreator && !isAssignee && !isMentioned) {
          return res.status(403).json({ message: "You don't have permission to update this task" });
        }
      }
      
      // Parse dates properly and update assignedAt if assignment changes
      const updateData: any = {
        ...req.body,
        reminderDate: req.body.reminderDate ? new Date(req.body.reminderDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      
      // Set assignedAt when task is newly assigned or assignment changes
      const assignmentChanged = req.body.assignedTo && req.body.assignedTo !== task.assignedTo;
      if (assignmentChanged) {
        updateData.assignedAt = new Date();
      }
      
      const updatedTask = await storage.updateTask(req.params.id, updateData);
      
      // Handle points for assignment changes
      if (assignmentChanged) {
        await handleAssignment({
          module: "tasks",
          entityId: task.id,
          newAssigneeId: req.body.assignedTo,
          previousAssigneeId: task.assignedTo,
          assignedById: authId,
        });
      }
      
      // Handle completion bonus
      if (req.body.status === "completed" && task.status !== "completed" && updatedTask.assignedTo) {
        await handleCompletion({
          module: "tasks",
          entityId: task.id,
          completedById: updatedTask.assignedTo,
        });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: updatedTask.id,
        action: "updated",
        description: `Task updated: ${updatedTask.title}`,
        userId: authId,
        metadata: { status: updatedTask.status },
      });

      invalidateCache("tasks:");
      invalidateCache("my-department:");
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task - with proper department-based access control
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check access: only creator, department head, or admin can delete
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      if (!accessControl.hasFullAccess) {
        const allowedIds = accessControl.allowedUserIds || [currentUser.id];
        const isCreator = task.createdBy && allowedIds.includes(task.createdBy);
        
        // Only creator or department head can delete (not just assignee)
        if (!isCreator) {
          return res.status(403).json({ message: "You don't have permission to delete this task" });
        }
      }
      
      await storage.deleteTask(req.params.id);
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: req.params.id,
        action: "deleted",
        description: `Task deleted: ${task.title}`,
        userId: authId,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Get task comments
  app.get("/api/tasks/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getTaskComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching task comments:", error);
      res.status(500).json({ message: "Failed to fetch task comments" });
    }
  });

  // Create task comment
  app.post("/api/tasks/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const commentData = {
        ...req.body,
        taskId,
        userId,
      };
      
      const validatedData = insertTaskCommentSchema.parse(commentData);
      const newComment = await storage.createTaskComment(validatedData);
      
      // Get the user who created the comment to return enriched data
      const user = await storage.getUser(userId);
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: taskId,
        action: "comment_added",
        description: `Comment added to task: ${task.title}`,
        userId,
      });
      
      // Return enriched comment with user data so UI displays immediately
      res.json({ ...newComment, user });
    } catch (error) {
      console.error("Error creating task comment:", error);
      res.status(500).json({ message: "Failed to create task comment" });
    }
  });

  // Update task comment
  app.patch("/api/task-comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const comments = await storage.getTaskComments(req.body.taskId);
      const comment = comments.find(c => c.id === req.params.id);
      
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      
      // Only comment author or admin can update
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      
      if (!isAdmin && comment.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update this comment" });
      }
      
      const updatedComment = await storage.updateTaskComment(req.params.id, req.body);
      res.json(updatedComment);
    } catch (error) {
      console.error("Error updating task comment:", error);
      res.status(500).json({ message: "Failed to update task comment" });
    }
  });

  // Delete task comment
  app.delete("/api/task-comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Only comment author or admin can delete
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      
      // For simplicity, admin can always delete
      if (!isAdmin) {
        // We'd need to verify ownership, but for now let the frontend handle this
      }
      
      await storage.deleteTaskComment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task comment:", error);
      res.status(500).json({ message: "Failed to delete task comment" });
    }
  });

  // =============================================
  // TASK FOLLOWUP ROUTES
  // =============================================

  // Get task followups
  app.get("/api/tasks/:id/followups", isAuthenticated, async (req, res) => {
    try {
      const followups = await storage.getTaskFollowups(req.params.id);
      res.json(followups);
    } catch (error) {
      console.error("Error fetching task followups:", error);
      res.status(500).json({ message: "Failed to fetch task followups" });
    }
  });

  // Create task followup
  app.post("/api/tasks/:id/followups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const followupData = {
        ...req.body,
        taskId,
        userId,
      };
      
      const validatedData = insertTaskFollowupSchema.parse(followupData);
      const newFollowup = await storage.createTaskFollowup(validatedData);
      
      // If next followup date is set, update task status to 'followup'
      if (req.body.nextFollowupDate) {
        await storage.updateTask(taskId, { status: 'followup' });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: taskId,
        action: "followup_added",
        description: `Follow-up added to task: ${task.title}`,
        userId,
      });
      
      res.json(newFollowup);
    } catch (error) {
      console.error("Error creating task followup:", error);
      res.status(500).json({ message: "Failed to create task followup" });
    }
  });

  // Update task followup
  app.patch("/api/task-followups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const followup = await storage.getTaskFollowup(req.params.id);
      
      if (!followup) {
        return res.status(404).json({ message: "Followup not found" });
      }
      
      // Only followup author or admin can update
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      
      if (!isAdmin && followup.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update this followup" });
      }
      
      const updatedFollowup = await storage.updateTaskFollowup(req.params.id, req.body);
      res.json(updatedFollowup);
    } catch (error) {
      console.error("Error updating task followup:", error);
      res.status(500).json({ message: "Failed to update task followup" });
    }
  });

  // Delete task followup
  app.delete("/api/task-followups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const followup = await storage.getTaskFollowup(req.params.id);
      
      if (!followup) {
        return res.status(404).json({ message: "Followup not found" });
      }
      
      // Only followup author or admin can delete
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      
      if (!isAdmin && followup.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this followup" });
      }
      
      await storage.deleteTaskFollowup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task followup:", error);
      res.status(500).json({ message: "Failed to delete task followup" });
    }
  });

  // Upload followup attachment (voice/video/image)
  app.post("/api/task-followups/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId, type, fileName: originalFileName, mimeType } = req.body;
      
      // Validate type
      if (!["voice", "video", "image"].includes(type)) {
        return res.status(400).json({ message: "Invalid attachment type. Must be 'voice', 'video', or 'image'" });
      }
      
      // Generate a unique file name
      const timestamp = Date.now();
      const extension = originalFileName ? `.${originalFileName.split('.').pop()}` : 
                        type === 'voice' ? '.webm' :
                        type === 'video' ? '.webm' : 
                        type === 'image' ? '.jpg' : '';
      const fileName = `followup_${type}_${userId}_${taskId || 'new'}_${timestamp}${extension}`;
      
      // Get upload URL
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName);
      
      res.json({ 
        uploadURL, 
        objectPath,
        attachmentUrl: `/objects/${objectPath}`,
        type,
        originalFileName,
        mimeType,
      });
    } catch (error) {
      console.error("Error getting followup upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Convert task to lead
  app.post("/api/tasks/:id/convert-to-lead", isAuthenticated, requirePermission('sales', 'create'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      
      // Get the task
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Validate required fields from the request body
      const { 
        companyName, 
        contactPerson, 
        contactEmail, 
        contactPhone,
        leadSource = "task_conversion",
        currency = "INR",
        estimatedValue,
        city,
        area,
      } = req.body;
      
      if (!companyName || !contactPerson || !contactEmail || !leadSource) {
        return res.status(400).json({ message: "Company name, contact person, contact email, and lead source are required" });
      }
      
      // Create the lead
      const leadData = {
        companyName,
        contactPerson,
        contactEmail,
        contactPhone: contactPhone || null,
        leadSource,
        currency,
        estimatedValue: estimatedValue ? parseInt(estimatedValue) : null,
        stage: "lead", // Start as lead since it came from a qualified task
        salesExecutiveId: userId,
        city: city || null,
        area: area || null,
      };
      
      const lead = await storage.createLead(leadData);
      
      // Transfer task comments as lead comments
      const taskComments = await storage.getTaskComments(taskId);
      for (const comment of taskComments) {
        await storage.createLeadComment({
          leadId: lead.id,
          userId: comment.userId,
          comment: comment.content,
        });
      }
      
      // Add a note about the conversion
      await storage.createLeadComment({
        leadId: lead.id,
        userId: userId,
        comment: `Lead created from task: ${task.title}\n\n${task.description || ''}`,
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        action: "task_converted_to_lead",
        entityType: "lead",
        entityId: lead.id,
        description: `Converted task "${task.title}" to lead "${lead.companyName}"`,
        metadata: { 
          taskId: task.id,
          taskTitle: task.title,
          leadId: lead.id,
          companyName: lead.companyName,
        },
      });
      
      // Mark the task as completed (completedAt is set automatically by storage)
      await storage.updateTask(taskId, { 
        status: "completed",
      });
      
      res.json({ 
        success: true, 
        lead,
        message: `Task converted to lead successfully. ${taskComments.length} comments transferred.`,
      });
    } catch (error) {
      console.error("Error converting task to lead:", error);
      res.status(500).json({ message: "Failed to convert task to lead" });
    }
  });

  // Get all users for task assignment/mentions - only return active users for selection
  app.get("/api/users/all", isAuthenticated, async (req, res) => {
    try {
      const { includeInactive } = req.query;
      let userList = await storage.getUsers();
      // Filter out inactive users unless explicitly requested
      if (includeInactive !== 'true') {
        userList = userList.filter(u => u.isActive !== false);
      }
      res.json(userList);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Upload voice note for task
  app.post("/api/tasks/voice-upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId } = req.body;
      
      // Generate a unique file name for the voice note
      const timestamp = Date.now();
      const fileName = `voice_${userId}_${taskId || 'new'}_${timestamp}.webm`;
      
      // Get upload URL using the object storage service
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName);
      
      res.json({ 
        uploadURL, 
        objectPath,
        voiceNoteUrl: `/objects/${objectPath}`,
      });
    } catch (error) {
      console.error("Error getting voice upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Upload task attachment (video recording, photo, or file)
  app.post("/api/tasks/attachment-upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { taskId, type, fileName: originalFileName, mimeType } = req.body;
      
      // Validate type
      if (!["video", "photo", "file"].includes(type)) {
        return res.status(400).json({ message: "Invalid attachment type. Must be 'video', 'photo', or 'file'" });
      }
      
      // Generate a unique file name for the attachment
      const timestamp = Date.now();
      const extension = originalFileName ? `.${originalFileName.split('.').pop()}` : 
                        type === 'video' ? '.webm' : 
                        type === 'photo' ? '.jpg' : '';
      const prefix = type === 'video' ? 'video' : type === 'photo' ? 'photo' : 'file';
      const fileName = `${prefix}_${userId}_${taskId || 'new'}_${timestamp}${extension}`;
      
      // Get upload URL using the object storage service
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(fileName);
      
      res.json({ 
        uploadURL, 
        objectPath,
        attachmentUrl: `/objects/${objectPath}`,
        type,
        originalFileName,
        mimeType,
      });
    } catch (error) {
      console.error("Error getting attachment upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // =============================================
  // REPORT EMAIL ROUTES
  // =============================================
  
  // Send report via email
  app.post("/api/reports/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const { to, subject, html } = req.body;
      
      if (!to || !subject || !html) {
        return res.status(400).json({ message: "Missing required fields: to, subject, html" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      
      const result = await sendEmail({ to, subject, html });
      
      if (result.success) {
        res.json({ success: true, message: "Report sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending report email:", error);
      res.status(500).json({ message: "Failed to send report email" });
    }
  });

  // =============================================
  // KNOWLEDGE BASE ROUTES
  // =============================================

  // Get all knowledge base sources
  app.get("/api/knowledge-base/sources", isAuthenticated, async (req: any, res) => {
    try {
      const cached = getCached<any>("kb:sources");
      if (cached) return res.json(cached);
      const sources = await storage.getKnowledgeBaseSources();
      setCached("kb:sources", sources, 300);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching knowledge base sources:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base sources" });
    }
  });

  // Get a single knowledge base source
  app.get("/api/knowledge-base/sources/:id", isAuthenticated, async (req: any, res) => {
    try {
      const source = await storage.getKnowledgeBaseSource(req.params.id);
      if (!source) {
        return res.status(404).json({ message: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      console.error("Error fetching knowledge base source:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base source" });
    }
  });

  // Get categories, content types, and languages for dropdowns
  app.get("/api/knowledge-base/metadata", isAuthenticated, async (req: any, res) => {
    res.json({
      categories: knowledgeBaseCategories,
      contentTypes: knowledgeBaseContentTypes,
      languages: supportedLanguages,
    });
  });

  // Create a new knowledge base source and index its content
  app.post("/api/knowledge-base/sources", isAuthenticated, requirePermission("knowledge_base", "create"), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { title, content, category, contentType, description, languageCode = "en", translationGroupId } = req.body;

      if (!title || !content || !category || !contentType) {
        return res.status(400).json({ message: "Title, content, category, and content type are required" });
      }

      // Validate category
      if (!knowledgeBaseCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      // Validate content type
      if (!knowledgeBaseContentTypes.includes(contentType)) {
        return res.status(400).json({ message: "Invalid content type" });
      }

      // Validate language code
      const validLanguage = supportedLanguages.find(l => l.code === languageCode);
      if (!validLanguage) {
        return res.status(400).json({ message: "Invalid language code" });
      }

      // Extract text from content
      const extractedText = extractTextFromContent(content, contentType);
      const totalTokens = estimateTokenCount(extractedText);

      // Generate translation group ID if not provided (for original documents)
      const groupId = translationGroupId || `tg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const isTranslation = !!translationGroupId;

      // Create the source record
      const source = await storage.createKnowledgeBaseSource({
        title,
        category,
        contentType,
        description,
        originalContent: content,
        languageCode,
        translationGroupId: groupId,
        translationStatus: isTranslation ? "translated" : "original",
        isActive: true,
        createdBy: userId,
      });

      // Chunk the content
      const chunks = chunkText(extractedText);

      if (chunks.length === 0) {
        return res.status(400).json({ message: "Content is too short to index" });
      }

      // Generate embeddings for all chunks
      const chunkTexts = chunks.map(c => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);

      // Create chunk records with embeddings
      const chunkRecords = chunks.map((chunk, index) => ({
        sourceId: source.id,
        chunkIndex: index,
        content: chunk.text,
        languageCode,
        tokenCount: estimateTokenCount(chunk.text),
        metadata: {
          startPosition: chunk.metadata.startChar,
          endPosition: chunk.metadata.endChar,
        },
      }));

      const createdChunks = await storage.createKnowledgeBaseChunks(chunkRecords);

      // Update embeddings directly in the database
      for (let i = 0; i < createdChunks.length; i++) {
        const embeddingString = `[${embeddings[i].join(',')}]`;
        await db.execute(sql`UPDATE knowledge_base_chunks SET embedding = ${embeddingString}::vector WHERE id = ${createdChunks[i].id}`);
      }

      // Update source with chunk and token counts
      await db.execute(sql`UPDATE knowledge_base_sources SET chunk_count = ${chunks.length}, token_count = ${totalTokens}, is_indexed = true, indexed_at = NOW() WHERE id = ${source.id}`);

      invalidateCache("kb:sources");
      invalidateCache("kb:analytics");
      res.status(201).json({
        ...source,
        totalChunks: chunks.length,
        message: `Successfully indexed ${chunks.length} chunks`,
      });
    } catch (error) {
      console.error("Error creating knowledge base source:", error);
      res.status(500).json({ message: "Failed to create knowledge base source" });
    }
  });

  // Update a knowledge base source
  app.patch("/api/knowledge-base/sources/:id", isAuthenticated, requirePermission("knowledge_base", "edit"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, description, category, isActive } = req.body;

      const existing = await storage.getKnowledgeBaseSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Source not found" });
      }

      const updated = await storage.updateKnowledgeBaseSource(id, {
        title,
        description,
        category,
        isActive,
      });

      invalidateCache("kb:sources");
      invalidateCache("kb:analytics");
      res.json(updated);
    } catch (error) {
      console.error("Error updating knowledge base source:", error);
      res.status(500).json({ message: "Failed to update knowledge base source" });
    }
  });

  // Delete a knowledge base source (cascades to chunks)
  app.delete("/api/knowledge-base/sources/:id", isAuthenticated, requirePermission("knowledge_base", "delete"), async (req: any, res) => {
    try {
      const { id } = req.params;

      const existing = await storage.getKnowledgeBaseSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Source not found" });
      }

      await storage.deleteKnowledgeBaseSource(id);
      invalidateCache("kb:sources");
      invalidateCache("kb:analytics");
      res.json({ message: "Source deleted successfully" });
    } catch (error) {
      console.error("Error deleting knowledge base source:", error);
      res.status(500).json({ message: "Failed to delete knowledge base source" });
    }
  });

  // Re-index a knowledge base source
  app.post("/api/knowledge-base/sources/:id/reindex", isAuthenticated, requirePermission("knowledge_base", "edit"), async (req: any, res) => {
    try {
      const { id } = req.params;

      const source = await storage.getKnowledgeBaseSource(id);
      if (!source) {
        return res.status(404).json({ message: "Source not found" });
      }

      // Delete existing chunks
      await storage.deleteKnowledgeBaseChunksBySource(id);

      // Extract and chunk the content
      const extractedText = extractTextFromContent(source.originalContent || '', source.contentType);
      const chunks = chunkText(extractedText);

      if (chunks.length === 0) {
        return res.status(400).json({ message: "Content is too short to index" });
      }

      // Generate embeddings
      const chunkTexts = chunks.map(c => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);

      // Create chunk records
      const chunkRecords = chunks.map((chunk, index) => ({
        sourceId: id,
        chunkIndex: index,
        content: chunk.text,
        tokenCount: estimateTokenCount(chunk.text),
        metadata: {
          startPosition: chunk.metadata.startChar,
          endPosition: chunk.metadata.endChar,
        },
      }));

      const createdChunks = await storage.createKnowledgeBaseChunks(chunkRecords);

      // Update embeddings
      for (let i = 0; i < createdChunks.length; i++) {
        const embeddingString = `[${embeddings[i].join(',')}]`;
        await db.execute(sql`UPDATE knowledge_base_chunks SET embedding = ${embeddingString}::vector WHERE id = ${createdChunks[i].id}`);
      }

      // Update source with chunk and token counts
      const tokenCount = estimateTokenCount(extractedText);
      await db.execute(sql`UPDATE knowledge_base_sources SET chunk_count = ${chunks.length}, token_count = ${tokenCount}, is_indexed = true, indexed_at = NOW() WHERE id = ${id}`);

      invalidateCache("kb:sources");
      invalidateCache("kb:analytics");
      res.json({
        message: `Successfully re-indexed ${chunks.length} chunks`,
        totalChunks: chunks.length,
      });
    } catch (error) {
      console.error("Error re-indexing knowledge base source:", error);
      res.status(500).json({ message: "Failed to re-index knowledge base source" });
    }
  });

  // Bulk re-index all unindexed knowledge base sources
  app.post("/api/knowledge-base/reindex-all", isAuthenticated, requirePermission("knowledge_base", "edit"), async (req: any, res) => {
    try {
      const { force } = req.body || {};
      
      // Get all sources - also check for missing embeddings
      const allSources = await storage.getKnowledgeBaseSources();
      
      // Check which sources need reindexing: either not indexed OR have chunks without embeddings
      let sourcesToIndex: typeof allSources = [];
      
      if (force) {
        // Force mode: reindex all active sources
        sourcesToIndex = allSources.filter(s => s.isActive);
      } else {
        // Check for sources that are unindexed OR have chunks without embeddings
        for (const source of allSources.filter(s => s.isActive)) {
          if (!source.isIndexed) {
            sourcesToIndex.push(source);
          } else {
            // Check if any chunks are missing embeddings
            const result = await db.execute(sql`
              SELECT COUNT(*) as missing_count 
              FROM knowledge_base_chunks 
              WHERE source_id = ${source.id} AND embedding IS NULL
            `);
            const missingCount = parseInt((result.rows[0] as any)?.missing_count || '0');
            if (missingCount > 0) {
              sourcesToIndex.push(source);
            }
          }
        }
      }
      
      if (sourcesToIndex.length === 0) {
        return res.json({ message: "All documents are already indexed", indexed: 0 });
      }

      let indexedCount = 0;
      let totalChunks = 0;
      const errors: string[] = [];

      for (const source of sourcesToIndex) {
        try {
          // Delete existing chunks if any
          await storage.deleteKnowledgeBaseChunksBySource(source.id);

          // Extract and chunk the content
          const extractedText = extractTextFromContent(source.originalContent || '', source.contentType);
          const chunks = chunkText(extractedText);

          if (chunks.length === 0) {
            errors.push(`${source.title}: Content too short to index`);
            continue;
          }

          // Generate embeddings
          const chunkTexts = chunks.map(c => c.text);
          const embeddings = await generateEmbeddings(chunkTexts);

          // Create chunk records
          const chunkRecords = chunks.map((chunk, index) => ({
            sourceId: source.id,
            chunkIndex: index,
            content: chunk.text,
            tokenCount: estimateTokenCount(chunk.text),
            metadata: {
              startPosition: chunk.metadata.startChar,
              endPosition: chunk.metadata.endChar,
            },
          }));

          const createdChunks = await storage.createKnowledgeBaseChunks(chunkRecords);

          // Update embeddings
          for (let i = 0; i < createdChunks.length; i++) {
            const embeddingString = `[${embeddings[i].join(',')}]`;
            await db.execute(sql`UPDATE knowledge_base_chunks SET embedding = ${embeddingString}::vector WHERE id = ${createdChunks[i].id}`);
          }

          // Update source with chunk and token counts
          const tokenCount = estimateTokenCount(extractedText);
          await db.execute(sql`UPDATE knowledge_base_sources SET chunk_count = ${chunks.length}, token_count = ${tokenCount}, is_indexed = true, indexed_at = NOW() WHERE id = ${source.id}`);

          indexedCount++;
          totalChunks += chunks.length;
        } catch (docError: any) {
          errors.push(`${source.title}: ${docError.message}`);
        }
      }

      invalidateCache("kb:sources");
      invalidateCache("kb:analytics");
      res.json({
        message: `Successfully indexed ${indexedCount} documents with ${totalChunks} chunks`,
        indexed: indexedCount,
        totalChunks,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error bulk re-indexing knowledge base:", error);
      res.status(500).json({ message: "Failed to bulk re-index knowledge base" });
    }
  });

  // Semantic search across knowledge base
  app.post("/api/knowledge-base/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { query, category, limit = 10, languageCode, includeCrossLanguage = false } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const startTime = Date.now();

      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query.trim());

      // Search for similar chunks with language filtering
      const results = await storage.searchKnowledgeBase(
        queryEmbedding,
        Math.min(limit, 20),
        category,
        languageCode,
        includeCrossLanguage
      );

      const searchDuration = Date.now() - startTime;

      // Log the query for analytics with language info
      await storage.createKnowledgeBaseQuery({
        queryText: query.trim(),
        userId,
        languageCode: languageCode || "en",
        includeCrossLanguage,
        resultsCount: results.length,
        topResults: results.slice(0, 5).map(r => ({
          sourceId: r.sourceId,
          title: r.source?.title || 'Unknown',
          languageCode: r.source?.languageCode,
          score: r.similarity,
        })),
        searchDurationMs: searchDuration,
      });

      res.json({
        query: query.trim(),
        results: results.map(r => ({
          id: r.id,
          content: r.content,
          similarity: r.similarity,
          source: r.source ? {
            id: r.source.id,
            title: r.source.title,
            category: r.source.category,
          } : null,
        })),
        searchDurationMs: searchDuration,
        totalResults: results.length,
      });
    } catch (error) {
      console.error("Error searching knowledge base:", error);
      res.status(500).json({ message: "Failed to search knowledge base" });
    }
  });

  // Get search analytics (admin only)
  app.get("/api/knowledge-base/analytics", isAuthenticated, requirePermission("knowledge_base", "view"), async (req: any, res) => {
    try {
      const cached = getCached<any>("kb:analytics");
      if (cached) return res.json(cached);

      const [queries, sources] = await Promise.all([
        storage.getKnowledgeBaseQueries(100),
        storage.getKnowledgeBaseSources(),
      ]);

      const totalSources = sources.length;
      const activeSources = sources.filter(s => s.isActive).length;
      const totalChunks = sources.reduce((sum, s) => sum + (s.chunkCount || 0), 0);
      const totalQueries = queries.length;
      const avgSearchTime = queries.length > 0 
        ? queries.reduce((sum, q) => sum + (q.searchDurationMs || 0), 0) / queries.length 
        : 0;

      const result = {
        totalSources,
        activeSources,
        totalChunks,
        totalQueries,
        avgSearchTimeMs: Math.round(avgSearchTime),
        recentQueries: queries.slice(0, 20).map(q => ({
          id: q.id,
          query: q.queryText,
          resultsCount: q.resultsCount,
          searchDurationMs: q.searchDurationMs,
          createdAt: q.createdAt,
          user: q.user ? { id: q.user.id, name: `${q.user.firstName || ''} ${q.user.lastName || ''}`.trim() } : null,
        })),
      };
      setCached("kb:analytics", result, 300);
      res.json(result);
    } catch (error) {
      console.error("Error fetching knowledge base analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // =============================================
  // SMTP CONFIGURATION ROUTES (Admin only)
  // =============================================

  // Get SMTP configuration
  app.get("/api/admin/smtp-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const config = await storage.getSmtpConfig();
      
      if (!config) {
        return res.json({
          configured: false,
          config: null,
        });
      }

      // Mask the password for security
      const maskedConfig = {
        ...config,
        pass: config.pass ? "••••••••" : "",
      };

      res.json({
        configured: true,
        config: maskedConfig,
      });
    } catch (error) {
      console.error("Error fetching SMTP config:", error);
      res.status(500).json({ message: "Failed to fetch SMTP configuration" });
    }
  });

  // Save SMTP configuration
  app.post("/api/admin/smtp-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const validatedConfig = smtpConfigSchema.parse(req.body);

      await storage.saveSmtpConfig(validatedConfig, userId);
      
      // Clear the email service SMTP cache so it uses the new settings
      clearSmtpSettingsCache();

      // Log the activity
      await storage.logActivity({
        entityType: "system_settings",
        entityId: "smtp_config",
        action: "updated",
        description: "SMTP configuration updated",
        userId,
      });

      res.json({ success: true, message: "SMTP configuration saved successfully" });
    } catch (error: any) {
      console.error("Error saving SMTP config:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid SMTP configuration", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save SMTP configuration" });
    }
  });

  // Test SMTP configuration by sending a test email
  app.post("/api/admin/smtp-config/test", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ message: "Test email address is required" });
      }

      // Get the current SMTP config
      const config = await storage.getSmtpConfig();
      
      if (!config || !config.enabled) {
        return res.status(400).json({ message: "SMTP is not configured or disabled" });
      }

      // Try to send a test email using SMTP
      const nodemailer = await import("nodemailer");
      
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });

      await transporter.sendMail({
        from: config.from,
        to: testEmail,
        subject: "M-CRM SMTP Test Email",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a2b6d;">SMTP Configuration Test</h2>
            <p>This is a test email to verify your SMTP configuration is working correctly.</p>
            <p style="color: #666;">Sent from M-CRM at ${new Date().toLocaleString()}</p>
          </div>
        `,
      });

      res.json({ success: true, message: `Test email sent successfully to ${testEmail}` });
    } catch (error: any) {
      console.error("Error testing SMTP config:", error);
      res.status(500).json({ 
        message: "Failed to send test email",
        error: error.message || "Unknown error"
      });
    }
  });

  // Delete SMTP configuration
  app.delete("/api/admin/smtp-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.id;

      // Delete all SMTP settings
      const smtpKeys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "smtp_secure", "smtp_enabled"];
      for (const key of smtpKeys) {
        await storage.deleteSystemSetting(key);
      }
      
      // Clear the email service SMTP cache
      clearSmtpSettingsCache();

      // Log the activity
      await storage.logActivity({
        entityType: "system_settings",
        entityId: "smtp_config",
        action: "deleted",
        description: "SMTP configuration deleted",
        userId,
      });

      res.json({ success: true, message: "SMTP configuration deleted" });
    } catch (error) {
      console.error("Error deleting SMTP config:", error);
      res.status(500).json({ message: "Failed to delete SMTP configuration" });
    }
  });

  // =============================================
  // ASSIGNMENT SETTINGS ROUTES
  // =============================================

  // Get all assignment settings (Admin only)
  app.get("/api/assignment-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getAssignmentSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting assignment settings:", error);
      res.status(500).json({ message: "Failed to get assignment settings" });
    }
  });

  // Get assignment setting for a specific module (Admin only)
  app.get("/api/assignment-settings/:module", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { module } = req.params;
      const setting = await storage.getAssignmentSetting(module);
      if (!setting) {
        // Return default settings if none exist
        return res.json({
          module,
          assignmentMethod: "manual",
          isEnabled: false,
          assignableRoles: [],
        });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error getting assignment setting:", error);
      res.status(500).json({ message: "Failed to get assignment setting" });
    }
  });

  // Update assignment setting (Admin only)
  app.put("/api/assignment-settings/:module", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { module } = req.params;
      const userId = req.user?.id;
      
      // Validate module
      if (!["tickets", "tasks", "leads"].includes(module)) {
        return res.status(400).json({ message: "Invalid module. Must be 'tickets', 'tasks', or 'leads'" });
      }
      
      const { assignmentMethod, isEnabled, departmentId, assignableRoles } = req.body;
      
      const setting = await storage.upsertAssignmentSetting({
        module,
        assignmentMethod: assignmentMethod || "manual",
        isEnabled: isEnabled ?? true,
        departmentId: departmentId || null,
        assignableRoles: assignableRoles || [],
      });
      
      await storage.logActivity({
        entityType: "assignment_settings",
        entityId: module,
        action: "updated",
        description: `Updated assignment settings for ${module}: method=${assignmentMethod}, enabled=${isEnabled}`,
        userId,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating assignment setting:", error);
      res.status(500).json({ message: "Failed to update assignment setting" });
    }
  });

  // Initialize default assignment settings (Admin only)
  app.post("/api/assignment-settings/initialize", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const modules = ["tickets", "tasks", "leads"];
      const results = [];
      
      for (const module of modules) {
        const existing = await storage.getAssignmentSetting(module);
        if (!existing) {
          const setting = await storage.upsertAssignmentSetting({
            module,
            assignmentMethod: module === "tickets" ? "round_robin" : "manual",
            isEnabled: module === "tickets",
            assignableRoles: module === "tickets" ? ["support"] : [],
          });
          results.push(setting);
        } else {
          results.push(existing);
        }
      }
      
      await storage.logActivity({
        entityType: "assignment_settings",
        entityId: "all",
        action: "initialized",
        description: "Initialized default assignment settings",
        userId,
      });
      
      res.json(results);
    } catch (error) {
      console.error("Error initializing assignment settings:", error);
      res.status(500).json({ message: "Failed to initialize assignment settings" });
    }
  });

  // =============================================
  // POINT CATEGORIES MANAGEMENT ROUTES
  // =============================================

  // Get all point categories
  app.get("/api/point-categories", isAuthenticated, async (req: any, res) => {
    try {
      const categories = await storage.getPointCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error getting point categories:", error);
      res.status(500).json({ message: "Failed to get point categories" });
    }
  });

  // Get point categories by module type
  app.get("/api/point-categories/module/:moduleType", isAuthenticated, async (req: any, res) => {
    try {
      const { moduleType } = req.params;
      const categories = await storage.getPointCategoriesByModule(moduleType);
      res.json(categories);
    } catch (error) {
      console.error("Error getting point categories by module:", error);
      res.status(500).json({ message: "Failed to get point categories" });
    }
  });

  // Get single point category
  app.get("/api/point-categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const category = await storage.getPointCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Point category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error getting point category:", error);
      res.status(500).json({ message: "Failed to get point category" });
    }
  });

  // Create point category (Admin only)
  app.post("/api/point-categories", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { departmentId, ...restData } = req.body;
      
      // Derive name from department if departmentId is provided
      let name = restData.name || "Default Category";
      if (departmentId) {
        const department = await storage.getDepartment(departmentId);
        if (department) {
          name = department.name;
        }
      }
      
      const validatedData = insertPointCategorySchema.parse({
        ...restData,
        name,
        departmentId: departmentId || null,
      });
      const category = await storage.createPointCategory(validatedData);
      
      await storage.logActivity({
        entityType: "point_category",
        entityId: category.id,
        action: "created",
        description: `Created point category: ${category.name}`,
        userId,
      });
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating point category:", error);
      res.status(500).json({ message: "Failed to create point category" });
    }
  });

  // Update point category (Admin only)
  app.patch("/api/point-categories/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { departmentId, ...restData } = req.body;
      
      // Derive name from department if departmentId is provided
      let updateData: any = { ...restData };
      if (departmentId !== undefined) {
        updateData.departmentId = departmentId || null;
        if (departmentId) {
          const department = await storage.getDepartment(departmentId);
          if (department) {
            updateData.name = department.name;
          }
        }
      }
      
      const validatedData = insertPointCategorySchema.partial().parse(updateData);
      const category = await storage.updatePointCategory(id, validatedData);
      
      if (!category) {
        return res.status(404).json({ message: "Point category not found" });
      }
      
      await storage.logActivity({
        entityType: "point_category",
        entityId: category.id,
        action: "updated",
        description: `Updated point category: ${category.name}`,
        userId,
      });
      
      res.json(category);
    } catch (error) {
      console.error("Error updating point category:", error);
      res.status(500).json({ message: "Failed to update point category" });
    }
  });

  // Delete point category (Admin only)
  app.delete("/api/point-categories/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const category = await storage.getPointCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: "Point category not found" });
      }
      
      await storage.deletePointCategory(id);
      
      await storage.logActivity({
        entityType: "point_category",
        entityId: id,
        action: "deleted",
        description: `Deleted point category: ${category.name}`,
        userId,
      });
      
      res.json({ message: "Point category deleted successfully" });
    } catch (error) {
      console.error("Error deleting point category:", error);
      res.status(500).json({ message: "Failed to delete point category" });
    }
  });

  // =============================================
  // POINT CATEGORY DEPARTMENT SETTINGS ROUTES
  // =============================================

  // Get department settings for a category
  app.get("/api/point-categories/:categoryId/department-settings", isAuthenticated, async (req: any, res) => {
    try {
      const { categoryId } = req.params;
      const settings = await storage.getPointCategoryDepartmentSettings(categoryId);
      res.json(settings);
    } catch (error) {
      console.error("Error getting department settings:", error);
      res.status(500).json({ message: "Failed to get department settings" });
    }
  });

  // Create department setting (Admin only)
  app.post("/api/point-categories/:categoryId/department-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { categoryId } = req.params;
      const userId = req.user?.id;
      const validatedData = insertPointCategoryDepartmentSettingSchema.parse({
        ...req.body,
        pointCategoryId: categoryId,
      });
      const setting = await storage.createPointCategoryDepartmentSetting(validatedData);
      
      await storage.logActivity({
        entityType: "point_category_department_setting",
        entityId: setting.id,
        action: "created",
        description: `Created department setting for category: ${categoryId}`,
        userId,
      });
      
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating department setting:", error);
      res.status(500).json({ message: "Failed to create department setting" });
    }
  });

  // Update department setting (Admin only)
  app.patch("/api/point-category-department-settings/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const validatedData = insertPointCategoryDepartmentSettingSchema.partial().parse(req.body);
      const setting = await storage.updatePointCategoryDepartmentSetting(id, validatedData);
      
      if (!setting) {
        return res.status(404).json({ message: "Department setting not found" });
      }
      
      await storage.logActivity({
        entityType: "point_category_department_setting",
        entityId: id,
        action: "updated",
        description: `Updated department setting`,
        userId,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating department setting:", error);
      res.status(500).json({ message: "Failed to update department setting" });
    }
  });

  // Delete department setting (Admin only)
  app.delete("/api/point-category-department-settings/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      await storage.deletePointCategoryDepartmentSetting(id);
      
      await storage.logActivity({
        entityType: "point_category_department_setting",
        entityId: id,
        action: "deleted",
        description: `Deleted department setting`,
        userId,
      });
      
      res.json({ message: "Department setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting department setting:", error);
      res.status(500).json({ message: "Failed to delete department setting" });
    }
  });

  // =============================================
  // USER POINTS ROUTES
  // =============================================

  // Get all user point balances
  app.get("/api/user-point-balances", isAuthenticated, async (req: any, res) => {
    try {
      const balances = await storage.getUserPointBalances();
      res.json(balances);
    } catch (error) {
      console.error("Error getting user point balances:", error);
      res.status(500).json({ message: "Failed to get user point balances" });
    }
  });

  // Get user's point balance
  app.get("/api/user-point-balances/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const balance = await storage.getUserPointBalance(userId);
      if (!balance) {
        // Initialize if not exists
        const newBalance = await storage.initializeUserPointBalance(userId);
        return res.json(newBalance);
      }
      res.json(balance);
    } catch (error) {
      console.error("Error getting user point balance:", error);
      res.status(500).json({ message: "Failed to get user point balance" });
    }
  });

  // Get user's point ledger (history)
  app.get("/api/user-point-ledger/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const ledger = await storage.getUserPointLedger(userId);
      res.json(ledger);
    } catch (error) {
      console.error("Error getting user point ledger:", error);
      res.status(500).json({ message: "Failed to get user point ledger" });
    }
  });

  // Manual point adjustment (Admin only)
  app.post("/api/user-points/adjust", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, points, moduleType, reason } = req.body;
      const adminId = req.user?.id;

      if (!userId || points === undefined || !moduleType) {
        return res.status(400).json({ message: "userId, points, and moduleType are required" });
      }

      // Create ledger entry
      const ledgerEntry = await storage.createPointLedgerEntry({
        userId,
        moduleType,
        entityId: "manual_adjustment",
        action: "adjustment",
        points,
        reason: reason || "Manual adjustment by admin",
        createdBy: adminId,
      });

      // Update user balance
      const balance = await storage.updateUserPointBalance(userId, points, moduleType);

      await storage.logActivity({
        entityType: "user_points",
        entityId: userId,
        action: "adjusted",
        description: `Manual point adjustment: ${points > 0 ? '+' : ''}${points} points (${moduleType})`,
        userId: adminId,
      });

      res.json({ ledgerEntry, balance });
    } catch (error) {
      console.error("Error adjusting user points:", error);
      res.status(500).json({ message: "Failed to adjust user points" });
    }
  });

  // Award points on assignment (internal endpoint for module integrations)
  app.post("/api/user-points/award", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, moduleType, entityId, categoryId, reason } = req.body;
      const createdBy = req.user?.id;

      if (!userId || !moduleType || !entityId) {
        return res.status(400).json({ message: "userId, moduleType, and entityId are required" });
      }

      // Get category to determine points
      let basePoints = 1; // Default
      if (categoryId) {
        const category = await storage.getPointCategory(categoryId);
        if (category) {
          basePoints = category.basePoints;
        }
      }

      // Create ledger entry
      const ledgerEntry = await storage.createPointLedgerEntry({
        userId,
        moduleType,
        entityId,
        categoryId: categoryId || null,
        action: "assign",
        points: basePoints,
        reason: reason || `Assigned ${moduleType}`,
        createdBy,
      });

      // Update user balance
      const balance = await storage.updateUserPointBalance(userId, basePoints, moduleType);

      res.json({ ledgerEntry, balance, pointsAwarded: basePoints });
    } catch (error) {
      console.error("Error awarding points:", error);
      res.status(500).json({ message: "Failed to award points" });
    }
  });

  // Deduct points on reassignment (internal endpoint for module integrations)
  app.post("/api/user-points/deduct-reassign", isAuthenticated, async (req: any, res) => {
    try {
      const { fromUserId, toUserId, moduleType, entityId, categoryId, reason } = req.body;
      const createdBy = req.user?.id;

      if (!fromUserId || !toUserId || !moduleType || !entityId) {
        return res.status(400).json({ message: "fromUserId, toUserId, moduleType, and entityId are required" });
      }

      // Get category to determine points
      let basePoints = 1;
      let reassignPenalty = 1;
      if (categoryId) {
        const category = await storage.getPointCategory(categoryId);
        if (category) {
          basePoints = category.basePoints;
          reassignPenalty = category.reassignPenalty;
        }
      }

      const penaltyPoints = basePoints + reassignPenalty;

      // Deduct from original assignee
      const deductLedger = await storage.createPointLedgerEntry({
        userId: fromUserId,
        moduleType,
        entityId,
        categoryId: categoryId || null,
        action: "reassign_from",
        points: -penaltyPoints,
        reason: reason || `Reassigned ${moduleType} to another user`,
        createdBy,
      });

      await storage.updateUserPointBalance(fromUserId, -penaltyPoints, moduleType);

      // Award to new assignee
      const awardLedger = await storage.createPointLedgerEntry({
        userId: toUserId,
        moduleType,
        entityId,
        categoryId: categoryId || null,
        action: "reassign_to",
        points: basePoints,
        reason: reason || `Received reassigned ${moduleType}`,
        createdBy,
      });

      const newBalance = await storage.updateUserPointBalance(toUserId, basePoints, moduleType);

      res.json({ 
        deductLedger, 
        awardLedger, 
        newBalance,
        penaltyDeducted: penaltyPoints,
        pointsAwarded: basePoints
      });
    } catch (error) {
      console.error("Error processing reassignment points:", error);
      res.status(500).json({ message: "Failed to process reassignment points" });
    }
  });

  // ========== Database Control - Truncate Tables ==========
  
  // Truncate Transaction Tables
  app.post("/api/admin/truncate-transactions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const transactionTables = [
        'point_transactions',
        'point_ledger',
        'activities',
        'quotes',
        'follow_ups',
        'tasks',
        'ticket_messages',
        'tickets',
        'training_records',
        'training_sessions',
        'project_progress',
        'project_handoffs',
        'project_engineers',
        'project_modules',
        'projects',
        'leads',
      ];

      // Execute truncate with CASCADE for each table in order
      for (const table of transactionTables) {
        try {
          await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
          console.log(`Truncated table: ${table}`);
        } catch (tableError: any) {
          console.warn(`Could not truncate ${table}: ${tableError.message}`);
        }
      }

      // Log the action
      await storage.logActivity({
        userId: req.user.id,
        entityType: "system",
        entityId: "database",
        action: "truncate_transactions",
        description: "Truncated all transaction tables",
        metadata: { tables: transactionTables },
      });

      res.json({ message: "Transaction tables truncated successfully", tables: transactionTables });
    } catch (error) {
      console.error("Error truncating transaction tables:", error);
      res.status(500).json({ message: "Failed to truncate transaction tables" });
    }
  });

  // Truncate Master Tables (will cascade delete related transaction data)
  app.post("/api/admin/truncate-masters", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const masterTables = [
        'point_transactions',
        'point_ledger',
        'point_categories',
        'knowledge_base_documents',
        'user_role_rights',
        'user_roles',
        'activities',
        'quotes',
        'follow_ups',
        'tasks',
        'ticket_messages',
        'tickets',
        'training_records',
        'training_sessions',
        'project_progress',
        'project_handoffs',
        'project_engineers',
        'project_modules',
        'projects',
        'leads',
        'customers',
        'modules',
        'departments',
      ];

      // Execute truncate with CASCADE for each table in order
      for (const table of masterTables) {
        try {
          await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
          console.log(`Truncated table: ${table}`);
        } catch (tableError: any) {
          console.warn(`Could not truncate ${table}: ${tableError.message}`);
        }
      }

      // Log the action (create a new activity since we just truncated activities)
      try {
        await storage.logActivity({
          userId: req.user.id,
          entityType: "system",
          entityId: "database",
          action: "truncate_masters",
          description: "Truncated all master and transaction tables",
          metadata: { tables: masterTables },
        });
      } catch (logError) {
        console.warn("Could not log activity (table may have been truncated)");
      }

      res.json({ message: "Master tables truncated successfully", tables: masterTables });
    } catch (error) {
      console.error("Error truncating master tables:", error);
      res.status(500).json({ message: "Failed to truncate master tables" });
    }
  });

  // ============ SUPER ADMIN DASHBOARD ENDPOINTS ============

  // Helper function to get date ranges
  const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Week (Monday to Sunday)
    const weekStart = new Date(today);
    const dayOfWeek = today.getDay();
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    
    return { today, tomorrow, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd, now };
  };

  // Super Admin Dashboard Overview - Combined stats for all modules
  app.get("/api/admin/dashboard/overview", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { today, tomorrow, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd, now } = getDateRanges();
      
      // Get all data
      const [allLeads, allProjects, allTickets, allFollowUps, allUsers] = await Promise.all([
        storage.getLeads({}),
        storage.getProjects({}),
        storage.getTickets({}),
        storage.getAllFollowUps(),
        storage.getUsers(),
      ]);
      
      // Helper function to filter by date
      const filterByPeriod = (items: any[], dateField: string, period: 'today' | 'week' | 'month' | 'year') => {
        return items.filter(item => {
          const date = item[dateField] ? new Date(item[dateField]) : null;
          if (!date) return false;
          switch (period) {
            case 'today': return date >= today && date < tomorrow;
            case 'week': return date >= weekStart && date <= weekEnd;
            case 'month': return date >= monthStart && date <= monthEnd;
            case 'year': return date >= yearStart && date <= yearEnd;
          }
        });
      };
      
      // Sales Stats
      const salesStats = {
        today: {
          newLeads: filterByPeriod(allLeads, 'createdAt', 'today').length,
          followups: filterByPeriod(allFollowUps, 'followUpDate', 'today').length,
          dealsWon: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'today').length,
          dealsWonValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'today')
            .reduce((sum, l) => sum + (l.confirmedOrderValue || 0), 0),
          dealsLost: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'today').length,
          dealsLostValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'today')
            .reduce((sum, l) => sum + (l.lostAmount || l.estimatedValue || 0), 0),
        },
        week: {
          newLeads: filterByPeriod(allLeads, 'createdAt', 'week').length,
          followups: filterByPeriod(allFollowUps, 'followUpDate', 'week').length,
          dealsWon: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'week').length,
          dealsWonValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'week')
            .reduce((sum, l) => sum + (l.confirmedOrderValue || 0), 0),
          dealsLost: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'week').length,
          dealsLostValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'week')
            .reduce((sum, l) => sum + (l.lostAmount || l.estimatedValue || 0), 0),
        },
        month: {
          newLeads: filterByPeriod(allLeads, 'createdAt', 'month').length,
          followups: filterByPeriod(allFollowUps, 'followUpDate', 'month').length,
          dealsWon: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'month').length,
          dealsWonValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'month')
            .reduce((sum, l) => sum + (l.confirmedOrderValue || 0), 0),
          dealsLost: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'month').length,
          dealsLostValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'month')
            .reduce((sum, l) => sum + (l.lostAmount || l.estimatedValue || 0), 0),
        },
        year: {
          newLeads: filterByPeriod(allLeads, 'createdAt', 'year').length,
          followups: filterByPeriod(allFollowUps, 'followUpDate', 'year').length,
          dealsWon: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'year').length,
          dealsWonValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_won'), 'closedDate', 'year')
            .reduce((sum, l) => sum + (l.confirmedOrderValue || 0), 0),
          dealsLost: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'year').length,
          dealsLostValue: filterByPeriod(allLeads.filter(l => l.stage === 'closed_lost'), 'closedDate', 'year')
            .reduce((sum, l) => sum + (l.lostAmount || l.estimatedValue || 0), 0),
        },
        total: {
          leads: allLeads.length,
          activeLeads: allLeads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage)).length,
          negotiation: allLeads.filter(l => l.stage === 'negotiation').length,
        }
      };
      
      // Implementation Stats
      const overdueProjects = allProjects.filter(p => {
        if (p.status === 'completed') return false;
        const dueDate = p.targetGoLiveDate || p.plannedEndDate;
        return dueDate && new Date(dueDate) < now;
      });
      
      const implementationStats = {
        today: {
          started: filterByPeriod(allProjects, 'createdAt', 'today').length,
          completed: filterByPeriod(allProjects.filter(p => p.status === 'completed'), 'updatedAt', 'today').length,
        },
        week: {
          started: filterByPeriod(allProjects, 'createdAt', 'week').length,
          completed: filterByPeriod(allProjects.filter(p => p.status === 'completed'), 'updatedAt', 'week').length,
        },
        month: {
          started: filterByPeriod(allProjects, 'createdAt', 'month').length,
          completed: filterByPeriod(allProjects.filter(p => p.status === 'completed'), 'updatedAt', 'month').length,
        },
        year: {
          started: filterByPeriod(allProjects, 'createdAt', 'year').length,
          completed: filterByPeriod(allProjects.filter(p => p.status === 'completed'), 'updatedAt', 'year').length,
        },
        total: {
          projects: allProjects.length,
          inProgress: allProjects.filter(p => p.status === 'in_progress').length,
          training: allProjects.filter(p => p.status === 'training').length,
          completed: allProjects.filter(p => p.status === 'completed').length,
          overdue: overdueProjects.length,
        }
      };
      
      // Support Stats
      const resolvedStatuses = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
      const overdueTickets = allTickets.filter(t => {
        if (resolvedStatuses.includes(t.status)) return false;
        return t.dueDate && new Date(t.dueDate) < now;
      });
      
      const resolvedTickets = allTickets.filter(t => resolvedStatuses.includes(t.status));
      const supportStats = {
        today: {
          opened: filterByPeriod(allTickets, 'createdAt', 'today').length,
          closed: filterByPeriod(resolvedTickets, 'closedAt', 'today').length + filterByPeriod(resolvedTickets.filter(t => !t.closedAt), 'updatedAt', 'today').length,
        },
        week: {
          opened: filterByPeriod(allTickets, 'createdAt', 'week').length,
          closed: filterByPeriod(resolvedTickets, 'closedAt', 'week').length + filterByPeriod(resolvedTickets.filter(t => !t.closedAt), 'updatedAt', 'week').length,
        },
        month: {
          opened: filterByPeriod(allTickets, 'createdAt', 'month').length,
          closed: filterByPeriod(resolvedTickets, 'closedAt', 'month').length + filterByPeriod(resolvedTickets.filter(t => !t.closedAt), 'updatedAt', 'month').length,
        },
        year: {
          opened: filterByPeriod(allTickets, 'createdAt', 'year').length,
          closed: filterByPeriod(resolvedTickets, 'closedAt', 'year').length + filterByPeriod(resolvedTickets.filter(t => !t.closedAt), 'updatedAt', 'year').length,
        },
        total: {
          tickets: allTickets.length,
          open: allTickets.filter(t => t.status === 'open').length,
          inProgress: allTickets.filter(t => t.status === 'in_progress').length,
          escalated: allTickets.filter(t => t.status === 'escalated').length,
          critical: allTickets.filter(t => t.priority === 'critical' && !resolvedStatuses.includes(t.status)).length,
          overdue: overdueTickets.length,
        }
      };
      
      res.json({
        sales: salesStats,
        implementation: implementationStats,
        support: supportStats,
      });
    } catch (error) {
      console.error("Error fetching admin dashboard overview:", error);
      res.status(500).json({ message: "Failed to fetch admin dashboard overview" });
    }
  });

  // Admin Dashboard - Sales Drill-down with bucketing
  app.get("/api/admin/dashboard/sales", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const bucket = req.query.bucket as string || 'month'; // year, month, week, day
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const week = req.query.week ? parseInt(req.query.week as string) : null;
      const day = req.query.day ? parseInt(req.query.day as string) : null;
      
      const [allLeads, allFollowUps, allUsers] = await Promise.all([
        storage.getLeads({}),
        storage.getAllFollowUps(),
        storage.getUsers(),
      ]);
      
      // Build buckets based on drill-down level
      let buckets: any[] = [];
      let items: any[] = [];
      
      if (bucket === 'year') {
        // Return monthly buckets for the year
        for (let m = 0; m < 12; m++) {
          const start = new Date(year, m, 1);
          const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
          
          const monthLeads = allLeads.filter(l => {
            const date = l.createdAt ? new Date(l.createdAt) : null;
            return date && date >= start && date <= end;
          });
          
          const wonLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_won') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= start && date <= end;
          });
          
          const lostLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_lost') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= start && date <= end;
          });
          
          buckets.push({
            period: `${year}-${String(m + 1).padStart(2, '0')}`,
            label: new Date(year, m).toLocaleDateString('en-US', { month: 'short' }),
            newLeads: monthLeads.length,
            newLeadsValue: monthLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0),
            dealsWon: wonLeads.length,
            dealsWonValue: wonLeads.reduce((s, l) => s + (l.confirmedOrderValue || 0), 0),
            dealsLost: lostLeads.length,
            dealsLostValue: lostLeads.reduce((s, l) => s + (l.lostAmount || l.estimatedValue || 0), 0),
          });
        }
      } else if (bucket === 'month' && month !== null) {
        // Return weekly buckets for the month
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        let weekNum = 1;
        let weekStart = new Date(monthStart);
        
        while (weekStart <= monthEnd) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
          weekEnd.setHours(23, 59, 59, 999);
          
          const ws = new Date(weekStart);
          const we = new Date(weekEnd);
          
          const weekLeads = allLeads.filter(l => {
            const date = l.createdAt ? new Date(l.createdAt) : null;
            return date && date >= ws && date <= we;
          });
          
          const wonLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_won') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= ws && date <= we;
          });
          
          const lostLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_lost') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= ws && date <= we;
          });
          
          buckets.push({
            period: `W${weekNum}`,
            label: `Week ${weekNum}`,
            weekNumber: weekNum,
            startDate: ws.toISOString().split('T')[0],
            endDate: we.toISOString().split('T')[0],
            newLeads: weekLeads.length,
            newLeadsValue: weekLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0),
            dealsWon: wonLeads.length,
            dealsWonValue: wonLeads.reduce((s, l) => s + (l.confirmedOrderValue || 0), 0),
            dealsLost: lostLeads.length,
            dealsLostValue: lostLeads.reduce((s, l) => s + (l.lostAmount || l.estimatedValue || 0), 0),
          });
          
          weekStart.setDate(weekStart.getDate() + 7);
          weekNum++;
        }
      } else if (bucket === 'week' && month !== null && week !== null) {
        // Return daily buckets for the week
        const monthStart = new Date(year, month - 1, 1);
        let weekStart = new Date(monthStart);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
        
        for (let d = 0; d < 7; d++) {
          const dayStart = new Date(weekStart);
          dayStart.setDate(weekStart.getDate() + d);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const ds = new Date(dayStart);
          const de = new Date(dayEnd);
          
          const dayLeads = allLeads.filter(l => {
            const date = l.createdAt ? new Date(l.createdAt) : null;
            return date && date >= ds && date <= de;
          });
          
          const wonLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_won') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= ds && date <= de;
          });
          
          const lostLeads = allLeads.filter(l => {
            if (l.stage !== 'closed_lost') return false;
            const date = l.closedDate ? new Date(l.closedDate) : null;
            return date && date >= ds && date <= de;
          });
          
          buckets.push({
            period: dayStart.toISOString().split('T')[0],
            label: dayStart.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
            newLeads: dayLeads.length,
            newLeadsValue: dayLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0),
            dealsWon: wonLeads.length,
            dealsWonValue: wonLeads.reduce((s, l) => s + (l.confirmedOrderValue || 0), 0),
            dealsLost: lostLeads.length,
            dealsLostValue: lostLeads.reduce((s, l) => s + (l.lostAmount || l.estimatedValue || 0), 0),
          });
        }
      } else if (bucket === 'day' && month !== null && day !== null) {
        // Return individual leads for the day
        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        items = allLeads.filter(l => {
          const date = l.createdAt ? new Date(l.createdAt) : null;
          return date && date >= dayStart && date <= dayEnd;
        }).map(l => {
          const salesExec = allUsers.find(u => u.id === l.salesExecutiveId);
          return {
            ...l,
            salesExecutiveName: salesExec ? `${salesExec.firstName || ''} ${salesExec.lastName || ''}`.trim() : null,
          };
        });
      }
      
      // Get loss data
      const lostLeads = allLeads.filter(l => l.stage === 'closed_lost').map(l => {
        const salesExec = allUsers.find(u => u.id === l.salesExecutiveId);
        return {
          ...l,
          salesExecutiveName: salesExec ? `${salesExec.firstName || ''} ${salesExec.lastName || ''}`.trim() : null,
        };
      });
      
      res.json({
        buckets,
        items,
        lostLeads: lostLeads.slice(0, 50), // Recent 50 lost leads
        summary: {
          totalLeads: allLeads.length,
          totalWon: allLeads.filter(l => l.stage === 'closed_won').length,
          totalLost: allLeads.filter(l => l.stage === 'closed_lost').length,
          totalLostValue: allLeads.filter(l => l.stage === 'closed_lost')
            .reduce((s, l) => s + (l.lostAmount || l.estimatedValue || 0), 0),
        },
      });
    } catch (error) {
      console.error("Error fetching admin sales dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin sales dashboard" });
    }
  });

  // Admin Dashboard - Sales Stage-wise Weekly/Monthly Comparison Analytics
  // Accessible by admins, super admin, and department heads
  app.get("/api/admin/dashboard/sales-stage-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const email = user?.claims?.email;
      const userId = user?.claims?.sub;
      const legacyRole = user?.claims?.metadata?.role;
      
      const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
      const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
      const isAdminRole = legacyRole === 'admin';
      
      // Check if user is department head
      let isDeptHead = false;
      if (userId) {
        const departments = await storage.getDepartmentsByHead(userId);
        isDeptHead = departments.length > 0;
      }
      
      // Allow access if super admin, admin role, or department head
      if (!isSuperAdmin && !isAdminRole && !isDeptHead) {
        return res.status(403).json({ message: "Access denied. Admin or department head privileges required." });
      }
      
      // User-specific cache key to prevent data leakage between different access levels
      const cacheKey = `sales-stage-analytics-${userId}`;
      const cachedData = getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log(`[Analytics] Serving cached sales stage analytics for user ${userId}`);
        return res.json(cachedData);
      }
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Calculate date range for queries (cover both weekly and monthly periods)
      // Weeks: 5 weeks back from current week start
      // Months: 7 months back from current month start
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - dayOfWeek);
      const earliestWeekStart = new Date(currentWeekStart);
      earliestWeekStart.setDate(currentWeekStart.getDate() - (4 * 7));
      
      // Earliest month start (7 months ago)
      const earliestMonthStart = new Date(currentYear, currentMonth - 6, 1);
      
      // Use the earlier of the two dates as the query start
      const queryStart = earliestMonthStart < earliestWeekStart ? earliestMonthStart : earliestWeekStart;
      const queryEnd = new Date(now);
      queryEnd.setHours(23, 59, 59, 999);
      
      // Fetch data using date-range query for efficiency
      const [allLeads, stageHistory] = await Promise.all([
        storage.getLeads({}),
        storage.getLeadStageHistoryByDateRange(queryStart, queryEnd),
      ]);
      
      // Build a map of leadId -> lead for quick lookup
      const leadMap = new Map(allLeads.map(l => [l.id, l]));
      
      const STAGES = [
        { id: "seed", label: "Seeds" },
        { id: "lead", label: "Leads" },
        { id: "demo_scheduled", label: "Demo Scheduled" },
        { id: "quote_sent", label: "Quote Sent" },
        { id: "negotiation", label: "Negotiation" },
        { id: "closed_won", label: "Closed Won" },
        { id: "closed_lost", label: "Closed Lost" },
      ];
      
      // Calculate week boundaries
      const getWeekBoundaries = (weeksAgo: number) => {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek - (weeksAgo * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      };
      
      // Calculate month boundaries
      const getMonthBoundaries = (monthsAgo: number) => {
        const targetMonth = currentMonth - monthsAgo;
        const targetYear = currentYear + Math.floor(targetMonth / 12);
        const adjustedMonth = ((targetMonth % 12) + 12) % 12;
        const start = new Date(targetYear, adjustedMonth, 1);
        const end = new Date(targetYear, adjustedMonth + 1, 0, 23, 59, 59, 999);
        return { start, end };
      };
      
      // Get stage entries that occurred during a time period
      // Relies primarily on leadStageHistory which now tracks all lead creations and stage transitions
      // Also checks stage-specific timestamps as fallback for legacy data
      const getStageEntriesInPeriod = (stage: string, start: Date, end: Date) => {
        const leadIds = new Set<string>();
        
        // 1. Primary source: Find entries TO this stage from history
        stageHistory.forEach(h => {
          if (h.toStage !== stage) return;
          const transitionDate = h.createdAt ? new Date(h.createdAt) : null;
          if (!transitionDate) return;
          if (transitionDate >= start && transitionDate <= end) {
            leadIds.add(h.leadId);
          }
        });
        
        // 2. Fallback for legacy data: Use stage-specific timestamps
        allLeads.forEach(lead => {
          if (leadIds.has(lead.id)) return;
          
          // Check if this lead has history entries at all
          const hasHistory = stageHistory.some(h => h.leadId === lead.id);
          if (hasHistory) return; // Already covered by history
          
          let stageDate: Date | null = null;
          
          switch (stage) {
            case 'demo_scheduled':
              stageDate = lead.demoDate ? new Date(lead.demoDate) : null;
              break;
            case 'quote_sent':
              stageDate = lead.quoteSentDate ? new Date(lead.quoteSentDate) : null;
              break;
            case 'negotiation':
              stageDate = lead.negotiationDate ? new Date(lead.negotiationDate) : null;
              break;
            case 'closed_won':
            case 'closed_lost':
              if (lead.stage === stage) {
                stageDate = lead.closedDate ? new Date(lead.closedDate) : null;
              }
              break;
            case 'seed':
            case 'lead':
              // For early stages without history, use createdAt
              if (lead.stage === stage) {
                stageDate = lead.createdAt ? new Date(lead.createdAt) : null;
              }
              break;
          }
          
          if (stageDate && stageDate >= start && stageDate <= end) {
            leadIds.add(lead.id);
          }
        });
        
        return Array.from(leadIds).map(id => leadMap.get(id)).filter(Boolean);
      };
      
      // Get value for a set of leads
      const getLeadsValue = (leads: any[]) => {
        return leads.reduce((sum, lead) => {
          return sum + (lead?.confirmedOrderValue || lead?.estimatedValue || 0);
        }, 0);
      };
      
      // Weekly comparison data (current week vs last 4 weeks)
      const weeklyData = [];
      for (let i = 0; i < 5; i++) {
        const { start, end } = getWeekBoundaries(i);
        const weekLabel = i === 0 ? 'Current Week' : 
                          i === 1 ? 'Last Week' : 
                          `${i} Weeks Ago`;
        
        const stageData: Record<string, { count: number; value: number }> = {};
        STAGES.forEach(stage => {
          const leads = getStageEntriesInPeriod(stage.id, start, end);
          stageData[stage.id] = {
            count: leads.length,
            value: getLeadsValue(leads),
          };
        });
        
        weeklyData.push({
          period: weekLabel,
          weekNumber: i,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          stages: stageData,
          totalLeads: Object.values(stageData).reduce((s, d) => s + d.count, 0),
          totalValue: Object.values(stageData).reduce((s, d) => s + d.value, 0),
        });
      }
      
      // Monthly comparison data (current month vs last 6 months)
      const monthlyData = [];
      for (let i = 0; i < 7; i++) {
        const { start, end } = getMonthBoundaries(i);
        const monthLabel = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        const stageData: Record<string, { count: number; value: number }> = {};
        STAGES.forEach(stage => {
          const leads = getStageEntriesInPeriod(stage.id, start, end);
          stageData[stage.id] = {
            count: leads.length,
            value: getLeadsValue(leads),
          };
        });
        
        monthlyData.push({
          period: monthLabel,
          monthIndex: i,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          stages: stageData,
          totalLeads: Object.values(stageData).reduce((s, d) => s + d.count, 0),
          totalValue: Object.values(stageData).reduce((s, d) => s + d.value, 0),
        });
      }
      
      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };
      
      // Reverse arrays first (oldest first for charts), then calculate changes
      // Current week is now at the END of the array after reverse
      const weeklyDataReversed = weeklyData.reverse();
      const monthlyDataReversed = monthlyData.reverse();
      
      // Weekly changes (current week vs previous week)
      // After reverse: index 0 = oldest, last index = current week
      const weeklyChanges: Record<string, { countChange: number; valueChange: number }> = {};
      if (weeklyDataReversed.length >= 2) {
        const currentIdx = weeklyDataReversed.length - 1;
        const previousIdx = weeklyDataReversed.length - 2;
        STAGES.forEach(stage => {
          const current = weeklyDataReversed[currentIdx].stages[stage.id];
          const previous = weeklyDataReversed[previousIdx].stages[stage.id];
          weeklyChanges[stage.id] = {
            countChange: calculateChange(current.count, previous.count),
            valueChange: calculateChange(current.value, previous.value),
          };
        });
      }
      
      // Monthly changes (current month vs previous month)
      const monthlyChanges: Record<string, { countChange: number; valueChange: number }> = {};
      if (monthlyDataReversed.length >= 2) {
        const currentIdx = monthlyDataReversed.length - 1;
        const previousIdx = monthlyDataReversed.length - 2;
        STAGES.forEach(stage => {
          const current = monthlyDataReversed[currentIdx].stages[stage.id];
          const previous = monthlyDataReversed[previousIdx].stages[stage.id];
          monthlyChanges[stage.id] = {
            countChange: calculateChange(current.count, previous.count),
            valueChange: calculateChange(current.value, previous.value),
          };
        });
      }
      
      // Current stage distribution (based on current lead.stage)
      const currentStageDistribution = STAGES.map(stage => {
        const leads = allLeads.filter(l => l.stage === stage.id);
        return {
          stage: stage.id,
          label: stage.label,
          count: leads.length,
          value: getLeadsValue(leads),
          percentage: allLeads.length > 0 ? Math.round((leads.length / allLeads.length) * 100) : 0,
        };
      });
      
      const responseData = {
        stages: STAGES,
        weekly: {
          data: weeklyDataReversed,
          changes: weeklyChanges,
        },
        monthly: {
          data: monthlyDataReversed,
          changes: monthlyChanges,
        },
        currentDistribution: currentStageDistribution,
        summary: {
          totalLeads: allLeads.length,
          totalValue: getLeadsValue(allLeads),
          conversionRate: allLeads.length > 0 
            ? Math.round((allLeads.filter(l => l.stage === 'closed_won').length / allLeads.length) * 100) 
            : 0,
        },
      };
      
      // Cache the result for 2 minutes
      setCachedData(cacheKey, responseData);
      console.log(`[Analytics] Computed and cached sales stage analytics`);
      
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching sales stage analytics:", error);
      res.status(500).json({ message: "Failed to fetch sales stage analytics" });
    }
  });

  // Admin Dashboard - Implementation Drill-down
  app.get("/api/admin/dashboard/implementation", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const bucket = req.query.bucket as string || 'month';
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const week = req.query.week ? parseInt(req.query.week as string) : null;
      
      const now = new Date();
      const [allProjects, allUsers] = await Promise.all([
        storage.getProjects({}),
        storage.getUsers(),
      ]);
      
      // Get project details
      const projectsWithDetails = await Promise.all(
        allProjects.map(async (project) => {
          const modules = await storage.getProjectModules(project.id);
          const engineers = await storage.getProjectEngineers(project.id);
          const engineerNames = engineers.map(e => {
            const user = allUsers.find(u => u.id === e.engineerId);
            return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
          }).filter(Boolean);
          
          const dueDate = project.targetGoLiveDate || project.plannedEndDate;
          const isOverdue = dueDate && new Date(dueDate) < now && project.status !== 'completed';
          
          return {
            ...project,
            modulesCompleted: modules.filter(m => m.completed === true).length,
            totalModules: modules.length,
            engineers: engineerNames,
            isOverdue,
            daysOverdue: isOverdue && dueDate ? Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          };
        })
      );
      
      let buckets: any[] = [];
      let items: any[] = [];
      
      if (bucket === 'year') {
        for (let m = 0; m < 12; m++) {
          const start = new Date(year, m, 1);
          const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
          
          const monthProjects = projectsWithDetails.filter(p => {
            const date = p.createdAt ? new Date(p.createdAt) : null;
            return date && date >= start && date <= end;
          });
          
          const completedProjects = projectsWithDetails.filter(p => {
            if (p.status !== 'completed') return false;
            const date = p.updatedAt ? new Date(p.updatedAt) : null;
            return date && date >= start && date <= end;
          });
          
          buckets.push({
            period: `${year}-${String(m + 1).padStart(2, '0')}`,
            label: new Date(year, m).toLocaleDateString('en-US', { month: 'short' }),
            started: monthProjects.length,
            completed: completedProjects.length,
            overdue: monthProjects.filter(p => p.isOverdue).length,
          });
        }
      } else if (bucket === 'month' && month !== null) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        let weekNum = 1;
        let weekStart = new Date(monthStart);
        
        while (weekStart <= monthEnd) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
          weekEnd.setHours(23, 59, 59, 999);
          
          const ws = new Date(weekStart);
          const we = new Date(weekEnd);
          
          const weekProjects = projectsWithDetails.filter(p => {
            const date = p.createdAt ? new Date(p.createdAt) : null;
            return date && date >= ws && date <= we;
          });
          
          buckets.push({
            period: `W${weekNum}`,
            label: `Week ${weekNum}`,
            weekNumber: weekNum,
            started: weekProjects.length,
            completed: weekProjects.filter(p => p.status === 'completed').length,
            overdue: weekProjects.filter(p => p.isOverdue).length,
          });
          
          weekStart.setDate(weekStart.getDate() + 7);
          weekNum++;
        }
        
        // Include all projects for the month as items
        items = projectsWithDetails.filter(p => {
          const date = p.createdAt ? new Date(p.createdAt) : null;
          return date && date.getFullYear() === year && date.getMonth() === month - 1;
        });
      }
      
      // Get overdue projects
      const overdueProjects = projectsWithDetails.filter(p => p.isOverdue);
      
      res.json({
        buckets,
        items,
        overdueProjects,
        summary: {
          total: allProjects.length,
          notStarted: allProjects.filter(p => p.status === 'not_started').length,
          inProgress: allProjects.filter(p => p.status === 'in_progress').length,
          training: allProjects.filter(p => p.status === 'training').length,
          completed: allProjects.filter(p => p.status === 'completed').length,
          overdue: overdueProjects.length,
        },
      });
    } catch (error) {
      console.error("Error fetching admin implementation dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin implementation dashboard" });
    }
  });

  // Admin Dashboard - Support Drill-down
  app.get("/api/admin/dashboard/support", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const bucket = req.query.bucket as string || 'month';
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const week = req.query.week ? parseInt(req.query.week as string) : null;
      
      const now = new Date();
      const [allTickets, allUsers] = await Promise.all([
        storage.getTickets({}),
        storage.getUsers(),
      ]);
      
      // Enrich tickets with user info and overdue status
      const ticketsWithDetails = allTickets.map(t => {
        const assignee = allUsers.find(u => u.id === t.assignedEngineerId);
        const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'closed';
        return {
          ...t,
          assigneeName: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null,
          isOverdue,
          daysOverdue: isOverdue && t.dueDate ? Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        };
      });
      
      let buckets: any[] = [];
      let items: any[] = [];
      
      if (bucket === 'year') {
        for (let m = 0; m < 12; m++) {
          const start = new Date(year, m, 1);
          const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
          
          const monthTickets = ticketsWithDetails.filter(t => {
            const date = t.createdAt ? new Date(t.createdAt) : null;
            return date && date >= start && date <= end;
          });
          
          const closedTickets = ticketsWithDetails.filter(t => {
            if (t.status !== 'closed') return false;
            const date = t.closedAt ? new Date(t.closedAt) : null;
            return date && date >= start && date <= end;
          });
          
          buckets.push({
            period: `${year}-${String(m + 1).padStart(2, '0')}`,
            label: new Date(year, m).toLocaleDateString('en-US', { month: 'short' }),
            opened: monthTickets.length,
            closed: closedTickets.length,
            critical: monthTickets.filter(t => t.priority === 'critical').length,
            overdue: monthTickets.filter(t => t.isOverdue).length,
          });
        }
      } else if (bucket === 'month' && month !== null) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        let weekNum = 1;
        let weekStart = new Date(monthStart);
        
        while (weekStart <= monthEnd) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
          weekEnd.setHours(23, 59, 59, 999);
          
          const ws = new Date(weekStart);
          const we = new Date(weekEnd);
          
          const weekTickets = ticketsWithDetails.filter(t => {
            const date = t.createdAt ? new Date(t.createdAt) : null;
            return date && date >= ws && date <= we;
          });
          
          const resolvedStatuses = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
          buckets.push({
            period: `W${weekNum}`,
            label: `Week ${weekNum}`,
            weekNumber: weekNum,
            opened: weekTickets.length,
            closed: weekTickets.filter(t => resolvedStatuses.includes(t.status)).length,
            critical: weekTickets.filter(t => t.priority === 'critical').length,
            overdue: weekTickets.filter(t => t.isOverdue).length,
          });
          
          weekStart.setDate(weekStart.getDate() + 7);
          weekNum++;
        }
        
        // Include all tickets for the month as items
        items = ticketsWithDetails.filter(t => {
          const date = t.createdAt ? new Date(t.createdAt) : null;
          return date && date.getFullYear() === year && date.getMonth() === month - 1;
        });
      } else if (bucket === 'day' && month !== null) {
        const day = req.query.day ? parseInt(req.query.day as string) : new Date().getDate();
        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        items = ticketsWithDetails.filter(t => {
          const date = t.createdAt ? new Date(t.createdAt) : null;
          return date && date >= dayStart && date <= dayEnd;
        });
      }
      
      // Get overdue tickets
      const overdueTickets = ticketsWithDetails.filter(t => t.isOverdue);
      
      res.json({
        buckets,
        items,
        overdueTickets,
        summary: {
          total: allTickets.length,
          open: allTickets.filter(t => t.status === 'open').length,
          inProgress: allTickets.filter(t => t.status === 'in_progress').length,
          escalated: allTickets.filter(t => t.status === 'escalated').length,
          closed: allTickets.filter(t => ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'].includes(t.status)).length,
          critical: allTickets.filter(t => t.priority === 'critical' && !['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'].includes(t.status)).length,
          overdue: overdueTickets.length,
        },
      });
    } catch (error) {
      console.error("Error fetching admin support dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin support dashboard" });
    }
  });

  // Admin Dashboard - Employee Performance across departments
  app.get("/api/admin/dashboard/performance", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const period = req.query.period as string || 'month'; // today, week, month, year
      const { today, tomorrow, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd } = getDateRanges();
      
      let startDate: Date, endDate: Date;
      switch (period) {
        case 'today':
          startDate = today;
          endDate = tomorrow;
          break;
        case 'week':
          startDate = weekStart;
          endDate = weekEnd;
          break;
        case 'year':
          startDate = yearStart;
          endDate = yearEnd;
          break;
        default:
          startDate = monthStart;
          endDate = monthEnd;
      }
      
      const [allUsers, allLeads, allProjects, allTickets, allFollowUps, departments] = await Promise.all([
        storage.getUsers(),
        storage.getLeads({}),
        storage.getProjects({}),
        storage.getTickets({}),
        storage.getAllFollowUps(),
        storage.getDepartments(),
      ]);
      
      // Get project engineers for each project
      const projectEngineersMap = new Map<string, string[]>();
      await Promise.all(
        allProjects.map(async (p) => {
          const engineers = await storage.getProjectEngineers(p.id);
          projectEngineersMap.set(p.id, engineers.map(e => e.engineerId));
        })
      );
      
      // Calculate performance metrics for each user
      const performance = allUsers.map(user => {
        const dept = departments.find(d => d.id === user.departmentId);
        
        // Sales metrics
        const userLeads = allLeads.filter(l => l.salesExecutiveId === user.id);
        const periodLeads = userLeads.filter(l => {
          const date = l.createdAt ? new Date(l.createdAt) : null;
          return date && date >= startDate && date < endDate;
        });
        const periodDealsWon = userLeads.filter(l => {
          if (l.stage !== 'closed_won') return false;
          const date = l.closedDate ? new Date(l.closedDate) : null;
          return date && date >= startDate && date < endDate;
        });
        const periodDealsLost = userLeads.filter(l => {
          if (l.stage !== 'closed_lost') return false;
          const date = l.closedDate ? new Date(l.closedDate) : null;
          return date && date >= startDate && date < endDate;
        });
        const periodFollowUps = allFollowUps.filter(f => {
          const lead = userLeads.find(l => l.id === f.leadId);
          if (!lead) return false;
          const date = f.followUpDate ? new Date(f.followUpDate) : null;
          return date && date >= startDate && date < endDate;
        });
        
        // Implementation metrics
        const userProjects = allProjects.filter(p => {
          const engineers = projectEngineersMap.get(p.id) || [];
          return engineers.includes(user.id);
        });
        const periodProjectsCompleted = userProjects.filter(p => {
          if (p.status !== 'completed') return false;
          const date = p.updatedAt ? new Date(p.updatedAt) : null;
          return date && date >= startDate && date < endDate;
        });
        
        // Support metrics
        const resolvedStatuses = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
        const userTickets = allTickets.filter(t => t.assignedEngineerId === user.id);
        const periodTicketsClosed = userTickets.filter(t => {
          if (!resolvedStatuses.includes(t.status)) return false;
          const dateVal = t.closedAt || t.updatedAt;
          const date = dateVal ? new Date(dateVal) : null;
          return date && date >= startDate && date < endDate;
        });
        const overdueTickets = userTickets.filter(t => {
          if (resolvedStatuses.includes(t.status)) return false;
          return t.dueDate && new Date(t.dueDate) < new Date();
        });
        
        // Calculate scores
        const salesScore = periodDealsWon.length * 10 + periodFollowUps.filter(f => f.completed).length * 2 - periodDealsLost.length * 3;
        const implScore = periodProjectsCompleted.length * 15;
        const supportScore = periodTicketsClosed.length * 5 - overdueTickets.length * 5;
        
        return {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          role: user.role,
          department: dept?.name || 'Unassigned',
          departmentId: user.departmentId,
          metrics: {
            sales: {
              leadsGenerated: periodLeads.length,
              dealsWon: periodDealsWon.length,
              dealsWonValue: periodDealsWon.reduce((s, l) => s + (l.confirmedOrderValue || 0), 0),
              dealsLost: periodDealsLost.length,
              followUpsCompleted: periodFollowUps.filter(f => f.completed).length,
              winRate: userLeads.length > 0 ? Math.round((periodDealsWon.length / (periodDealsWon.length + periodDealsLost.length || 1)) * 100) : 0,
            },
            implementation: {
              projectsAssigned: userProjects.length,
              projectsCompleted: periodProjectsCompleted.length,
            },
            support: {
              ticketsAssigned: userTickets.filter(t => !resolvedStatuses.includes(t.status)).length,
              ticketsClosed: periodTicketsClosed.length,
              overdueTickets: overdueTickets.length,
            },
          },
          scores: {
            sales: salesScore,
            implementation: implScore,
            support: supportScore,
            total: salesScore + implScore + supportScore,
          },
        };
      });
      
      // Sort by total score for top performers
      const topPerformers = [...performance]
        .filter(p => p.scores.total > 0)
        .sort((a, b) => b.scores.total - a.scores.total)
        .slice(0, 10);
      
      // Get top performers by department
      const salesPerformers = [...performance]
        .filter(p => p.role === 'sales_executive' && p.scores.sales > 0)
        .sort((a, b) => b.scores.sales - a.scores.sales)
        .slice(0, 5);
      
      const implPerformers = [...performance]
        .filter(p => p.role === 'engineer' && p.scores.implementation > 0)
        .sort((a, b) => b.scores.implementation - a.scores.implementation)
        .slice(0, 5);
      
      const supportPerformers = [...performance]
        .filter(p => ['engineer', 'support'].includes(p.role || '') && p.scores.support > 0)
        .sort((a, b) => b.scores.support - a.scores.support)
        .slice(0, 5);
      
      res.json({
        period,
        topPerformers,
        byDepartment: {
          sales: salesPerformers,
          implementation: implPerformers,
          support: supportPerformers,
        },
        allUsers: performance,
      });
    } catch (error) {
      console.error("Error fetching admin performance dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin performance dashboard" });
    }
  });

  // Admin Dashboard - Development Tasks Overview
  app.get("/api/admin/dashboard/development", isAuthenticated, isAdmin, async (req: any, res) => {
    // Disable caching for this endpoint
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const bucket = req.query.bucket as string || 'year';
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      
      console.log("[DevDashboard] Fetching tasks for bucket:", bucket, "year:", year, "month:", month);
      
      const now = new Date();
      const [allTasks, allUsers] = await Promise.all([
        storage.getDevelopmentTasks({}),
        storage.getUsers(),
      ]);
      
      console.log("[DevDashboard] Found tasks:", allTasks.length, "sourceTypes:", allTasks.map(t => t.sourceType));
      console.log("[DevDashboard] Sample task:", allTasks[0] ? JSON.stringify({ 
        id: allTasks[0].id, 
        sourceType: allTasks[0].sourceType, 
        status: allTasks[0].status 
      }) : 'none');
      
      // Enrich tasks with user info
      const tasksWithDetails = allTasks.map(t => {
        const assignee = allUsers.find(u => u.id === t.assignedTo);
        const assigner = allUsers.find(u => u.id === t.assignedBy);
        const isOverdue = t.deadline && new Date(t.deadline) < now && t.status !== 'completed';
        return {
          ...t,
          assigneeName: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null,
          assignerName: assigner ? `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() : null,
          isOverdue,
          daysOverdue: isOverdue && t.deadline ? Math.floor((now.getTime() - new Date(t.deadline).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        };
      });
      
      let buckets: any[] = [];
      let items: any[] = [];
      
      if (bucket === 'year') {
        for (let m = 0; m < 12; m++) {
          const start = new Date(year, m, 1);
          const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
          
          const monthTasks = tasksWithDetails.filter(t => {
            const date = t.createdAt ? new Date(t.createdAt) : null;
            return date && date >= start && date <= end;
          });
          
          const completedTasks = tasksWithDetails.filter(t => {
            if (t.status !== 'completed') return false;
            const date = t.completedAt ? new Date(t.completedAt) : null;
            return date && date >= start && date <= end;
          });
          
          buckets.push({
            period: `${year}-${String(m + 1).padStart(2, '0')}`,
            label: new Date(year, m).toLocaleDateString('en-US', { month: 'short' }),
            created: monthTasks.length,
            completed: completedTasks.length,
            pending: monthTasks.filter(t => t.status === 'pending').length,
            inProgress: monthTasks.filter(t => t.status === 'in_progress').length,
            overdue: monthTasks.filter(t => t.isOverdue).length,
            fromSupport: monthTasks.filter(t => t.sourceType === 'support').length,
            fromImplementation: monthTasks.filter(t => t.sourceType === 'implementation').length,
            fromTasks: monthTasks.filter(t => t.sourceType === 'task').length,
            manual: monthTasks.filter(t => t.sourceType === 'manual').length,
          });
        }
      } else if (bucket === 'month' && month !== null) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        let weekNum = 1;
        let weekStart = new Date(monthStart);
        
        while (weekStart <= monthEnd) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
          
          const weekTasks = tasksWithDetails.filter(t => {
            const date = t.createdAt ? new Date(t.createdAt) : null;
            return date && date >= weekStart && date <= weekEnd;
          });
          
          const completedTasks = tasksWithDetails.filter(t => {
            if (t.status !== 'completed') return false;
            const date = t.completedAt ? new Date(t.completedAt) : null;
            return date && date >= weekStart && date <= weekEnd;
          });
          
          buckets.push({
            period: `Week ${weekNum}`,
            label: `W${weekNum}`,
            week: weekNum,
            created: weekTasks.length,
            completed: completedTasks.length,
            pending: weekTasks.filter(t => t.status === 'pending').length,
            inProgress: weekTasks.filter(t => t.status === 'in_progress').length,
            overdue: weekTasks.filter(t => t.isOverdue).length,
            fromSupport: weekTasks.filter(t => t.sourceType === 'support').length,
            fromImplementation: weekTasks.filter(t => t.sourceType === 'implementation').length,
            fromTasks: weekTasks.filter(t => t.sourceType === 'task').length,
            manual: weekTasks.filter(t => t.sourceType === 'manual').length,
          });
          
          weekNum++;
          weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() + 1);
        }
        
        // Also include items for this month
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        items = tasksWithDetails.filter(t => {
          const date = t.createdAt ? new Date(t.createdAt) : null;
          return date && date >= start && date <= end;
        });
      }
      
      // Get overdue tasks
      const overdueTasks = tasksWithDetails.filter(t => t.isOverdue);
      
      // Summary metrics
      const summary = {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        completed: allTasks.filter(t => t.status === 'completed').length,
        overdue: overdueTasks.length,
        totalPenaltyPoints: allTasks.reduce((sum, t) => sum + (t.penaltyPoints || 0), 0),
        fromSupport: allTasks.filter(t => t.sourceType === 'support').length,
        fromImplementation: allTasks.filter(t => t.sourceType === 'implementation').length,
        fromTasks: allTasks.filter(t => t.sourceType === 'task').length,
        manual: allTasks.filter(t => t.sourceType === 'manual').length,
      };
      
      console.log("[DevDashboard] Summary:", JSON.stringify(summary));
      console.log("[DevDashboard] Buckets count:", buckets.length, "buckets with data:", buckets.filter(b => b.created > 0).length);
      
      res.json({
        buckets,
        items,
        overdueTasks,
        summary,
      });
    } catch (error) {
      console.error("Error fetching admin development dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin development dashboard" });
    }
  });

  // Admin Dashboard - Drill-down to specific items
  app.get("/api/admin/dashboard/drilldown", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const module = req.query.module as string; // sales, implementation, support
      const date = req.query.date as string; // YYYY-MM-DD format
      const type = req.query.type as string; // leads, deals_won, deals_lost, projects, tickets, followups
      
      if (!module || !date) {
        return res.status(400).json({ message: "Module and date are required" });
      }
      
      const targetDate = new Date(date);
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const [allUsers] = await Promise.all([storage.getUsers()]);
      
      let items: any[] = [];
      
      if (module === 'sales') {
        const allLeads = await storage.getLeads({});
        
        switch (type) {
          case 'leads':
            items = allLeads.filter(l => {
              const d = l.createdAt ? new Date(l.createdAt) : null;
              return d && d >= dayStart && d < dayEnd;
            });
            break;
          case 'deals_won':
            items = allLeads.filter(l => {
              if (l.stage !== 'closed_won') return false;
              const d = l.closedDate ? new Date(l.closedDate) : null;
              return d && d >= dayStart && d < dayEnd;
            });
            break;
          case 'deals_lost':
            items = allLeads.filter(l => {
              if (l.stage !== 'closed_lost') return false;
              const d = l.closedDate ? new Date(l.closedDate) : null;
              return d && d >= dayStart && d < dayEnd;
            });
            break;
        }
        
        items = items.map(l => {
          const salesExec = allUsers.find(u => u.id === l.salesExecutiveId);
          return {
            ...l,
            salesExecutiveName: salesExec ? `${salesExec.firstName || ''} ${salesExec.lastName || ''}`.trim() : null,
          };
        });
      } else if (module === 'implementation') {
        const allProjects = await storage.getProjects({});
        items = allProjects.filter(p => {
          const d = p.createdAt ? new Date(p.createdAt) : null;
          return d && d >= dayStart && d < dayEnd;
        });
      } else if (module === 'support') {
        const allTickets = await storage.getTickets({});
        items = allTickets.filter(t => {
          const d = t.createdAt ? new Date(t.createdAt) : null;
          return d && d >= dayStart && d < dayEnd;
        }).map(t => {
          const assignee = allUsers.find(u => u.id === t.assignedEngineerId);
          return {
            ...t,
            assigneeName: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null,
          };
        });
      }
      
      res.json({ items, date, module, type });
    } catch (error) {
      console.error("Error fetching drilldown data:", error);
      res.status(500).json({ message: "Failed to fetch drilldown data" });
    }
  });

  // =============================================
  // DEVELOPMENT TASK ROUTES
  // =============================================

  // Get development dashboard metrics
  app.get("/api/development/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      
      // Fetch database user first
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Use centralized access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      // Admins see all metrics, others see their own or department's
      let assignedTo: string | undefined;
      let assignedToIds: string[] | undefined;
      
      if (!accessControl.hasFullAccess && accessControl.allowedUserIds) {
        if (accessControl.allowedUserIds.length === 1) {
          assignedTo = currentUser.id;
        } else {
          assignedToIds = accessControl.allowedUserIds;
        }
      }

      const devDashCacheKey = `devdash:metrics:${accessControl.hasFullAccess ? 'shared' : currentUser.id}`;
      const devDashCached = getCached<any>(devDashCacheKey);
      if (devDashCached) return res.json(devDashCached);
      
      const metrics = await storage.getDevelopmentDashboardMetrics(assignedTo, assignedToIds);
      setCached(devDashCacheKey, metrics, 300);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching development dashboard:", error);
      res.status(500).json({ message: "Failed to fetch development dashboard metrics" });
    }
  });

  // Get developer-wise task summary
  app.get("/api/development/developer-summary", isAuthenticated, async (req: any, res) => {
    try {
      const devSumCached = getCached<any>("devdash:developer-summary");
      if (devSumCached) return res.json(devSumCached);

      // Use SQL GROUP BY aggregation instead of fetching all rows
      const rows = await db.select({
        assignedTo:   developmentTasks.assignedTo,
        pending:      sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
        inProgress:   sql<number>`COUNT(*) FILTER (WHERE status = 'in_progress')`,
        completed:    sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
        overdue:      sql<number>`COUNT(*) FILTER (WHERE is_overdue = true)`,
        total:        sql<number>`COUNT(*)`,
      }).from(developmentTasks)
        .where(isNotNull(developmentTasks.assignedTo))
        .groupBy(developmentTasks.assignedTo);

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const summary = rows
        .map(r => {
          const u = userMap.get(r.assignedTo!);
          if (!u) return null;
          return {
            developer: { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email },
            pending:    Number(r.pending),
            inProgress: Number(r.inProgress),
            completed:  Number(r.completed),
            overdue:    Number(r.overdue),
            total:      Number(r.total),
          };
        })
        .filter(Boolean);

      setCached("devdash:developer-summary", summary, 300);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching developer summary:", error);
      res.status(500).json({ message: "Failed to fetch developer summary" });
    }
  });

  // Get client-wise task summary
  app.get("/api/development/client-summary", isAuthenticated, async (req: any, res) => {
    try {
      const clientSumCached = getCached<any>("devdash:client-summary");
      if (clientSumCached) return res.json(clientSumCached);

      // Fetch minimal fields only — avoid loading all ticket columns
      const [devTasks, ticketMap, projectMap, customers] = await Promise.all([
        storage.getDevelopmentTasks({}),
        // Only need id → customerId mapping from tickets
        db.select({ id: tickets.id, customerId: tickets.customerId })
          .from(tickets)
          .where(isNotNull(tickets.customerId)),
        // Only need id → customerId mapping from projects
        db.select({ id: projects.id, customerId: projects.customerId })
          .from(projects)
          .where(isNotNull(projects.customerId)),
        storage.getCustomers(),
      ]);

      // Build source-id → customerId map
      const sourceToCustomer = new Map<string, string>();
      for (const t of ticketMap) if (t.customerId) sourceToCustomer.set(t.id, t.customerId);
      for (const p of projectMap) if (p.customerId) sourceToCustomer.set(p.id, p.customerId);

      const customerLookup = new Map(customers.map(c => [c.id, c]));

      // Group tasks by customer
      const customerMap = new Map<string, any>();
      for (const task of devTasks) {
        const customerId = sourceToCustomer.get(task.sourceId ?? '');
        if (!customerId) continue;
        if (!customerMap.has(customerId)) {
          const c = customerLookup.get(customerId);
          customerMap.set(customerId, {
            customer: c ? { id: c.id, name: c.name } : null,
            pending: 0, inProgress: 0, completed: 0, overdue: 0, total: 0,
            sources: { support: 0, implementation: 0, task: 0, manual: 0 },
          });
        }
        const entry = customerMap.get(customerId)!;
        entry.total++;
        if (task.status === 'pending') entry.pending++;
        else if (task.status === 'in_progress') entry.inProgress++;
        else if (task.status === 'completed') entry.completed++;
        if (task.isOverdue) entry.overdue++;
        if (task.sourceType === 'support') entry.sources.support++;
        else if (task.sourceType === 'implementation') entry.sources.implementation++;
        else if (task.sourceType === 'task') entry.sources.task++;
        else if (task.sourceType === 'manual') entry.sources.manual++;
      }
      
      const summary = Array.from(customerMap.values()).filter(c => c.customer);
      setCached("devdash:client-summary", summary, 300);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching client summary:", error);
      res.status(500).json({ message: "Failed to fetch client summary" });
    }
  });

  // Get all development tasks with filtering
  app.get("/api/development/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const { status, sourceType, sourceId, priority, isOverdue } = req.query;
      const authId = req.user?.claims?.sub || req.user?.id;
      
      // Fetch database user first - required for proper ID resolution
      const currentUser = await storage.getUser(authId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Cache only when not filtering by sourceId (sourceId lookups are highly specific)
      const cacheKey = !sourceId
        ? `devtasks:${currentUser.id}:${status||''}:${sourceType||''}:${priority||''}:${isOverdue||''}`
        : null;
      if (cacheKey) {
        const cached = getCached<any>(cacheKey);
        if (cached) return res.json(cached);
      }
      
      // Use the database user ID (not auth ID) for access control
      const accessControl = await getAllowedUserIdsForUser(currentUser.id);
      
      const filters: any = {};
      if (status) filters.status = status;
      if (sourceType) filters.sourceType = sourceType;
      if (priority) filters.priority = priority;
      if (isOverdue) filters.isOverdue = isOverdue === 'true';
      
      // Apply access control - non-admins can only see their own tasks or department tasks
      if (!accessControl.hasFullAccess && accessControl.allowedUserIds) {
        if (accessControl.allowedUserIds.length === 1) {
          filters.assignedTo = currentUser.id;
        } else {
          filters.assignedToIds = accessControl.allowedUserIds;
        }
      }
      
      let tasks = await storage.getDevelopmentTasks(filters);
      
      // Filter by sourceId if provided (for checking dev tasks linked to a specific ticket/project/task)
      if (sourceId) {
        const sourceIdStr = String(sourceId);
        tasks = tasks.filter(t => String(t.sourceId) === sourceIdStr);
      }
      
      if (cacheKey) setCached(cacheKey, tasks, 300);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching development tasks:", error);
      res.status(500).json({ message: "Failed to fetch development tasks" });
    }
  });

  // Get single development task
  app.get("/api/development/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const task = await storage.getDevelopmentTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Development task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching development task:", error);
      res.status(500).json({ message: "Failed to fetch development task" });
    }
  });

  // Create development task (from Implementation, Support, Tasks, or Manual)
  app.post("/api/development/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      
      // Parse deadline string to Date if provided
      const deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      
      // For manual tasks, generate a sourceId if not provided
      const sourceId = req.body.sourceId || (req.body.sourceType === 'manual' ? `manual-${Date.now()}` : null);
      
      if (!sourceId) {
        return res.status(400).json({ message: "Source ID is required" });
      }
      
      const taskData = {
        ...req.body,
        sourceId,
        deadline,
        assignedBy: userId,
        assignedAt: req.body.assignedTo ? new Date() : null,
        status: 'pending',
        isOverdue: false,
        penaltyApplied: false,
      };
      
      console.log("[DevTask] Creating task with data:", JSON.stringify(taskData, null, 2));
      const task = await storage.createDevelopmentTask(taskData);
      
      // Log activity
      await storage.logActivity({
        userId,
        entityType: 'development_task',
        entityId: task.id,
        action: 'created',
        description: `Created development task ${task.taskNumber} from ${task.sourceType}`,
      });

      invalidateCache("devdash:");
      res.status(201).json(task);
    } catch (error: any) {
      console.error("Error creating development task:", error);
      console.error("Error details:", error?.message, error?.stack);
      res.status(500).json({ message: error?.message || "Failed to create development task" });
    }
  });

  // Update development task
  app.patch("/api/development/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const { id } = req.params;
      
      const existingTask = await storage.getDevelopmentTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      // Prevent reassignment when task is in_progress (work has started)
      if (req.body.assignedTo && 
          existingTask.assignedTo && 
          req.body.assignedTo !== existingTask.assignedTo &&
          existingTask.status === 'in_progress') {
        return res.status(400).json({ 
          message: "Cannot reassign task while work is in progress. Task must be completed first." 
        });
      }
      
      // Track status change for completion handling
      const previousStatus = existingTask.status;
      const newStatus = req.body.status;
      
      const updated = await storage.updateDevelopmentTask(id, {
        ...req.body,
        completedAt: newStatus === 'completed' ? new Date() : existingTask.completedAt,
      });
      
      // If dev task is being started (in_progress) and linked to a support ticket, update ticket status
      if (newStatus === 'in_progress' && previousStatus !== 'in_progress' && existingTask.sourceType === 'support' && existingTask.sourceId) {
        try {
          await storage.updateTicket(existingTask.sourceId, { status: 'in_development' });
          console.log(`Updated linked ticket ${existingTask.sourceId} to in_development status`);
        } catch (err) {
          console.error('Failed to update linked ticket status:', err);
        }
      }
      
      // If task is being completed, log activity
      if (newStatus === 'completed' && previousStatus !== 'completed') {
        // Log activity
        await storage.logActivity({
          userId,
          entityType: 'development_task',
          entityId: id,
          action: 'completed',
          description: `Completed development task ${updated.taskNumber}`,
        });
      } else {
        await storage.logActivity({
          userId,
          entityType: 'development_task',
          entityId: id,
          action: 'updated',
          description: `Updated development task ${updated.taskNumber}`,
        });
      }

      invalidateCache("devdash:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating development task:", error);
      res.status(500).json({ message: "Failed to update development task" });
    }
  });

  // Delete development task (admin only)
  app.delete("/api/development/tasks/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const { id } = req.params;
      
      const task = await storage.getDevelopmentTask(id);
      if (!task) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      await storage.deleteDevelopmentTask(id);
      
      await storage.logActivity({
        userId,
        entityType: 'development_task',
        entityId: id,
        action: 'deleted',
        description: `Deleted development task ${task.taskNumber}`,
      });

      invalidateCache("devdash:");
      res.json({ message: "Development task deleted" });
    } catch (error) {
      console.error("Error deleting development task:", error);
      res.status(500).json({ message: "Failed to delete development task" });
    }
  });

  // Get development task comments
  app.get("/api/development/tasks/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getDevelopmentTaskComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching development task comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add comment to development task
  app.post("/api/development/tasks/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const { id } = req.params;
      
      const comment = await storage.createDevelopmentTaskComment({
        developmentTaskId: id,
        userId,
        content: req.body.content,
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding development task comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Get development-support messages for a task
  app.get("/api/development/tasks/:id/support-messages", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const userEmail = currentUser?.email || req.user?.email;
      const userRole = currentUser?.role || req.user?.role;
      const { id } = req.params;
      
      // Verify task exists
      const task = await storage.getDevelopmentTask(id);
      if (!task) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      // Authorization: Allow if user is assigned, is admin, is super admin, or is any developer
      const isSuperAdmin = userEmail === "senthil@microgenn.com";
      const isAssigned = task.assignedTo === userId || task.assignedBy === userId;
      const isAdminRole = userRole === "admin";
      
      // Check if user is in development department by looking up their department
      let isDeveloper = currentUser?.role?.toLowerCase().includes('development') ||
                        currentUser?.role?.toLowerCase().includes('engineer');
      if (!isDeveloper && currentUser?.departmentId) {
        const dept = await storage.getDepartment(currentUser.departmentId);
        isDeveloper = dept?.name?.toLowerCase().includes('development') || false;
      }
      
      // Be more permissive - allow any authenticated user from development team
      if (!isAssigned && !isAdminRole && !isSuperAdmin && !isDeveloper) {
        console.log(`[Support Message Auth GET] User ${userEmail} (id: ${userId}) tried to view messages for task ${id}. assignedTo: ${task.assignedTo}, assignedBy: ${task.assignedBy}`);
        return res.status(403).json({ message: "Not authorized to view messages for this task" });
      }
      
      const messages = await storage.getDevelopmentSupportMessagesByTask(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching development-support messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message from development to support
  app.post("/api/development/tasks/:id/support-messages", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const userEmail = currentUser?.email || req.user?.email;
      const userRole = currentUser?.role || req.user?.role;
      const { id } = req.params;
      const { message } = req.body;
      
      if (!message?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      // Get the task to find the linked ticket
      const task = await storage.getDevelopmentTask(id);
      if (!task) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      // Authorization: Allow if user is assigned, is admin, is super admin, or is any developer
      const isSuperAdmin = userEmail === "senthil@microgenn.com";
      const isAssigned = task.assignedTo === userId || task.assignedBy === userId;
      const isAdminRole = userRole === "admin";
      
      // Check if user is in development department by looking up their department
      let isDeveloper = currentUser?.role?.toLowerCase().includes('development') ||
                        currentUser?.role?.toLowerCase().includes('engineer');
      if (!isDeveloper && currentUser?.departmentId) {
        const dept = await storage.getDepartment(currentUser.departmentId);
        isDeveloper = dept?.name?.toLowerCase().includes('development') || false;
      }
      
      // Be more permissive - allow any authenticated user from development team
      if (!isAssigned && !isAdminRole && !isSuperAdmin && !isDeveloper) {
        console.log(`[Support Message Auth] User ${userEmail} (id: ${userId}) tried to send message for task ${id}. assignedTo: ${task.assignedTo}, assignedBy: ${task.assignedBy}`);
        return res.status(403).json({ message: "Not authorized to send messages for this task" });
      }
      
      // Ensure task is linked to a support ticket
      if (task.sourceType !== 'support' || !task.sourceId) {
        return res.status(400).json({ message: "Task is not linked to a support ticket" });
      }
      
      const newMessage = await storage.createDevelopmentSupportMessage({
        developmentTaskId: id,
        ticketId: task.sourceId,
        senderType: 'development',
        senderId: userId,
        message: message.trim(),
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        entityType: 'development_task',
        entityId: id,
        action: 'message_sent',
        description: `Sent guidance message to support team`,
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending development-support message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get development-support messages for a ticket
  app.get("/api/tickets/:id/dev-messages", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const userEmail = currentUser?.email || req.user?.email;
      const userRole = currentUser?.role || req.user?.role;
      const { id } = req.params;
      
      // Verify ticket exists
      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Authorization: Allow if user is assigned, is admin, or has super admin email
      const isSuperAdmin = userEmail === "senthil@microgenn.com";
      const isAssigned = ticket.assignedEngineerId === userId;
      const isAdminRole = userRole === "admin";
      
      if (!isAssigned && !isAdminRole && !isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to view messages for this ticket" });
      }
      
      const messages = await storage.getDevelopmentSupportMessagesByTicket(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching ticket dev messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message from support to development (from ticket context)
  app.post("/api/tickets/:id/dev-messages", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const userEmail = currentUser?.email || req.user?.email;
      const userRole = currentUser?.role || req.user?.role;
      const { id: ticketId } = req.params;
      const { message, developmentTaskId } = req.body;
      
      if (!message?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      if (!developmentTaskId) {
        return res.status(400).json({ message: "Development task ID is required" });
      }
      
      // Verify ticket exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Authorization: Allow if user is assigned, is admin, or has super admin email
      const isSuperAdmin = userEmail === "senthil@microgenn.com";
      const isAssigned = ticket.assignedEngineerId === userId;
      const isAdminRole = userRole === "admin";
      
      if (!isAssigned && !isAdminRole && !isSuperAdmin) {
        return res.status(403).json({ message: "Not authorized to send messages for this ticket" });
      }
      
      // Verify development task exists and is linked to this ticket
      const task = await storage.getDevelopmentTask(developmentTaskId);
      if (!task) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      if (task.sourceType !== 'support' || task.sourceId !== ticketId) {
        return res.status(400).json({ message: "Development task is not linked to this ticket" });
      }
      
      const newMessage = await storage.createDevelopmentSupportMessage({
        developmentTaskId,
        ticketId,
        senderType: 'support',
        senderId: userId,
        message: message.trim(),
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending support-development message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Check and apply overdue penalties (can be called by admin or scheduled job)
  app.post("/api/development/check-overdue", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const penaltyCount = await storage.checkAndApplyOverduePenalties();
      res.json({ message: `Applied penalties to ${penaltyCount} overdue tasks` });
    } catch (error) {
      console.error("Error checking overdue tasks:", error);
      res.status(500).json({ message: "Failed to check overdue tasks" });
    }
  });

  // Complete development task with mandatory image and description
  app.post("/api/development/tasks/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const { id } = req.params;
      const { completionStatus, completionDescription, completionImageUrl } = req.body;
      
      // Validate required fields
      if (!completionStatus || !['complete', 'incomplete'].includes(completionStatus)) {
        return res.status(400).json({ message: "Invalid completion status. Must be 'complete' or 'incomplete'" });
      }
      
      if (!completionDescription || !completionDescription.trim()) {
        return res.status(400).json({ message: "Completion description is required" });
      }
      
      if (!completionImageUrl) {
        return res.status(400).json({ message: "Completion image is required" });
      }
      
      const existingTask = await storage.getDevelopmentTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      // Task must be in_progress, completed, or incomplete to be updated (check multiple formats)
      const taskStatus = existingTask.status?.toLowerCase().replace(/\s+/g, '_');
      console.log(`[Task Complete] Task ${id} status: "${existingTask.status}" (normalized: "${taskStatus}")`);
      
      const allowedStatuses = ['in_progress', 'inprogress', 'completed', 'incomplete'];
      const isAllowed = allowedStatuses.includes(taskStatus) || existingTask.status === 'In Progress';
      
      if (!isAllowed) {
        return res.status(400).json({ message: `Only tasks in progress, completed, or incomplete can be updated. Current status: ${existingTask.status}` });
      }
      
      // Determine final status
      const finalStatus = completionStatus === 'complete' ? 'completed' : 'incomplete';
      
      // If marking as incomplete, log the penalty activity
      if (completionStatus === 'incomplete' && existingTask.assignedTo) {
        // Log penalty activity for incomplete work
        const penaltyPoints = 5;
        await storage.logActivity({
          userId,
          entityType: 'development_task',
          entityId: id,
          action: 'penalty_applied',
          description: `${penaltyPoints} penalty points applied for incomplete work on ${existingTask.taskNumber}`,
        });
      }
      
      // Update task with completion details
      const updated = await storage.updateDevelopmentTask(id, {
        status: finalStatus,
        completionStatus,
        completionDescription: completionDescription.trim(),
        completionImageUrl,
        completedAt: completionStatus === 'complete' ? new Date() : null,
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        entityType: 'development_task',
        entityId: id,
        action: completionStatus === 'complete' ? 'completed' : 'marked_incomplete',
        description: `Marked development task ${updated.taskNumber} as ${completionStatus}`,
      });
      
      // Handle source ticket update if requested (for support-sourced tasks)
      const { updateSourceTicket, sourceTicketStatus, sourceTicketComment } = req.body;
      if (existingTask.sourceType === 'support' && existingTask.sourceId && updateSourceTicket) {
        try {
          // Update the source ticket status if provided
          if (sourceTicketStatus) {
            await storage.updateTicket(existingTask.sourceId, { status: sourceTicketStatus });
          }
          
          // Log activity for the ticket about development task completion
          await storage.logActivity({
            userId,
            entityType: 'ticket',
            entityId: existingTask.sourceId,
            action: 'development_completed',
            description: `Development task ${updated.taskNumber} completed for ticket`,
          });
        } catch (ticketError) {
          console.error("Error updating source ticket:", ticketError);
          // Don't fail the completion if ticket update fails
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing development task:", error);
      res.status(500).json({ message: "Failed to complete development task" });
    }
  });

  // Reassign incomplete development task to another engineer
  app.post("/api/development/tasks/:id/reassign", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const authId = req.user?.claims?.sub || req.user?.id;
      const currentUser = await storage.getUser(authId);
      const userId = currentUser?.id || authId;
      const { id } = req.params;
      const { assignedTo, deadline, notes } = req.body;
      
      if (!assignedTo) {
        return res.status(400).json({ message: "New assignee is required" });
      }
      
      const existingTask = await storage.getDevelopmentTask(id);
      if (!existingTask) {
        return res.status(404).json({ message: "Development task not found" });
      }
      
      // Can only reassign incomplete tasks
      if (existingTask.status !== 'incomplete') {
        return res.status(400).json({ message: "Only incomplete tasks can be reassigned" });
      }
      
      // Update task with new assignment
      const updated = await storage.updateDevelopmentTask(id, {
        assignedTo,
        assignedBy: userId,
        assignedAt: new Date(),
        deadline: deadline ? new Date(deadline) : existingTask.deadline,
        status: 'pending', // Reset to pending for new assignee
        completionStatus: null, // Clear previous completion status
        completionDescription: null,
        completionImageUrl: null,
        notes: notes || existingTask.notes,
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        entityType: 'development_task',
        entityId: id,
        action: 'reassigned',
        description: `Development task ${updated.taskNumber} reassigned after incomplete status`,
      });
      
      // Add comment about reassignment
      await storage.createDevelopmentTaskComment({
        developmentTaskId: id,
        userId,
        content: `Task reassigned. Previous work was marked incomplete. ${notes ? `Notes: ${notes}` : ''}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error reassigning development task:", error);
      res.status(500).json({ message: "Failed to reassign development task" });
    }
  });

  // =============================================
  // CONTRACT TYPES MASTER ROUTES (Admin Only)
  // =============================================
  
  // Get all contract types
  app.get("/api/contract-types", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const cached = getCached<any>("contract-types:all");
      if (cached) return res.json(cached);
      const types = await db.select().from(contractTypes).orderBy(contractTypes.sortOrder);
      setCached("contract-types:all", types, 600);
      res.json(types);
    } catch (error) {
      console.error("Error fetching contract types:", error);
      res.status(500).json({ message: "Failed to fetch contract types" });
    }
  });

  // Get single contract type
  app.get("/api/contract-types/:id", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const [type] = await db.select().from(contractTypes).where(eq(contractTypes.id, req.params.id));
      if (!type) {
        return res.status(404).json({ message: "Contract type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Error fetching contract type:", error);
      res.status(500).json({ message: "Failed to fetch contract type" });
    }
  });

  // Create contract type (admin only with create permission)
  app.post("/api/contract-types", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      const validated = insertContractTypeSchema.parse(req.body);
      const [created] = await db.insert(contractTypes).values(validated).returning();
      
      await storage.logActivity({
        entityType: "contract_type",
        entityId: created.id,
        action: "created",
        description: `Contract type created: ${created.displayName}`,
        userId: req.user?.id,
      });

      invalidateCache("contract-types:");
      res.json(created);
    } catch (error: any) {
      console.error("Error creating contract type:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "A contract type with this name already exists" });
      }
      res.status(400).json({ message: "Failed to create contract type" });
    }
  });

  // Update contract type (with edit permission)
  app.patch("/api/contract-types/:id", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const [updated] = await db.update(contractTypes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(contractTypes.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Contract type not found" });
      }
      
      await storage.logActivity({
        entityType: "contract_type",
        entityId: updated.id,
        action: "updated",
        description: `Contract type updated: ${updated.displayName}`,
        userId: req.user?.id,
      });

      invalidateCache("contract-types:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating contract type:", error);
      res.status(400).json({ message: "Failed to update contract type" });
    }
  });

  // Delete contract type (with delete permission)
  app.delete("/api/contract-types/:id", isAuthenticated, requirePermission("contracts", "delete"), async (req: any, res) => {
    try {
      const [type] = await db.select().from(contractTypes).where(eq(contractTypes.id, req.params.id));
      if (!type) {
        return res.status(404).json({ message: "Contract type not found" });
      }
      
      await db.delete(contractTypes).where(eq(contractTypes.id, req.params.id));
      
      await storage.logActivity({
        entityType: "contract_type",
        entityId: req.params.id,
        action: "deleted",
        description: `Contract type deleted: ${type.displayName}`,
        userId: req.user?.id,
      });

      invalidateCache("contract-types:");
      res.json({ message: "Contract type deleted successfully" });
    } catch (error) {
      console.error("Error deleting contract type:", error);
      res.status(500).json({ message: "Failed to delete contract type" });
    }
  });

  // =============================================
  // CUSTOMER CONTRACTS ROUTES
  // =============================================

  // Generate contract number
  async function generateContractNumber(): Promise<string> {
    // Find the maximum contract number to avoid duplicates after deletions
    const result = await db.select({ 
      maxNum: sql<string>`MAX(CAST(SUBSTRING(contract_number FROM 5) AS INTEGER))` 
    }).from(customerContracts);
    const maxNum = Number(result[0]?.maxNum || 0) + 1;
    return `CON-${String(maxNum).padStart(6, '0')}`;
  }

  // Get all customer contracts with customer and type details
  app.get("/api/customer-contracts", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { customerId, status, contractTypeId, expiringDays } = req.query;

      // Cache the unfiltered list for 5 minutes — filtered views are fast since they just slice the cached array
      const isUnfiltered = !customerId && !status && !contractTypeId && !expiringDays;
      if (isUnfiltered) {
        const cached = getCached<any>("contracts:list");
        if (cached) return res.json(cached);
      }

      // Use proper JOINs instead of correlated subqueries (much faster)
      const conditions: any[] = [];
      if (customerId)     conditions.push(eq(customerContracts.customerId,    customerId as string));
      if (status)         conditions.push(eq(customerContracts.status,         status as string));
      if (contractTypeId) conditions.push(eq(customerContracts.contractTypeId, contractTypeId as string));

      let contractsResult = await db.select({
        contract:         customerContracts,
        customerName:     customers.name,
        customerCity:     customers.city,
        customerModules:  customers.selectedModules,
        contractTypeName: contractTypes.displayName,
      })
        .from(customerContracts)
        .leftJoin(customers,     eq(customerContracts.customerId,    customers.id))
        .leftJoin(contractTypes, eq(customerContracts.contractTypeId, contractTypes.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(customerContracts.createdAt));

      // Filter by expiring within X days if specified
      if (expiringDays) {
        const days = parseInt(expiringDays as string);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        contractsResult = contractsResult.filter(c => {
          const endDate = new Date(c.contract.endDate);
          return endDate <= futureDate && endDate >= new Date();
        });
      }

      if (isUnfiltered) setCached("contracts:list", contractsResult, 300);
      res.json(contractsResult);
    } catch (error) {
      console.error("Error fetching customer contracts:", error);
      res.status(500).json({ message: "Failed to fetch customer contracts" });
    }
  });

  // Get contracts for a specific customer
  app.get("/api/customers/:customerId/contracts", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const contracts = await db.select({
        contract: customerContracts,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customerContracts.contractTypeId})`,
      })
        .from(customerContracts)
        .where(eq(customerContracts.customerId, req.params.customerId));
      
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching customer contracts:", error);
      res.status(500).json({ message: "Failed to fetch customer contracts" });
    }
  });

  // Get single contract with details and modules
  app.get("/api/customer-contracts/:id", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const [contract] = await db.select({
        contract: customerContracts,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerContracts.customerId})`,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customerContracts.contractTypeId})`,
      })
        .from(customerContracts)
        .where(eq(customerContracts.id, req.params.id));
      
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Get associated modules
      const modules = await db.select()
        .from(customerContractModules)
        .where(eq(customerContractModules.contractId, req.params.id));
      
      res.json({ ...contract, modules });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });
  
  // Get modules for a contract
  app.get("/api/customer-contracts/:id/modules", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const modules = await db.select()
        .from(customerContractModules)
        .where(eq(customerContractModules.contractId, req.params.id));
      res.json(modules);
    } catch (error) {
      console.error("Error fetching contract modules:", error);
      res.status(500).json({ message: "Failed to fetch contract modules" });
    }
  });

  // Create customer contract
  app.post("/api/customer-contracts", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      // Convert date strings to Date objects before validation
      const { modules: moduleDetails, ...contractData } = req.body;
      const bodyWithDates = {
        ...contractData,
        startDate: contractData.startDate ? new Date(contractData.startDate) : undefined,
        endDate: contractData.endDate ? new Date(contractData.endDate) : undefined,
      };
      const validated = insertCustomerContractSchema.parse(bodyWithDates);
      const contractNumber = await generateContractNumber();
      
      const [created] = await db.insert(customerContracts).values({
        ...validated,
        contractNumber,
        createdBy: req.user?.id,
      }).returning();
      
      // Insert module details if provided
      if (moduleDetails && Array.isArray(moduleDetails) && moduleDetails.length > 0) {
        const modulesToInsert = moduleDetails.map((mod: any) => ({
          contractId: created.id,
          moduleName: mod.moduleName,
          orderValue: Math.round(parseFloat(mod.orderValue) || 0),
          amcAmount: Math.round(parseFloat(mod.amcAmount) || 0),
          contractPeriodMonths: parseInt(mod.contractPeriodMonths) || 12,
          startDate: mod.startDate ? new Date(mod.startDate) : null,
          endDate: mod.endDate ? new Date(mod.endDate) : null,
          notes: mod.notes || null,
        }));
        await db.insert(customerContractModules).values(modulesToInsert);
      }
      
      await storage.logActivity({
        entityType: "customer_contract",
        entityId: created.id,
        action: "created",
        description: `Customer contract created: ${contractNumber}`,
        userId: req.user?.id,
      });

      invalidateCache("contracts:");
      res.json(created);
    } catch (error: any) {
      console.error("Error creating customer contract:", error);
      res.status(400).json({ message: error.message || "Failed to create customer contract" });
    }
  });

  // Bulk import clients with contracts
  app.post("/api/customer-contracts/bulk-import", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      const { clients } = req.body;
      
      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ message: "No clients provided for import" });
      }

      // Validate payload structure
      const importRowSchema = z.object({
        serialNo: z.string().optional(),
        clientName: z.string().min(1, "Client name is required"),
        mobileNo: z.string().optional(),
        module: z.string().optional(),
        contractType: z.string().optional(),
      });

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
        created: [] as { customerId: string; contractId: string; clientName: string }[],
      };

      // Get all contract types for matching
      const allContractTypes = await db.select().from(contractTypes);
      
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        const rowNum = i + 1;
        
        try {
          // Validate row data
          const validationResult = importRowSchema.safeParse(client);
          if (!validationResult.success) {
            const errorMsg = validationResult.error.errors.map((e: { message: string }) => e.message).join(", ");
            results.errors.push(`Row ${rowNum}: ${errorMsg}`);
            results.failed++;
            continue;
          }
          
          const { clientName, mobileNo, module, contractType } = validationResult.data;
          
          if (!clientName || clientName.trim() === "") {
            results.errors.push(`Row ${rowNum}: Client name is required`);
            results.failed++;
            continue;
          }

          // Find or create customer
          let customerId: string;
          const existingCustomer = await db.select()
            .from(customers)
            .where(eq(customers.name, clientName.trim()))
            .limit(1);
          
          if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            // Update phone if provided
            if (mobileNo) {
              await db.update(customers)
                .set({ phone: mobileNo.trim(), updatedAt: new Date() })
                .where(eq(customers.id, customerId));
            }
          } else {
            // Create new customer
            const [newCustomer] = await db.insert(customers).values({
              name: clientName.trim(),
              phone: mobileNo?.trim() || null,
              status: "active",
              customerType: "customer",
              selectedModules: module?.trim() ? [module.trim()] : null,
            }).returning();
            customerId = newCustomer.id;
          }

          // Find contract type by name (case-insensitive)
          let matchedContractType = allContractTypes.find(ct => 
            ct.name.toLowerCase() === contractType?.toLowerCase()?.trim() ||
            ct.displayName.toLowerCase() === contractType?.toLowerCase()?.trim()
          );
          
          // Default to first active contract type if not found
          if (!matchedContractType) {
            matchedContractType = allContractTypes.find(ct => ct.isActive);
          }
          
          if (!matchedContractType) {
            results.errors.push(`${clientName}: No valid contract type found`);
            results.failed++;
            continue;
          }

          // Create contract
          const contractNumber = await generateContractNumber();
          const startDate = new Date();
          const durationMonths = matchedContractType.defaultDurationMonths || 12;
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + durationMonths);

          const [contract] = await db.insert(customerContracts).values({
            contractNumber,
            customerId,
            contractTypeId: matchedContractType.id,
            amount: 0, // Default amount, can be updated later
            currency: "INR",
            startDate,
            endDate,
            contactPhone: mobileNo?.trim() || null,
            status: "active",
            createdBy: req.user?.claims?.sub,
          }).returning();

          // Create module entry if provided
          if (module && module.trim()) {
            await db.insert(customerContractModules).values({
              contractId: contract.id,
              moduleName: module.trim(),
              orderValue: 0,
              amcAmount: 0,
              contractPeriodMonths: durationMonths,
              startDate,
              endDate,
            });
          }

          results.success++;
          results.created.push({
            customerId,
            contractId: contract.id,
            clientName: clientName.trim(),
          });

        } catch (rowError: any) {
          results.errors.push(`${client.clientName || "Unknown"}: ${rowError.message}`);
          results.failed++;
        }
      }

      // Log activity
      await storage.logActivity({
        entityType: "customer_contract",
        entityId: "bulk-import",
        action: "bulk_import",
        description: `Bulk import: ${results.success} clients imported, ${results.failed} failed`,
        userId: req.user?.claims?.sub,
      });

      res.json(results);
    } catch (error: any) {
      console.error("Error in bulk import:", error);
      res.status(500).json({ message: error.message || "Failed to import clients" });
    }
  });

  // Update customer contract
  app.patch("/api/customer-contracts/:id", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      // Convert date strings to Date objects if present
      const { modules: moduleDetails, ...contractData } = req.body;
      const updateData: any = { ...contractData, updatedAt: new Date() };
      if (contractData.startDate) updateData.startDate = new Date(contractData.startDate);
      if (contractData.endDate) updateData.endDate = new Date(contractData.endDate);
      
      // Remove modules from updateData as it's handled separately
      delete updateData.modules;
      
      const [updated] = await db.update(customerContracts)
        .set(updateData)
        .where(eq(customerContracts.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Update module details if provided (delete existing and re-insert)
      if (moduleDetails && Array.isArray(moduleDetails)) {
        await db.delete(customerContractModules)
          .where(eq(customerContractModules.contractId, req.params.id));
        
        if (moduleDetails.length > 0) {
          const modulesToInsert = moduleDetails.map((mod: any) => ({
            contractId: req.params.id,
            moduleName: mod.moduleName,
            orderValue: Math.round(parseFloat(mod.orderValue) || 0),
            amcAmount: Math.round(parseFloat(mod.amcAmount) || 0),
            contractPeriodMonths: parseInt(mod.contractPeriodMonths) || 12,
            startDate: mod.startDate ? new Date(mod.startDate) : null,
            endDate: mod.endDate ? new Date(mod.endDate) : null,
            notes: mod.notes || null,
          }));
          await db.insert(customerContractModules).values(modulesToInsert);
        }
      }
      
      await storage.logActivity({
        entityType: "customer_contract",
        entityId: updated.id,
        action: "updated",
        description: `Customer contract updated: ${updated.contractNumber}`,
        userId: req.user?.id,
      });

      invalidateCache("contracts:");
      res.json(updated);
    } catch (error) {
      console.error("Error updating customer contract:", error);
      res.status(400).json({ message: "Failed to update customer contract" });
    }
  });

  // Delete customer contract
  app.delete("/api/customer-contracts/:id", isAuthenticated, requirePermission("contracts", "delete"), async (req: any, res) => {
    try {
      const [contract] = await db.select().from(customerContracts).where(eq(customerContracts.id, req.params.id));
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      await db.delete(customerContracts).where(eq(customerContracts.id, req.params.id));
      
      await storage.logActivity({
        entityType: "customer_contract",
        entityId: req.params.id,
        action: "deleted",
        description: `Customer contract deleted: ${contract.contractNumber}`,
        userId: req.user?.id,
      });

      invalidateCache("contracts:");
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer contract:", error);
      res.status(500).json({ message: "Failed to delete customer contract" });
    }
  });

  // Get contracts expiring soon (for accounts dashboard)
  app.get("/api/contracts/expiring", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const cacheKey = `contracts:expiring:${days}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const expiringContracts = await db.select({
        contract:         customerContracts,
        customerName:     customers.name,
        customerCity:     customers.city,
        customerModules:  customers.selectedModules,
        contractTypeName: contractTypes.displayName,
      })
        .from(customerContracts)
        .leftJoin(customers,     eq(customerContracts.customerId,    customers.id))
        .leftJoin(contractTypes, eq(customerContracts.contractTypeId, contractTypes.id))
        .where(and(
          gte(customerContracts.endDate, new Date()),
          lte(customerContracts.endDate, futureDate),
          eq(customerContracts.status, 'active')
        ));

      setCached(cacheKey, expiringContracts, 300);
      res.json(expiringContracts);
    } catch (error) {
      console.error("Error fetching expiring contracts:", error);
      res.status(500).json({ message: "Failed to fetch expiring contracts" });
    }
  });

  // =============================================
  // CONTRACT FOLLOW-UP ROUTES
  // =============================================

  // Get follow-ups for a contract
  app.get("/api/customer-contracts/:contractId/followups", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { desc } = await import('drizzle-orm');
      const followups = await db.select()
        .from(contractFollowups)
        .where(eq(contractFollowups.contractId, req.params.contractId))
        .orderBy(desc(contractFollowups.followupDate));
      
      res.json(followups);
    } catch (error) {
      console.error("Error fetching contract follow-ups:", error);
      res.status(500).json({ message: "Failed to fetch contract follow-ups" });
    }
  });

  // Create contract follow-up (log payment or reminder)
  app.post("/api/customer-contracts/:contractId/followups", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const validated = insertContractFollowupSchema.parse({
        ...req.body,
        contractId: req.params.contractId,
      });
      
      const [created] = await db.insert(contractFollowups).values({
        ...validated,
        createdBy: req.user?.id,
      }).returning();
      
      // If payment was recorded, update the contract's last payment info
      if (validated.paymentStatus === 'paid' && validated.paymentAmount) {
        await db.update(customerContracts)
          .set({
            lastPaymentDate: validated.paymentDate || new Date(),
            lastPaymentAmount: validated.paymentAmount,
            nextFollowupDate: validated.nextFollowupDate,
            updatedAt: new Date(),
          })
          .where(eq(customerContracts.id, req.params.contractId));
      }
      
      await storage.logActivity({
        entityType: "contract_followup",
        entityId: created.id,
        action: "created",
        description: `Contract follow-up logged: ${validated.followupType}`,
        userId: req.user?.id,
      });
      
      res.json(created);
    } catch (error: any) {
      console.error("Error creating contract follow-up:", error);
      res.status(400).json({ message: error.message || "Failed to create follow-up" });
    }
  });

  // Send renewal reminder email
  app.post("/api/customer-contracts/:id/send-renewal", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const [result] = await db.select({
        contract: customerContracts,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerContracts.customerId})`,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customerContracts.contractTypeId})`,
      })
        .from(customerContracts)
        .where(eq(customerContracts.id, req.params.id));
      
      if (!result) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      const { contract, customerName, contractTypeName } = result;
      
      if (!contract.contactEmail) {
        return res.status(400).json({ message: "No contact email specified for this contract" });
      }
      
      // Send renewal reminder email
      const endDate = new Date(contract.endDate);
      const emailHtml = `
        <h2>Contract Renewal Reminder</h2>
        <p>Dear ${contract.contactPerson || 'Valued Customer'},</p>
        <p>This is a reminder that your <strong>${contractTypeName}</strong> contract is approaching renewal.</p>
        <br/>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${contract.contractNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Company:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${customerName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${contractTypeName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${contract.currency} ${contract.amount.toLocaleString()}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>End Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${endDate.toLocaleDateString()}</td></tr>
        </table>
        <br/>
        <p>Please contact us to renew your contract and ensure uninterrupted service.</p>
        <p>Best Regards,<br/>M-CRM Support Team</p>
      `;
      
      await sendEmail({
        to: contract.contactEmail,
        subject: `Contract Renewal Reminder - ${contract.contractNumber}`,
        html: emailHtml,
      });
      
      // Log the follow-up
      await db.insert(contractFollowups).values({
        contractId: contract.id,
        followupDate: new Date(),
        followupType: 'renewal',
        notes: `Renewal reminder email sent to ${contract.contactEmail}`,
        emailSent: true,
        emailSentAt: new Date(),
        createdBy: req.user?.id,
      });
      
      await storage.logActivity({
        entityType: "customer_contract",
        entityId: contract.id,
        action: "renewal_reminder_sent",
        description: `Renewal reminder sent for contract ${contract.contractNumber}`,
        userId: req.user?.id,
      });
      
      res.json({ message: "Renewal reminder sent successfully" });
    } catch (error) {
      console.error("Error sending renewal reminder:", error);
      res.status(500).json({ message: "Failed to send renewal reminder" });
    }
  });

  // Get contracts needing follow-up (for accounts team)
  app.get("/api/contracts/pending-followup", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const cached = getCached<any>("contracts:pending-followup");
      if (cached) return res.json(cached);

      const today = new Date();
      const { or: drizzleOr, isNull: drizzleIsNull, lte: drizzleLte } = await import('drizzle-orm');
      
      const pendingFollowups = await db.select({
        contract:         customerContracts,
        customerName:     customers.name,
        contractTypeName: contractTypes.displayName,
      })
        .from(customerContracts)
        .leftJoin(customers,     eq(customerContracts.customerId,    customers.id))
        .leftJoin(contractTypes, eq(customerContracts.contractTypeId, contractTypes.id))
        .where(drizzleOr(
          drizzleLte(customerContracts.nextFollowupDate, today),
          drizzleIsNull(customerContracts.nextFollowupDate)
        ));

      setCached("contracts:pending-followup", pendingFollowups, 300);
      res.json(pendingFollowups);
    } catch (error) {
      console.error("Error fetching pending follow-ups:", error);
      res.status(500).json({ message: "Failed to fetch pending follow-ups" });
    }
  });

  // Get contracts grouped by renewal month (for month-wise renewal view)
  app.get("/api/contracts/renewals-by-month", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const monthsAhead = parseInt(req.query.months as string) || 12;
      const cacheKey = `contracts:renewals-by-month:${monthsAhead}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const today = new Date();
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + monthsAhead);

      const allContracts = await db.select({
        contract:         customerContracts,
        customerName:     customers.name,
        customerCity:     customers.city,
        contractTypeName: contractTypes.displayName,
      })
        .from(customerContracts)
        .leftJoin(customers,     eq(customerContracts.customerId,    customers.id))
        .leftJoin(contractTypes, eq(customerContracts.contractTypeId, contractTypes.id))
        .where(and(
          gte(customerContracts.endDate, today),
          sql`${customerContracts.endDate} <= ${futureDate}`
        ))
        .orderBy(customerContracts.endDate);

      // Group by month
      const byMonth: Record<string, any[]> = {};
      allContracts.forEach(c => {
        if (c.contract.endDate) {
          const monthKey = new Date(c.contract.endDate).toISOString().substring(0, 7);
          if (!byMonth[monthKey]) byMonth[monthKey] = [];
          byMonth[monthKey].push(c);
        }
      });

      const result = Object.entries(byMonth).map(([month, contracts]) => ({
        month,
        monthDisplay: new Date(month + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        contractCount: contracts.length,
        totalValue: contracts.reduce((sum, c) => sum + (c.contract.amount || 0), 0),
        contracts,
      }));

      setCached(cacheKey, result, 300);
      res.json(result);
    } catch (error) {
      console.error("Error fetching renewals by month:", error);
      res.status(500).json({ message: "Failed to fetch renewals by month" });
    }
  });

  // Get contract type summary with client counts
  app.get("/api/contracts/type-summary", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const cached = getCached<any>("contracts:type-summary");
      if (cached) return res.json(cached);

      const summary = await db.select({
        contractTypeId:   customerContracts.contractTypeId,
        contractTypeName: contractTypes.displayName,
        clientCount:      sql<number>`COUNT(DISTINCT ${customerContracts.customerId})`,
        contractCount:    sql<number>`COUNT(*)`,
        totalValue:       sql<number>`SUM(${customerContracts.amount})`,
        activeCount:      sql<number>`SUM(CASE WHEN ${customerContracts.status} = 'active' THEN 1 ELSE 0 END)`,
        expiringCount:    sql<number>`SUM(CASE WHEN ${customerContracts.endDate} <= NOW() + INTERVAL '30 days' AND ${customerContracts.endDate} > NOW() THEN 1 ELSE 0 END)`,
      })
        .from(customerContracts)
        .leftJoin(contractTypes, eq(customerContracts.contractTypeId, contractTypes.id))
        .groupBy(customerContracts.contractTypeId, contractTypes.displayName);

      setCached("contracts:type-summary", summary, 300);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching contract type summary:", error);
      res.status(500).json({ message: "Failed to fetch contract type summary" });
    }
  });

  // Get contracts with advanced filtering (city, type, modules, date range)
  app.get("/api/contracts/search", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { search, city, contractTypeId, startDate, endDate, status } = req.query;
      const { and, gte, lte, ilike } = await import('drizzle-orm');
      
      const conditions: any[] = [];
      
      // Build dynamic query
      let query = db.select({
        contract: customerContracts,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerContracts.customerId})`,
        customerCity: sql<string>`(SELECT city FROM customers WHERE id = ${customerContracts.customerId})`,
        customerModules: sql<string[]>`(SELECT selected_modules FROM customers WHERE id = ${customerContracts.customerId})`,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customerContracts.contractTypeId})`,
      }).from(customerContracts);
      
      // Apply filters
      if (contractTypeId) {
        conditions.push(eq(customerContracts.contractTypeId, contractTypeId as string));
      }
      if (status) {
        conditions.push(eq(customerContracts.status, status as string));
      }
      if (startDate) {
        conditions.push(gte(customerContracts.startDate, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(customerContracts.endDate, new Date(endDate as string)));
      }
      
      // Text search across multiple fields
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        conditions.push(sql`(
          LOWER(${customerContracts.contractNumber}) LIKE ${searchLower}
          OR LOWER((SELECT name FROM customers WHERE id = ${customerContracts.customerId})) LIKE ${searchLower}
          OR LOWER((SELECT city FROM customers WHERE id = ${customerContracts.customerId})) LIKE ${searchLower}
          OR LOWER((SELECT display_name FROM contract_types WHERE id = ${customerContracts.contractTypeId})) LIKE ${searchLower}
          OR EXISTS (SELECT 1 FROM customers c WHERE c.id = ${customerContracts.customerId} AND ${searchLower} = ANY(c.selected_modules))
        )`);
      }
      
      // City filter
      if (city) {
        conditions.push(sql`LOWER((SELECT city FROM customers WHERE id = ${customerContracts.customerId})) = LOWER(${city})`);
      }
      
      const results = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(customerContracts.endDate)
        : await query.orderBy(customerContracts.endDate);
      
      res.json(results);
    } catch (error) {
      console.error("Error searching contracts:", error);
      res.status(500).json({ message: "Failed to search contracts" });
    }
  });

  // ================== CUSTOMER MASTER WITH CONTRACT TYPE (Accounts) ==================

  // Get unallocated customers (not in any contract - neither customer_contracts nor customer_module_contracts)
  app.get("/api/accounts/unallocated-customers", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { search, city } = req.query;
      const { and, or } = await import('drizzle-orm');
      
      const conditions: any[] = [
        // Customer must NOT have any active customer_contracts
        sql`NOT EXISTS (
          SELECT 1 FROM customer_contracts cc 
          WHERE cc.customer_id = ${customers.id} 
          AND cc.status = 'active'
        )`,
        // Customer must NOT have any active module_contracts
        sql`NOT EXISTS (
          SELECT 1 FROM customer_module_contracts cmc 
          WHERE cmc.customer_id = ${customers.id} 
          AND cmc.status = 'active'
        )`,
        // Only active customers
        eq(customers.status, 'active')
      ];
      
      // Search filter
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        conditions.push(or(
          sql`LOWER(${customers.name}) LIKE ${searchLower}`,
          sql`LOWER(${customers.contactPerson}) LIKE ${searchLower}`,
          sql`LOWER(${customers.city}) LIKE ${searchLower}`,
          sql`LOWER(${customers.email}) LIKE ${searchLower}`,
          sql`LOWER(${customers.phone}) LIKE ${searchLower}`
        ));
      }
      
      // City filter
      if (city) {
        conditions.push(sql`LOWER(${customers.city}) = LOWER(${city})`);
      }
      
      const results = await db.select({
        id: customers.id,
        name: customers.name,
        contactPerson: customers.contactPerson,
        designation: customers.designation,
        email: customers.email,
        phone: customers.phone,
        city: customers.city,
        state: customers.state,
        country: customers.country,
        status: customers.status,
        customerType: customers.customerType,
        contractTypeId: customers.contractTypeId,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customers.contractTypeId})`,
        selectedModules: customers.selectedModules,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
        .from(customers)
        .where(and(...conditions))
        .orderBy(customers.name);
      
      res.json(results);
    } catch (error) {
      console.error("Error fetching unallocated customers:", error);
      res.status(500).json({ message: "Failed to fetch unallocated customers" });
    }
  });

  // Get all customers with their contract type for Accounts department
  app.get("/api/accounts/customer-master", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { search, contractTypeId, city } = req.query;
      const { and, ilike, or } = await import('drizzle-orm');
      
      const conditions: any[] = [];
      
      // Search filter
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        conditions.push(or(
          sql`LOWER(${customers.name}) LIKE ${searchLower}`,
          sql`LOWER(${customers.contactPerson}) LIKE ${searchLower}`,
          sql`LOWER(${customers.city}) LIKE ${searchLower}`,
          sql`LOWER(${customers.email}) LIKE ${searchLower}`,
          sql`LOWER(${customers.phone}) LIKE ${searchLower}`
        ));
      }
      
      // Contract type filter
      if (contractTypeId) {
        conditions.push(eq(customers.contractTypeId, contractTypeId as string));
      }
      
      // City filter
      if (city) {
        conditions.push(sql`LOWER(${customers.city}) = LOWER(${city})`);
      }
      
      const query = db.select({
        id: customers.id,
        name: customers.name,
        contactPerson: customers.contactPerson,
        designation: customers.designation,
        email: customers.email,
        phone: customers.phone,
        city: customers.city,
        state: customers.state,
        country: customers.country,
        status: customers.status,
        customerType: customers.customerType,
        contractTypeId: customers.contractTypeId,
        contractTypeName: sql<string>`(SELECT display_name FROM contract_types WHERE id = ${customers.contractTypeId})`,
        selectedModules: customers.selectedModules,
        activeContractsCount: sql<number>`(SELECT COUNT(*) FROM customer_contracts WHERE customer_id = ${customers.id} AND status = 'active')`,
        totalContractValue: sql<number>`(SELECT COALESCE(SUM(amount), 0) FROM customer_contracts WHERE customer_id = ${customers.id} AND status = 'active')`,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      }).from(customers);
      
      const results = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(customers.name)
        : await query.orderBy(customers.name);
      
      res.json(results);
    } catch (error) {
      console.error("Error fetching customer master:", error);
      res.status(500).json({ message: "Failed to fetch customer master" });
    }
  });

  // Update customer's contract type with audit logging
  app.patch("/api/accounts/customer-master/:customerId/contract-type", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { customerId } = req.params;
      const { contractTypeId, reason } = req.body;
      
      // Get current customer data
      const [currentCustomer] = await db.select().from(customers).where(eq(customers.id, customerId));
      if (!currentCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Get previous and new contract type names
      let previousTypeName: string | null = null;
      let newTypeName: string | null = null;
      
      if (currentCustomer.contractTypeId) {
        const [prevType] = await db.select({ displayName: contractTypes.displayName })
          .from(contractTypes)
          .where(eq(contractTypes.id, currentCustomer.contractTypeId));
        previousTypeName = prevType?.displayName || null;
      }
      
      if (contractTypeId) {
        const [newType] = await db.select({ displayName: contractTypes.displayName })
          .from(contractTypes)
          .where(eq(contractTypes.id, contractTypeId));
        newTypeName = newType?.displayName || null;
      }
      
      // Create audit log entry
      const userId = req.user?.claims?.sub || req.user?.id || "system";
      const userEmail = req.user?.claims?.email || req.user?.email || "unknown";
      const userName = req.user?.claims?.first_name && req.user?.claims?.last_name
        ? `${req.user.claims.first_name} ${req.user.claims.last_name}`
        : userEmail;
        
      await db.insert(contractTypeChangeLogs).values({
        customerId,
        previousContractTypeId: currentCustomer.contractTypeId,
        newContractTypeId: contractTypeId,
        previousContractTypeName: previousTypeName,
        newContractTypeName: newTypeName,
        reason: reason || null,
        changedBy: userId,
        changedByName: userName,
        changedByEmail: userEmail,
      });
      
      // Update customer contract type
      await db.update(customers)
        .set({ 
          contractTypeId,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
      
      // Log activity
      await storage.logActivity({
        entityType: "customer",
        entityId: customerId,
        action: "contract_type_changed",
        description: `Contract type changed from "${previousTypeName || 'None'}" to "${newTypeName || 'None'}"`,
        userId,
      });
      
      res.json({ 
        message: "Contract type updated successfully",
        previousType: previousTypeName,
        newType: newTypeName,
      });
    } catch (error) {
      console.error("Error updating customer contract type:", error);
      res.status(500).json({ message: "Failed to update contract type" });
    }
  });

  // Get contract type change history for a customer
  app.get("/api/accounts/customer-master/:customerId/contract-type-history", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { customerId } = req.params;
      
      const history = await db.select()
        .from(contractTypeChangeLogs)
        .where(eq(contractTypeChangeLogs.customerId, customerId))
        .orderBy(sql`${contractTypeChangeLogs.changedAt} DESC`);
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching contract type change history:", error);
      res.status(500).json({ message: "Failed to fetch change history" });
    }
  });

  // Get unique cities for filter dropdown
  app.get("/api/accounts/customer-master/cities", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { isNotNull } = await import('drizzle-orm');
      
      const cities = await db.selectDistinct({ city: customers.city })
        .from(customers)
        .where(isNotNull(customers.city))
        .orderBy(customers.city);
      
      res.json(cities.map(c => c.city).filter(Boolean));
    } catch (error) {
      console.error("Error fetching cities:", error);
      res.status(500).json({ message: "Failed to fetch cities" });
    }
  });

  // ================== CUSTOMER MODULE CONTRACTS ==================

  // Get all module contracts for a customer
  app.get("/api/accounts/customer-master/:customerId/module-contracts", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { customerId } = req.params;
      
      const contracts = await db.select({
        contract: customerModuleContracts,
        moduleName: sql<string>`COALESCE((SELECT name FROM modules WHERE id = ${customerModuleContracts.moduleId}), ${customerModuleContracts.moduleName})`,
      })
        .from(customerModuleContracts)
        .where(eq(customerModuleContracts.customerId, customerId))
        .orderBy(sql`${customerModuleContracts.contractEndDate} DESC`);
      
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching module contracts:", error);
      res.status(500).json({ message: "Failed to fetch module contracts" });
    }
  });

  // Create a new module contract for a customer
  app.post("/api/accounts/customer-master/:customerId/module-contracts", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      const { customerId } = req.params;
      const { 
        moduleId, moduleName, orderDate, orderValue, currency,
        amcCalculationType, amcPercentage, amcAmount,
        gstPercentage, contractStartDate, contractEndDate,
        renewalReminderDays, notes
      } = req.body;
      
      // Calculate GST amount and total
      const gstAmount = Math.round((amcAmount * (gstPercentage || 18)) / 100);
      const totalAmcWithGst = amcAmount + gstAmount;
      
      const userId = req.user?.claims?.sub || req.user?.id || "system";
      
      const [contract] = await db.insert(customerModuleContracts).values({
        customerId,
        moduleId: moduleId || null,
        moduleName,
        orderDate: new Date(orderDate),
        orderValue,
        currency: currency || "INR",
        amcCalculationType: amcCalculationType || "percentage",
        amcPercentage: amcPercentage || null,
        amcAmount,
        gstPercentage: gstPercentage || 18,
        gstAmount,
        totalAmcWithGst,
        contractStartDate: new Date(contractStartDate),
        contractEndDate: new Date(contractEndDate),
        renewalReminderDays: renewalReminderDays || 30,
        notes: notes || null,
        createdBy: userId,
      }).returning();
      
      // Log activity
      await storage.logActivity({
        entityType: "customer_module_contract",
        entityId: contract.id,
        action: "created",
        description: `Module contract created for ${moduleName}`,
        userId,
      });
      
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating module contract:", error);
      res.status(500).json({ message: "Failed to create module contract" });
    }
  });

  // Update a module contract
  app.patch("/api/accounts/module-contracts/:contractId", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { contractId } = req.params;
      const updates = req.body;
      
      // Recalculate GST if AMC amount changed
      if (updates.amcAmount !== undefined) {
        const gstPercentage = updates.gstPercentage || 18;
        updates.gstAmount = Math.round((updates.amcAmount * gstPercentage) / 100);
        updates.totalAmcWithGst = updates.amcAmount + updates.gstAmount;
      }
      
      // Convert date strings to Date objects
      if (updates.orderDate) updates.orderDate = new Date(updates.orderDate);
      if (updates.contractStartDate) updates.contractStartDate = new Date(updates.contractStartDate);
      if (updates.contractEndDate) updates.contractEndDate = new Date(updates.contractEndDate);
      
      updates.updatedAt = new Date();
      
      const [updated] = await db.update(customerModuleContracts)
        .set(updates)
        .where(eq(customerModuleContracts.id, contractId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Module contract not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating module contract:", error);
      res.status(500).json({ message: "Failed to update module contract" });
    }
  });

  // Delete a module contract
  app.delete("/api/accounts/module-contracts/:contractId", isAuthenticated, requirePermission("contracts", "delete"), async (req, res) => {
    try {
      const { contractId } = req.params;
      
      await db.delete(customerModuleContracts)
        .where(eq(customerModuleContracts.id, contractId));
      
      res.json({ message: "Module contract deleted successfully" });
    } catch (error) {
      console.error("Error deleting module contract:", error);
      res.status(500).json({ message: "Failed to delete module contract" });
    }
  });

  // Get expiring module contracts (for reminders)
  app.get("/api/accounts/module-contracts/expiring", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const { lte, gte } = await import('drizzle-orm');
      
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days as string));
      
      const expiring = await db.select({
        contract: customerModuleContracts,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerModuleContracts.customerId})`,
        customerEmail: sql<string>`(SELECT email FROM customers WHERE id = ${customerModuleContracts.customerId})`,
        customerPhone: sql<string>`(SELECT phone FROM customers WHERE id = ${customerModuleContracts.customerId})`,
      })
        .from(customerModuleContracts)
        .where(and(
          eq(customerModuleContracts.status, "active"),
          gte(customerModuleContracts.contractEndDate, now),
          lte(customerModuleContracts.contractEndDate, futureDate)
        ))
        .orderBy(customerModuleContracts.contractEndDate);
      
      res.json(expiring);
    } catch (error) {
      console.error("Error fetching expiring module contracts:", error);
      res.status(500).json({ message: "Failed to fetch expiring contracts" });
    }
  });

  // Get available modules for dropdown
  app.get("/api/accounts/available-modules", isAuthenticated, async (req, res) => {
    try {
      const availableModules = await db.select().from(modules).orderBy(modules.name);
      res.json(availableModules);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // Send module contract renewal reminder email
  app.post("/api/accounts/module-contracts/:contractId/send-reminder", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { contractId } = req.params;
      
      const [contractData] = await db.select({
        contract: customerModuleContracts,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerModuleContracts.customerId})`,
        customerEmail: sql<string>`(SELECT email FROM customers WHERE id = ${customerModuleContracts.customerId})`,
        moduleName: sql<string>`(SELECT name FROM modules WHERE id = ${customerModuleContracts.moduleId})`,
      })
        .from(customerModuleContracts)
        .where(eq(customerModuleContracts.id, contractId));
      
      if (!contractData) {
        return res.status(404).json({ message: "Module contract not found" });
      }
      
      if (!contractData.customerEmail) {
        return res.status(400).json({ message: "Customer email not available" });
      }
      
      const { contract, customerName, customerEmail, moduleName } = contractData;
      const endDate = new Date(contract.contractEndDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      const amcAmount = contract.amcCalculationType === 'percentage' 
        ? (contract.orderValue * (contract.amcPercentage || 0) / 100)
        : (contract.amcAmount || 0);
      const gstAmount = amcAmount * ((contract.gstPercentage || 18) / 100);
      const totalAmount = amcAmount + gstAmount;
      
      // Send email
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: "M-CRM <noreply@microgenn.com>",
        to: customerEmail,
        subject: `Module Contract Renewal Reminder - ${moduleName || contract.moduleName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a2b6d;">Contract Renewal Reminder</h2>
            <p>Dear ${customerName || 'Customer'},</p>
            <p>This is a reminder that your <strong>${moduleName || contract.moduleName}</strong> module contract is approaching renewal.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Module:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${moduleName || contract.moduleName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract End Date:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${endDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Until Expiry:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${daysUntilExpiry} days</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>AMC Amount:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">INR ${amcAmount.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>GST (${contract.gstPercentage || 18}%):</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">INR ${gstAmount.toLocaleString()}</td>
              </tr>
              <tr style="background-color: #f5f5f5;">
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>INR ${totalAmount.toLocaleString()}</strong></td>
              </tr>
            </table>
            
            <p>Please contact us to renew your contract and ensure uninterrupted service.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is a reminder from M-CRM.
            </p>
          </div>
        `,
      });
      
      // Update contract
      await db.update(customerModuleContracts)
        .set({ lastReminderSentAt: new Date() })
        .where(eq(customerModuleContracts.id, contractId));
      
      // Log activity
      await db.insert(activityLog).values({
        entityType: "module_contract",
        entityId: contractId,
        action: "renewal_reminder_sent",
        description: `Renewal reminder sent for ${moduleName || contract.moduleName} to ${customerEmail}`,
        userId: req.user?.claims?.sub,
      });
      
      res.json({ message: "Renewal reminder sent successfully" });
    } catch (error) {
      console.error("Error sending module contract reminder:", error);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // Trigger module contract reminder check manually (admin only)
  app.post("/api/accounts/module-contracts/trigger-reminders", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { triggerModuleContractReminderCheck } = await import("./moduleContractReminderScheduler");
      await triggerModuleContractReminderCheck();
      res.json({ message: "Module contract reminder check triggered" });
    } catch (error) {
      console.error("Error triggering reminder check:", error);
      res.status(500).json({ message: "Failed to trigger reminder check" });
    }
  });

  // ================== MONTHLY PAYMENT REMINDERS ==================

  // Get monthly payment reminders for current month
  app.get("/api/accounts/monthly-reminders", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const { month, year, status } = req.query;
      const { and, gte, lte } = await import('drizzle-orm');
      
      const currentDate = new Date();
      const targetMonth = month ? parseInt(month as string) : currentDate.getMonth() + 1;
      const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();
      
      const conditions: any[] = [
        eq(monthlyPaymentReminders.reminderMonth, targetMonth),
        eq(monthlyPaymentReminders.reminderYear, targetYear),
      ];
      
      if (status) {
        conditions.push(eq(monthlyPaymentReminders.status, status as string));
      }
      
      const reminders = await db.select({
        reminder: monthlyPaymentReminders,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        customerCity: sql<string>`(SELECT city FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        customerEmail: sql<string>`(SELECT email FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        customerPhone: sql<string>`(SELECT phone FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        contractNumber: sql<string>`(SELECT contract_number FROM customer_contracts WHERE id = ${monthlyPaymentReminders.contractId})`,
        contractTypeName: sql<string>`(SELECT ct.display_name FROM contract_types ct JOIN customer_contracts cc ON cc.contract_type_id = ct.id WHERE cc.id = ${monthlyPaymentReminders.contractId})`,
      })
        .from(monthlyPaymentReminders)
        .where(and(...conditions))
        .orderBy(monthlyPaymentReminders.dueDate);
      
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching monthly reminders:", error);
      res.status(500).json({ message: "Failed to fetch monthly reminders" });
    }
  });

  // Generate monthly reminders for contracts (based on billing cycle day)
  app.post("/api/accounts/monthly-reminders/generate", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { month, year } = req.body;
      
      const targetMonth = month || new Date().getMonth() + 1;
      const targetYear = year || new Date().getFullYear();
      
      // Get all active contracts with monthly billing
      const activeContracts = await db.select({
        contract: customerContracts,
        billingFrequency: sql<string>`(SELECT billing_frequency FROM contract_types WHERE id = ${customerContracts.contractTypeId})`,
      })
        .from(customerContracts)
        .where(eq(customerContracts.status, 'active'));
      
      let created = 0;
      let skipped = 0;
      
      for (const { contract, billingFrequency } of activeContracts) {
        // Only create reminders for monthly billing contracts
        if (billingFrequency !== 'monthly') {
          skipped++;
          continue;
        }
        
        // Check if reminder already exists for this month
        const existing = await db.select()
          .from(monthlyPaymentReminders)
          .where(and(
            eq(monthlyPaymentReminders.contractId, contract.id),
            eq(monthlyPaymentReminders.reminderMonth, targetMonth),
            eq(monthlyPaymentReminders.reminderYear, targetYear),
          ));
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        
        // Create reminder
        const billingDay = contract.billingCycleDay || 1;
        const dueDate = new Date(targetYear, targetMonth - 1, billingDay);
        
        await db.insert(monthlyPaymentReminders).values({
          customerId: contract.customerId,
          contractId: contract.id,
          reminderMonth: targetMonth,
          reminderYear: targetYear,
          dueDate,
          amount: contract.amount,
          status: 'pending',
        });
        
        created++;
      }
      
      res.json({ 
        message: `Generated ${created} reminders, skipped ${skipped}`,
        created,
        skipped,
      });
    } catch (error) {
      console.error("Error generating monthly reminders:", error);
      res.status(500).json({ message: "Failed to generate reminders" });
    }
  });

  // Update payment reminder status
  app.patch("/api/accounts/monthly-reminders/:id", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentAmount, paymentDate, paymentReference, notes, status } = req.body;
      
      const updates: any = {
        updatedAt: new Date(),
      };
      
      if (paymentStatus) updates.paymentStatus = paymentStatus;
      if (paymentAmount !== undefined) updates.paymentAmount = paymentAmount;
      if (paymentDate) updates.paymentDate = new Date(paymentDate);
      if (paymentReference) updates.paymentReference = paymentReference;
      if (notes) updates.notes = notes;
      if (status) updates.status = status;
      
      // Mark as followed up
      updates.followedUpBy = req.user?.id;
      updates.followedUpAt = new Date();
      
      await db.update(monthlyPaymentReminders)
        .set(updates)
        .where(eq(monthlyPaymentReminders.id, id));
      
      res.json({ message: "Reminder updated successfully" });
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // Send payment reminder email
  app.post("/api/accounts/monthly-reminders/:id/send-email", isAuthenticated, requirePermission("contracts", "edit"), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const [reminderData] = await db.select({
        reminder: monthlyPaymentReminders,
        customerName: sql<string>`(SELECT name FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        customerEmail: sql<string>`(SELECT email FROM customers WHERE id = ${monthlyPaymentReminders.customerId})`,
        contractNumber: sql<string>`(SELECT contract_number FROM customer_contracts WHERE id = ${monthlyPaymentReminders.contractId})`,
        contractTypeName: sql<string>`(SELECT ct.display_name FROM contract_types ct JOIN customer_contracts cc ON cc.contract_type_id = ct.id WHERE cc.id = ${monthlyPaymentReminders.contractId})`,
      })
        .from(monthlyPaymentReminders)
        .where(eq(monthlyPaymentReminders.id, id));
      
      if (!reminderData) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      
      if (!reminderData.customerEmail) {
        return res.status(400).json({ message: "Customer email not found" });
      }
      
      const { reminder, customerName, customerEmail, contractNumber, contractTypeName } = reminderData;
      
      const dueDate = new Date(reminder.dueDate);
      const monthName = dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      const emailHtml = `
        <h2>Payment Reminder - ${monthName}</h2>
        <p>Dear ${customerName},</p>
        <p>This is a friendly reminder for your pending payment.</p>
        <br/>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${contractNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract Type:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${contractTypeName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount Due:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">INR ${(reminder.amount || 0).toLocaleString()}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dueDate.toLocaleDateString()}</td></tr>
        </table>
        <br/>
        <p>Please make the payment at your earliest convenience.</p>
        <p>If you have already made the payment, please ignore this reminder.</p>
        <br/>
        <p>Best Regards,<br/>M-CRM Accounts Team</p>
      `;
      
      await sendEmail({
        to: customerEmail,
        subject: `Payment Reminder - ${contractNumber} - ${monthName}`,
        html: emailHtml,
      });
      
      // Update reminder
      await db.update(monthlyPaymentReminders)
        .set({
          emailSent: true,
          emailSentAt: new Date(),
          status: 'reminded',
          updatedAt: new Date(),
        })
        .where(eq(monthlyPaymentReminders.id, id));
      
      res.json({ message: "Payment reminder sent successfully" });
    } catch (error) {
      console.error("Error sending payment reminder:", error);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // ================== HR FEEDBACK MANAGEMENT ==================

  // Get HR Feedback stats - summary of closed tickets feedback status
  // HR Feedback grants full access to all users with hr_feedback permission (no department filtering)
  // Optimized: Uses database-level aggregation for better performance
  app.get("/api/hr/feedback/stats", isAuthenticated, requirePermission('hr_feedback', 'view'), async (req: any, res) => {
    try {
      const cached = getCached<any>("hr:feedback:stats");
      if (cached) return res.json(cached);

      // Use EXISTS/NOT EXISTS instead of IN/NOT IN — far faster on large tables
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'open') as "totalOpen",
          COUNT(*) FILTER (WHERE status = 'in_progress') as "totalInProgress",
          COUNT(*) FILTER (WHERE status = 'pending_customer') as "totalPendingCustomer",
          COUNT(*) FILTER (WHERE status = 'escalated') as "totalEscalated",
          COUNT(*) FILTER (WHERE status = 'closed') as "totalClosed",
          COUNT(*) FILTER (WHERE status = 'resolved') as "totalResolved",
          COUNT(*) FILTER (WHERE status = 'closed' AND EXISTS (SELECT 1 FROM feedback WHERE feedback.ticket_id = tickets.id)) as "closedWithFeedback",
          COUNT(*) FILTER (WHERE status = 'closed' AND NOT EXISTS (SELECT 1 FROM feedback WHERE feedback.ticket_id = tickets.id)) as "closedWithoutFeedback"
        FROM tickets
      `);
      
      const row = result.rows[0] as any || {};
      const stats = {
        totalOpen: Number(row.totalOpen) || 0,
        totalInProgress: Number(row.totalInProgress) || 0,
        totalPendingCustomer: Number(row.totalPendingCustomer) || 0,
        totalEscalated: Number(row.totalEscalated) || 0,
        totalClosed: Number(row.totalClosed) || 0,
        totalResolved: Number(row.totalResolved) || 0,
        closedWithFeedback: Number(row.closedWithFeedback) || 0,
        closedWithoutFeedback: Number(row.closedWithoutFeedback) || 0,
      };

      setCached("hr:feedback:stats", stats, 300);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching HR feedback stats:", error);
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  // Get closed tickets without feedback for HR follow-up
  // HR Feedback grants full access to all users with hr_feedback permission (no department filtering)
  // The purpose is for HR to call ALL customers regardless of which engineer handled the ticket
  // Supports pagination with page/limit query params
  app.get("/api/hr/feedback/pending", isAuthenticated, requirePermission('hr_feedback', 'view'), async (req: any, res) => {
    try {
      const { search, dateFrom, dateTo, priority, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Base conditions (LEFT JOIN feedback + WHERE feedback.ticket_id IS NULL is much faster than NOT IN subquery)
      const baseConditions: any[] = [
        eq(tickets.status, 'closed'),
        isNotNull(tickets.closedAt),
        sql`${feedback.ticketId} IS NULL`,  // anti-join via LEFT JOIN
      ];

      if (dateFrom) baseConditions.push(gte(tickets.closedAt, new Date(dateFrom as string)));
      if (dateTo) {
        const to = new Date(dateTo as string);
        to.setDate(to.getDate() + 1);
        baseConditions.push(lte(tickets.closedAt, to));
      }
      if (priority && priority !== 'all') baseConditions.push(eq(tickets.priority, priority as string));
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        baseConditions.push(or(
          sql`LOWER(${tickets.ticketNumber}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.customerName}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.issueSummary}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.customerPhone}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.customerEmail}) LIKE ${searchLower}`,
        ));
      }

      const whereClause = and(...baseConditions);

      // Count query (also uses LEFT JOIN anti-join pattern)
      const countResult = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(tickets)
        .leftJoin(feedback, eq(feedback.ticketId, tickets.id))
        .where(whereClause);

      const totalCount = countResult[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limitNum);

      // Data query — JOIN users once instead of 2 correlated subqueries per row
      const pendingTickets = await db.select({
        id:                   tickets.id,
        ticketNumber:         tickets.ticketNumber,
        customerName:         tickets.customerName,
        customerEmail:        tickets.customerEmail,
        customerPhone:        tickets.customerPhone,
        issueSummary:         tickets.issueSummary,
        issueDescription:     tickets.issueDescription,
        priority:             tickets.priority,
        status:               tickets.status,
        createdAt:            tickets.createdAt,
        closedAt:             tickets.closedAt,
        closingNotes:         tickets.closingNotes,
        resolvedAt:           tickets.resolvedAt,
        escalationLevel:      tickets.escalationLevel,
        assignedEngineerId:   tickets.assignedEngineerId,
        assignedEngineerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        assignedEngineerEmail: users.email,
        daysSinceClosed:      sql<number>`EXTRACT(DAY FROM NOW() - ${tickets.closedAt})::int`,
      })
        .from(tickets)
        .leftJoin(feedback, eq(feedback.ticketId, tickets.id))
        .leftJoin(users, eq(users.id, tickets.assignedEngineerId))
        .where(whereClause)
        .orderBy(desc(tickets.closedAt))
        .limit(limitNum)
        .offset(offset);

      res.json({
        data: pendingTickets,
        pagination: { page: pageNum, limit: limitNum, totalCount, totalPages, hasMore: pageNum < totalPages },
      });
    } catch (error) {
      console.error("Error fetching pending feedback tickets:", error);
      res.status(500).json({ message: "Failed to fetch pending feedback tickets" });
    }
  });

  // Get closed tickets WITH feedback (for comparison/tracking)
  // Shows ALL tickets with feedback regardless of userId - for HR to review all completed calls
  app.get("/api/hr/feedback/completed", isAuthenticated, requirePermission('hr_feedback', 'view'), async (req: any, res) => {
    try {
      const { search, dateFrom, dateTo } = req.query;
      const isUnfiltered = !search && !dateFrom && !dateTo;

      if (isUnfiltered) {
        const cached = getCached<any>("hr:feedback:completed");
        if (cached) return res.json(cached);
      }

      // INNER JOIN feedback (replaces IN subquery) — tickets without feedback are excluded automatically
      // JOIN users once (replaces correlated engineer name subquery)
      // All 8 feedback field correlated subqueries eliminated — read directly from the JOIN
      const conditions: any[] = [
        eq(tickets.status, 'closed'),
        isNotNull(tickets.closedAt),
      ];

      if (dateFrom) conditions.push(gte(tickets.closedAt, new Date(dateFrom as string)));
      if (dateTo) {
        const to = new Date(dateTo as string);
        to.setDate(to.getDate() + 1);
        conditions.push(lte(tickets.closedAt, to));
      }
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        conditions.push(or(
          sql`LOWER(${tickets.ticketNumber}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.customerName}) LIKE ${searchLower}`,
          sql`LOWER(${tickets.issueSummary}) LIKE ${searchLower}`,
        ));
      }

      const completedTickets = await db.select({
        id:                   tickets.id,
        ticketNumber:         tickets.ticketNumber,
        customerName:         tickets.customerName,
        customerEmail:        tickets.customerEmail,
        customerPhone:        tickets.customerPhone,
        issueSummary:         tickets.issueSummary,
        priority:             tickets.priority,
        closedAt:             tickets.closedAt,
        closingNotes:         tickets.closingNotes,
        assignedEngineerId:   tickets.assignedEngineerId,
        assignedEngineerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        feedbackRating:       feedback.rating,
        feedbackComments:     feedback.comments,
        feedbackSatisfied:    feedback.satisfied,
        feedbackSubmittedAt:  feedback.submittedAt,
        workStatus:           feedback.workStatus,
        workDescription:      feedback.workDescription,
        clientContactPerson:  feedback.clientContactPerson,
        clientContactPhone:   feedback.clientContactPhone,
        completedAt:          feedback.completedAt,
      })
        .from(tickets)
        .innerJoin(feedback, eq(feedback.ticketId, tickets.id))
        .leftJoin(users, eq(users.id, tickets.assignedEngineerId))
        .where(and(...conditions))
        .orderBy(desc(tickets.closedAt))
        .limit(100);

      if (isUnfiltered) setCached("hr:feedback:completed", completedTickets, 300);
      res.json(completedTickets);
    } catch (error) {
      console.error("Error fetching completed feedback tickets:", error);
      res.status(500).json({ message: "Failed to fetch completed feedback tickets" });
    }
  });

  // Submit feedback for a ticket (HR permission required)
  app.post("/api/hr/feedback/submit", isAuthenticated, requirePermission("hr_feedback", "edit"), async (req, res) => {
    try {
      const { z } = await import('zod');
      
      // Zod schema for feedback submission
      const feedbackSchema = z.object({
        ticketId: z.string().min(1, "Ticket ID is required"),
        rating: z.number().min(1).max(5).nullable().optional(),
        comments: z.string().nullable().optional(),
        satisfied: z.boolean().nullable().optional(),
      }).refine(data => {
        // Require at least rating or satisfaction to be provided
        return (data.rating !== null && data.rating !== undefined) || 
               (data.satisfied !== null && data.satisfied !== undefined);
      }, {
        message: "Either rating or satisfaction must be provided"
      });
      
      const validationResult = feedbackSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: validationResult.error.errors[0]?.message || "Validation failed" 
        });
      }
      
      const { ticketId, rating, comments, satisfied } = validationResult.data;
      const userId = (req.user as any)?.id;
      
      // Check if feedback already exists for this ticket
      const existingFeedback = await db.select()
        .from(feedback)
        .where(eq(feedback.ticketId, ticketId))
        .limit(1);
      
      if (existingFeedback.length > 0) {
        return res.status(400).json({ message: "Feedback already submitted for this ticket" });
      }
      
      // Insert feedback
      const [newFeedback] = await db.insert(feedback)
        .values({
          ticketId,
          rating: rating || null,
          comments: comments || null,
          satisfied: satisfied !== undefined ? satisfied : null,
        })
        .returning();
      
      // Log activity
      await db.insert(activityLog).values({
        entityType: 'ticket',
        entityId: ticketId,
        action: 'feedback_submitted',
        description: `Customer feedback submitted: ${rating ? rating + ' stars' : 'No rating'}, ${satisfied ? 'Satisfied' : satisfied === false ? 'Not satisfied' : 'Unknown'}`,
        userId: userId,
        metadata: { rating, satisfied, comments: comments?.substring(0, 100) },
      });
      
      invalidateCache("hr:feedback:");
      res.json({ success: true, feedback: newFeedback, message: "Feedback submitted successfully" });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });
  
  // Reopen a closed ticket (HR permission required)
  app.post("/api/hr/feedback/reopen", isAuthenticated, requirePermission("hr_feedback", "edit"), async (req, res) => {
    try {
      const { z } = await import('zod');
      
      // Zod schema for reopen request
      const reopenSchema = z.object({
        ticketId: z.string().min(1, "Ticket ID is required"),
        reason: z.string().min(1, "Reason for reopening is required").max(1000, "Reason is too long"),
      });
      
      const validationResult = reopenSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: validationResult.error.errors[0]?.message || "Validation failed" 
        });
      }
      
      const { ticketId, reason } = validationResult.data;
      const userId = (req.user as any)?.id;
      
      // Get the ticket
      const [ticket] = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
        return res.status(400).json({ message: "Only closed or resolved tickets can be reopened" });
      }
      
      // Update ticket status to 'reopened'
      const [updatedTicket] = await db.update(tickets)
        .set({
          status: 'reopened',
          resolvedAt: null,
          closedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId))
        .returning();
      
      // Add a comment entry for the reopen reason
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        userId: userId || null,
        comment: `Ticket reopened by HR. Reason: ${reason}`,
        isInternal: false,
      });
      
      // Log activity
      await db.insert(activityLog).values({
        entityType: 'ticket',
        entityId: ticketId,
        action: 'ticket_reopened',
        description: `Ticket ${ticket.ticketNumber} reopened. Reason: ${reason}`,
        userId: userId,
        metadata: { reason, previousStatus: ticket.status },
      });
      
      invalidateCache("hr:feedback:");
      res.json({ success: true, ticket: updatedTicket, message: "Ticket reopened successfully" });
    } catch (error) {
      console.error("Error reopening ticket:", error);
      res.status(500).json({ message: "Failed to reopen ticket" });
    }
  });

  // ================== DEPARTMENT TASKS ==================

  // Get tasks for a specific department (HR or Accounts) with follow-up info
  app.get("/api/hr/department-tasks", isAuthenticated, requirePermission("hr_feedback", "view"), async (req: any, res) => {
    try {
      const { department, status, search } = req.query;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Validate department (only HR and Accounts are allowed)
      const validDepartments = ['hr', 'accounts'];
      if (department && !validDepartments.includes(department as string)) {
        return res.status(400).json({ message: "Invalid department. Only 'hr' or 'accounts' allowed." });
      }
      
      // Get users in the target department(s)
      let departmentFilter: string[] = [];
      if (department) {
        departmentFilter = [department as string];
      } else {
        departmentFilter = validDepartments; // Both HR and Accounts
      }
      
      // Get all users who belong to HR or Accounts departments (by departmentId)
      // First get department IDs for HR and Accounts
      const departments = await storage.getDepartments();
      const targetDepts = departments.filter(d => 
        departmentFilter.some(df => d.name.toLowerCase().includes(df.toLowerCase()))
      );
      const targetDeptIds = targetDepts.map(d => d.id);
      
      if (targetDeptIds.length === 0) {
        return res.json({ tasks: [], stats: { pending: 0, followup: 0, completed: 0, overdue: 0 } });
      }
      
      const departmentUsers = await db.select({ id: users.id })
        .from(users)
        .where(inArray(users.departmentId, targetDeptIds));
      
      const departmentUserIds = departmentUsers.map(u => u.id);
      
      if (departmentUserIds.length === 0) {
        return res.json({ tasks: [], stats: { pending: 0, followup: 0, completed: 0, overdue: 0 } });
      }
      
      // Build conditions
      const conditions: any[] = [
        inArray(tasks.assignedTo, departmentUserIds)
      ];
      
      // Status filter
      if (status && status !== 'all') {
        conditions.push(eq(tasks.status, status as string));
      } else {
        // By default, exclude completed tasks
        conditions.push(sql`${tasks.status} != 'completed'`);
      }
      
      // Search filter
      if (search) {
        conditions.push(
          or(
            ilike(tasks.title, `%${search}%`),
            ilike(tasks.description, `%${search}%`)
          )
        );
      }
      
      // Get tasks with assignee info
      const departmentTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        createdBy: tasks.createdBy,
        assignedTo: tasks.assignedTo,
        assignedAt: tasks.assignedAt,
        reminderDate: tasks.reminderDate,
        dueDate: tasks.dueDate,
        relatedEntityType: tasks.relatedEntityType,
        relatedEntityId: tasks.relatedEntityId,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        assigneeDepartmentId: users.departmentId,
      })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt));
      
      // Get latest followup date for each task
      const taskIds = departmentTasks.map(t => t.id);
      
      let followupsMap: Record<string, { nextFollowupDate: Date | null; lastFollowupDate: Date | null }> = {};
      
      if (taskIds.length > 0) {
        const latestFollowups = await db.select({
          taskId: taskFollowups.taskId,
          nextFollowupDate: sql<Date>`MAX(${taskFollowups.nextFollowupDate})`,
          lastFollowupDate: sql<Date>`MAX(${taskFollowups.createdAt})`,
        })
          .from(taskFollowups)
          .where(inArray(taskFollowups.taskId, taskIds))
          .groupBy(taskFollowups.taskId);
        
        followupsMap = latestFollowups.reduce((acc, f) => {
          acc[f.taskId] = { nextFollowupDate: f.nextFollowupDate, lastFollowupDate: f.lastFollowupDate };
          return acc;
        }, {} as Record<string, { nextFollowupDate: Date | null; lastFollowupDate: Date | null }>);
      }
      
      // Combine tasks with followup info
      const tasksWithFollowups = departmentTasks.map(task => ({
        ...task,
        nextFollowupDate: followupsMap[task.id]?.nextFollowupDate || null,
        lastFollowupDate: followupsMap[task.id]?.lastFollowupDate || null,
        isOverdue: task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'completed' : false,
        isFollowupDue: followupsMap[task.id]?.nextFollowupDate 
          ? new Date(followupsMap[task.id].nextFollowupDate!) <= new Date() 
          : false,
      }));
      
      // Calculate stats
      const now = new Date();
      const stats = {
        pending: tasksWithFollowups.filter(t => t.status === 'pending').length,
        followup: tasksWithFollowups.filter(t => t.status === 'followup').length,
        completed: departmentTasks.filter(t => t.status === 'completed').length,
        overdue: tasksWithFollowups.filter(t => t.isOverdue || t.isFollowupDue).length,
      };
      
      res.json({ tasks: tasksWithFollowups, stats });
    } catch (error) {
      console.error("Error fetching department tasks:", error);
      res.status(500).json({ message: "Failed to fetch department tasks" });
    }
  });

  // Add follow-up to a department task
  app.post("/api/hr/department-tasks/:taskId/followup", isAuthenticated, requirePermission("hr_feedback", "edit"), async (req: any, res) => {
    try {
      const { z } = await import('zod');
      
      const followupSchema = z.object({
        description: z.string().min(1, "Follow-up description is required").max(2000),
        nextFollowupDate: z.string().nullable().optional(),
      });
      
      const validationResult = followupSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: validationResult.error.errors[0]?.message || "Validation failed" 
        });
      }
      
      const { description, nextFollowupDate } = validationResult.data;
      const userId = req.user.claims.sub;
      const taskId = req.params.taskId;
      
      // Verify task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Create followup
      const followupData = {
        taskId,
        userId,
        followupType: 'text',
        description,
        nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
        status: nextFollowupDate ? 'pending_next' : 'completed',
      };
      
      const newFollowup = await storage.createTaskFollowup(followupData);
      
      // Update task status based on followup
      if (nextFollowupDate) {
        await storage.updateTask(taskId, { status: 'followup' });
      }
      
      // Log activity
      await db.insert(activityLog).values({
        entityType: 'task',
        entityId: taskId,
        action: 'followup_added',
        description: `Follow-up added by HR to task: ${task.title}`,
        userId,
      });
      
      res.json(newFollowup);
    } catch (error) {
      console.error("Error creating task followup:", error);
      res.status(500).json({ message: "Failed to create task followup" });
    }
  });

  // Mark department task as complete
  app.patch("/api/hr/department-tasks/:taskId/complete", isAuthenticated, requirePermission("hr_feedback", "edit"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.taskId;
      
      // Verify task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Update task to completed (storage automatically sets completedAt)
      const updatedTask = await storage.updateTask(taskId, { 
        status: 'completed'
      });
      
      // Log activity
      await db.insert(activityLog).values({
        entityType: 'task',
        entityId: taskId,
        action: 'task_completed',
        description: `Task marked as complete by HR: ${task.title}`,
        userId,
      });
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Get task followup history
  app.get("/api/hr/department-tasks/:taskId/followups", isAuthenticated, requirePermission("hr_feedback", "view"), async (req, res) => {
    try {
      const taskId = req.params.taskId;
      
      // Verify task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Get followups with user info
      const followups = await db.select({
        id: taskFollowups.id,
        taskId: taskFollowups.taskId,
        userId: taskFollowups.userId,
        followupType: taskFollowups.followupType,
        description: taskFollowups.description,
        nextFollowupDate: taskFollowups.nextFollowupDate,
        status: taskFollowups.status,
        createdAt: taskFollowups.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
        .from(taskFollowups)
        .leftJoin(users, eq(taskFollowups.userId, users.id))
        .where(eq(taskFollowups.taskId, taskId))
        .orderBy(desc(taskFollowups.createdAt));
      
      res.json(followups);
    } catch (error) {
      console.error("Error fetching task followups:", error);
      res.status(500).json({ message: "Failed to fetch task followups" });
    }
  });

  // ================== FREQUENT CALLER ANALYSIS ==================

  // Get frequent callers analysis with time period filtering
  app.get("/api/analytics/frequent-callers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { year, month, fromDate, toDate } = req.query;
      const { gte, and, lte } = await import('drizzle-orm');
      
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      
      // Priority: fromDate/toDate > month > year (only if both dates are provided and valid)
      if (fromDate && toDate) {
        // Parse dates in UTC to avoid timezone issues
        const from = new Date(fromDate as string + 'T00:00:00.000Z');
        const to = new Date(toDate as string + 'T00:00:00.000Z');
        
        // Validate date range
        if (from > to) {
          return res.status(400).json({ message: "From date must be before To date" });
        }
        
        startDate = from;
        endDate = new Date(to.getTime() + 24 * 60 * 60 * 1000); // Include end date
      } else if (month && year) {
        const yearNum = parseInt(year as string);
        const monthNum = parseInt(month as string);
        startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
        endDate = new Date(Date.UTC(yearNum, monthNum, 1));
      } else if (year) {
        const yearNum = parseInt(year as string);
        startDate = new Date(Date.UTC(yearNum, 0, 1));
        endDate = new Date(Date.UTC(yearNum + 1, 0, 1));
      } else {
        // Default to current month (UTC)
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
      }

      // Date range filter condition
      const dateFilter = and(
        gte(tickets.createdAt, startDate),
        sql`${tickets.createdAt} < ${endDate}`
      );

      // Get frequent callers by customer
      const frequentCallers = await db.select({
        customerId: tickets.customerId,
        customerName: tickets.customerName,
        callCount: sql<number>`COUNT(*)::int`,
        criticalCount: sql<number>`SUM(CASE WHEN ${tickets.priority} = 'critical' THEN 1 ELSE 0 END)::int`,
        highCount: sql<number>`SUM(CASE WHEN ${tickets.priority} = 'high' THEN 1 ELSE 0 END)::int`,
        resolvedCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)::int`,
        openCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('open', 'in_progress', 'pending_customer') THEN 1 ELSE 0 END)::int`,
        avgResolutionDays: sql<number>`ROUND(AVG(CASE WHEN ${tickets.resolvedAt} IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 86400 
          ELSE NULL END)::numeric, 1)`,
        lastCallDate: sql<string>`MAX(${tickets.createdAt})::text`,
      })
        .from(tickets)
        .where(dateFilter)
        .groupBy(tickets.customerId, tickets.customerName)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(20);

      // Get total calls in period
      const [totalStats] = await db.select({
        totalCalls: sql<number>`COUNT(*)::int`,
        uniqueCustomers: sql<number>`COUNT(DISTINCT ${tickets.customerId})::int`,
        criticalCalls: sql<number>`SUM(CASE WHEN ${tickets.priority} = 'critical' THEN 1 ELSE 0 END)::int`,
        resolvedCalls: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)::int`,
      })
        .from(tickets)
        .where(dateFilter);

      // Get employee call handling stats
      const employeeStats = await db.select({
        employeeId: tickets.assignedEngineerId,
        employeeName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${tickets.assignedEngineerId})`,
        employeeEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.assignedEngineerId})`,
        callsHandled: sql<number>`COUNT(*)::int`,
        resolvedCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)::int`,
        criticalHandled: sql<number>`SUM(CASE WHEN ${tickets.priority} = 'critical' THEN 1 ELSE 0 END)::int`,
        avgResolutionDays: sql<number>`ROUND(AVG(CASE WHEN ${tickets.resolvedAt} IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 86400 
          ELSE NULL END)::numeric, 1)`,
      })
        .from(tickets)
        .where(and(
          dateFilter,
          sql`${tickets.assignedEngineerId} IS NOT NULL`
        ))
        .groupBy(tickets.assignedEngineerId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10);

      // Get calls by day for chart within the selected period
      const dailyTrend = await db.select({
        date: sql<string>`DATE(${tickets.createdAt})::text`,
        callCount: sql<number>`COUNT(*)::int`,
        resolvedCount: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)::int`,
      })
        .from(tickets)
        .where(dateFilter)
        .groupBy(sql`DATE(${tickets.createdAt})`)
        .orderBy(sql`DATE(${tickets.createdAt})`);

      // Get priority distribution
      const priorityDistribution = await db.select({
        priority: tickets.priority,
        count: sql<number>`COUNT(*)::int`,
      })
        .from(tickets)
        .where(dateFilter)
        .groupBy(tickets.priority);

      res.json({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: totalStats || { totalCalls: 0, uniqueCustomers: 0, criticalCalls: 0, resolvedCalls: 0 },
        frequentCallers,
        employeeStats,
        dailyTrend,
        priorityDistribution,
      });
    } catch (error) {
      console.error("Error fetching frequent callers:", error);
      res.status(500).json({ message: "Failed to fetch frequent callers analysis" });
    }
  });

  // Get detailed call history for a specific customer
  app.get("/api/analytics/customer-calls/:customerId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { customerId } = req.params;
      const { year, month, fromDate, toDate } = req.query;
      const { gte, and } = await import('drizzle-orm');
      
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      
      // Priority: fromDate/toDate > month > year (only if both dates are provided and valid)
      if (fromDate && toDate) {
        // Parse dates in UTC to avoid timezone issues
        const from = new Date(fromDate as string + 'T00:00:00.000Z');
        const to = new Date(toDate as string + 'T00:00:00.000Z');
        
        // Validate date range
        if (from > to) {
          return res.status(400).json({ message: "From date must be before To date" });
        }
        
        startDate = from;
        endDate = new Date(to.getTime() + 24 * 60 * 60 * 1000); // Include end date
      } else if (month && year) {
        const yearNum = parseInt(year as string);
        const monthNum = parseInt(month as string);
        startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
        endDate = new Date(Date.UTC(yearNum, monthNum, 1));
      } else if (year) {
        const yearNum = parseInt(year as string);
        startDate = new Date(Date.UTC(yearNum, 0, 1));
        endDate = new Date(Date.UTC(yearNum + 1, 0, 1));
      } else {
        // Default to current month (UTC)
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
      }

      const dateFilter = and(
        gte(tickets.createdAt, startDate),
        sql`${tickets.createdAt} < ${endDate}`
      );

      const customerCalls = await db.select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        issueSummary: tickets.issueSummary,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        assignedEngineerName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${tickets.assignedEngineerId})`,
        moduleName: sql<string>`(SELECT name FROM modules WHERE id = ${tickets.moduleId})`,
      })
        .from(tickets)
        .where(and(
          eq(tickets.customerId, customerId),
          dateFilter
        ))
        .orderBy(sql`${tickets.createdAt} DESC`);

      // Get customer summary
      const [customerSummary] = await db.select({
        customerName: tickets.customerName,
        totalCalls: sql<number>`COUNT(*)::int`,
        resolvedCalls: sql<number>`SUM(CASE WHEN ${tickets.status} IN ('resolved', 'closed') THEN 1 ELSE 0 END)::int`,
        avgResolutionDays: sql<number>`ROUND(AVG(CASE WHEN ${tickets.resolvedAt} IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 86400 
          ELSE NULL END)::numeric, 1)`,
      })
        .from(tickets)
        .where(and(eq(tickets.customerId, customerId), dateFilter))
        .groupBy(tickets.customerName);

      res.json({
        customerId,
        customerSummary: customerSummary || { customerName: 'Unknown', totalCalls: 0, resolvedCalls: 0 },
        calls: customerCalls,
      });
    } catch (error) {
      console.error("Error fetching customer calls:", error);
      res.status(500).json({ message: "Failed to fetch customer call history" });
    }
  });

  // Get tickets for a specific period (week) in Support tab drill-down
  app.get("/api/analytics/support-period-tickets", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { year, month, period } = req.query;
      const { gte, and } = await import('drizzle-orm');
      const yearNum = parseInt(year as string) || new Date().getFullYear();
      const monthNum = month ? parseInt(month as string) : null;
      
      if (!period) {
        return res.status(400).json({ message: "Period is required" });
      }

      // Calculate date range based on period (e.g., "W1", "W2", "W3", etc.)
      let startDate: Date;
      let endDate: Date;

      if (monthNum) {
        // Weekly period within a month (W1, W2, W3, W4, W5)
        const weekMatch = (period as string).match(/W(\d+)/);
        if (weekMatch) {
          const weekNum = parseInt(weekMatch[1]);
          const monthStart = new Date(yearNum, monthNum - 1, 1);
          startDate = new Date(monthStart);
          startDate.setDate(startDate.getDate() + (weekNum - 1) * 7);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          // Make sure endDate doesn't go past month end
          const nextMonth = new Date(yearNum, monthNum, 1);
          if (endDate > nextMonth) {
            endDate = nextMonth;
          }
        } else {
          // Fallback to entire month
          startDate = new Date(yearNum, monthNum - 1, 1);
          endDate = new Date(yearNum, monthNum, 1);
        }
      } else {
        // Monthly period within a year (2025-01, 2025-02, etc.)
        const monthMatch = (period as string).match(/\d{4}-(\d{2})/);
        if (monthMatch) {
          const periodMonth = parseInt(monthMatch[1]);
          startDate = new Date(yearNum, periodMonth - 1, 1);
          endDate = new Date(yearNum, periodMonth, 1);
        } else {
          startDate = new Date(yearNum, 0, 1);
          endDate = new Date(yearNum + 1, 0, 1);
        }
      }

      // Fetch tickets for this period
      const periodTickets = await db.select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        customerName: tickets.customerName,
        customerId: tickets.customerId,
        issueSummary: tickets.issueSummary,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        assignedEngineerName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${tickets.assignedEngineerId})`,
        moduleName: sql<string>`(SELECT name FROM modules WHERE id = ${tickets.moduleId})`,
      })
        .from(tickets)
        .where(and(
          gte(tickets.createdAt, startDate),
          sql`${tickets.createdAt} < ${endDate}`
        ))
        .orderBy(sql`${tickets.createdAt} DESC`);

      // Calculate summary
      const summary = {
        total: periodTickets.length,
        open: periodTickets.filter(t => ['open', 'new', 'in_progress'].includes(t.status)).length,
        closed: periodTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length,
        critical: periodTickets.filter(t => t.priority === 'critical').length,
      };

      res.json({
        tickets: periodTickets,
        summary,
        period: { start: startDate, end: endDate },
      });
    } catch (error) {
      console.error("Error fetching period tickets:", error);
      res.status(500).json({ message: "Failed to fetch period tickets" });
    }
  });

  // Get ticket detail with comments (solutions/remedies) and engineer report
  app.get("/api/analytics/ticket-detail/:ticketId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Get ticket with engineer info
      const [ticket] = await db.select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        customerName: tickets.customerName,
        customerEmail: tickets.customerEmail,
        customerPhone: tickets.customerPhone,
        issueSummary: tickets.issueSummary,
        issueDescription: tickets.issueDescription,
        priority: tickets.priority,
        status: tickets.status,
        escalationLevel: tickets.escalationLevel,
        createdAt: tickets.createdAt,
        assignedAt: tickets.assignedAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        dueDate: tickets.dueDate,
        assignedEngineerName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${tickets.assignedEngineerId})`,
        assignedEngineerEmail: sql<string>`(SELECT email FROM users WHERE id = ${tickets.assignedEngineerId})`,
        moduleName: sql<string>`(SELECT name FROM modules WHERE id = ${tickets.moduleId})`,
      })
        .from(tickets)
        .where(eq(tickets.id, ticketId));

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Get all comments (solutions/engineer reports)
      const comments = await db.select({
        id: ticketComments.id,
        comment: ticketComments.comment,
        isInternal: ticketComments.isInternal,
        createdAt: ticketComments.createdAt,
        userName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${ticketComments.userId})`,
        userEmail: sql<string>`(SELECT email FROM users WHERE id = ${ticketComments.userId})`,
      })
        .from(ticketComments)
        .where(eq(ticketComments.ticketId, ticketId))
        .orderBy(ticketComments.createdAt);

      // Get escalation history
      const escalations = await db.select({
        id: escalationHistory.id,
        fromLevel: escalationHistory.fromLevel,
        toLevel: escalationHistory.toLevel,
        reason: escalationHistory.reason,
        escalatedAt: escalationHistory.escalatedAt,
        escalatedByName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${escalationHistory.escalatedBy})`,
      })
        .from(escalationHistory)
        .where(eq(escalationHistory.ticketId, ticketId))
        .orderBy(escalationHistory.escalatedAt);

      // Get feedback if any
      const [ticketFeedback] = await db.select()
        .from(feedback)
        .where(eq(feedback.ticketId, ticketId));

      // Calculate resolution time if resolved
      let resolutionTime = null;
      if (ticket.resolvedAt && ticket.createdAt) {
        const diff = new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime();
        resolutionTime = {
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        };
      }

      // Get all handlers (unique people who worked on this ticket via comments)
      const handlers = await db.select({
        userId: ticketComments.userId,
        userName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${ticketComments.userId})`,
        userEmail: sql<string>`(SELECT email FROM users WHERE id = ${ticketComments.userId})`,
        firstAction: sql<string>`MIN(${ticketComments.createdAt})::text`,
        lastAction: sql<string>`MAX(${ticketComments.createdAt})::text`,
        actionCount: sql<number>`COUNT(*)::int`,
      })
        .from(ticketComments)
        .where(eq(ticketComments.ticketId, ticketId))
        .groupBy(ticketComments.userId);

      // Get similar issues from the same customer (matching keywords in issue summary)
      const [currentTicket] = await db.select({ customerId: tickets.customerId, issueSummary: tickets.issueSummary })
        .from(tickets)
        .where(eq(tickets.id, ticketId));

      let similarTickets: any[] = [];
      if (currentTicket?.customerId) {
        // Find tickets from same customer with similar issue summaries (basic keyword matching)
        const allCustomerTickets = await db.select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          issueSummary: tickets.issueSummary,
          status: tickets.status,
          priority: tickets.priority,
          createdAt: tickets.createdAt,
          resolvedAt: tickets.resolvedAt,
          assignedEngineerName: sql<string>`(SELECT first_name || ' ' || last_name FROM users WHERE id = ${tickets.assignedEngineerId})`,
        })
          .from(tickets)
          .where(and(
            eq(tickets.customerId, currentTicket.customerId),
            sql`${tickets.id} != ${ticketId}`
          ))
          .orderBy(sql`${tickets.createdAt} DESC`)
          .limit(20);

        // Group by similar keywords (basic grouping by first 3 words of issue summary)
        similarTickets = allCustomerTickets.map(t => ({
          ...t,
          isSimilar: currentTicket.issueSummary && t.issueSummary ? 
            currentTicket.issueSummary.toLowerCase().split(' ').slice(0, 3).some(
              (word: string) => word.length > 3 && t.issueSummary.toLowerCase().includes(word)
            ) : false,
        })).filter(t => t.isSimilar);
      }

      res.json({
        ticket,
        comments,
        escalations,
        feedback: ticketFeedback || null,
        resolutionTime,
        handlers,
        similarTickets,
      });
    } catch (error) {
      console.error("Error fetching ticket detail:", error);
      res.status(500).json({ message: "Failed to fetch ticket detail" });
    }
  });

  // =====================
  // Marketing Daily Reports API
  // =====================

  // Marketing Dashboard - Get summary metrics
  app.get("/api/marketing/dashboard", isAuthenticated, requirePermission("digital_marketing", "view"), async (req, res) => {
    try {
      const cached = getCached<any>("marketing:dashboard");
      if (cached) return res.json(cached);

      // Single aggregation query replacing all JS-side filtering of the full dataset
      const summaryResult = await db.execute(sql`
        SELECT
          -- Status counts
          COUNT(*) FILTER (WHERE status = 'draft')     AS draft,
          COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
          COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
          -- Today metrics
          COUNT(*) FILTER (WHERE report_date >= CURRENT_DATE) AS today_reports,
          COALESCE(SUM(website_sessions)  FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_sessions,
          COALESCE(SUM(website_conversions) FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_conversions,
          COALESCE(SUM(social_likes)      FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_likes,
          COALESCE(SUM(social_shares)     FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_shares,
          COALESCE(SUM(social_comments)   FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_comments,
          COALESCE(SUM(email_conversions) FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_email_conv,
          COALESCE(SUM(ad_budget_used)    FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_ad_budget,
          COALESCE(SUM(leads_generated)   FILTER (WHERE report_date >= CURRENT_DATE), 0) AS today_leads,
          -- Week metrics (Monday-based)
          COUNT(*) FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)) AS week_reports,
          COALESCE(SUM(website_sessions)  FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_sessions,
          COALESCE(SUM(website_conversions) FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_conversions,
          COALESCE(SUM(social_likes)      FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_likes,
          COALESCE(SUM(social_shares)     FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_shares,
          COALESCE(SUM(social_comments)   FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_comments,
          COALESCE(SUM(email_conversions) FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_email_conv,
          COALESCE(SUM(ad_budget_used)    FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_ad_budget,
          COALESCE(SUM(leads_generated)   FILTER (WHERE report_date >= date_trunc('week', CURRENT_DATE)), 0) AS week_leads,
          -- Month metrics
          COUNT(*) FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)) AS month_reports,
          COALESCE(SUM(website_sessions)  FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_sessions,
          COALESCE(SUM(website_conversions) FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_conversions,
          COALESCE(SUM(social_likes)      FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_likes,
          COALESCE(SUM(social_shares)     FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_shares,
          COALESCE(SUM(social_comments)   FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_comments,
          COALESCE(SUM(email_conversions) FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_email_conv,
          COALESCE(SUM(ad_budget_used)    FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_ad_budget,
          COALESCE(SUM(leads_generated)   FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)), 0) AS month_leads,
          -- All-time totals
          COUNT(*) AS total_reports,
          COALESCE(SUM(website_sessions), 0)   AS total_sessions,
          COALESCE(SUM(website_conversions), 0) AS total_conversions,
          COALESCE(SUM(social_likes), 0)       AS total_likes,
          COALESCE(SUM(social_shares), 0)      AS total_shares,
          COALESCE(SUM(social_comments), 0)    AS total_comments,
          COALESCE(SUM(email_conversions), 0)  AS total_email_conv,
          COALESCE(SUM(ad_budget_used), 0)     AS total_ad_budget,
          COALESCE(SUM(leads_generated), 0)    AS total_leads
        FROM marketing_daily_reports
      `);
      const s = (summaryResult.rows[0] as any) || {};

      const buildMetrics = (prefix: string) => ({
        totalReports:       Number(s[`${prefix}_reports`]) || 0,
        websiteSessions:    Number(s[`${prefix}_sessions`]) || 0,
        websiteConversions: Number(s[`${prefix}_conversions`]) || 0,
        socialLikes:        Number(s[`${prefix}_likes`]) || 0,
        socialShares:       Number(s[`${prefix}_shares`]) || 0,
        socialComments:     Number(s[`${prefix}_comments`]) || 0,
        emailConversions:   Number(s[`${prefix}_email_conv`]) || 0,
        adBudgetUsed:       Number(s[`${prefix}_ad_budget`]) || 0,
        leadsGenerated:     Number(s[`${prefix}_leads`]) || 0,
        costPerLead:        0,
      });

      const statusCounts = {
        draft:     Number(s.draft)     || 0,
        submitted: Number(s.submitted) || 0,
        approved:  Number(s.approved)  || 0,
        rejected:  Number(s.rejected)  || 0,
      };

      // Team summary — SQL GROUP BY instead of JS nested loops
      const teamRows = await db.execute(sql`
        SELECT
          m.user_id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(*)::int                                          AS total_reports,
          COUNT(*) FILTER (WHERE m.status = 'approved')::int    AS approved,
          COUNT(*) FILTER (WHERE m.status = 'submitted')::int   AS pending,
          COUNT(*) FILTER (WHERE m.status = 'draft')::int       AS draft,
          COALESCE(SUM(m.leads_generated), 0)::int              AS total_leads
        FROM marketing_daily_reports m
        JOIN users u ON u.id = m.user_id
        GROUP BY m.user_id, u.first_name, u.last_name, u.email
        ORDER BY total_reports DESC
      `);
      const teamSummary = teamRows.rows.map((r: any) => ({
        user: { id: r.user_id, firstName: r.first_name, lastName: r.last_name, email: r.email },
        totalReports: Number(r.total_reports),
        approved:     Number(r.approved),
        pending:      Number(r.pending),
        draft:        Number(r.draft),
        totalLeads:   Number(r.total_leads),
      }));

      // Recent 10 reports + pending approval — single query each, minimal fields
      const [recentReports, pendingApproval] = await Promise.all([
        db.select().from(marketingDailyReports)
          .orderBy(desc(marketingDailyReports.createdAt))
          .limit(10),
        db.select().from(marketingDailyReports)
          .where(eq(marketingDailyReports.status, 'submitted'))
          .orderBy(desc(marketingDailyReports.createdAt)),
      ]);

      const result = {
        statusCounts,
        metrics: {
          today: buildMetrics('today'),
          week:  buildMetrics('week'),
          month: buildMetrics('month'),
          total: buildMetrics('total'),
        },
        teamSummary,
        recentReports,
        pendingApproval,
      };

      setCached("marketing:dashboard", result, 300);
      res.json(result);
    } catch (error) {
      console.error("Error fetching marketing dashboard:", error);
      res.status(500).json({ message: "Failed to fetch marketing dashboard" });
    }
  });

  // Get all marketing daily reports (with optional filters)
  app.get("/api/marketing-reports", isAuthenticated, async (req, res) => {
    try {
      const { userId: filterUserId, status, startDate, endDate } = req.query;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const userEmail = userClaims.claims?.email;

      // Build cache key from user + all filter dimensions (60-sec TTL)
      const cacheKey = `marketing:reports:${currentUserId}:${filterUserId||""}:${status||""}:${startDate||""}:${endDate||""}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return res.json(cached);

      const user = await storage.getUser(currentUserId);
      
      // Digital Marketing users can only see their own reports unless admin or super admin
      const filters: any = {};
      const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || isSuperAdmin(userEmail);
      
      if (!isAdminOrSuperAdmin) {
        // Resolve department-head status via cached departments list
        const departments = await storage.getDepartments();
        const marketingDept = departments.find(d => d.name === 'Digital Marketing');
        let isDeptHead = false;
        if (marketingDept) {
          const deptHeads = await storage.getDepartmentHeads(marketingDept.id);
          isDeptHead = deptHeads.some(h => h.userId === currentUserId);
        }
        
        if (!isDeptHead) {
          filters.userId = currentUserId;
        } else if (filterUserId) {
          filters.userId = filterUserId as string;
        }
      } else if (filterUserId) {
        filters.userId = filterUserId as string;
      }
      
      if (status) filters.status = status as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const reports = await storage.getMarketingDailyReports(filters);
      setCached(cacheKey, reports, 60);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching marketing reports:", error);
      res.status(500).json({ message: "Failed to fetch marketing reports" });
    }
  });

  // Get a single marketing report by ID
  app.get("/api/marketing-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const userEmail = userClaims.claims?.email;
      const user = await storage.getUser(currentUserId);
      
      const report = await storage.getMarketingDailyReport(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Access control: own report, admin, super admin, or dept head
      const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || isSuperAdmin(userEmail);
      if (report.userId !== currentUserId && !isAdminOrSuperAdmin) {
        const departments = await storage.getDepartments();
        const marketingDept = departments.find(d => d.name === 'Digital Marketing');
        let isDeptHead = false;
        if (marketingDept) {
          const deptHeads = await storage.getDepartmentHeads(marketingDept.id);
          isDeptHead = deptHeads.some(h => h.userId === currentUserId);
        }
        if (!isDeptHead) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching marketing report:", error);
      res.status(500).json({ message: "Failed to fetch marketing report" });
    }
  });

  // Get marketing report by date (for checking if today's report exists)
  app.get("/api/marketing-reports/by-date/:date", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.params;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      
      const report = await storage.getMarketingDailyReportByDate(currentUserId, new Date(date));
      res.json(report || null);
    } catch (error) {
      console.error("Error fetching marketing report by date:", error);
      res.status(500).json({ message: "Failed to fetch marketing report" });
    }
  });

  // Create a new marketing daily report
  app.post("/api/marketing-reports", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.claims?.sub || (req.session as any).userId;
      const { taskEntries, ...bodyData } = req.body;
      
      const reportData = {
        ...bodyData,
        userId,
        reportDate: new Date(), // Always use current system date
      };
      
      // Check if a report for today already exists
      const existingReport = await storage.getMarketingDailyReportByDate(
        userId, 
        new Date()
      );
      
      if (existingReport) {
        return res.status(400).json({ 
          message: "A report for this date already exists",
          existingReportId: existingReport.id 
        });
      }
      
      const report = await storage.createMarketingDailyReport(reportData);
      
      // Create task entries if provided
      if (taskEntries && Array.isArray(taskEntries)) {
        for (const entry of taskEntries) {
          // Transform frontend fields to match database schema
          const transformedEntry = {
            reportId: report.id,
            timeSlot: entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : entry.timeSlot,
            taskActivity: entry.taskDescription || entry.taskActivity,
            platformTool: entry.platform && entry.toolUsed 
              ? `${entry.platform}${entry.toolUsed ? ' / ' + entry.toolUsed : ''}`.trim()
              : entry.platformTool || '',
            status: entry.status || 'completed',
            remarks: entry.remarks || '',
            sortOrder: entry.sortOrder || 0,
          };
          await storage.createMarketingTaskEntry(transformedEntry);
        }
      }
      
      invalidateCache("marketing:dashboard");
      invalidateCache("marketing:reports:");
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating marketing report:", error);
      res.status(500).json({ message: "Failed to create marketing report" });
    }
  });

  // Update a marketing daily report
  app.patch("/api/marketing-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const userEmail = userClaims.claims?.email;
      const user = await storage.getUser(currentUserId);
      
      const existingReport = await storage.getMarketingDailyReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Only the creator can update, unless admin or super admin
      const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || isSuperAdmin(userEmail);
      if (existingReport.userId !== currentUserId && !isAdminOrSuperAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { taskEntries, ...reportData } = req.body;
      
      // Convert reportDate to Date object if provided
      if (reportData.reportDate) {
        reportData.reportDate = new Date(reportData.reportDate);
      }
      
      const report = await storage.updateMarketingDailyReport(id, reportData);
      
      // Update task entries if provided
      if (taskEntries && Array.isArray(taskEntries)) {
        // Delete existing entries and recreate
        await storage.deleteMarketingTaskEntriesByReport(id);
        for (const entry of taskEntries) {
          // Transform frontend fields to match database schema
          const transformedEntry = {
            reportId: id,
            timeSlot: entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : entry.timeSlot,
            taskActivity: entry.taskDescription || entry.taskActivity,
            platformTool: entry.platform && entry.toolUsed 
              ? `${entry.platform}${entry.toolUsed ? ' / ' + entry.toolUsed : ''}`.trim()
              : entry.platformTool || '',
            status: entry.status || 'completed',
            remarks: entry.remarks || '',
            sortOrder: entry.sortOrder || 0,
          };
          await storage.createMarketingTaskEntry(transformedEntry);
        }
      }
      
      invalidateCache("marketing:dashboard");
      invalidateCache("marketing:reports:");
      res.json(report);
    } catch (error) {
      console.error("Error updating marketing report:", error);
      res.status(500).json({ message: "Failed to update marketing report" });
    }
  });

  // Delete a marketing daily report
  app.delete("/api/marketing-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const userEmail = userClaims.claims?.email;
      const user = await storage.getUser(currentUserId);
      
      const existingReport = await storage.getMarketingDailyReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Only admin or super admin can delete
      const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || isSuperAdmin(userEmail);
      if (!isAdminOrSuperAdmin) {
        return res.status(403).json({ message: "Only admins can delete reports" });
      }
      
      await storage.deleteMarketingDailyReport(id);
      invalidateCache("marketing:dashboard");
      invalidateCache("marketing:reports:");
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting marketing report:", error);
      res.status(500).json({ message: "Failed to delete marketing report" });
    }
  });

  // Submit a marketing report for approval
  app.post("/api/marketing-reports/:id/submit", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      
      const existingReport = await storage.getMarketingDailyReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      if (existingReport.userId !== currentUserId) {
        return res.status(403).json({ message: "Only the creator can submit the report" });
      }
      
      if (existingReport.status !== 'draft') {
        return res.status(400).json({ message: "Report has already been submitted" });
      }
      
      const report = await storage.updateMarketingDailyReport(id, { 
        status: 'submitted',
      });
      
      invalidateCache("marketing:dashboard");
      invalidateCache("marketing:reports:");
      res.json(report);
    } catch (error) {
      console.error("Error submitting marketing report:", error);
      res.status(500).json({ message: "Failed to submit marketing report" });
    }
  });

  // Approve/reject a marketing report
  app.post("/api/marketing-reports/:id/review", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const userEmail = userClaims.claims?.email;
      const user = await storage.getUser(currentUserId);
      
      // Must be admin, super admin, or department head (using junction table)
      const departments = await storage.getDepartments();
      const marketingDept = departments.find(d => d.name === 'Digital Marketing');
      let isDeptHead = false;
      if (marketingDept) {
        const deptHeads = await storage.getDepartmentHeads(marketingDept.id);
        isDeptHead = deptHeads.some(h => h.userId === currentUserId);
      }
      const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin' || isSuperAdmin(userEmail);
      
      if (!isAdminOrSuperAdmin && !isDeptHead) {
        return res.status(403).json({ message: "Only department heads or admins can review reports" });
      }
      
      const existingReport = await storage.getMarketingDailyReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      if (existingReport.status !== 'submitted') {
        return res.status(400).json({ message: "Report must be submitted before review" });
      }
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const report = await storage.updateMarketingDailyReport(id, { 
        status: newStatus,
      });
      
      invalidateCache("marketing:dashboard");
      invalidateCache("marketing:reports:");
      res.json(report);
    } catch (error) {
      console.error("Error reviewing marketing report:", error);
      res.status(500).json({ message: "Failed to review marketing report" });
    }
  });

  // ==========================================
  // Google Maps Extractor Routes
  // ==========================================

  // Search Google Places API
  app.post("/api/extractor/search", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const { query, city, area, industry, segment } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Places API key not configured" });
      }

      // Build the search query with location context
      let searchQuery = query;
      if (city) searchQuery += ` in ${city}`;
      if (area) searchQuery += `, ${area}`;

      // Use Google Places Text Search (New) API
      const url = "https://places.googleapis.com/v1/places:searchText";
      
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,places.businessStatus,places.priceLevel,places.types,nextPageToken"
      };

      // Helper to delay between pagination requests (Google requires ~2s delay)
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Transform a single place to our format
      const transformPlace = (place: any) => {
        const address = place.formattedAddress || "";
        const addressParts = address.split(",").map((p: string) => p.trim());
        
        return {
          googlePlaceId: place.id,
          businessName: place.displayName?.text || "Unknown Business",
          contactPhone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
          website: place.websiteUri || null,
          address: address,
          city: city || (addressParts.length > 2 ? addressParts[addressParts.length - 3] : null),
          area: area || (addressParts.length > 1 ? addressParts[0] : null),
          latitude: place.location?.latitude?.toString() || null,
          longitude: place.location?.longitude?.toString() || null,
          rating: place.rating?.toString() || null,
          reviewCount: place.userRatingCount || null,
          industry: industry || (place.types?.[0]?.replace(/_/g, " ") || null),
          segment: segment || null,
          priceLevel: place.priceLevel || null,
          businessStatus: place.businessStatus || "OPERATIONAL"
        };
      };

      // Collect all places across pages (Google allows up to 3 pages = 60 results max)
      const allPlaces: any[] = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;
      const maxPages = 3; // Google Places API returns max 60 results (3 pages x 20)

      do {
        const payload: any = {
          textQuery: searchQuery,
          pageSize: 20,
          languageCode: "en"
        };

        // Add page token for subsequent requests
        if (nextPageToken) {
          payload.pageToken = nextPageToken;
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Google Places API error:", errorText);
          // If we have some results, return them even if pagination fails
          if (allPlaces.length > 0) {
            break;
          }
          return res.status(response.status).json({ message: "Google Places API request failed" });
        }

        const data = await response.json();
        const places = data.places || [];
        
        // Add places to our collection
        allPlaces.push(...places);
        
        // Check for next page token
        nextPageToken = data.nextPageToken || null;
        pageCount++;

        // If there's another page, wait before requesting (Google requires delay)
        if (nextPageToken && pageCount < maxPages) {
          await delay(2000); // 2 second delay as required by Google
        }

      } while (nextPageToken && pageCount < maxPages);

      // Transform all places to our format and deduplicate by googlePlaceId
      const seenIds = new Set<string>();
      const transformedPlaces = allPlaces
        .map(transformPlace)
        .filter(place => {
          if (seenIds.has(place.googlePlaceId)) {
            return false;
          }
          seenIds.add(place.googlePlaceId);
          return true;
        });

      // Check which places already exist as LEADS in the CRM (by phone or company name)
      // This checks against actual CRM data, not just extracted places
      const phoneNumbers = transformedPlaces
        .map(p => p.contactPhone)
        .filter((phone): phone is string => !!phone);
      
      const companyChecks = transformedPlaces.map(p => ({
        name: p.businessName,
        city: p.city || undefined
      }));
      
      // Batch check for duplicates in leads table
      const existingPhones = await storage.checkDuplicateLeadsByPhone(phoneNumbers);
      const existingCompanyKeys = await storage.checkDuplicateLeadsByCompanyName(companyChecks);
      
      const existingPhonesSet = new Set(existingPhones);
      const existingCompanyKeysSet = new Set(existingCompanyKeys);
      
      // Mark each place with whether it already exists in CRM
      const placesWithStatus = transformedPlaces.map(p => {
        // Check if phone number matches
        const phoneMatch = p.contactPhone && existingPhonesSet.has(p.contactPhone);
        // Check company name + city using composite key format
        const companyKey = `${p.businessName}::${p.city || ""}`;
        const companyMatch = existingCompanyKeysSet.has(companyKey);
        
        return {
          ...p,
          alreadySaved: phoneMatch || companyMatch
        };
      });
      
      const newPlaces = placesWithStatus.filter(p => !p.alreadySaved);
      const existingPlaces = placesWithStatus.filter(p => p.alreadySaved);

      console.log(`[Extractor] Fetched ${pageCount} page(s), ${transformedPlaces.length} from Google, ${existingPlaces.length} already in CRM, ${newPlaces.length} new for query: ${searchQuery}`);

      res.json({ 
        places: newPlaces,
        existingPlaces: existingPlaces,
        total: newPlaces.length,
        totalExisting: existingPlaces.length,
        totalAll: transformedPlaces.length,
        pagesRetrieved: pageCount,
        hasMoreResults: !!nextPageToken
      });
    } catch (error) {
      console.error("Error searching Google Places:", error);
      res.status(500).json({ message: "Failed to search Google Places" });
    }
  });

  // Get all extracted places for current user
  app.get("/api/extractor/places", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const { isImported, city, area, industry } = req.query;

      const places = await storage.getExtractedPlaces({
        extractedById: currentUserId,
        isImported: isImported === 'true' ? true : isImported === 'false' ? false : undefined,
        city: city as string,
        area: area as string,
        industry: industry as string
      });

      res.json(places);
    } catch (error) {
      console.error("Error fetching extracted places:", error);
      res.status(500).json({ message: "Failed to fetch extracted places" });
    }
  });

  // Save extracted places to database
  app.post("/api/extractor/places", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const { places, searchQuery } = req.body;

      if (!Array.isArray(places) || places.length === 0) {
        return res.status(400).json({ message: "No places to save" });
      }

      const placesToSave = places.map((place: any) => ({
        ...place,
        extractedById: currentUserId,
        searchQuery: searchQuery || null
      }));

      const savedPlaces = await storage.createExtractedPlaces(placesToSave);
      res.json({ saved: savedPlaces.length, places: savedPlaces });
    } catch (error) {
      console.error("Error saving extracted places:", error);
      res.status(500).json({ message: "Failed to save extracted places" });
    }
  });

  // Check for duplicate leads
  app.post("/api/extractor/check-duplicate", isAuthenticated, requirePermission('leads', 'view'), async (req: any, res) => {
    try {
      const { contactPhone, businessName, contactPerson, contactEmail, city, area } = req.body;

      const existingLead = await storage.checkDuplicateLead({
        contactPhone,
        businessName,
        contactPerson,
        contactEmail,
        city,
        area
      });

      res.json({ isDuplicate: !!existingLead, existingLead });
    } catch (error) {
      console.error("Error checking duplicate:", error);
      res.status(500).json({ message: "Failed to check for duplicates" });
    }
  });

  // Import extracted places as seeds (leads with stage='seed')
  app.post("/api/extractor/import-as-seeds", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const { placeIds, skipDuplicates = true, assigneeId } = req.body;
      
      // Get current user to check their role
      const currentUser = await storage.getUser(currentUserId);
      
      // Check if user is privileged (can assign to others)
      const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
      const isAdmin = currentUser?.role === "admin";
      // Check if user is a department head by looking for departments they manage
      const managedDepartments = currentUser ? await storage.getDepartmentsByHead(currentUserId) : [];
      const isDepartmentHead = managedDepartments.length > 0;
      const canAssign = isSuperAdmin || isAdmin || isDepartmentHead;
      
      // Determine the actual assignee
      // Only privileged users can assign to others; regular users always get self-assigned
      let targetAssigneeId = currentUserId;
      if (assigneeId && assigneeId !== "self" && canAssign) {
        // Validate that the assignee exists
        const targetUser = await storage.getUser(assigneeId);
        if (targetUser) {
          targetAssigneeId = assigneeId;
        }
        // If assignee doesn't exist, fall back to current user
      }

      if (!Array.isArray(placeIds) || placeIds.length === 0) {
        return res.status(400).json({ message: "No places to import" });
      }

      const results = {
        imported: 0,
        skipped: 0,
        duplicates: [] as string[],
        errors: [] as string[]
      };

      for (const placeId of placeIds) {
        try {
          const place = await storage.getExtractedPlace(placeId);
          if (!place) {
            results.errors.push(`Place ${placeId} not found`);
            continue;
          }

          if (place.isImported) {
            results.skipped++;
            continue;
          }

          // Check for duplicates using multiple criteria
          if (skipDuplicates) {
            // Primary check: by phone number (most reliable)
            if (place.contactPhone) {
              const existingByPhone = await storage.checkDuplicateLead({
                contactPhone: place.contactPhone
              });
              if (existingByPhone) {
                results.duplicates.push(`${place.businessName} (phone match)`);
                results.skipped++;
                continue;
              }
            }

            // Secondary check: by business name + city combination
            if (place.businessName && place.city) {
              const existingByName = await storage.checkDuplicateLead({
                businessName: place.businessName,
                city: place.city,
                area: place.area || undefined
              });
              if (existingByName) {
                results.duplicates.push(`${place.businessName} (name+location match)`);
                results.skipped++;
                continue;
              }
            }
          }

          // Generate a unique placeholder email using business name and timestamp
          const sanitizedName = place.businessName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
          const uniqueEmail = place.contactEmail || `${sanitizedName}.${Date.now()}@pending.com`;
          
          // Generate contact person from business name if not available
          const contactPerson = place.contactPerson || `${place.businessName} - Contact`;

          // Create lead as seed with proper field values
          const leadData = {
            companyName: place.businessName,
            contactPerson: contactPerson,
            contactEmail: uniqueEmail,
            contactPhone: place.contactPhone || null,
            leadSource: "google_maps",
            stage: "seed",
            salesExecutiveId: targetAssigneeId,
            city: place.city || null,
            area: place.area || null,
            latitude: place.latitude || null,
            longitude: place.longitude || null,
            currency: "INR" as const
          };

          const lead = await storage.createLead(leadData);

          // Mark place as imported
          await storage.updateExtractedPlace(placeId, {
            isImported: true,
            importedLeadId: lead.id
          });

          results.imported++;
        } catch (error: any) {
          console.error(`Error importing place ${placeId}:`, error);
          results.errors.push(`Failed to import: ${error.message || 'Unknown error'}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error importing places as seeds:", error);
      res.status(500).json({ message: "Failed to import places as seeds" });
    }
  });

  // Delete an extracted place
  app.delete("/api/extractor/places/:id", isAuthenticated, requirePermission('leads', 'delete'), async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteExtractedPlace(id);
      res.json({ message: "Place deleted successfully" });
    } catch (error) {
      console.error("Error deleting extracted place:", error);
      res.status(500).json({ message: "Failed to delete extracted place" });
    }
  });

  // Extractor Options routes (custom industries and segments)
  app.get("/api/extractor/options", isAuthenticated, async (req: any, res) => {
    try {
      const type = req.query.type as 'industry' | 'segment' | undefined;
      const options = await storage.getExtractorOptions(type);
      res.json(options);
    } catch (error) {
      console.error("Error getting extractor options:", error);
      res.status(500).json({ message: "Failed to get extractor options" });
    }
  });

  app.post("/api/extractor/options", isAuthenticated, requirePermission('leads', 'create'), async (req: any, res) => {
    try {
      const userClaims = req.user as any;
      const currentUserId = userClaims.claims?.sub || (req.session as any).userId;
      const { type, value, label } = req.body;

      if (!type || !value || !label) {
        return res.status(400).json({ message: "Type, value, and label are required" });
      }

      if (type !== 'industry' && type !== 'segment') {
        return res.status(400).json({ message: "Type must be 'industry' or 'segment'" });
      }

      const option = await storage.createExtractorOption({
        type,
        value,
        label,
        createdById: currentUserId
      });

      res.json(option);
    } catch (error) {
      console.error("Error creating extractor option:", error);
      res.status(500).json({ message: "Failed to create extractor option" });
    }
  });

  app.delete("/api/extractor/options/:id", isAuthenticated, requirePermission('leads', 'delete'), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if option exists and is not a default
      const option = await storage.getExtractorOption(id);
      if (!option) {
        return res.status(404).json({ message: "Option not found" });
      }
      if (option.isDefault) {
        return res.status(400).json({ message: "Cannot delete default options" });
      }

      await storage.deleteExtractorOption(id);
      res.json({ message: "Option deleted successfully" });
    } catch (error) {
      console.error("Error deleting extractor option:", error);
      res.status(500).json({ message: "Failed to delete extractor option" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
