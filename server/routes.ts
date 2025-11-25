import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { users, modules, projectModules, projectEngineers, tickets, ticketComments, escalationHistory } from "@shared/schema";
import { sendQuoteEmail, sendTicketClosureFeedbackEmail, sendTrainingConfirmationEmail, sendWelcomeEmail } from "./email";
import { eq } from "drizzle-orm";
import {
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
} from "@shared/schema";

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
      const updated = await storage.updateLead(req.params.id, req.body);
      
      // Log activity
      await storage.logActivity({
        entityType: "lead",
        entityId: updated.id,
        action: "updated",
        description: `Lead updated: ${updated.companyName} - Stage: ${updated.stage}`,
        userId: req.user.claims.sub,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(400).json({ message: "Failed to update lead" });
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
      const validatedData = insertFollowUpSchema.parse({
        ...req.body,
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
      const validatedData = insertProjectSchema.parse(req.body);
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
      const updated = await storage.updateProjectModule(req.params.id, req.body);
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

  const httpServer = createServer(app);

  return httpServer;
}
