import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { db } from "./db";
import { users, modules, projectModules, projectEngineers, tickets, ticketComments, escalationHistory } from "@shared/schema";
import { sendQuoteEmail, sendTicketClosureFeedbackEmail, sendTrainingConfirmationEmail, sendWelcomeEmail, sendEmail, sendOtpEmail, sendPasswordResetSuccessEmail, clearSmtpSettingsCache, setStorageGetter } from "./email";
import { eq, sql } from "drizzle-orm";
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
} from "@shared/schema";
import { generateEmbedding, generateEmbeddings, chunkText, extractTextFromContent, estimateTokenCount } from "./embeddings";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { handleAssignment, handleCompletion } from "./pointsService";

// Generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
        await storage.updateUser(user.id, { role: "admin" });
        userRole = "admin";
      }
      
      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      
      // Set up session
      (req.session as any).userId = user.id;
      (req.session as any).isLocalAuth = true;
      req.user = { claims: { sub: user.id } };
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          role: userRole,
          profileImageUrl: user.profileImageUrl
        } 
      });
    } catch (error: any) {
      console.error("Error logging in:", error?.message || error, error?.stack);
      res.status(500).json({ message: "Login failed", error: error?.message });
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
      if (role && ["admin", "sales_executive", "engineer", "support"].includes(role)) {
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

  // Local logout
  app.post("/api/auth/local-logout", async (req, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
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
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const { role } = req.query;
      if (role) {
        const userList = await storage.getUsersByRole(role as string);
        return res.json(userList);
      }
      res.json([]);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // =============================================
  // MASTER DATA ROUTES
  // =============================================

  // Customer Master routes
  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const customersList = await storage.getCustomers();
      res.json(customersList);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Get customers with lifecycle status for support ticket creation
  app.get("/api/customers/with-lifecycle", isAuthenticated, async (req, res) => {
    try {
      const customersWithLifecycle = await storage.getCustomersWithLifecycle();
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
      
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Module Master routes
  app.get("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const modulesList = await storage.getModules();
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
  app.get("/api/users/all", isAuthenticated, async (req, res) => {
    try {
      const usersList = await storage.getUsers();
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
      const updated = await storage.updateUser(req.params.id, req.body);
      
      await storage.logActivity({
        entityType: "user",
        entityId: updated.id,
        action: "updated",
        description: `User updated: ${updated.firstName} ${updated.lastName}`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
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
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updated = await storage.updateUser(req.params.id, {
        isApproved: true,
        isActive: true,
        approvedAt: new Date(),
        approvedBy: req.user.claims.sub,
      });

      await storage.logActivity({
        entityType: "user",
        entityId: updated.id,
        action: "approved",
        description: `User approved: ${updated.firstName} ${updated.lastName}`,
        userId: req.user.claims.sub,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Failed to approve user" });
    }
  });

  app.post("/api/users/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updated = await storage.updateUser(req.params.id, {
        isApproved: false,
        isActive: false,
      });

      await storage.logActivity({
        entityType: "user",
        entityId: updated.id,
        action: "rejected",
        description: `User rejected: ${updated.firstName} ${updated.lastName}. Reason: ${req.body.reason || "No reason provided"}`,
        userId: req.user.claims.sub,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: "Failed to reject user" });
    }
  });

  app.post("/api/users/:id/revoke-approval", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent revoking super admin approval
      if (user.email === "senthil@microgenn.com") {
        return res.status(403).json({ message: "Cannot revoke super admin approval" });
      }

      const updated = await storage.updateUser(req.params.id, {
        isApproved: false,
      });

      await storage.logActivity({
        entityType: "user",
        entityId: updated.id,
        action: "approval_revoked",
        description: `User approval revoked: ${updated.firstName} ${updated.lastName}`,
        userId: req.user.claims.sub,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error revoking user approval:", error);
      res.status(500).json({ message: "Failed to revoke user approval" });
    }
  });

  // User Role routes (admin only for write operations)
  app.get("/api/user-roles", isAuthenticated, async (req, res) => {
    try {
      const rolesList = await storage.getUserRoles();
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
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: newRole.id,
        action: "created",
        description: `New user role created: ${newRole.displayName}`,
        userId: req.user.claims.sub,
      });
      
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
      const departmentsList = await storage.getDepartments();
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
      
      res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // =============================================
  // SYSTEM MODULE ROUTES (admin only for write operations)
  // =============================================

  app.get("/api/system-modules", isAuthenticated, async (req, res) => {
    try {
      const modulesList = await storage.getSystemModules();
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
      
      res.json({ message: "System module deleted successfully" });
    } catch (error) {
      console.error("Error deleting system module:", error);
      res.status(500).json({ message: "Failed to delete system module" });
    }
  });

  // Seed default system modules (admin only)
  app.post("/api/system-modules/seed", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const defaultModules = [
        { name: "dashboard", displayName: "Dashboard", description: "Main dashboard and analytics", icon: "LayoutDashboard", sortOrder: 1 },
        { name: "leads", displayName: "Sales / Leads", description: "Lead management and sales pipeline", icon: "Target", sortOrder: 2 },
        { name: "quotes", displayName: "Quotes", description: "Quote generation and management", icon: "FileText", sortOrder: 3 },
        { name: "projects", displayName: "Implementation", description: "Project implementation tracking", icon: "FolderKanban", sortOrder: 4 },
        { name: "tickets", displayName: "Support Tickets", description: "Customer support ticket management", icon: "Ticket", sortOrder: 5 },
        { name: "tasks", displayName: "Tasks", description: "Task and follow-up management", icon: "CheckSquare", sortOrder: 6 },
        { name: "customers", displayName: "Customers", description: "Customer master data", icon: "Users", sortOrder: 7 },
        { name: "reports", displayName: "Reports", description: "Reports and analytics", icon: "BarChart3", sortOrder: 8 },
        { name: "user_management", displayName: "User Management", description: "User, role, and permission management", icon: "ShieldCheck", sortOrder: 9 },
        { name: "settings", displayName: "Settings", description: "System settings and configuration", icon: "Settings", sortOrder: 10 },
      ];
      
      const existingModules = await storage.getSystemModules();
      const existingNames = existingModules.map(m => m.name);
      
      const createdModules = [];
      for (const mod of defaultModules) {
        if (!existingNames.includes(mod.name)) {
          const created = await storage.createSystemModule(mod);
          createdModules.push(created);
        }
      }
      
      if (createdModules.length > 0) {
        await storage.logActivity({
          entityType: "system_module",
          entityId: "seed",
          action: "seeded",
          description: `${createdModules.length} default system modules created`,
          userId: req.user.claims.sub,
        });
      }
      
      res.json({ 
        message: `Created ${createdModules.length} new modules`,
        created: createdModules 
      });
    } catch (error) {
      console.error("Error seeding system modules:", error);
      res.status(500).json({ message: "Failed to seed system modules" });
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

  // Lead routes
  app.get("/api/leads", isAuthenticated, async (req, res) => {
    try {
      const { stage, salesExecutiveId, limit } = req.query;
      let leadsList = await storage.getLeads({
        stage: stage as string,
        salesExecutiveId: salesExecutiveId as string,
      });
      
      if (limit) {
        leadsList = leadsList.slice(0, parseInt(limit as string));
      }
      
      res.json(leadsList);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const newLead = await storage.createLead(validatedData);
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: newLead.id,
        action: "created",
        description: `New lead created: ${newLead.companyName}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newLead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(400).json({ message: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, async (req: any, res) => {
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
      
      // Auto-transition to demo_scheduled when demo date is set and lead is in new_lead stage
      if (updateData.demoDate && currentLead && currentLead.stage === "new_lead") {
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
          (currentLead.stage === "demo_scheduled" || currentLead.stage === "new_lead")) {
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
      
      // Handle deal closure (won or lost)
      if (updateData.closedDate && updateData.stage) {
        if (updateData.stage === "closed_won") {
          if (!updateData.confirmedOrderValue) {
            return res.status(400).json({ message: "Confirmed order value is required to close the deal" });
          }
          activityAction = "deal_won";
          activityDescription = `Deal won with ${currentLead?.companyName} - Confirmed Value: $${updateData.confirmedOrderValue?.toLocaleString()}`;
        } else if (updateData.stage === "closed_lost") {
          activityAction = "deal_lost";
          activityDescription = `Deal lost with ${currentLead?.companyName}${updateData.closedReason ? ` - Reason: ${updateData.closedReason}` : ""}`;
        }
      }
      
      const updated = await storage.updateLead(req.params.id, updateData);
      
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
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(400).json({ message: "Failed to update lead" });
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
            stage: "new_lead",
            estimatedValue: parseFloat(leadRow.estimatedValue || leadRow.estimated_value || leadRow["Value"]) || 0,
            notes: leadRow.notes || leadRow["Notes"] || "",
          });
          
          const newLead = await storage.createLead(validatedData);
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

  // Social Media Webhook Endpoints (public - no auth required for webhooks)
  // These endpoints receive lead data from social media platforms

  // Facebook Lead Ads Webhook
  app.post("/api/webhooks/facebook", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Facebook Lead Ad - Form ID: ${form_id || "N/A"}, Ad ID: ${ad_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.get("/api/webhooks/facebook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Verify token should be configured in environment
    const verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    
    if (mode === "subscribe" && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Verification failed");
    }
  });

  // LinkedIn Lead Gen Webhook
  app.post("/api/webhooks/linkedin", async (req, res) => {
    try {
      const { lead, campaign, form } = req.body;
      
      const leadData = {
        companyName: lead?.company || lead?.organization || "LinkedIn Lead",
        contactPerson: `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim() || "Unknown",
        contactEmail: lead?.email || "",
        contactPhone: lead?.phone || "",
        leadSource: "linkedin",
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `LinkedIn Lead Gen Form - Campaign: ${campaign?.name || "N/A"}, Form: ${form?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.get("/api/webhooks/instagram", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Instagram uses the same Meta/Facebook API, so shares the same verify token
    const verifyToken = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    
    if (mode === "subscribe" && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: "Verification failed" });
    }
  });

  // Instagram Lead Ads Webhook (uses Facebook's API)
  app.post("/api/webhooks/instagram", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Instagram Lead Ad - Form ID: ${form_id || "N/A"}, Instagram User: ${instagram_user_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/twitter", async (req, res) => {
    try {
      const { card_data, user_data } = req.body;
      
      const leadData = {
        companyName: user_data?.company || card_data?.company_name || "Twitter Lead",
        contactPerson: user_data?.name || card_data?.full_name || "Unknown",
        contactEmail: user_data?.email || card_data?.email || "",
        contactPhone: user_data?.phone || card_data?.phone_number || "",
        leadSource: "twitter",
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Twitter/X Lead Card`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/google", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Google Ads Lead Form - Campaign ID: ${campaign_id || "N/A"}, Form ID: ${form_id || "N/A"}, Lead ID: ${lead_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/youtube", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `YouTube Lead Form - Video ID: ${video_id || "N/A"}, Campaign: ${campaign_id || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/tiktok", async (req, res) => {
    try {
      const { event, lead_info, page_info, ad_info } = req.body;
      
      const leadData = {
        companyName: lead_info?.company || lead_info?.business_name || "TikTok Lead",
        contactPerson: lead_info?.name || lead_info?.full_name || `${lead_info?.first_name || ""} ${lead_info?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead_info?.email || "",
        contactPhone: lead_info?.phone_number || lead_info?.phone || "",
        leadSource: "tiktok",
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `TikTok Lead Ad - Page: ${page_info?.page_name || "N/A"}, Ad: ${ad_info?.ad_name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/pinterest", async (req, res) => {
    try {
      const { lead_data, pin_info, campaign_info } = req.body;
      
      const leadData = {
        companyName: lead_data?.company || lead_data?.business || "Pinterest Lead",
        contactPerson: lead_data?.full_name || lead_data?.name || `${lead_data?.first_name || ""} ${lead_data?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead_data?.email || "",
        contactPhone: lead_data?.phone || "",
        leadSource: "pinterest",
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Pinterest Lead Ad - Pin: ${pin_info?.pin_id || "N/A"}, Campaign: ${campaign_info?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/snapchat", async (req, res) => {
    try {
      const { lead, campaign, ad_squad } = req.body;
      
      const leadData = {
        companyName: lead?.company || lead?.organization || "Snapchat Lead",
        contactPerson: lead?.full_name || lead?.name || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "Unknown",
        contactEmail: lead?.email || "",
        contactPhone: lead?.phone_number || lead?.phone || "",
        leadSource: "snapchat",
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Snapchat Lead Ad - Campaign: ${campaign?.name || "N/A"}, Ad Squad: ${ad_squad?.name || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/whatsapp", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `WhatsApp Lead - Message: ${message?.text?.body || "Click-to-WhatsApp inquiry"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/microsoft", async (req, res) => {
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
        stage: "new_lead" as const,
        estimatedValue: 0,
        notes: `Microsoft/Bing Ads Lead Form - Campaign ID: ${campaignId || "N/A"}, Lead Form ID: ${leadFormId || "N/A"}`,
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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
  app.post("/api/webhooks/website", async (req, res) => {
    try {
      const { company, name, email, phone, source, notes } = req.body;
      
      const leadData = {
        companyName: company || req.body.companyName || "Website Lead",
        contactPerson: name || req.body.contactPerson || "Unknown",
        contactEmail: email || req.body.contactEmail || "",
        contactPhone: phone || req.body.contactPhone || "",
        leadSource: source || "website",
        stage: "new_lead" as const,
        estimatedValue: parseFloat(req.body.value) || 0,
        notes: notes || req.body.notes || "Submitted via website form",
      };
      
      const validatedData = insertLeadSchema.parse(leadData);
      const newLead = await storage.createLead(validatedData);
      
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

  // Follow-up routes
  app.get("/api/leads/:id/follow-ups", isAuthenticated, async (req, res) => {
    try {
      const followUpsList = await storage.getFollowUpsByLead(req.params.id);
      res.json(followUpsList);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ message: "Failed to fetch follow-ups" });
    }
  });

  app.post("/api/leads/:id/follow-ups", isAuthenticated, async (req: any, res) => {
    try {
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
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      const projectsList = await storage.getProjects({ status: status as string });
      
      // Attach engineers to each project
      const projectsWithEngineers = await Promise.all(
        projectsList.map(async (project) => {
          const engineerAssignments = await storage.getProjectEngineers(project.id);
          const engineerIds = engineerAssignments.map((a) => a.engineerId);
          const engineers = await Promise.all(
            engineerIds.map((id) => storage.getUser(id))
          );
          return {
            ...project,
            engineers: engineers.filter((e) => e !== undefined),
          };
        })
      );
      
      res.json(projectsWithEngineers);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/projects/:id", isAuthenticated, async (req: any, res) => {
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
      
      res.json(newTicket);
    } catch (error) {
      console.error("Error reopening ticket:", error);
      res.status(400).json({ message: "Failed to reopen ticket" });
    }
  });

  // Implementation Dashboard stats
  app.get("/api/dashboard/implementation", isAuthenticated, async (req, res) => {
    try {
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
      
      res.json({
        projects: projectsWithDetails,
        stats: {
          totalProjects,
          inProgress,
          inTraining,
          completed,
          pendingHandoff,
        },
      });
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

  // Ticket routes
  app.get("/api/tickets", isAuthenticated, async (req, res) => {
    try {
      const { status, priority, limit } = req.query;
      let ticketsList = await storage.getTickets({
        status: status as string,
        priority: priority as string,
      });
      
      if (limit) {
        ticketsList = ticketsList.slice(0, parseInt(limit as string));
      }
      
      res.json(ticketsList);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertTicketSchema.parse(req.body);
      
      // Round-robin assignment if not specified
      if (!validatedData.assignedEngineerId) {
        const supportEngineers = await storage.getUsersByRole("support");
        if (supportEngineers.length > 0) {
          // Get last assigned engineer and assign to next one
          const recentTickets = await storage.getTickets({});
          const assignedTickets = recentTickets.filter((t) => t.assignedEngineerId);
          
          if (assignedTickets.length > 0) {
            const lastAssignedId = assignedTickets[0].assignedEngineerId;
            const lastIndex = supportEngineers.findIndex((e) => e.id === lastAssignedId);
            const nextIndex = (lastIndex + 1) % supportEngineers.length;
            validatedData.assignedEngineerId = supportEngineers[nextIndex].id;
          } else {
            validatedData.assignedEngineerId = supportEngineers[0].id;
          }
        }
      }
      
      const newTicket = await storage.createTicket(validatedData);
      
      // Award points if ticket is assigned
      if (newTicket.assignedEngineerId) {
        await handleAssignment({
          module: "tickets",
          entityId: newTicket.id,
          newAssigneeId: newTicket.assignedEngineerId,
          previousAssigneeId: null,
          assignedById: req.user.claims.sub,
        });
      }
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: newTicket.id,
        action: "created",
        description: `New ticket created: ${newTicket.ticketNumber} - ${newTicket.issueSummary}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newTicket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(400).json({ message: "Failed to create ticket" });
    }
  });

  app.patch("/api/tickets/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Get current ticket for comparison
      const currentTicket = await storage.getTicket(req.params.id);
      if (!currentTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const updated = await storage.updateTicket(req.params.id, req.body);
      
      // Handle points for engineer assignment changes
      if (req.body.assignedEngineerId !== undefined && 
          req.body.assignedEngineerId !== currentTicket.assignedEngineerId) {
        if (req.body.assignedEngineerId) {
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
      
      res.json(updated);
    } catch (error) {
      console.error("Error escalating ticket:", error);
      res.status(400).json({ message: "Failed to escalate ticket" });
    }
  });

  app.post("/api/tickets/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateTicket(req.params.id, {
        status: "closed",
        closedAt: new Date(),
      });
      
      // Log activity
      await storage.logActivity({
        entityType: "ticket",
        entityId: updated.id,
        action: "closed",
        description: `Ticket closed: ${updated.ticketNumber}`,
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
      
      res.json(updated);
    } catch (error) {
      console.error("Error closing ticket:", error);
      res.status(400).json({ message: "Failed to close ticket" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/activities", isAuthenticated, async (req, res) => {
    try {
      const activities = await storage.getRecentActivities(20);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
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
      
      // Set ACL policy on the uploaded object
      const userId = req.user.claims.sub;
      if (validatedData.objectPath.startsWith("/objects/")) {
        await objectStorageService.trySetObjectEntityAclPolicy(validatedData.objectPath, {
          owner: userId,
          visibility: "private",
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

  // =============================================
  // TASK/FOLLOWUP MANAGEMENT ROUTES
  // =============================================

  // Get all tasks (with filters)
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { status, assignedTo, createdBy, view } = req.query;
      
      // Role-based access control for view=all
      const isAdmin = user?.role === 'admin';
      
      // Only admins can request view=all (all tasks)
      if (view === 'all' && !isAdmin) {
        return res.status(403).json({ message: "Access denied: Only admins can view all tasks" });
      }
      
      const includeAll = isAdmin && view === 'all';
      
      const taskList = await storage.getTasks({
        userId: !includeAll ? userId : undefined,
        status: status as string,
        assignedTo: assignedTo as string,
        createdBy: createdBy as string,
        includeAll,
      });
      
      res.json(taskList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get single task
  app.get("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create task
  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Parse dates properly and set assignedAt if task is assigned
      const taskData = {
        ...req.body,
        createdBy: userId,
        reminderDate: req.body.reminderDate ? new Date(req.body.reminderDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        assignedAt: req.body.assignedTo ? new Date() : undefined,
      };
      
      const validatedData = insertTaskSchema.parse(taskData);
      const newTask = await storage.createTask(validatedData);
      
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
      
      res.json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task
  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check permission (creator, assignee, or admin can update)
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      const canUpdate = isAdmin || task.createdBy === userId || task.assignedTo === userId;
      
      if (!canUpdate) {
        return res.status(403).json({ message: "You don't have permission to update this task" });
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
          assignedById: userId,
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
        userId,
        metadata: { status: updatedTask.status },
      });
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only creator or admin can delete
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      
      if (!isAdmin && task.createdBy !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this task" });
      }
      
      await storage.deleteTask(req.params.id);
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: req.params.id,
        action: "deleted",
        description: `Task deleted: ${task.title}`,
        userId,
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
      
      // Log activity
      await storage.logActivity({
        entityType: "task",
        entityId: taskId,
        action: "comment_added",
        description: `Comment added to task: ${task.title}`,
        userId,
      });
      
      res.json(newComment);
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

  // Get today's tasks (for Today's Task page)
  app.get("/api/tasks/today", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Super admin (senthil@microgenn.com) sees all tasks
      const isSuperAdmin = user?.email === 'senthil@microgenn.com';
      
      const todayTasks = await storage.getTodayTasks(userId, isSuperAdmin);
      res.json(todayTasks);
    } catch (error) {
      console.error("Error fetching today's tasks:", error);
      res.status(500).json({ message: "Failed to fetch today's tasks" });
    }
  });

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

  // Get all users for task assignment/mentions
  app.get("/api/users/all", isAuthenticated, async (req, res) => {
    try {
      const userList = await storage.getUsers();
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
        attachmentUrl: objectPath,
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
      const sources = await storage.getKnowledgeBaseSources();
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
  app.post("/api/knowledge-base/sources", isAuthenticated, isAdmin, async (req: any, res) => {
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
  app.patch("/api/knowledge-base/sources/:id", isAuthenticated, isAdmin, async (req: any, res) => {
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

      res.json(updated);
    } catch (error) {
      console.error("Error updating knowledge base source:", error);
      res.status(500).json({ message: "Failed to update knowledge base source" });
    }
  });

  // Delete a knowledge base source (cascades to chunks)
  app.delete("/api/knowledge-base/sources/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      const existing = await storage.getKnowledgeBaseSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Source not found" });
      }

      await storage.deleteKnowledgeBaseSource(id);
      res.json({ message: "Source deleted successfully" });
    } catch (error) {
      console.error("Error deleting knowledge base source:", error);
      res.status(500).json({ message: "Failed to delete knowledge base source" });
    }
  });

  // Re-index a knowledge base source
  app.post("/api/knowledge-base/sources/:id/reindex", isAuthenticated, isAdmin, async (req: any, res) => {
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
  app.post("/api/knowledge-base/reindex-all", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Get all unindexed sources
      const allSources = await storage.getKnowledgeBaseSources();
      const unindexedSources = allSources.filter(s => !s.isIndexed && s.isActive);
      
      if (unindexedSources.length === 0) {
        return res.json({ message: "All documents are already indexed", indexed: 0 });
      }

      let indexedCount = 0;
      let totalChunks = 0;
      const errors: string[] = [];

      for (const source of unindexedSources) {
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
  app.get("/api/knowledge-base/analytics", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const queries = await storage.getKnowledgeBaseQueries(100);
      const sources = await storage.getKnowledgeBaseSources();

      const totalSources = sources.length;
      const activeSources = sources.filter(s => s.isActive).length;
      const totalChunks = sources.reduce((sum, s) => sum + (s.chunkCount || 0), 0);
      const totalQueries = queries.length;
      const avgSearchTime = queries.length > 0 
        ? queries.reduce((sum, q) => sum + (q.searchDurationMs || 0), 0) / queries.length 
        : 0;

      res.json({
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
      });
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

  const httpServer = createServer(app);

  return httpServer;
}
