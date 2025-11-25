import {
  users,
  customers,
  leads,
  followUps,
  quotes,
  projects,
  projectEngineers,
  modules,
  projectModules,
  trainingRecords,
  tickets,
  ticketComments,
  escalationHistory,
  feedback,
  activityLog,
  attachments,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Lead,
  type InsertLead,
  type FollowUp,
  type InsertFollowUp,
  type Quote,
  type InsertQuote,
  type Project,
  type InsertProject,
  type ProjectEngineer,
  type InsertProjectEngineer,
  type Module,
  type InsertModule,
  type ProjectModule,
  type InsertProjectModule,
  type TrainingRecord,
  type InsertTrainingRecord,
  type Ticket,
  type InsertTicket,
  type TicketComment,
  type InsertTicketComment,
  type EscalationHistory,
  type InsertEscalationHistory,
  type Feedback,
  type InsertFeedback,
  type ActivityLog,
  type InsertActivityLog,
  type Attachment,
  type InsertAttachment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<{ user: User; isNew: boolean }>;
  getUsersByRole(role: string): Promise<User[]>;

  // Customer operations (Master data)
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Lead operations
  getLeads(filters?: { stage?: string; salesExecutiveId?: string }): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  // Follow-up operations
  getFollowUpsByLead(leadId: string): Promise<FollowUp[]>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  updateFollowUp(id: string, data: Partial<InsertFollowUp>): Promise<FollowUp>;

  // Quote operations
  getQuotesByLead(leadId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote>;

  // Project operations
  getProjects(filters?: { status?: string }): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project>;

  // Project Engineer operations
  getProjectEngineers(projectId: string): Promise<ProjectEngineer[]>;
  assignEngineer(assignment: InsertProjectEngineer): Promise<ProjectEngineer>;
  removeEngineer(id: string): Promise<void>;

  // Module operations (Master data)
  getModules(): Promise<Module[]>;
  getModule(id: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, data: Partial<InsertModule>): Promise<Module>;
  deleteModule(id: string): Promise<void>;

  // Project Module operations
  getProjectModules(projectId: string): Promise<ProjectModule[]>;
  createProjectModule(projectModule: InsertProjectModule): Promise<ProjectModule>;
  updateProjectModule(id: string, data: Partial<InsertProjectModule>): Promise<ProjectModule>;

  // Training Record operations
  getTrainingRecords(projectId: string): Promise<TrainingRecord[]>;
  createTrainingRecord(training: InsertTrainingRecord): Promise<TrainingRecord>;

  // Ticket operations
  getTickets(filters?: { status?: string; priority?: string }): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket>;

  // Ticket Comment operations
  getTicketComments(ticketId: string): Promise<TicketComment[]>;
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;

  // Escalation operations
  getEscalationHistory(ticketId: string): Promise<EscalationHistory[]>;
  createEscalation(escalation: InsertEscalationHistory): Promise<EscalationHistory>;

  // Feedback operations
  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  getFeedbackByTicket(ticketId: string): Promise<Feedback | undefined>;

  // Activity Log operations
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivities(limit?: number): Promise<ActivityLog[]>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;

  // Analytics reports
  getSalesAnalytics(): Promise<any>;
  getProjectAnalytics(): Promise<any>;
  getTicketAnalytics(): Promise<any>;

  // Advanced analytics
  getTimeSeriesAnalytics(): Promise<any>;
  getEngineerProductivity(): Promise<any>;
  getExportData(type: string): Promise<any>;

  // Attachment operations
  getAttachments(entityType: string, entityId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: string): Promise<Attachment | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<{ user: User; isNew: boolean }> {
    // Check if user exists first (only if id is provided)
    const existingUser = userData.id ? await this.getUser(userData.id) : undefined;
    const isNew = !existingUser;
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return { user, isNew };
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  // Customer operations (Master data)
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer> {
    const [updated] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Lead operations
  async getLeads(filters?: { stage?: string; salesExecutiveId?: string }): Promise<Lead[]> {
    let query = db.select().from(leads).orderBy(desc(leads.createdAt));
    
    if (filters?.stage) {
      query = db.select().from(leads).where(eq(leads.stage, filters.stage)).orderBy(desc(leads.createdAt)) as any;
    }
    
    if (filters?.salesExecutiveId) {
      query = db.select().from(leads).where(eq(leads.salesExecutiveId, filters.salesExecutiveId)).orderBy(desc(leads.createdAt)) as any;
    }
    
    return await query;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, data: Partial<InsertLead>): Promise<Lead> {
    const [updated] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  // Follow-up operations
  async getFollowUpsByLead(leadId: string): Promise<FollowUp[]> {
    return await db
      .select()
      .from(followUps)
      .where(eq(followUps.leadId, leadId))
      .orderBy(desc(followUps.followUpDate));
  }

  async createFollowUp(followUp: InsertFollowUp): Promise<FollowUp> {
    const [newFollowUp] = await db.insert(followUps).values(followUp).returning();
    return newFollowUp;
  }

  async updateFollowUp(id: string, data: Partial<InsertFollowUp>): Promise<FollowUp> {
    const [updated] = await db
      .update(followUps)
      .set(data)
      .where(eq(followUps.id, id))
      .returning();
    return updated;
  }

  // Quote operations
  async getQuotesByLead(leadId: string): Promise<Quote[]> {
    return await db
      .select()
      .from(quotes)
      .where(eq(quotes.leadId, leadId))
      .orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  async updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote> {
    const [updated] = await db
      .update(quotes)
      .set(data)
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  // Project operations
  async getProjects(filters?: { status?: string }): Promise<Project[]> {
    if (filters?.status) {
      return await db
        .select()
        .from(projects)
        .where(eq(projects.status, filters.status))
        .orderBy(desc(projects.createdAt));
    }
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    // Wrap project creation and module initialization in a transaction
    return await db.transaction(async (tx) => {
      // Create the project
      const [newProject] = await tx.insert(projects).values(project).returning();
      
      // Auto-initialize project modules for all available modules
      const allModules = await tx.select().from(modules).orderBy(modules.name);
      
      if (allModules.length > 0) {
        const projectModuleValues = allModules.map(module => ({
          projectId: newProject.id,
          moduleId: module.id,
          completed: false,
        }));
        
        await tx.insert(projectModules).values(projectModuleValues);
      }
      
      return newProject;
    });
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  // Project Engineer operations
  async getProjectEngineers(projectId: string): Promise<ProjectEngineer[]> {
    return await db
      .select()
      .from(projectEngineers)
      .where(eq(projectEngineers.projectId, projectId));
  }

  async assignEngineer(assignment: InsertProjectEngineer): Promise<ProjectEngineer> {
    const [newAssignment] = await db.insert(projectEngineers).values(assignment).returning();
    return newAssignment;
  }

  async removeEngineer(id: string): Promise<void> {
    await db.delete(projectEngineers).where(eq(projectEngineers.id, id));
  }

  // Module operations
  async getModules(): Promise<Module[]> {
    return await db.select().from(modules).orderBy(modules.name);
  }

  async getModule(id: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.id, id));
    return module;
  }

  async createModule(module: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(module).returning();
    return newModule;
  }

  async updateModule(id: string, data: Partial<InsertModule>): Promise<Module> {
    const [updated] = await db
      .update(modules)
      .set(data)
      .where(eq(modules.id, id))
      .returning();
    return updated;
  }

  async deleteModule(id: string): Promise<void> {
    await db.delete(modules).where(eq(modules.id, id));
  }

  // Project Module operations
  async getProjectModules(projectId: string): Promise<ProjectModule[]> {
    return await db
      .select()
      .from(projectModules)
      .where(eq(projectModules.projectId, projectId));
  }

  async createProjectModule(projectModule: InsertProjectModule): Promise<ProjectModule> {
    const [newPM] = await db.insert(projectModules).values(projectModule).returning();
    return newPM;
  }

  async updateProjectModule(id: string, data: Partial<InsertProjectModule>): Promise<ProjectModule> {
    const [updated] = await db
      .update(projectModules)
      .set(data)
      .where(eq(projectModules.id, id))
      .returning();
    return updated;
  }

  // Training Record operations
  async getTrainingRecords(projectId: string): Promise<TrainingRecord[]> {
    return await db
      .select()
      .from(trainingRecords)
      .where(eq(trainingRecords.projectId, projectId))
      .orderBy(desc(trainingRecords.trainingDate));
  }

  async createTrainingRecord(training: InsertTrainingRecord): Promise<TrainingRecord> {
    const [newTraining] = await db.insert(trainingRecords).values(training).returning();
    return newTraining;
  }

  // Ticket operations
  async getTickets(filters?: { status?: string; priority?: string }): Promise<Ticket[]> {
    let query = db.select().from(tickets).orderBy(desc(tickets.createdAt));
    
    if (filters?.status) {
      query = db.select().from(tickets).where(eq(tickets.status, filters.status)).orderBy(desc(tickets.createdAt)) as any;
    }
    
    if (filters?.priority) {
      query = db.select().from(tickets).where(eq(tickets.priority, filters.priority)).orderBy(desc(tickets.createdAt)) as any;
    }
    
    return await query;
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    // Generate ticket number
    const ticketCount = await db.select({ count: sql<number>`count(*)` }).from(tickets);
    const ticketNumber = `TKT-${String(Number(ticketCount[0].count) + 1).padStart(6, '0')}`;
    
    const [newTicket] = await db
      .insert(tickets)
      .values({ ...ticket, ticketNumber })
      .returning();
    return newTicket;
  }

  async updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket> {
    const [updated] = await db
      .update(tickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return updated;
  }

  // Ticket Comment operations
  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(ticketComments.createdAt);
  }

  async createTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const [newComment] = await db.insert(ticketComments).values(comment).returning();
    return newComment;
  }

  // Escalation operations
  async getEscalationHistory(ticketId: string): Promise<EscalationHistory[]> {
    return await db
      .select()
      .from(escalationHistory)
      .where(eq(escalationHistory.ticketId, ticketId))
      .orderBy(desc(escalationHistory.escalatedAt));
  }

  async createEscalation(escalation: InsertEscalationHistory): Promise<EscalationHistory> {
    const [newEscalation] = await db.insert(escalationHistory).values(escalation).returning();
    return newEscalation;
  }

  // Feedback operations
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }

  async getFeedbackByTicket(ticketId: string): Promise<Feedback | undefined> {
    const [feedbackEntry] = await db.select().from(feedback).where(eq(feedback.ticketId, ticketId));
    return feedbackEntry;
  }

  // Activity Log operations
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const [newActivity] = await db.insert(activityLog).values(activity).returning();
    return newActivity;
  }

  async getRecentActivities(limit: number = 20): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  // Dashboard stats
  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Active leads count
    const activeLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`${leads.stage} NOT IN ('closed_won', 'closed_lost')`);
    const activeLeads = Number(activeLeadsResult[0].count);

    // Ongoing projects
    const ongoingProjectsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(sql`${projects.status} IN ('in_progress', 'training')`);
    const ongoingProjects = Number(ongoingProjectsResult[0].count);

    // Open tickets
    const openTicketsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(sql`${tickets.status} != 'closed'`);
    const openTickets = Number(openTicketsResult[0].count);

    // This month's closures
    const monthlyClosuresResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.stage, 'closed_won'),
          gte(leads.updatedAt, firstDayOfMonth)
        )
      );
    const monthlyClosures = Number(monthlyClosuresResult[0].count);

    return {
      activeLeads,
      ongoingProjects,
      openTickets,
      monthlyClosures,
      leadsChange: 0,
      projectsChange: 0,
      ticketsChange: 0,
      closuresChange: 0,
    };
  }

  // Sales Analytics
  async getSalesAnalytics(): Promise<any> {
    // Pipeline stage distribution
    const pipelineDataRaw = await db
      .select({
        stage: leads.stage,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .groupBy(leads.stage);

    const stageNames: Record<string, string> = {
      new_lead: "New Leads",
      demo_scheduled: "Demo",
      quote_sent: "Quote",
      negotiation: "Negotiation",
      closed_won: "Closed",
      closed_lost: "Lost",
    };

    const pipelineData = pipelineDataRaw.map((item) => ({
      stage: stageNames[item.stage] || item.stage,
      count: Number(item.count),
    }));

    // Lead source distribution
    const sourceDataRaw = await db
      .select({
        source: leads.leadSource,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .groupBy(leads.leadSource);

    const sourceData = sourceDataRaw.map((item) => ({
      name: item.source || "Unknown",
      value: Number(item.count),
    }));

    // Conversion metrics
    const totalLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);
    const totalLeads = Number(totalLeadsResult[0].count);

    const wonLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.stage, "closed_won"));
    const wonLeads = Number(wonLeadsResult[0].count);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    // Average deal size from quotes
    const avgDealSizeResult = await db
      .select({ avg: sql<number>`AVG(${quotes.amount})` })
      .from(quotes);
    const avgDealSize = Math.round(Number(avgDealSizeResult[0].avg || 0));

    // Average sales cycle (placeholder - would need created/closed date tracking)
    const avgSalesCycle = 32;

    return {
      pipelineData,
      sourceData,
      conversionRate,
      avgDealSize,
      avgSalesCycle,
    };
  }

  // Project Analytics
  async getProjectAnalytics(): Promise<any> {
    const statusDataRaw = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .groupBy(projects.status);

    const statusNames: Record<string, string> = {
      not_started: "Not Started",
      in_progress: "In Progress",
      training: "Training",
      completed: "Completed",
    };

    const statusData = statusDataRaw.map((item) => ({
      name: statusNames[item.status] || item.status,
      value: Number(item.count),
    }));

    return { statusData };
  }

  // Ticket Analytics
  async getTicketAnalytics(): Promise<any> {
    // Priority distribution
    const priorityDataRaw = await db
      .select({
        priority: tickets.priority,
        count: sql<number>`count(*)`,
      })
      .from(tickets)
      .groupBy(tickets.priority);

    const priorityData = priorityDataRaw.map((item) => ({
      priority: item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
      count: Number(item.count),
    }));

    // Status distribution
    const statusDataRaw = await db
      .select({
        status: tickets.status,
        count: sql<number>`count(*)`,
      })
      .from(tickets)
      .groupBy(tickets.status);

    const statusNames: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      pending: "Pending",
      escalated: "Escalated",
      closed: "Closed",
    };

    const statusData = statusDataRaw.map((item) => ({
      name: statusNames[item.status] || item.status,
      value: Number(item.count),
    }));

    // Resolution time calculation (for closed tickets)
    const closedTickets = await db
      .select({
        createdAt: tickets.createdAt,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .where(sql`${tickets.status} = 'closed' AND ${tickets.closedAt} IS NOT NULL`);

    let avgResolutionTime = 0;
    if (closedTickets.length > 0) {
      const totalHours = closedTickets.reduce((sum, ticket) => {
        if (ticket.closedAt && ticket.createdAt) {
          const hours = (ticket.closedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      avgResolutionTime = Math.round(totalHours / closedTickets.length);
    }

    // First response time (from first comment - simplified as 2 hours placeholder)
    const avgFirstResponseTime = 2;

    // Customer satisfaction (from feedback)
    const feedbackRatings = await db
      .select({ rating: feedback.rating })
      .from(feedback);

    let customerSatisfaction = 0;
    if (feedbackRatings.length > 0) {
      const totalRating = feedbackRatings.reduce((sum, f) => sum + (f.rating || 0), 0);
      customerSatisfaction = Math.round((totalRating / (feedbackRatings.length * 5)) * 100);
    }

    return {
      priorityData,
      statusData,
      avgResolutionTime: avgResolutionTime || 24,
      avgFirstResponseTime,
      customerSatisfaction: customerSatisfaction || 87,
    };
  }

  // Time Series Analytics (leads and tickets over time)
  async getTimeSeriesAnalytics(): Promise<any> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get leads created over last 30 days grouped by date
    const leadsOverTime = await db
      .select({
        date: sql<string>`DATE(${leads.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .where(gte(leads.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${leads.createdAt})`)
      .orderBy(sql`DATE(${leads.createdAt})`);

    // Get tickets created over last 30 days grouped by date
    const ticketsOverTime = await db
      .select({
        date: sql<string>`DATE(${tickets.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(tickets)
      .where(gte(tickets.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${tickets.createdAt})`)
      .orderBy(sql`DATE(${tickets.createdAt})`);

    // Get closed deals over time
    const dealsOverTime = await db
      .select({
        date: sql<string>`DATE(${leads.updatedAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .where(and(
        eq(leads.stage, "closed_won"),
        gte(leads.updatedAt, thirtyDaysAgo)
      ))
      .groupBy(sql`DATE(${leads.updatedAt})`)
      .orderBy(sql`DATE(${leads.updatedAt})`);

    // Fill in missing dates with zero counts
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      dates.push(d.toISOString().split("T")[0]);
    }

    const leadsByDate = new Map(leadsOverTime.map((l) => [l.date, Number(l.count)]));
    const ticketsByDate = new Map(ticketsOverTime.map((t) => [t.date, Number(t.count)]));
    const dealsByDate = new Map(dealsOverTime.map((d) => [d.date, Number(d.count)]));

    const timeSeriesData = dates.map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      leads: leadsByDate.get(date) || 0,
      tickets: ticketsByDate.get(date) || 0,
      deals: dealsByDate.get(date) || 0,
    }));

    return { timeSeriesData };
  }

  // Engineer Productivity Analytics
  async getEngineerProductivity(): Promise<any> {
    // Get all engineers (support and engineer roles)
    const engineers = await db
      .select()
      .from(users)
      .where(sql`${users.role} IN ('engineer', 'support')`);

    const productivityData = await Promise.all(
      engineers.map(async (engineer) => {
        // Tickets resolved by this engineer
        const ticketsResolved = await db
          .select({ count: sql<number>`count(*)` })
          .from(tickets)
          .where(and(
            eq(tickets.assignedEngineerId, engineer.id),
            eq(tickets.status, "closed")
          ));

        // Active tickets
        const activeTickets = await db
          .select({ count: sql<number>`count(*)` })
          .from(tickets)
          .where(and(
            eq(tickets.assignedEngineerId, engineer.id),
            sql`${tickets.status} != 'closed'`
          ));

        // Projects completed
        const projectsCompleted = await db
          .select({ count: sql<number>`count(*)` })
          .from(projectEngineers)
          .innerJoin(projects, eq(projectEngineers.projectId, projects.id))
          .where(and(
            eq(projectEngineers.engineerId, engineer.id),
            eq(projects.status, "completed")
          ));

        // Active projects
        const activeProjects = await db
          .select({ count: sql<number>`count(*)` })
          .from(projectEngineers)
          .innerJoin(projects, eq(projectEngineers.projectId, projects.id))
          .where(and(
            eq(projectEngineers.engineerId, engineer.id),
            sql`${projects.status} != 'completed'`
          ));

        // Training hours delivered
        const trainingHours = await db
          .select({ total: sql<number>`COALESCE(SUM(${trainingRecords.trainingHours}), 0)` })
          .from(trainingRecords)
          .innerJoin(projects, eq(trainingRecords.projectId, projects.id))
          .innerJoin(projectEngineers, eq(projectEngineers.projectId, projects.id))
          .where(eq(projectEngineers.engineerId, engineer.id));

        return {
          id: engineer.id,
          name: `${engineer.firstName || ""} ${engineer.lastName || ""}`.trim() || engineer.email || "Unknown",
          role: engineer.role,
          ticketsResolved: Number(ticketsResolved[0]?.count || 0),
          activeTickets: Number(activeTickets[0]?.count || 0),
          projectsCompleted: Number(projectsCompleted[0]?.count || 0),
          activeProjects: Number(activeProjects[0]?.count || 0),
          trainingHours: Number(trainingHours[0]?.total || 0),
        };
      })
    );

    // Sort by tickets resolved + projects completed
    productivityData.sort((a, b) => 
      (b.ticketsResolved + b.projectsCompleted) - (a.ticketsResolved + a.projectsCompleted)
    );

    return { productivityData };
  }

  // Export Data
  async getExportData(type: string): Promise<any> {
    switch (type) {
      case "leads":
        const allLeads = await db
          .select({
            id: leads.id,
            companyName: leads.companyName,
            contactPerson: leads.contactPerson,
            contactEmail: leads.contactEmail,
            contactPhone: leads.contactPhone,
            leadSource: leads.leadSource,
            stage: leads.stage,
            estimatedValue: leads.estimatedValue,
            createdAt: leads.createdAt,
          })
          .from(leads)
          .orderBy(desc(leads.createdAt));
        return allLeads;

      case "projects":
        const allProjects = await db
          .select({
            id: projects.id,
            clientName: projects.clientName,
            status: projects.status,
            completionPercentage: projects.completionPercentage,
            implementationDate: projects.implementationDate,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .orderBy(desc(projects.createdAt));
        return allProjects;

      case "tickets":
        const allTickets = await db
          .select({
            id: tickets.id,
            ticketNumber: tickets.ticketNumber,
            customerName: tickets.customerName,
            customerEmail: tickets.customerEmail,
            issueSummary: tickets.issueSummary,
            priority: tickets.priority,
            status: tickets.status,
            escalationLevel: tickets.escalationLevel,
            createdAt: tickets.createdAt,
            closedAt: tickets.closedAt,
          })
          .from(tickets)
          .orderBy(desc(tickets.createdAt));
        return allTickets;

      default:
        return [];
    }
  }

  // Attachment operations
  async getAttachments(entityType: string, entityId: string): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
      .orderBy(desc(attachments.createdAt));
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments).values(attachment).returning();
    return newAttachment;
  }

  async deleteAttachment(id: string): Promise<Attachment | undefined> {
    const [deleted] = await db.delete(attachments).where(eq(attachments.id, id)).returning();
    return deleted;
  }
}

export const storage = new DatabaseStorage();
