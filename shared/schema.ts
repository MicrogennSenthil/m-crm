import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth and Local Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).notNull().default("sales_executive"), // sales_executive, engineer, support, admin
  departmentId: varchar("department_id"), // Reference to departments table
  // Local authentication fields
  passwordHash: varchar("password_hash"), // Bcrypt hashed password
  isEmailVerified: boolean("is_email_verified").default(false),
  isActive: boolean("is_active").default(true),
  isApproved: boolean("is_approved").default(false), // Admin approval required for login
  approvedBy: varchar("approved_by"), // Admin user ID who approved this user
  approvedAt: timestamp("approved_at"), // When the user was approved
  authProvider: varchar("auth_provider", { length: 20 }).default("local"), // local, replit
  lastLoginAt: timestamp("last_login_at"),
  // Impersonation tracking
  impersonatedBy: varchar("impersonated_by"), // Super admin user ID when impersonating
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  isEmailVerified: true,
  isActive: true,
  authProvider: true,
  lastLoginAt: true,
  impersonatedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// OTP Verification table for email verification
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  otpCode: varchar("otp_code", { length: 6 }).notNull(),
  purpose: varchar("purpose", { length: 20 }).notNull().default("signup"), // signup, login, password_reset
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  isUsed: true,
  attempts: true,
  createdAt: true,
});

export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type OtpVerification = typeof otpVerifications.$inferSelect;

// User Roles table - Define available roles in the system
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // admin, sales_executive, engineer, support
  displayName: text("display_name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isSupportAssignable: boolean("is_support_assignable").default(false), // Can be assigned to support tickets
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// User Role Rights table - Define permissions for each role
export const userRoleRights = pgTable("user_role_rights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // dashboard, sales, implementations, support, reports, masters
  canView: boolean("can_view").default(false),
  canCreate: boolean("can_create").default(false),
  canEdit: boolean("can_edit").default(false),
  canDelete: boolean("can_delete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserRoleRightSchema = createInsertSchema(userRoleRights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserRoleRight = z.infer<typeof insertUserRoleRightSchema>;
export type UserRoleRight = typeof userRoleRights.$inferSelect;

// Customers table - Master data for customer companies
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Company name
  contactPerson: text("contact_person"), // Primary contact name
  designation: text("designation"), // Contact's job title
  email: text("email"),
  phone: text("phone"),
  alternatePhone: text("alternate_phone"),
  website: text("website"),
  industry: text("industry"), // Industry type
  company: text("company"), // Parent company (if subsidiary)
  gstNumber: text("gst_number"), // Tax ID
  panNumber: text("pan_number"), // PAN for India
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  pincode: text("pincode"),
  status: text("status").notNull().default("active"), // active, inactive
  customerType: text("customer_type").default("prospect"), // prospect, customer, partner
  selectedModules: text("selected_modules").array(), // Modules the customer is interested in
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Leads table - Sales Pipeline
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id), // Link to Company Master
  companyName: text("company_name").notNull(), // Denormalized for display, auto-filled from customer
  contactPerson: text("contact_person").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  leadSource: text("lead_source").notNull(), // facebook, linkedin, instagram, referral, website, etc.
  estimatedValue: integer("estimated_value"), // in currency units
  stage: text("stage").notNull().default("new_lead"), // new_lead, demo_scheduled, quote_sent, negotiation, closed_won, closed_lost
  salesExecutiveId: varchar("sales_executive_id").references(() => users.id),
  demoDate: timestamp("demo_date"), // Scheduled demo date and time
  // Quote stage fields
  quoteSentDate: timestamp("quote_sent_date"), // When quote was sent
  quoteValue: integer("quote_value"), // Quote amount
  selectedModules: text("selected_modules").array(), // Array of module names
  // Negotiation stage fields
  negotiationDate: timestamp("negotiation_date"), // When negotiation started
  // Close deal fields
  closedDate: timestamp("closed_date"), // When deal was closed (won or lost)
  confirmedOrderValue: integer("confirmed_order_value"), // Final confirmed order value
  closedReason: text("closed_reason"), // Reason for lost deals
  lostAmount: integer("lost_amount"), // Value of the lost deal for tracking
  daysInStage: integer("days_in_stage").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  daysInStage: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Follow-ups table - Track multiple touchpoints with leads
export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  notes: text("notes").notNull(),
  followUpDate: timestamp("follow_up_date").notNull(),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
});

