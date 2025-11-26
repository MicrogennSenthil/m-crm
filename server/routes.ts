import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { users, modules, projectModules, projectEngineers, tickets, ticketComments, escalationHistory } from "@shared/schema";
import { sendQuoteEmail, sendTicketClosureFeedbackEmail, sendTrainingConfirmationEmail, sendWelcomeEmail } from "./email";
import { eq } from "drizzle-orm";
import {
  insertCustomerSchema,
  insertLeadSchema,
  insertFollowUpSchema,
  insertQuoteSchema,
  insertProjectSchema,
  insertProjectEngineerSchema,
  insertModuleSchema,
  insertProjectModuleSchema,
  insertTrainingRecordSchema,
  insertTicketSchema,
  insertTicketCommentSchema,
  insertEscalationHistorySchema,
  insertFeedbackSchema,
  insertAttachmentSchema,
  insertUserSchema,
  insertUserRoleSchema,
  insertUserRoleRightSchema,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
      const newCustomer = await storage.createCustomer(validatedData);
      
      await storage.logActivity({
        entityType: "customer",
        entityId: newCustomer.id,
        action: "created",
        description: `New customer created: ${newCustomer.name}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newCustomer);
    } catch (error) {
      console.error("Error creating customer:", error);
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
      const newModule = await storage.createModule(validatedData);
      
      await storage.logActivity({
        entityType: "module",
        entityId: newModule.id,
        action: "created",
        description: `New module created: ${newModule.name}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newModule);
    } catch (error) {
      console.error("Error creating module:", error);
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

  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
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
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/users/:id", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // User Role routes
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

  app.post("/api/user-roles", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertUserRoleSchema.parse(req.body);
      const newRole = await storage.createUserRole(validatedData);
      
      await storage.logActivity({
        entityType: "user_role",
        entityId: newRole.id,
        action: "created",
        description: `New user role created: ${newRole.displayName}`,
        userId: req.user.claims.sub,
      });
      
      res.json(newRole);
    } catch (error) {
      console.error("Error creating user role:", error);
      res.status(400).json({ message: "Failed to create user role" });
    }
  });

  app.patch("/api/user-roles/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/user-roles/:id", isAuthenticated, async (req: any, res) => {
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

  // User Role Rights routes
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

  app.post("/api/user-role-rights", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/user-role-rights/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/user-role-rights/:id", isAuthenticated, async (req: any, res) => {
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
      // Convert date string to Date object if present
      let projectData = { ...req.body };
      if (projectData.implementationDate) {
        projectData.implementationDate = new Date(projectData.implementationDate);
      }
      
      const validatedData = insertProjectSchema.parse(projectData);
      const newProject = await storage.createProject(validatedData);
      
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

  app.patch("/api/project-modules/:id", isAuthenticated, async (req, res) => {
    try {
      let updateData = { ...req.body };
      
      // Convert completedAt string to Date object
      if (updateData.completedAt) {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      
      const updated = await storage.updateProjectModule(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project module:", error);
      res.status(400).json({ message: "Failed to update project module" });
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
              newTraining.trainingDate,
              newTraining.trainingHours
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
      const updated = await storage.updateTicket(req.params.id, req.body);
      
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

  const httpServer = createServer(app);

  return httpServer;
}
