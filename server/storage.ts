import {
  users,
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
  type User,
  type UpsertUser,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;

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

  // Module operations
  getModules(): Promise<Module[]>;
  getModule(id: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;

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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
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
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
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
      leadsChange: 0, // Placeholder for month-over-month change
      projectsChange: 0,
      ticketsChange: 0,
      closuresChange: 0,
    };
  }
}

export const storage = new DatabaseStorage();