export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type FollowUp = typeof followUps.$inferSelect;

// Lead Comments table - Comments from admins/heads on leads
export const leadComments = pgTable("lead_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeadCommentSchema = createInsertSchema(leadComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLeadComment = z.infer<typeof insertLeadCommentSchema>;
export type LeadComment = typeof leadComments.$inferSelect;

// Demo Date History table - Track all demo date changes
export const demoDateHistory = pgTable("demo_date_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  demoDate: timestamp("demo_date").notNull(),
  changedById: varchar("changed_by_id").references(() => users.id),
  changeReason: text("change_reason"), // optional reason for reschedule
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDemoDateHistorySchema = createInsertSchema(demoDateHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertDemoDateHistory = z.infer<typeof insertDemoDateHistorySchema>;
export type DemoDateHistory = typeof demoDateHistory.$inferSelect;

// Negotiation Date History table - Track all negotiation date changes
export const negotiationDateHistory = pgTable("negotiation_date_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  negotiationDate: timestamp("negotiation_date").notNull(),
  notes: text("notes"), // optional notes about this negotiation round
  changedById: varchar("changed_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNegotiationDateHistorySchema = createInsertSchema(negotiationDateHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertNegotiationDateHistory = z.infer<typeof insertNegotiationDateHistorySchema>;
export type NegotiationDateHistory = typeof negotiationDateHistory.$inferSelect;

// Quotes table - Sales quotes sent to leads
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// Projects table - Implementation phase
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id), // Link to Customer Master
  leadId: varchar("lead_id").references(() => leads.id),
  clientName: text("client_name").notNull(), // Denormalized for display
  implementationDate: timestamp("implementation_date"),
  targetGoLiveDate: timestamp("target_go_live_date"), // Target completion date for overdue tracking
  plannedEndDate: timestamp("planned_end_date"), // Planned project end date
  status: text("status").notNull().default("not_started"), // not_started, in_progress, training, completed
  completionPercentage: integer("completion_percentage").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Project Engineer Assignment table
export const projectEngineers = pgTable("project_engineers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  engineerId: varchar("engineer_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const insertProjectEngineerSchema = createInsertSchema(projectEngineers).omit({
  id: true,
  assignedAt: true,
});

export type InsertProjectEngineer = z.infer<typeof insertProjectEngineerSchema>;
export type ProjectEngineer = typeof projectEngineers.$inferSelect;

// Modules table - Available implementation modules
export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  createdAt: true,
});

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

// Project Modules table - Track module completion per project with scheduling
export const projectModules = pgTable("project_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").notNull().references(() => modules.id),
  // Planning/Scheduling fields
  assignedEngineerId: varchar("assigned_engineer_id").references(() => users.id), // Planned engineer
  scheduledStartDate: timestamp("scheduled_start_date"),
  scheduledEndDate: timestamp("scheduled_end_date"),
  departmentName: text("department_name"), // Client department for this module installation
  departmentContact: text("department_contact"), // Contact person at the department
  installationStatus: text("installation_status").default("pending"), // pending, scheduled, in_progress, completed
  installationNotes: text("installation_notes"),
  // Actual visit/work fields (may differ from planned)
  actualEngineerId: varchar("actual_engineer_id").references(() => users.id), // Engineer who actually visited
  actualVisitDate: timestamp("actual_visit_date"), // When work was actually done
  // Completion tracking
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
});

export const insertProjectModuleSchema = createInsertSchema(projectModules).omit({
  id: true,
});

export type InsertProjectModule = z.infer<typeof insertProjectModuleSchema>;
export type ProjectModule = typeof projectModules.$inferSelect;

// Planning Change Log table - Track all changes to module planning
export const planningChangeLogs = pgTable("planning_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectModuleId: varchar("project_module_id").notNull().references(() => projectModules.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  changedBy: varchar("changed_by").references(() => users.id), // User who made the change
  changeType: text("change_type").notNull(), // engineer_changed, date_changed, status_changed, etc.
  fieldName: text("field_name").notNull(), // Which field was changed
  oldValue: text("old_value"), // Previous value
  newValue: text("new_value"), // New value
  oldEngineerId: varchar("old_engineer_id").references(() => users.id), // For engineer changes
  newEngineerId: varchar("new_engineer_id").references(() => users.id), // For engineer changes
  reason: text("reason"), // Optional reason for the change
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlanningChangeLogSchema = createInsertSchema(planningChangeLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertPlanningChangeLog = z.infer<typeof insertPlanningChangeLogSchema>;
export type PlanningChangeLog = typeof planningChangeLogs.$inferSelect;

// Project Progress Entries table - Track daily implementation progress with proof
export const projectProgressEntries = pgTable("project_progress_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  engineerId: varchar("engineer_id").references(() => users.id),
  progressDate: timestamp("progress_date").notNull(),
  progressType: text("progress_type").default("installation"), // installation, training, handoff
  description: text("description").notNull(),
  attachments: jsonb("attachments").$type<Array<{
    type: 'photo' | 'video' | 'file';
    url: string;
    name: string;
    size?: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

const progressAttachmentSchema = z.object({
  type: z.enum(['photo', 'video', 'file']),
  url: z.string(),
  name: z.string(),
  size: z.number().optional(),
});

export const insertProjectProgressEntrySchema = createInsertSchema(projectProgressEntries)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    attachments: z.array(progressAttachmentSchema).nullable().optional(),
  });

export type InsertProjectProgressEntry = z.infer<typeof insertProjectProgressEntrySchema>;
export type ProjectProgressEntry = typeof projectProgressEntries.$inferSelect;

// Training Sessions table - Schedule future training sessions
export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").notNull().references(() => modules.id),
  assignedEngineerId: varchar("assigned_engineer_id").references(() => users.id),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  recipientDepartment: text("recipient_department"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledHours: integer("scheduled_hours").notNull(),
  status: text("status").default("scheduled"), // scheduled, in_progress, completed, cancelled
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type TrainingSession = typeof trainingSessions.$inferSelect;

// Training Records table - Log completed training sessions
export const trainingRecords = pgTable("training_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").notNull().references(() => modules.id),
  trainingSessionId: varchar("training_session_id").references(() => trainingSessions.id), // Link to scheduled session
  recipientName: text("recipient_name").notNull(),
  trainingHours: integer("training_hours").notNull(),
  trainingDate: timestamp("training_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrainingRecordSchema = createInsertSchema(trainingRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertTrainingRecord = z.infer<typeof insertTrainingRecordSchema>;
export type TrainingRecord = typeof trainingRecords.$inferSelect;

// Project Handoffs table - Track project completion and support transition
export const projectHandoffs = pgTable("project_handoffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  completionCertificateIssued: boolean("completion_certificate_issued").default(false),
  completionCertificateDate: timestamp("completion_certificate_date"),
  trainingCertificateIssued: boolean("training_certificate_issued").default(false),
  trainingCertificateDate: timestamp("training_certificate_date"),
  handoffDate: timestamp("handoff_date"),
  handoffToTeam: text("handoff_to_team").default("support"), // support, maintenance
  handoffById: varchar("handoff_by_id").references(() => users.id),
  notes: text("notes"),
  status: text("status").default("pending"), // pending, certificates_issued, handed_off
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectHandoffSchema = createInsertSchema(projectHandoffs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectHandoff = z.infer<typeof insertProjectHandoffSchema>;
export type ProjectHandoff = typeof projectHandoffs.$inferSelect;

// Support Tickets table
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => customers.id), // Link to Customer Master
  projectId: varchar("project_id").references(() => projects.id),
  moduleId: varchar("module_id").references(() => modules.id), // Related module for the issue
  customerName: text("customer_name").notNull(), // Denormalized for display
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"), // Contact phone
  issueSummary: text("issue_summary").notNull(),
  issueDescription: text("issue_description").notNull(),
  attachments: text("attachments").array(), // Array of file URLs for images/attachments
  priority: text("priority").notNull().default("medium"), // critical, high, medium, low
  status: text("status").notNull().default("open"), // open, in_progress, pending_customer, escalated, closed, reopened
  assignedEngineerId: varchar("assigned_engineer_id").references(() => users.id),
  dueDate: timestamp("due_date"), // Due date for SLA tracking and overdue detection
  resolvedAt: timestamp("resolved_at"), // When the ticket was actually resolved (for MTTR calculation)
  escalationLevel: integer("escalation_level").default(1), // 1: Support Engineer, 2: Senior Support, 3: Development Team
  escalatedAt: timestamp("escalated_at"),
  closedAt: timestamp("closed_at"),
  // Reopen tracking
  reopenedFromTicketId: varchar("reopened_from_ticket_id"), // Reference to original closed ticket
  reopenReason: text("reopen_reason"),
  reopenedAt: timestamp("reopened_at"),
  // Feedback tracking
  feedbackStatus: text("feedback_status").default("pending"), // pending, sent, responded
  feedbackSentAt: timestamp("feedback_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Ticket Comments/Conversation table
export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  comment: text("comment").notNull(),
  isInternal: boolean("is_internal").default(false), // internal notes vs customer-facing
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({
  id: true,
  createdAt: true,
});

export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;

// Escalation History table
export const escalationHistory = pgTable("escalation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  fromLevel: integer("from_level").notNull(),
  toLevel: integer("to_level").notNull(),
  reason: text("reason"),
  escalatedBy: varchar("escalated_by").references(() => users.id),
  escalatedAt: timestamp("escalated_at").defaultNow(),
});

export const insertEscalationHistorySchema = createInsertSchema(escalationHistory).omit({
  id: true,
  escalatedAt: true,
});

export type InsertEscalationHistory = z.infer<typeof insertEscalationHistorySchema>;
export type EscalationHistory = typeof escalationHistory.$inferSelect;

// Customer Feedback table
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  rating: integer("rating"), // 1-5 stars
  comments: text("comments"),
  satisfied: boolean("satisfied"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  submittedAt: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// Activity Log table - Complete history of customer interactions
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // lead, project, ticket, etc.
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(), // created, updated, status_changed, assigned, etc.
  description: text("description").notNull(),
  userId: varchar("user_id").references(() => users.id),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

// Attachments table - File management for quotes, contracts, training materials, tickets
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // lead, quote, project, ticket, training
  entityId: varchar("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // mime type
  fileSize: integer("file_size").notNull(), // in bytes
  objectPath: text("object_path").notNull(), // path in object storage
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// Tasks table - Task/Followup management system
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, followup, completed, get_information
  priority: text("priority").default("medium"), // low, medium, high, urgent
  createdBy: varchar("created_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"), // When the task was assigned
  mentionedUsers: text("mentioned_users").array(), // User IDs mentioned in the task
  reminderDate: timestamp("reminder_date"),
  dueDate: timestamp("due_date"),
  voiceNoteUrl: text("voice_note_url"), // Object storage path for voice recording
  voiceNoteDuration: integer("voice_note_duration"), // Duration in seconds
  attachments: jsonb("attachments").$type<TaskAttachment[]>(), // Video recordings, photos, and file attachments
  relatedEntityType: text("related_entity_type"), // lead, project, ticket, customer
  relatedEntityId: varchar("related_entity_id"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task attachment type for videos, photos, and files
export type TaskAttachment = {
  id: string;
  type: "video" | "photo" | "file";
  url: string;
  name: string;
  size?: number;
  duration?: number; // For video recordings in seconds
  mimeType?: string;
  thumbnailUrl?: string; // For video thumbnails
  createdAt: string;
};

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task Comments table - Comments on tasks
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  voiceNoteUrl: text("voice_note_url"), // Optional voice note for comment
  voiceNoteDuration: integer("voice_note_duration"),
  mentionedUsers: text("mentioned_users").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// Task Followups table - Track follow-up entries with voice/video/text/image
export const taskFollowups = pgTable("task_followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  followupType: text("followup_type").notNull().default("text"), // text, voice, video, image
  description: text("description"), // Text description of the follow-up
  voiceNoteUrl: text("voice_note_url"), // Object storage path for voice recording
  voiceNoteDuration: integer("voice_note_duration"), // Duration in seconds
  videoUrl: text("video_url"), // Object storage path for video recording
  videoDuration: integer("video_duration"), // Duration in seconds
  videoThumbnailUrl: text("video_thumbnail_url"), // Thumbnail for video
  imageUrl: text("image_url"), // Object storage path for image
  nextFollowupDate: timestamp("next_followup_date"), // When next follow-up is due
  status: text("status").notNull().default("completed"), // completed, pending_next
  createdAt: timestamp("created_at").defaultNow(),
});

// Task followup attachment type
export type TaskFollowupAttachment = {
  type: "voice" | "video" | "image";
  url: string;
  duration?: number;
  thumbnailUrl?: string;
};

export const insertTaskFollowupSchema = createInsertSchema(taskFollowups).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskFollowup = z.infer<typeof insertTaskFollowupSchema>;
export type TaskFollowup = typeof taskFollowups.$inferSelect;

// Customer with lifecycle info for support ticket creation
export type CustomerWithLifecycle = Customer & {
  lifecycleStatus: "handed_off" | "in_implementation" | "prospect" | "existing";
  projects: {
    id: string;
    clientName: string;
    status: string;
    handoffStatus: string | null;
    handoffDate: Date | null;
  }[];
};

// Departments table - Organize users by department
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: varchar("manager_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// System Modules catalog - Available modules/forms in the system for permissions
export const systemModules = pgTable("system_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // dashboard, sales, implementations, support, reports, masters, tasks
  displayName: text("display_name").notNull(),
  description: text("description"),
  icon: text("icon"), // Lucide icon name
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemModuleSchema = createInsertSchema(systemModules).omit({
  id: true,
  createdAt: true,
});

export type InsertSystemModule = z.infer<typeof insertSystemModuleSchema>;
export type SystemModule = typeof systemModules.$inferSelect;

// User Role Assignments - Many-to-many relationship between users and roles
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false),
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;

// Role Change History - Audit trail for role changes
export const roleChangeHistory = pgTable("role_change_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  previousRoleId: varchar("previous_role_id").references(() => userRoles.id),
  newRoleId: varchar("new_role_id").references(() => userRoles.id),
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleChangeHistorySchema = createInsertSchema(roleChangeHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertRoleChangeHistory = z.infer<typeof insertRoleChangeHistorySchema>;
export type RoleChangeHistory = typeof roleChangeHistory.$inferSelect;

// User Module Permissions - Individual user permission overrides
export const userModulePermissions = pgTable("user_module_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").notNull().references(() => systemModules.id, { onDelete: "cascade" }),
  canView: boolean("can_view").default(false),
  canCreate: boolean("can_create").default(false),
  canEdit: boolean("can_edit").default(false),
  canDelete: boolean("can_delete").default(false),
  grantedBy: varchar("granted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserModulePermissionSchema = createInsertSchema(userModulePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserModulePermission = z.infer<typeof insertUserModulePermissionSchema>;
export type UserModulePermission = typeof userModulePermissions.$inferSelect;

// Extended User type with role and permission details
export type UserWithRoles = User & {
  roles: UserRole[];
  department?: Department;
  permissions: {
    module: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }[];
};

// Role with rights
export type RoleWithRights = UserRole & {
  rights: UserRoleRight[];
};

// ==================== Knowledge Base (Vector Database) ====================

// Supported languages for knowledge base content
export const supportedLanguages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
] as const;

export type SupportedLanguageCode = typeof supportedLanguages[number]["code"];

// Knowledge Base Sources - stores original documents/content
export const knowledgeBaseSources = pgTable("knowledge_base_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull().default("general"), // general, sales, implementation, support, product, faq
  contentType: varchar("content_type", { length: 50 }).notNull().default("document"), // document, faq, guide, article, policy
  originalContent: text("original_content").notNull(), // The full original content
  // Multilingual support
  languageCode: varchar("language_code", { length: 10 }).notNull().default("en"), // ISO 639-1 language code
  translationGroupId: varchar("translation_group_id"), // UUID to link translations of the same content
  translationStatus: varchar("translation_status", { length: 20 }).default("original"), // original, translated, pending_review
  sourceUrl: text("source_url"), // Optional external URL
  fileUrl: text("file_url"), // If uploaded as a file
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  isIndexed: boolean("is_indexed").default(false), // Whether embeddings have been generated
  indexedAt: timestamp("indexed_at"),
  tokenCount: integer("token_count"), // Total tokens in the content
  chunkCount: integer("chunk_count"), // Number of chunks created
  createdBy: varchar("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnowledgeBaseSourceSchema = createInsertSchema(knowledgeBaseSources).omit({
  id: true,
  isIndexed: true,
  indexedAt: true,
  tokenCount: true,
  chunkCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKnowledgeBaseSource = z.infer<typeof insertKnowledgeBaseSourceSchema>;
export type KnowledgeBaseSource = typeof knowledgeBaseSources.$inferSelect;

// Knowledge Base Chunks - stores chunked content with embeddings
// Note: The 'embedding' column is a vector(1536) which is handled by pgvector extension
// We store it as text here and handle conversion in the database
export const knowledgeBaseChunks = pgTable("knowledge_base_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => knowledgeBaseSources.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Order within the source document
  content: text("content").notNull(), // The chunked text content
  languageCode: varchar("language_code", { length: 10 }).notNull().default("en"), // Language of this chunk for filtering
  tokenCount: integer("token_count"), // Tokens in this chunk
  // Note: embedding column is added via raw SQL as vector(1536)
  metadata: jsonb("metadata").$type<{
    startPosition?: number;
    endPosition?: number;
    headings?: string[];
    section?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKnowledgeBaseChunkSchema = createInsertSchema(knowledgeBaseChunks).omit({
  id: true,
  createdAt: true,
});

export type InsertKnowledgeBaseChunk = z.infer<typeof insertKnowledgeBaseChunkSchema>;
export type KnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferSelect;

// Knowledge Base Search Queries - for analytics and improving search
export const knowledgeBaseQueries = pgTable("knowledge_base_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  queryText: text("query_text").notNull(),
  languageCode: varchar("language_code", { length: 10 }).default("en"), // Language used for the search
  includeCrossLanguage: boolean("include_cross_language").default(false), // Whether cross-language search was enabled
  resultsCount: integer("results_count"),
  topResults: jsonb("top_results").$type<{
    sourceId: string;
    title: string;
    score: number;
    languageCode?: string;
  }[]>(),
  searchDurationMs: integer("search_duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKnowledgeBaseQuerySchema = createInsertSchema(knowledgeBaseQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertKnowledgeBaseQuery = z.infer<typeof insertKnowledgeBaseQuerySchema>;
export type KnowledgeBaseQuery = typeof knowledgeBaseQueries.$inferSelect;

// Knowledge Base Category type
export const knowledgeBaseCategories = [
  "general",
  "sales",
  "implementation", 
  "support",
  "product",
  "faq",
  "training",
  "policy"
] as const;

export type KnowledgeBaseCategory = typeof knowledgeBaseCategories[number];

// Knowledge Base Content Types
export const knowledgeBaseContentTypes = [
  "document",
  "faq",
  "guide",
  "article",
  "policy",
  "tutorial"
] as const;

export type KnowledgeBaseContentType = typeof knowledgeBaseContentTypes[number];

// System Settings table for SMTP and other configurations
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: text("setting_value"),
  settingType: varchar("setting_type", { length: 20 }).notNull().default("string"), // string, number, boolean, json
  category: varchar("category", { length: 50 }).notNull().default("general"), // general, email, security, etc.
  description: text("description"),
  isSecret: boolean("is_secret").default(false), // If true, value should be masked in UI
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

// SMTP Configuration type for the UI
export const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().min(1).max(65535),
  user: z.string().email("Valid email is required"),
  pass: z.string().min(1, "Password is required"),
  from: z.string().min(1, "From address is required"),
  secure: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

// ============================================
// Points Management System
// ============================================

// Point Categories - defines point values for different task/lead types per department
export const pointCategories = pgTable("point_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // Derived from department name
  departmentId: varchar("department_id").references(() => departments.id), // Link to department master
  description: text("description"),
  moduleType: varchar("module_type", { length: 20 }).notNull(), // lead, task, ticket, project
  basePoints: integer("base_points").notNull().default(1), // Default points for assignment
  reassignPenalty: integer("reassign_penalty").notNull().default(1), // Points deducted from original assignee on reassign
  completionBonus: integer("completion_bonus").notNull().default(0), // Bonus points on completion
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPointCategorySchema = createInsertSchema(pointCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPointCategory = z.infer<typeof insertPointCategorySchema>;
export type PointCategory = typeof pointCategories.$inferSelect;

// Department-specific point overrides
export const pointCategoryDepartmentSettings = pgTable("point_category_department_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pointCategoryId: varchar("point_category_id").notNull().references(() => pointCategories.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 50 }).notNull(), // sales, support, engineering, admin
  basePoints: integer("base_points").notNull(),
  reassignPenalty: integer("reassign_penalty").notNull(),
  completionBonus: integer("completion_bonus").notNull().default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPointCategoryDepartmentSettingSchema = createInsertSchema(pointCategoryDepartmentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPointCategoryDepartmentSetting = z.infer<typeof insertPointCategoryDepartmentSettingSchema>;
export type PointCategoryDepartmentSetting = typeof pointCategoryDepartmentSettings.$inferSelect;

// User Point Ledger - immutable log of all point transactions
export const userPointLedger = pgTable("user_point_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  moduleType: varchar("module_type", { length: 20 }).notNull(), // lead, task, ticket, project
  entityId: varchar("entity_id").notNull(), // ID of the lead/task/ticket/project
  categoryId: varchar("category_id").references(() => pointCategories.id),
  action: varchar("action", { length: 20 }).notNull(), // assign, reassign_from, reassign_to, complete, adjustment
  points: integer("points").notNull(), // Positive for earned, negative for deducted
  reason: text("reason"), // Description of why points were awarded/deducted
  createdBy: varchar("created_by").references(() => users.id), // Who triggered the action
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserPointLedgerSchema = createInsertSchema(userPointLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertUserPointLedger = z.infer<typeof insertUserPointLedgerSchema>;
export type UserPointLedger = typeof userPointLedger.$inferSelect;

// User Point Balances - aggregated point totals per user (for fast reads)
export const userPointBalances = pgTable("user_point_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalPoints: integer("total_points").notNull().default(0),
  leadPoints: integer("lead_points").notNull().default(0),
  taskPoints: integer("task_points").notNull().default(0),
  ticketPoints: integer("ticket_points").notNull().default(0),
  projectPoints: integer("project_points").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserPointBalanceSchema = createInsertSchema(userPointBalances).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserPointBalance = z.infer<typeof insertUserPointBalanceSchema>;
export type UserPointBalance = typeof userPointBalances.$inferSelect;

// ============================================
// Assignment Settings
// ============================================

// Assignment Settings - configures how items are assigned per module
export const assignmentSettings = pgTable("assignment_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  module: varchar("module", { length: 20 }).notNull().unique(), // tickets, tasks, leads
  assignmentMethod: varchar("assignment_method", { length: 20 }).notNull().default("manual"), // manual, round_robin, load_balanced
  isEnabled: boolean("is_enabled").default(true), // Whether auto-assignment is enabled
  departmentId: varchar("department_id").references(() => departments.id), // Optional: restrict to specific department
  assignableRoles: text("assignable_roles").array(), // Roles that can be assigned (e.g., ['support', 'engineer'])
  lastAssignedUserId: varchar("last_assigned_user_id"), // Track last assigned user for round-robin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssignmentSettingSchema = createInsertSchema(assignmentSettings).omit({
  id: true,
  lastAssignedUserId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAssignmentSetting = z.infer<typeof insertAssignmentSettingSchema>;
export type AssignmentSetting = typeof assignmentSettings.$inferSelect;
