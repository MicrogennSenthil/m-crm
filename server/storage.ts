import {
  users,
  userRoles,
  userRoleRights,
  customers,
  leads,
  followUps,
  leadComments,
  demoDateHistory,
  negotiationDateHistory,
  quotes,
  projects,
  projectEngineers,
  modules,
  projectModules,
  trainingSessions,
  trainingRecords,
  projectHandoffs,
  tickets,
  ticketComments,
  escalationHistory,
  feedback,
  activityLog,
  attachments,
  tasks,
  taskComments,
  taskFollowups,
  otpVerifications,
  departments,
  departmentHeads,
  systemModules,
  userRoleAssignments,
  roleChangeHistory,
  userModulePermissions,
  knowledgeBaseSources,
  knowledgeBaseChunks,
  knowledgeBaseQueries,
  systemSettings,
  type User,
  type UpsertUser,
  type InsertUser,
  type UserRole,
  type InsertUserRole,
  type UserRoleRight,
  type InsertUserRoleRight,
  type Customer,
  type InsertCustomer,
  type Lead,
  type InsertLead,
  type FollowUp,
  type InsertFollowUp,
  type LeadComment,
  type InsertLeadComment,
  type DemoDateHistory,
  type InsertDemoDateHistory,
  type NegotiationDateHistory,
  type InsertNegotiationDateHistory,
  type LeadStageHistory,
  type InsertLeadStageHistory,
  leadStageHistory,
  leadAssignmentHistory,
  type LeadAssignmentHistory,
  type InsertLeadAssignmentHistory,
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
  type TrainingSession,
  type InsertTrainingSession,
  type TrainingRecord,
  type InsertTrainingRecord,
  type ProjectHandoff,
  type InsertProjectHandoff,
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
  type Task,
  type InsertTask,
  type TaskComment,
  type InsertTaskComment,
  type TaskFollowup,
  type InsertTaskFollowup,
  type ProjectProgressEntry,
  type InsertProjectProgressEntry,
  projectProgressEntries,
  planningChangeLogs,
  type PlanningChangeLog,
  type InsertPlanningChangeLog,
  type CustomerWithLifecycle,
  type Department,
  type InsertDepartment,
  type DepartmentHead,
  type InsertDepartmentHead,
  type SystemModule,
  type InsertSystemModule,
  type UserRoleAssignment,
  type InsertUserRoleAssignment,
  type RoleChangeHistory,
  type InsertRoleChangeHistory,
  type UserModulePermission,
  type InsertUserModulePermission,
  type UserWithRoles,
  type RoleWithRights,
  type KnowledgeBaseSource,
  type InsertKnowledgeBaseSource,
  type KnowledgeBaseChunk,
  type InsertKnowledgeBaseChunk,
  type KnowledgeBaseQuery,
  type InsertKnowledgeBaseQuery,
  type SystemSetting,
  type InsertSystemSetting,
  type SmtpConfig,
  pointCategories,
  pointCategoryDepartmentSettings,
  userPointLedger,
  userPointBalances,
  type PointCategory,
  type InsertPointCategory,
  type PointCategoryDepartmentSetting,
  type InsertPointCategoryDepartmentSetting,
  type UserPointLedger,
  type InsertUserPointLedger,
  type UserPointBalance,
  type InsertUserPointBalance,
  assignmentSettings,
  type AssignmentSetting,
  type InsertAssignmentSetting,
  developmentTasks,
  developmentTaskComments,
  developmentSupportMessages,
  type DevelopmentTask,
  type InsertDevelopmentTask,
  type DevelopmentTaskComment,
  type InsertDevelopmentTaskComment,
  type DevelopmentSupportMessage,
  type InsertDevelopmentSupportMessage,
  marketingDailyReports,
  marketingTaskEntries,
  type MarketingDailyReport,
  type InsertMarketingDailyReport,
  type MarketingTaskEntry,
  type InsertMarketingTaskEntry,
  extractedPlaces,
  type ExtractedPlace,
  type InsertExtractedPlace,
  extractorOptions,
  type ExtractorOption,
  type InsertExtractorOption,
  salesPlans,
  salesMonthlyTargets,
  type SalesPlan,
  type InsertSalesPlan,
  type SalesMonthlyTarget,
  type InsertSalesMonthlyTarget,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, gte, lte, sql, isNotNull, isNull, inArray, ilike, count } from "drizzle-orm";
import { getCached, setCached, invalidateCache } from "./cache";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth and Local Auth)
  getUser(id: string): Promise<User | undefined>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<{ user: User; isNew: boolean }>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithPassword(user: InsertUser & { passwordHash: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser & { passwordHash?: string; isEmailVerified?: boolean; isActive?: boolean; lastLoginAt?: Date; approvedAt?: Date; approvedBy?: string }>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByDepartment(departmentId: string): Promise<User[]>;
  getSupportAssignableUsers(): Promise<User[]>;
  getUserAssignments(userId: string): Promise<{ leads: number; tasks: number; tickets: number; projects: number; total: number }>;
  reassignUserItems(fromUserId: string, toUserId: string): Promise<{ leads: number; tasks: number; tickets: number; projects: number }>;

  // OTP operations
  createOtp(email: string, otpCode: string, purpose: string, expiresAt: Date): Promise<void>;
  verifyOtp(email: string, otpCode: string, purpose: string): Promise<boolean>;
  invalidateOtp(email: string, purpose: string): Promise<void>;

  // User Role operations (Master data)
  getUserRoles(): Promise<UserRole[]>;
  getUserRole(id: string): Promise<UserRole | undefined>;
  getUserRoleByName(name: string): Promise<UserRole | undefined>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: string, data: Partial<InsertUserRole>): Promise<UserRole>;
  deleteUserRole(id: string): Promise<void>;

  // User Role Rights operations (Master data)
  getUserRoleRights(roleId?: string): Promise<UserRoleRight[]>;
  getUserRoleRight(id: string): Promise<UserRoleRight | undefined>;
  createUserRoleRight(right: InsertUserRoleRight): Promise<UserRoleRight>;
  updateUserRoleRight(id: string, data: Partial<InsertUserRoleRight>): Promise<UserRoleRight>;
  deleteUserRoleRight(id: string): Promise<void>;

  // Customer operations (Master data)
  getCustomers(): Promise<Customer[]>;
  getCustomersWithLifecycle(): Promise<CustomerWithLifecycle[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomersByIds(ids: string[]): Promise<Customer[]>;
  getCustomerByName(name: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Lead operations
  getLeads(filters?: { stage?: string; salesExecutiveId?: string; salesExecutiveIds?: string[]; interestStatus?: string | null; fromDate?: Date; toDate?: Date; followupFrom?: Date; followupTo?: Date; isExistingCustomer?: boolean; hasFollowupDate?: boolean }): Promise<Lead[]>;
  getLeadsPaginated(filters: { stage?: string; salesExecutiveId?: string; salesExecutiveIds?: string[]; search?: string; city?: string; area?: string; leadSource?: string; fromDate?: Date; toDate?: Date; page?: number; pageSize?: number; }): Promise<{ leads: Lead[]; total: number }>;
  getLeadsKanban(filters: {
    search?: string;
    city?: string;
    area?: string;
    leadSource?: string;
    salesExecutiveId?: string;
    salesExecutiveIds?: string[];
    stageLimit?: number;
  }): Promise<{ stages: Record<string, { leads: Lead[]; total: number }> }>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead, options?: { 
    skipStageHistory?: boolean;
    changedById?: string | null;
    changeReason?: string;
  }): Promise<Lead>;
  updateLead(id: string, data: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  // Follow-up operations
  getFollowUpsByLead(leadId: string): Promise<FollowUp[]>;
  getAllFollowUps(): Promise<FollowUp[]>;
  countPendingFollowUpsByLeadIds(leadIds: string[]): Promise<number>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  updateFollowUp(id: string, data: Partial<InsertFollowUp>): Promise<FollowUp>;

  // Lead Comment operations
  getLeadComments(leadId: string): Promise<LeadComment[]>;
  createLeadComment(comment: InsertLeadComment): Promise<LeadComment>;
  updateLeadComment(id: string, data: Partial<InsertLeadComment>): Promise<LeadComment>;
  deleteLeadComment(id: string): Promise<void>;

  // Demo Date History operations
  getDemoDateHistory(leadId: string): Promise<DemoDateHistory[]>;
  createDemoDateHistory(history: InsertDemoDateHistory): Promise<DemoDateHistory>;
  getLeadStageHistory(leadId: string): Promise<LeadStageHistory[]>;
  getAllLeadStageHistory(): Promise<LeadStageHistory[]>;
  getLeadStageHistoryByDateRange(start: Date, end: Date): Promise<LeadStageHistory[]>;
  createLeadStageHistory(history: InsertLeadStageHistory): Promise<LeadStageHistory>;

  // Negotiation Date History operations
  getNegotiationDateHistory(leadId: string): Promise<NegotiationDateHistory[]>;
  createNegotiationDateHistory(history: InsertNegotiationDateHistory): Promise<NegotiationDateHistory>;

  // Lead Assignment History operations
  getLeadAssignmentHistory(leadId: string): Promise<LeadAssignmentHistory[]>;
  createLeadAssignmentHistory(history: InsertLeadAssignmentHistory): Promise<LeadAssignmentHistory>;
  reassignLead(leadId: string, newSalesExecutiveId: string, reassignedById: string, reason?: string): Promise<Lead>;

  // Quote operations
  getQuotesByLead(leadId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote>;

  // Project operations
  getProjects(filters?: { status?: string; engineerIds?: string[] }): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject, selectedModuleNames?: string[]): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project>;

  // Project Engineer operations
  getProjectEngineers(projectId: string): Promise<ProjectEngineer[]>;
  getProjectEngineersForProjects(projectIds: string[]): Promise<ProjectEngineer[]>;
  assignEngineer(assignment: InsertProjectEngineer): Promise<ProjectEngineer>;
  removeEngineer(id: string): Promise<void>;

  // Module operations (Master data)
  getModules(): Promise<Module[]>;
  getModule(id: string): Promise<Module | undefined>;
  getModuleByName(name: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, data: Partial<InsertModule>): Promise<Module>;
  deleteModule(id: string): Promise<void>;

  // Project Module operations
  getProjectModules(projectId: string): Promise<ProjectModule[]>;
  getProjectModule(id: string): Promise<ProjectModule | undefined>;
  createProjectModule(projectModule: InsertProjectModule): Promise<ProjectModule>;
  updateProjectModule(id: string, data: Partial<InsertProjectModule>): Promise<ProjectModule>;

  // Planning Change Log operations
  getPlanningChangeLogs(projectModuleId: string): Promise<PlanningChangeLog[]>;
  getProjectPlanningChangeLogs(projectId: string): Promise<PlanningChangeLog[]>;
  createPlanningChangeLog(log: InsertPlanningChangeLog): Promise<PlanningChangeLog>;

  // Project Progress Entry operations
  getProjectProgressEntries(projectId: string): Promise<(ProjectProgressEntry & { engineer?: User })[]>;
  getProjectProgressEntry(id: string): Promise<ProjectProgressEntry | undefined>;
  createProjectProgressEntry(entry: InsertProjectProgressEntry): Promise<ProjectProgressEntry>;
  updateProjectProgressEntry(id: string, data: Partial<InsertProjectProgressEntry>): Promise<ProjectProgressEntry>;
  deleteProjectProgressEntry(id: string): Promise<void>;

  // Training Record operations
  getTrainingRecords(projectId: string): Promise<TrainingRecord[]>;
  createTrainingRecord(training: InsertTrainingRecord): Promise<TrainingRecord>;

  // Ticket operations
  getTickets(filters?: { status?: string; priority?: string; assignedEngineerIds?: string[]; limit?: number; fromDate?: Date; toDate?: Date }): Promise<Ticket[]>;
  getTicketsPaginated(filters: { assignedEngineerIds?: string[]; fromDate?: Date; toDate?: Date; search?: string; category?: string; statusTab?: string; status?: string; priority?: string; customerId?: string; page?: number; pageSize?: number; }): Promise<{ tickets: Ticket[]; total: number; counts: { all: number; open: number; inProgress: number; completed: number; remindersDue: number; support: number; development: number; } }>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketsByIds(ids: string[]): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket>;

  // Ticket Comment operations
  getTicketComments(ticketId: string): Promise<TicketComment[]>;
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;

  // Escalation operations
  getEscalationHistory(ticketId: string): Promise<EscalationHistory[]>;
  createEscalation(escalation: InsertEscalationHistory): Promise<EscalationHistory>;

  // Ticket Assignment History operations
  getTicketAssignmentHistory(ticketId: string): Promise<any[]>;
  createTicketAssignmentHistory(data: { ticketId: string; engineerId: string; assignedAt?: Date }): Promise<any>;
  updateTicketAssignmentHistory(id: string, data: { unassignedAt?: Date; transferredToId?: string; transferReason?: string; actionsTaken?: string }): Promise<any>;
  getActiveTicketAssignment(ticketId: string): Promise<any | undefined>;

  // Feedback operations
  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  getFeedbackByTicket(ticketId: string): Promise<Feedback | undefined>;
  getFeedbackListByTicket(ticketId: string): Promise<(Feedback & { submittedBy?: User; completedBy?: User })[]>;
  updateFeedback(id: string, data: Partial<InsertFeedback>): Promise<Feedback>;

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
  getAllAttachments(): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: string): Promise<Attachment | undefined>;

  // Task operations
  getTasks(filters?: { 
    userId?: string; 
    userIds?: string[]; // For department-based filtering
    assignedTo?: string; 
    createdBy?: string; 
    status?: string;
    includeAll?: boolean; // For super admin to see all tasks
  }): Promise<(Task & { 
    creator?: User; 
    assignee?: User; 
    mentionedUserDetails?: User[];
    commentsCount?: number;
  })[]>;
  getTask(id: string): Promise<(Task & { 
    creator?: User; 
    assignee?: User; 
    mentionedUserDetails?: User[];
  }) | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Task Comment operations
  getTaskComments(taskId: string): Promise<(TaskComment & { user?: User })[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment>;
  deleteTaskComment(id: string): Promise<void>;

  // Task Followup operations
  getTaskFollowups(taskId: string): Promise<(TaskFollowup & { user?: User })[]>;
  getTaskFollowup(id: string): Promise<TaskFollowup | undefined>;
  createTaskFollowup(followup: InsertTaskFollowup): Promise<TaskFollowup>;
  updateTaskFollowup(id: string, data: Partial<InsertTaskFollowup>): Promise<TaskFollowup>;
  deleteTaskFollowup(id: string): Promise<void>;
  getTodayTasks(userId?: string, includeAll?: boolean): Promise<(Task & { 
    creator?: User; 
    assignee?: User;
    followupsCount?: number;
    latestFollowup?: TaskFollowup;
  })[]>;

  // Department operations (User Management)
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  createDepartment(dept: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;
  
  // Department Heads operations (multiple heads per department)
  getDepartmentHeads(departmentId: string): Promise<(DepartmentHead & { user?: User })[]>;
  setDepartmentHeads(departmentId: string, userIds: string[], primaryUserId?: string): Promise<void>;
  isUserDepartmentHead(userId: string): Promise<{ isDeptHead: boolean; departments: Department[] }>;
  getDepartmentsByHead(userId: string): Promise<Department[]>;

  // System Module operations (for permissions)
  getSystemModules(): Promise<SystemModule[]>;
  getSystemModule(id: string): Promise<SystemModule | undefined>;
  createSystemModule(module: InsertSystemModule): Promise<SystemModule>;
  updateSystemModule(id: string, data: Partial<InsertSystemModule>): Promise<SystemModule>;
  deleteSystemModule(id: string): Promise<void>;

  // User Role Assignment operations
  getUserRoleAssignments(userId?: string): Promise<(UserRoleAssignment & { role?: UserRole })[]>;
  getUserRoleAssignment(id: string): Promise<UserRoleAssignment | undefined>;
  assignRoleToUser(assignment: InsertUserRoleAssignment): Promise<UserRoleAssignment>;
  removeRoleFromUser(id: string): Promise<void>;
  getUserWithRoles(userId: string): Promise<UserWithRoles | undefined>;

  // Role Change History operations
  getRoleChangeHistory(userId?: string): Promise<(RoleChangeHistory & { 
    previousRole?: UserRole; 
    newRole?: UserRole;
    changedByUser?: User;
  })[]>;
  createRoleChangeHistory(history: InsertRoleChangeHistory): Promise<RoleChangeHistory>;

  // User Module Permission operations
  getUserModulePermissions(userId: string): Promise<(UserModulePermission & { module?: SystemModule })[]>;
  getUserModulePermission(id: string): Promise<UserModulePermission | undefined>;
  setUserModulePermission(permission: InsertUserModulePermission): Promise<UserModulePermission>;
  updateUserModulePermission(id: string, data: Partial<InsertUserModulePermission>): Promise<UserModulePermission>;
  deleteUserModulePermission(id: string): Promise<void>;
  
  // Get user's effective permissions (combined from roles and individual overrides)
  getUserEffectivePermissions(userId: string): Promise<{
    module: string;
    moduleName: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    source: 'role' | 'user';
  }[]>;

  // Get role with all its rights
  getRoleWithRights(roleId: string): Promise<RoleWithRights | undefined>;

  // Knowledge Base Source operations
  getKnowledgeBaseSources(): Promise<KnowledgeBaseSource[]>;
  getKnowledgeBaseSource(id: string): Promise<KnowledgeBaseSource | undefined>;
  createKnowledgeBaseSource(source: InsertKnowledgeBaseSource): Promise<KnowledgeBaseSource>;
  updateKnowledgeBaseSource(id: string, data: Partial<InsertKnowledgeBaseSource>): Promise<KnowledgeBaseSource>;
  deleteKnowledgeBaseSource(id: string): Promise<void>;

  // Knowledge Base Chunk operations
  getKnowledgeBaseChunks(sourceId: string): Promise<KnowledgeBaseChunk[]>;
  createKnowledgeBaseChunk(chunk: InsertKnowledgeBaseChunk): Promise<KnowledgeBaseChunk>;
  createKnowledgeBaseChunks(chunks: InsertKnowledgeBaseChunk[]): Promise<KnowledgeBaseChunk[]>;
  deleteKnowledgeBaseChunksBySource(sourceId: string): Promise<void>;
  searchKnowledgeBase(embedding: number[], limit?: number, category?: string, languageCode?: string, includeCrossLanguage?: boolean): Promise<(KnowledgeBaseChunk & { similarity: number; source?: KnowledgeBaseSource })[]>;

  // Knowledge Base Query operations (for analytics)
  createKnowledgeBaseQuery(query: InsertKnowledgeBaseQuery): Promise<KnowledgeBaseQuery>;
  getKnowledgeBaseQueries(limit?: number): Promise<(KnowledgeBaseQuery & { user?: User })[]>;

  // System Settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getSystemSettingsByCategory(category: string): Promise<SystemSetting[]>;
  upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  deleteSystemSetting(key: string): Promise<void>;
  
  // SMTP Configuration helpers
  getSmtpConfig(): Promise<SmtpConfig | null>;
  saveSmtpConfig(config: SmtpConfig, userId: string): Promise<void>;

  // Point Categories operations
  getPointCategories(): Promise<PointCategory[]>;
  getPointCategoriesByModule(moduleType: string): Promise<PointCategory[]>;
  getPointCategory(id: string): Promise<PointCategory | undefined>;
  createPointCategory(category: InsertPointCategory): Promise<PointCategory>;
  updatePointCategory(id: string, category: Partial<InsertPointCategory>): Promise<PointCategory | undefined>;
  deletePointCategory(id: string): Promise<void>;

  // Point Category Department Settings operations
  getPointCategoryDepartmentSettings(categoryId: string): Promise<PointCategoryDepartmentSetting[]>;
  createPointCategoryDepartmentSetting(setting: InsertPointCategoryDepartmentSetting): Promise<PointCategoryDepartmentSetting>;
  updatePointCategoryDepartmentSetting(id: string, setting: Partial<InsertPointCategoryDepartmentSetting>): Promise<PointCategoryDepartmentSetting | undefined>;
  deletePointCategoryDepartmentSetting(id: string): Promise<void>;

  // User Point Ledger operations
  getUserPointLedger(userId: string): Promise<UserPointLedger[]>;
  getPointLedgerByEntity(moduleType: string, entityId: string): Promise<UserPointLedger[]>;
  createPointLedgerEntry(entry: InsertUserPointLedger): Promise<UserPointLedger>;

  // User Point Balance operations
  getUserPointBalance(userId: string): Promise<UserPointBalance | undefined>;
  getUserPointBalances(): Promise<UserPointBalance[]>;
  updateUserPointBalance(userId: string, points: number, moduleType: string): Promise<UserPointBalance>;
  initializeUserPointBalance(userId: string): Promise<UserPointBalance>;

  // Assignment Settings operations
  getAssignmentSettings(): Promise<AssignmentSetting[]>;
  getAssignmentSetting(module: string): Promise<AssignmentSetting | undefined>;
  upsertAssignmentSetting(setting: InsertAssignmentSetting): Promise<AssignmentSetting>;
  updateLastAssignedUser(module: string, userId: string): Promise<void>;
  getNextAssignableUser(module: string): Promise<User | undefined>;

  // Development Task operations
  getDevelopmentTasks(filters?: { 
    status?: string; 
    assignedTo?: string;
    assignedToIds?: string[];
    sourceType?: string;
    sourceId?: string;
    priority?: string;
    isOverdue?: boolean;
  }): Promise<(DevelopmentTask & { 
    assignee?: User; 
    assignedByUser?: User;
  })[]>;
  getDevelopmentTask(id: string): Promise<(DevelopmentTask & { 
    assignee?: User; 
    assignedByUser?: User;
  }) | undefined>;
  createDevelopmentTask(task: InsertDevelopmentTask): Promise<DevelopmentTask>;
  updateDevelopmentTask(id: string, data: Partial<InsertDevelopmentTask & { 
    isOverdue?: boolean; 
    penaltyApplied?: boolean; 
    penaltyPoints?: number; 
    penaltyReason?: string;
  }>): Promise<DevelopmentTask>;
  deleteDevelopmentTask(id: string): Promise<void>;

  // Development Task Comment operations
  getDevelopmentTaskComments(developmentTaskId: string): Promise<(DevelopmentTaskComment & { user?: User })[]>;
  createDevelopmentTaskComment(comment: InsertDevelopmentTaskComment): Promise<DevelopmentTaskComment>;

  // Development-Support Message operations (bidirectional communication)
  getDevelopmentSupportMessagesByTask(developmentTaskId: string): Promise<(DevelopmentSupportMessage & { sender?: User })[]>;
  getDevelopmentSupportMessagesByTicket(ticketId: string): Promise<(DevelopmentSupportMessage & { sender?: User })[]>;
  createDevelopmentSupportMessage(message: InsertDevelopmentSupportMessage): Promise<DevelopmentSupportMessage>;

  // Development Dashboard metrics
  getDevelopmentDashboardMetrics(assignedTo?: string, assignedToIds?: string[]): Promise<{
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalPenaltyPoints: number;
    // Enhanced categories
    yetToWorkTasks: number;  // pending + unassigned
    onProcessTasks: number;  // in_progress
    waitingTasks: number;    // pending + assigned
    // Source breakdown
    supportTasks: number;
    implementationTasks: number;
    taskModuleTasks: number;
    manualTasks: number;
  }>;
  
  // Check and apply penalties for overdue tasks
  checkAndApplyOverduePenalties(): Promise<number>;

  // Marketing Daily Report operations
  getMarketingDailyReports(filters?: { 
    userId?: string; 
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<(MarketingDailyReport & { user?: User })[]>;
  getMarketingDailyReport(id: string): Promise<(MarketingDailyReport & { 
    user?: User; 
    taskEntries?: MarketingTaskEntry[];
  }) | undefined>;
  getMarketingDailyReportByDate(userId: string, date: Date): Promise<MarketingDailyReport | undefined>;
  createMarketingDailyReport(report: InsertMarketingDailyReport): Promise<MarketingDailyReport>;
  updateMarketingDailyReport(id: string, data: Partial<InsertMarketingDailyReport>): Promise<MarketingDailyReport>;
  deleteMarketingDailyReport(id: string): Promise<void>;

  // Marketing Task Entry operations
  getMarketingTaskEntries(reportId: string): Promise<MarketingTaskEntry[]>;
  createMarketingTaskEntry(entry: InsertMarketingTaskEntry): Promise<MarketingTaskEntry>;
  updateMarketingTaskEntry(id: string, data: Partial<InsertMarketingTaskEntry>): Promise<MarketingTaskEntry>;
  deleteMarketingTaskEntry(id: string): Promise<void>;
  deleteMarketingTaskEntriesByReport(reportId: string): Promise<void>;

  // System Module Sync operations (for automatic module registration)
  syncSystemModulesFromManifest(): Promise<{ created: number; updated: number }>;
  ensureRoleHasAllModuleRights(roleId: string): Promise<number>;
  ensureAllRolesHaveAllModuleRights(): Promise<number>;

  // Extracted Places operations (Google Maps data extraction)
  getExtractedPlaces(filters?: { 
    extractedById?: string;
    isImported?: boolean;
    city?: string;
    area?: string;
    industry?: string;
  }): Promise<ExtractedPlace[]>;
  getExtractedPlace(id: string): Promise<ExtractedPlace | undefined>;
  getExistingGooglePlaceIds(googlePlaceIds: string[]): Promise<string[]>;
  createExtractedPlace(place: InsertExtractedPlace): Promise<ExtractedPlace>;
  createExtractedPlaces(places: InsertExtractedPlace[]): Promise<ExtractedPlace[]>;
  updateExtractedPlace(id: string, data: Partial<InsertExtractedPlace & { isImported?: boolean; importedLeadId?: string }>): Promise<ExtractedPlace>;
  deleteExtractedPlace(id: string): Promise<void>;
  getExtractedPlacesByLeadId(leadId: string): Promise<ExtractedPlace[]>;
  resetExtractedPlaceImportByLeadId(leadId: string): Promise<void>;
  checkDuplicateLead(data: { 
    contactPhone?: string; 
    businessName?: string; 
    contactPerson?: string; 
    contactEmail?: string; 
    city?: string; 
    area?: string; 
  }): Promise<Lead | null>;
  
  // Batch check for duplicates in leads table - returns phone numbers that already exist
  checkDuplicateLeadsByPhone(phoneNumbers: string[]): Promise<string[]>;
  checkDuplicateLeadsByCompanyName(companyNames: { name: string; city?: string }[]): Promise<string[]>;

  // Extractor Options operations (custom industries and segments)
  getExtractorOptions(type?: 'industry' | 'segment'): Promise<ExtractorOption[]>;
  getExtractorOption(id: string): Promise<ExtractorOption | undefined>;
  createExtractorOption(option: InsertExtractorOption): Promise<ExtractorOption>;
  deleteExtractorOption(id: string): Promise<void>;

  // Sales Planning operations
  getSalesPlans(filters: { userId?: string; month?: string; userIds?: string[] }): Promise<SalesPlan[]>;
  getSalesPlan(id: string): Promise<SalesPlan | undefined>;
  upsertSalesPlan(plan: InsertSalesPlan): Promise<SalesPlan>;
  deleteSalesPlan(id: string): Promise<void>;

  // Sales Monthly Target operations
  getSalesMonthlyTargets(filters: { userId?: string; month?: string; userIds?: string[] }): Promise<SalesMonthlyTarget[]>;
  getSalesMonthlyTarget(id: string): Promise<SalesMonthlyTarget | undefined>;
  upsertSalesMonthlyTarget(target: InsertSalesMonthlyTarget): Promise<SalesMonthlyTarget>;
  deleteSalesMonthlyTarget(id: string): Promise<void>;

  // Sales Performance analytics
  getSalesPerformance(filters: { 
    userId?: string; 
    userIds?: string[];
    month?: string; 
  }): Promise<{
    plans: SalesPlan[];
    monthlyTarget: SalesMonthlyTarget | null;
    achievements: {
      stage: string;
      qty: number;
      value: number;
      weekNumber: number;
    }[];
    dailyAchievements: {
      date: string;
      stage: string;
      qty: number;
      value: number;
    }[];
    prediction: {
      predictedQty: number;
      predictedValue: number;
      daysElapsed: number;
      totalDays: number;
    };
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    return await db.select().from(users).where(inArray(users.id, ids));
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

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.role, role),
        eq(users.isActive, true),
        isNotNull(users.approvedAt)
      )
    );
  }

  async getUsersByDepartment(departmentId: string): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.departmentId, departmentId),
        eq(users.isActive, true)
      )
    );
  }

  async getSupportAssignableUsers(): Promise<User[]> {
    // Get all roles that are marked as support-assignable
    const supportRoles = await db.select().from(userRoles).where(
      and(
        eq(userRoles.isSupportAssignable, true),
        eq(userRoles.isActive, true)
      )
    );
    
    if (supportRoles.length === 0) {
      return [];
    }
    
    // Get users with any of these roles who are active and approved
    const roleNames = supportRoles.map(r => r.name);
    const supportUsers = await db.select().from(users).where(
      and(
        eq(users.isActive, true),
        isNotNull(users.approvedAt)
      )
    );
    
    // Filter users whose role is in the support-assignable list
    return supportUsers.filter(u => roleNames.includes(u.role || ''));
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<InsertUser & { passwordHash?: string; isEmailVerified?: boolean; isActive?: boolean; lastLoginAt?: Date; approvedAt?: Date; approvedBy?: string }>): Promise<User> {
    console.log("[Storage.updateUser] ID:", id, "Incoming data:", JSON.stringify(data));
    console.log("[Storage.updateUser] Role in data:", data.role);
    
    const updateData = { ...data, updatedAt: new Date() };
    console.log("[Storage.updateUser] Update data:", JSON.stringify(updateData));
    
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    console.log("[Storage.updateUser] Result:", JSON.stringify(updated));
    console.log("[Storage.updateUser] Result role:", updated.role);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserAssignments(userId: string): Promise<{ leads: number; tasks: number; tickets: number; projects: number; total: number }> {
    // Count leads assigned to user (as sales executive)
    const [leadsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.salesExecutiveId, userId));
    
    // Count tasks assigned to user
    const [tasksResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.assignedTo, userId));
    
    // Count tickets assigned to user (using assignedEngineerId)
    const [ticketsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.assignedEngineerId, userId));
    
    // Count project engineer assignments
    const [projectsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectEngineers)
      .where(eq(projectEngineers.engineerId, userId));

    const leadsCount = leadsResult?.count || 0;
    const tasksCount = tasksResult?.count || 0;
    const ticketsCount = ticketsResult?.count || 0;
    const projectsCount = projectsResult?.count || 0;

    return {
      leads: leadsCount,
      tasks: tasksCount,
      tickets: ticketsCount,
      projects: projectsCount,
      total: leadsCount + tasksCount + ticketsCount + projectsCount,
    };
  }

  async reassignUserItems(fromUserId: string, toUserId: string): Promise<{ leads: number; tasks: number; tickets: number; projects: number }> {
    // Get original counts before reassignment
    const originalCounts = await this.getUserAssignments(fromUserId);
    
    // Reassign leads
    await db
      .update(leads)
      .set({ salesExecutiveId: toUserId })
      .where(eq(leads.salesExecutiveId, fromUserId));
    
    // Reassign tasks
    await db
      .update(tasks)
      .set({ assignedTo: toUserId })
      .where(eq(tasks.assignedTo, fromUserId));
    
    // Reassign tickets (using assignedEngineerId)
    await db
      .update(tickets)
      .set({ assignedEngineerId: toUserId })
      .where(eq(tickets.assignedEngineerId, fromUserId));
    
    // Reassign project engineer assignments
    await db
      .update(projectEngineers)
      .set({ engineerId: toUserId })
      .where(eq(projectEngineers.engineerId, fromUserId));
    
    return {
      leads: originalCounts.leads,
      tasks: originalCounts.tasks,
      tickets: originalCounts.tickets,
      projects: originalCounts.projects,
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUserWithPassword(userData: InsertUser & { passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        authProvider: "local",
        isEmailVerified: false,
        isActive: true,
      })
      .returning();
    return user;
  }

  // OTP operations
  async createOtp(email: string, otpCode: string, purpose: string, expiresAt: Date): Promise<void> {
    // Invalidate any existing OTPs for this email and purpose
    await this.invalidateOtp(email, purpose);
    
    await db.insert(otpVerifications).values({
      email,
      otpCode,
      purpose,
      expiresAt,
    });
  }

  async verifyOtp(email: string, otpCode: string, purpose: string): Promise<boolean> {
    const [otp] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.otpCode, otpCode),
          eq(otpVerifications.purpose, purpose),
          eq(otpVerifications.isUsed, false)
        )
      )
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);

    if (!otp) return false;
    
    // Check if OTP has expired
    if (new Date() > otp.expiresAt) {
      return false;
    }
    
    // Check if too many attempts (max 5)
    if ((otp.attempts || 0) >= 5) {
      return false;
    }
    
    // Increment attempts
    await db
      .update(otpVerifications)
      .set({ attempts: (otp.attempts || 0) + 1 })
      .where(eq(otpVerifications.id, otp.id));
    
    // Mark as used if OTP matches
    if (otp.otpCode === otpCode) {
      await db
        .update(otpVerifications)
        .set({ isUsed: true })
        .where(eq(otpVerifications.id, otp.id));
      return true;
    }
    
    return false;
  }

  async invalidateOtp(email: string, purpose: string): Promise<void> {
    await db
      .update(otpVerifications)
      .set({ isUsed: true })
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.purpose, purpose),
          eq(otpVerifications.isUsed, false)
        )
      );
  }

  // User Role operations (Master data)
  async getUserRoles(): Promise<UserRole[]> {
    const cached = getCached<UserRole[]>("roles:all");
    if (cached) return cached;
    const result = await db.select().from(userRoles).orderBy(userRoles.name);
    setCached("roles:all", result, 600);
    return result;
  }

  async getUserRole(id: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.id, id));
    return role;
  }

  async getUserRoleByName(name: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.name, name));
    return role;
  }

  async createUserRole(role: InsertUserRole): Promise<UserRole> {
    const [newRole] = await db.insert(userRoles).values(role).returning();
    return newRole;
  }

  async updateUserRole(id: string, data: Partial<InsertUserRole>): Promise<UserRole> {
    const [updated] = await db
      .update(userRoles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userRoles.id, id))
      .returning();
    return updated;
  }

  async deleteUserRole(id: string): Promise<void> {
    await db.delete(userRoles).where(eq(userRoles.id, id));
  }

  // User Role Rights operations (Master data)
  async getUserRoleRights(roleId?: string): Promise<UserRoleRight[]> {
    if (roleId) {
      return await db.select().from(userRoleRights).where(eq(userRoleRights.roleId, roleId)).orderBy(userRoleRights.module);
    }
    return await db.select().from(userRoleRights).orderBy(userRoleRights.module);
  }

  async getUserRoleRight(id: string): Promise<UserRoleRight | undefined> {
    const [right] = await db.select().from(userRoleRights).where(eq(userRoleRights.id, id));
    return right;
  }

  async createUserRoleRight(right: InsertUserRoleRight): Promise<UserRoleRight> {
    const [newRight] = await db.insert(userRoleRights).values(right).returning();
    return newRight;
  }

  async updateUserRoleRight(id: string, data: Partial<InsertUserRoleRight>): Promise<UserRoleRight> {
    const [updated] = await db
      .update(userRoleRights)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userRoleRights.id, id))
      .returning();
    return updated;
  }

  async deleteUserRoleRight(id: string): Promise<void> {
    await db.delete(userRoleRights).where(eq(userRoleRights.id, id));
  }

  // Customer operations (Master data)
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomersWithLifecycle(): Promise<CustomerWithLifecycle[]> {
    // Get all active customers
    const allCustomers = await db.select().from(customers).where(eq(customers.status, "active")).orderBy(desc(customers.createdAt));
    
    // Get all projects with their handoff status
    const allProjects = await db.select().from(projects);
    const allHandoffs = await db.select().from(projectHandoffs);
    
    // Map customers with their projects and lifecycle status
    const customersWithLifecycle: CustomerWithLifecycle[] = allCustomers.map(customer => {
      // Get projects for this customer
      const customerProjects = allProjects
        .filter(p => p.customerId === customer.id)
        .map(project => {
          const handoff = allHandoffs.find(h => h.projectId === project.id);
          return {
            id: project.id,
            clientName: project.clientName,
            status: project.status,
            handoffStatus: handoff?.status || null,
            handoffDate: handoff?.handoffDate || null,
          };
        });
      
      // Determine lifecycle status based on projects and handoffs
      let lifecycleStatus: "handed_off" | "in_implementation" | "prospect" | "existing";
      
      // Check if any project has been handed off
      const hasHandedOffProject = customerProjects.some(p => p.handoffStatus === "handed_off");
      const hasActiveImplementation = customerProjects.some(p => 
        p.status === "in_progress" || p.status === "training" || p.status === "not_started"
      );
      
      if (hasHandedOffProject) {
        lifecycleStatus = "handed_off";
      } else if (hasActiveImplementation) {
        lifecycleStatus = "in_implementation";
      } else if (customer.customerType === "customer") {
        lifecycleStatus = "existing";
      } else {
        lifecycleStatus = "prospect";
      }
      
      return {
        ...customer,
        lifecycleStatus,
        projects: customerProjects,
      };
    });
    
    // Sort: handed_off first, then in_implementation, then existing, then prospect
    const statusOrder = { "handed_off": 0, "in_implementation": 1, "existing": 2, "prospect": 3 };
    customersWithLifecycle.sort((a, b) => statusOrder[a.lifecycleStatus] - statusOrder[b.lifecycleStatus]);
    
    return customersWithLifecycle;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomersByIds(ids: string[]): Promise<Customer[]> {
    if (!ids.length) return [];
    return await db.select().from(customers).where(inArray(customers.id, ids));
  }

  async getCustomerByName(name: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.name, name));
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
  async getLeads(filters?: { stage?: string; salesExecutiveId?: string; salesExecutiveIds?: string[]; limit?: number; offset?: number; search?: string; city?: string; area?: string; leadSource?: string; interestStatus?: string | null; fromDate?: Date; toDate?: Date; followupFrom?: Date; followupTo?: Date; isExistingCustomer?: boolean; hasFollowupDate?: boolean }): Promise<Lead[]> {
    const conditions: any[] = [];
    const maxLimit = filters?.limit;
    const maxOffset = filters?.offset;

    if (filters?.stage) conditions.push(eq(leads.stage, filters.stage));
    if (filters?.salesExecutiveId) conditions.push(eq(leads.salesExecutiveId, filters.salesExecutiveId));
    if (filters?.salesExecutiveIds && filters.salesExecutiveIds.length > 0) {
      conditions.push(inArray(leads.salesExecutiveId, filters.salesExecutiveIds));
    }
    if (filters?.search) {
      conditions.push(or(
        ilike(leads.companyName, `%${filters.search}%`),
        ilike(leads.contactPerson, `%${filters.search}%`),
        ilike(leads.contactPhone, `%${filters.search}%`),
        ilike(leads.contactEmail, `%${filters.search}%`),
      ));
    }
    if (filters?.city) conditions.push(eq(leads.city, filters.city));
    if (filters?.area) conditions.push(eq(leads.area, filters.area));
    if (filters?.leadSource) conditions.push(eq(leads.leadSource, filters.leadSource));

    // Interest status: null means "undecided"
    if (filters && 'interestStatus' in filters) {
      if (filters.interestStatus === null || filters.interestStatus === 'undecided') {
        conditions.push(isNull(leads.interestStatus));
      } else if (filters.interestStatus) {
        conditions.push(eq(leads.interestStatus, filters.interestStatus));
      }
    }

    // Date range on createdAt
    if (filters?.fromDate) conditions.push(gte(leads.createdAt, filters.fromDate));
    if (filters?.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(leads.createdAt, end));
    }

    // Date range on nextFollowupDate
    if (filters?.followupFrom) conditions.push(gte(leads.nextFollowupDate, filters.followupFrom));
    if (filters?.followupTo) conditions.push(lte(leads.nextFollowupDate, filters.followupTo));

    // Has a followup date set
    if (filters?.hasFollowupDate === true) conditions.push(isNotNull(leads.nextFollowupDate));

    let query = db.select().from(leads);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    query = query.orderBy(desc(leads.createdAt)) as any;
    if (maxLimit) query = query.limit(maxLimit) as any;
    if (maxOffset) query = query.offset(maxOffset) as any;

    return await query;
  }

  async getLeadsPaginated(filters: {
    stage?: string;
    salesExecutiveId?: string;
    salesExecutiveIds?: string[];
    search?: string;
    city?: string;
    area?: string;
    leadSource?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ leads: Lead[]; total: number }> {
    const conditions: any[] = [];
    if (filters.stage) conditions.push(eq(leads.stage, filters.stage));
    if (filters.salesExecutiveId) conditions.push(eq(leads.salesExecutiveId, filters.salesExecutiveId));
    if (filters.salesExecutiveIds && filters.salesExecutiveIds.length > 0) {
      conditions.push(inArray(leads.salesExecutiveId, filters.salesExecutiveIds));
    }
    if (filters.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(leads.companyName, s),
        ilike(leads.contactPerson, s),
        ilike(leads.contactPhone, s),
        ilike(leads.contactEmail, s),
      ));
    }
    if (filters.city) conditions.push(eq(leads.city, filters.city));
    if (filters.area) conditions.push(eq(leads.area, filters.area));
    if (filters.leadSource) conditions.push(eq(leads.leadSource, filters.leadSource));
    if (filters.fromDate) conditions.push(gte(leads.createdAt, filters.fromDate));
    if (filters.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(leads.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const pageSize = filters.pageSize || 50;
    const page = filters.page || 1;
    const offset = (page - 1) * pageSize;

    const [[{ total }], rows] = await Promise.all([
      db.select({ total: count() }).from(leads).where(where),
      db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(pageSize).offset(offset),
    ]);

    return { leads: rows, total: Number(total) };
  }

  async getLeadsKanban(filters: {
    search?: string;
    city?: string;
    area?: string;
    leadSource?: string;
    salesExecutiveId?: string;
    salesExecutiveIds?: string[];
    stageLimit?: number;
  }): Promise<{ stages: Record<string, { leads: Lead[]; total: number }> }> {
    const KANBAN_STAGES = ["seed", "lead", "demo_scheduled", "quote_sent", "negotiation", "closed_won"];
    const stageLimit = filters.stageLimit || 50;

    // Build shared base conditions (no stage filter — applied across all stages)
    const baseConds: any[] = [inArray(leads.stage, KANBAN_STAGES)];
    if (filters.search) {
      baseConds.push(or(
        ilike(leads.companyName, `%${filters.search}%`),
        ilike(leads.contactPerson, `%${filters.search}%`),
        ilike(leads.contactPhone, `%${filters.search}%`),
        ilike(leads.contactEmail, `%${filters.search}%`),
      ));
    }
    if (filters.city) baseConds.push(eq(leads.city, filters.city));
    if (filters.area) baseConds.push(eq(leads.area, filters.area));
    if (filters.leadSource) baseConds.push(eq(leads.leadSource, filters.leadSource));
    if (filters.salesExecutiveId) baseConds.push(eq(leads.salesExecutiveId, filters.salesExecutiveId));
    if (filters.salesExecutiveIds && filters.salesExecutiveIds.length > 0) {
      baseConds.push(inArray(leads.salesExecutiveId, filters.salesExecutiveIds));
    }
    const baseWhere = and(...baseConds);

    // 2 queries instead of 12: one for counts, one for paginated leads via ROW_NUMBER()
    const [countRows, pagedRows] = await Promise.all([
      // Query 1: stage counts
      db.select({ stage: leads.stage, total: count() })
        .from(leads)
        .where(baseWhere)
        .groupBy(leads.stage),
      // Query 2: top N leads per stage using ROW_NUMBER() window function
      db.execute(sql`
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY stage ORDER BY created_at DESC) AS rn
          FROM leads
          WHERE ${baseWhere}
        ) ranked
        WHERE rn <= ${stageLimit}
        ORDER BY stage, created_at DESC
      `),
    ]);

    // Build stages map
    const stages: Record<string, { leads: Lead[]; total: number }> = {};
    for (const stage of KANBAN_STAGES) {
      stages[stage] = { leads: [], total: 0 };
    }
    for (const row of countRows) {
      if (row.stage && stages[row.stage]) {
        stages[row.stage].total = Number(row.total);
      }
    }
    for (const row of pagedRows.rows as any[]) {
      const stage = row.stage as string;
      if (stage && stages[stage]) {
        // Map snake_case DB columns to camelCase Lead type
        stages[stage].leads.push({
          id: row.id,
          companyName: row.company_name,
          contactPerson: row.contact_person,
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
          stage: row.stage,
          salesExecutiveId: row.sales_executive_id,
          city: row.city,
          area: row.area,
          leadSource: row.lead_source,
          customLeadSource: row.custom_lead_source,
          estimatedValue: row.estimated_value,
          notes: row.notes,
          photoUrl: row.photo_url,
          followUpDate: row.follow_up_date,
          daysInStage: row.days_in_stage,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        } as Lead);
      }
    }
    return { stages };
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead, options?: { 
    skipStageHistory?: boolean;
    changedById?: string | null;
    changeReason?: string;
  }): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    
    // Automatically record initial stage in history for analytics tracking
    // Can be skipped if the caller will handle it separately
    if (!options?.skipStageHistory) {
      try {
        await db.insert(leadStageHistory).values({
          leadId: newLead.id,
          fromStage: null, // null indicates lead creation
          toStage: newLead.stage || 'seed',
          changedById: options?.changedById || null, // user ID or null for system actions
          changeReason: options?.changeReason || 'Lead created',
        });
      } catch (err) {
        // Log but don't fail lead creation if history recording fails
        console.error("Failed to record initial lead stage history:", err);
      }
    }
    
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

  async getAllFollowUps(): Promise<FollowUp[]> {
    return await db
      .select()
      .from(followUps)
      .orderBy(desc(followUps.followUpDate));
  }

  async countPendingFollowUpsByLeadIds(leadIds: string[]): Promise<number> {
    if (leadIds.length === 0) return 0;
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(followUps)
      .where(
        and(
          inArray(followUps.leadId, leadIds),
          eq(followUps.completed, false),
          lte(followUps.followUpDate, new Date().toISOString().split('T')[0])
        )
      );
    return Number(result[0]?.count ?? 0);
  }

  // Lead Comment operations
  async getLeadComments(leadId: string): Promise<LeadComment[]> {
    return await db
      .select()
      .from(leadComments)
      .where(eq(leadComments.leadId, leadId))
      .orderBy(desc(leadComments.createdAt));
  }

  async createLeadComment(comment: InsertLeadComment): Promise<LeadComment> {
    const [newComment] = await db.insert(leadComments).values(comment).returning();
    return newComment;
  }

  async updateLeadComment(id: string, data: Partial<InsertLeadComment>): Promise<LeadComment> {
    const [updated] = await db
      .update(leadComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leadComments.id, id))
      .returning();
    return updated;
  }

  async deleteLeadComment(id: string): Promise<void> {
    await db.delete(leadComments).where(eq(leadComments.id, id));
  }

  // Demo Date History operations
  async getDemoDateHistory(leadId: string): Promise<DemoDateHistory[]> {
    return await db
      .select()
      .from(demoDateHistory)
      .where(eq(demoDateHistory.leadId, leadId))
      .orderBy(desc(demoDateHistory.createdAt));
  }

  async createDemoDateHistory(history: InsertDemoDateHistory): Promise<DemoDateHistory> {
    const [newHistory] = await db.insert(demoDateHistory).values(history).returning();
    return newHistory;
  }

  // Lead Stage History operations
  async getLeadStageHistory(leadId: string): Promise<LeadStageHistory[]> {
    return await db
      .select()
      .from(leadStageHistory)
      .where(eq(leadStageHistory.leadId, leadId))
      .orderBy(desc(leadStageHistory.createdAt));
  }

  async getAllLeadStageHistory(): Promise<LeadStageHistory[]> {
    return await db
      .select()
      .from(leadStageHistory)
      .orderBy(desc(leadStageHistory.createdAt));
  }

  async getLeadStageHistoryByDateRange(start: Date, end: Date): Promise<LeadStageHistory[]> {
    return await db
      .select()
      .from(leadStageHistory)
      .where(and(
        gte(leadStageHistory.createdAt, start),
        lte(leadStageHistory.createdAt, end)
      ))
      .orderBy(desc(leadStageHistory.createdAt));
  }

  async createLeadStageHistory(history: InsertLeadStageHistory): Promise<LeadStageHistory> {
    const [newHistory] = await db.insert(leadStageHistory).values(history).returning();
    return newHistory;
  }

  // Negotiation Date History operations
  async getNegotiationDateHistory(leadId: string): Promise<NegotiationDateHistory[]> {
    return await db
      .select()
      .from(negotiationDateHistory)
      .where(eq(negotiationDateHistory.leadId, leadId))
      .orderBy(desc(negotiationDateHistory.createdAt));
  }

  async createNegotiationDateHistory(history: InsertNegotiationDateHistory): Promise<NegotiationDateHistory> {
    const [newHistory] = await db.insert(negotiationDateHistory).values(history).returning();
    return newHistory;
  }

  // Lead Assignment History operations
  async getLeadAssignmentHistory(leadId: string): Promise<LeadAssignmentHistory[]> {
    return await db
      .select()
      .from(leadAssignmentHistory)
      .where(eq(leadAssignmentHistory.leadId, leadId))
      .orderBy(desc(leadAssignmentHistory.createdAt));
  }

  async createLeadAssignmentHistory(history: InsertLeadAssignmentHistory): Promise<LeadAssignmentHistory> {
    const [newHistory] = await db.insert(leadAssignmentHistory).values(history).returning();
    return newHistory;
  }

  async reassignLead(leadId: string, newSalesExecutiveId: string, reassignedById: string, reason?: string): Promise<Lead> {
    // Get the current lead to get the old sales executive
    const lead = await this.getLead(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    const oldSalesExecutiveId = lead.salesExecutiveId;

    // Create assignment history record
    await this.createLeadAssignmentHistory({
      leadId,
      fromUserId: oldSalesExecutiveId || undefined,
      toUserId: newSalesExecutiveId,
      reassignedById,
      reason: reason || undefined,
    });

    // Update the lead with new sales executive
    const updatedLead = await this.updateLead(leadId, {
      salesExecutiveId: newSalesExecutiveId,
    });

    return updatedLead;
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
  async getProjects(filters?: { status?: string; engineerIds?: string[]; limit?: number; fromDate?: Date; toDate?: Date }): Promise<Project[]> {
    const conditions: any[] = [];
    const maxLimit = filters?.limit || 200; // Default limit for performance
    
    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    }

    if (filters?.fromDate) {
      conditions.push(gte(projects.createdAt, filters.fromDate));
    }

    if (filters?.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(projects.createdAt, end));
    }
    
    // Filter by engineers assigned to projects
    if (filters?.engineerIds && filters.engineerIds.length > 0) {
      // Get project IDs that have any of the specified engineers
      const engineerProjectIds = await db
        .select({ projectId: projectEngineers.projectId })
        .from(projectEngineers)
        .where(inArray(projectEngineers.engineerId, filters.engineerIds));
      
      const projectIdList = engineerProjectIds.map(p => p.projectId);
      if (projectIdList.length === 0) {
        return []; // No projects for these engineers
      }
      conditions.push(inArray(projects.id, projectIdList));
    }
    
    if (conditions.length > 0) {
      return await db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .limit(maxLimit);
    }
    return await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(maxLimit);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject, selectedModuleNames?: string[]): Promise<Project> {
    // Wrap project creation and module initialization in a transaction
    return await db.transaction(async (tx) => {
      // Create the project
      const [newProject] = await tx.insert(projects).values(project).returning();
      
      // Get all available modules
      const allModules = await tx.select().from(modules).orderBy(modules.name);
      
      // Filter modules based on selected module names (purchased modules)
      // If selectedModuleNames is provided, only create project modules for those
      // Otherwise fall back to all modules for backward compatibility
      let modulesToCreate = allModules;
      if (selectedModuleNames && selectedModuleNames.length > 0) {
        modulesToCreate = allModules.filter(module => 
          selectedModuleNames.includes(module.name)
        );
      }
      
      if (modulesToCreate.length > 0) {
        const projectModuleValues = modulesToCreate.map(module => ({
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

  async getProjectEngineersForProjects(projectIds: string[]): Promise<ProjectEngineer[]> {
    if (!projectIds.length) return [];
    return await db
      .select()
      .from(projectEngineers)
      .where(inArray(projectEngineers.projectId, projectIds));
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

  async getModuleByName(name: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.name, name));
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

  async getProjectModule(id: string): Promise<ProjectModule | undefined> {
    const [pm] = await db.select().from(projectModules).where(eq(projectModules.id, id));
    return pm;
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

  // Planning Change Log operations
  async getPlanningChangeLogs(projectModuleId: string): Promise<PlanningChangeLog[]> {
    return await db
      .select()
      .from(planningChangeLogs)
      .where(eq(planningChangeLogs.projectModuleId, projectModuleId))
      .orderBy(desc(planningChangeLogs.createdAt));
  }

  async getProjectPlanningChangeLogs(projectId: string): Promise<PlanningChangeLog[]> {
    return await db
      .select()
      .from(planningChangeLogs)
      .where(eq(planningChangeLogs.projectId, projectId))
      .orderBy(desc(planningChangeLogs.createdAt));
  }

  async createPlanningChangeLog(log: InsertPlanningChangeLog): Promise<PlanningChangeLog> {
    const [newLog] = await db.insert(planningChangeLogs).values(log).returning();
    return newLog;
  }

  // Project Progress Entry operations
  async getProjectProgressEntries(projectId: string): Promise<(ProjectProgressEntry & { engineer?: User })[]> {
    const entries = await db
      .select()
      .from(projectProgressEntries)
      .where(eq(projectProgressEntries.projectId, projectId))
      .orderBy(desc(projectProgressEntries.progressDate));
    
    // Enrich with engineer details
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        let engineer: User | undefined;
        if (entry.engineerId) {
          engineer = await this.getUser(entry.engineerId);
        }
        return { ...entry, engineer };
      })
    );
    
    return enrichedEntries;
  }

  async getProjectProgressEntry(id: string): Promise<ProjectProgressEntry | undefined> {
    const [entry] = await db
      .select()
      .from(projectProgressEntries)
      .where(eq(projectProgressEntries.id, id));
    return entry;
  }

  async createProjectProgressEntry(entry: InsertProjectProgressEntry): Promise<ProjectProgressEntry> {
    const [newEntry] = await db.insert(projectProgressEntries).values(entry).returning();
    return newEntry;
  }

  async updateProjectProgressEntry(id: string, data: Partial<InsertProjectProgressEntry>): Promise<ProjectProgressEntry> {
    const [updated] = await db
      .update(projectProgressEntries)
      .set(data)
      .where(eq(projectProgressEntries.id, id))
      .returning();
    return updated;
  }

  async deleteProjectProgressEntry(id: string): Promise<void> {
    await db.delete(projectProgressEntries).where(eq(projectProgressEntries.id, id));
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

  // Training Session operations (scheduled training)
  async getTrainingSessions(projectId: string): Promise<TrainingSession[]> {
    return await db
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.projectId, projectId))
      .orderBy(trainingSessions.scheduledDate);
  }

  async getTrainingSession(id: string): Promise<TrainingSession | undefined> {
    const [session] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, id));
    return session;
  }

  async createTrainingSession(session: InsertTrainingSession): Promise<TrainingSession> {
    const [newSession] = await db.insert(trainingSessions).values(session).returning();
    return newSession;
  }

  async updateTrainingSession(id: string, data: Partial<InsertTrainingSession>): Promise<TrainingSession> {
    const [updated] = await db
      .update(trainingSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainingSessions.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingSession(id: string): Promise<void> {
    await db.delete(trainingSessions).where(eq(trainingSessions.id, id));
  }

  // Project Handoff operations
  async getProjectHandoff(projectId: string): Promise<ProjectHandoff | undefined> {
    const [handoff] = await db.select().from(projectHandoffs).where(eq(projectHandoffs.projectId, projectId));
    return handoff;
  }

  async createProjectHandoff(handoff: InsertProjectHandoff): Promise<ProjectHandoff> {
    const [newHandoff] = await db.insert(projectHandoffs).values(handoff).returning();
    return newHandoff;
  }

  async updateProjectHandoff(id: string, data: Partial<InsertProjectHandoff>): Promise<ProjectHandoff> {
    const [updated] = await db
      .update(projectHandoffs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectHandoffs.id, id))
      .returning();
    return updated;
  }

  // Ticket operations
  async getTickets(filters?: { status?: string; priority?: string; assignedEngineerIds?: string[]; limit?: number; fromDate?: Date; toDate?: Date }): Promise<Ticket[]> {
    const conditions: any[] = [];
    const maxLimit = filters?.limit || 500;
    
    if (filters?.status) {
      conditions.push(eq(tickets.status, filters.status));
    }
    
    if (filters?.priority) {
      conditions.push(eq(tickets.priority, filters.priority));
    }
    
    if (filters?.assignedEngineerIds && filters.assignedEngineerIds.length > 0) {
      conditions.push(inArray(tickets.assignedEngineerId, filters.assignedEngineerIds));
    }
    
    // Date range filtering
    if (filters?.fromDate) {
      conditions.push(gte(tickets.createdAt, filters.fromDate));
    }
    if (filters?.toDate) {
      conditions.push(lte(tickets.createdAt, filters.toDate));
    }
    
    if (conditions.length > 0) {
      return await db
        .select()
        .from(tickets)
        .where(and(...conditions))
        .orderBy(desc(tickets.createdAt))
        .limit(maxLimit);
    }
    
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(maxLimit);
  }

  async getTicketsPaginated(filters: {
    assignedEngineerIds?: string[];
    fromDate?: Date;
    toDate?: Date;
    search?: string;
    category?: string;
    statusTab?: string;
    status?: string;
    priority?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ tickets: Ticket[]; total: number; counts: { all: number; open: number; inProgress: number; completed: number; remindersDue: number; support: number; development: number } }> {
    // Build base conditions (date range + employee + search + category)
    const conditions: any[] = [];
    if (filters.assignedEngineerIds && filters.assignedEngineerIds.length > 0) {
      conditions.push(inArray(tickets.assignedEngineerId, filters.assignedEngineerIds));
    }
    if (filters.fromDate) conditions.push(gte(tickets.createdAt, filters.fromDate));
    if (filters.toDate) conditions.push(lte(tickets.createdAt, filters.toDate));
    if (filters.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(ilike(tickets.ticketNumber, s), ilike(tickets.customerName, s), ilike(tickets.issueSummary, s)));
    }
    if (filters.category === 'support') conditions.push(sql`${tickets.escalationLevel} < 3`);
    if (filters.category === 'development') conditions.push(sql`${tickets.escalationLevel} = 3`);
    if (filters.priority) conditions.push(eq(tickets.priority, filters.priority as any));
    if (filters.customerId) conditions.push(eq(tickets.customerId, filters.customerId));

    const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

    // statusTab and granular status add additional filter on top of base
    const tabConditions = [...conditions];
    if (filters.status) {
      tabConditions.push(eq(tickets.status, filters.status as any));
    } else if (filters.statusTab === 'open') {
      tabConditions.push(eq(tickets.status, 'open'));
    } else if (filters.statusTab === 'in_progress') {
      tabConditions.push(sql`${tickets.status} IN ('in_progress','escalated','pending_customer')`);
    } else if (filters.statusTab === 'completed') {
      tabConditions.push(sql`${tickets.status} IN ('closed','resolved','resolved_at_techteam','pending_feedback')`);
    } else if (filters.statusTab === 'reminders_due') {
      tabConditions.push(isNotNull(tickets.reminderDate));
      tabConditions.push(sql`DATE(${tickets.reminderDate}) = CURRENT_DATE`);
      tabConditions.push(sql`${tickets.status} NOT IN ('closed','resolved','resolved_at_techteam','pending_feedback')`);
    }
    const tabWhere = tabConditions.length > 0 ? and(...tabConditions) : undefined;

    const pageSize = filters.pageSize || 50;
    const page = filters.page || 1;
    const offset = (page - 1) * pageSize;

    // Run aggregate counts and paginated data in parallel
    const [countResult, ticketRows] = await Promise.all([
      db.select({
        allCount: sql<number>`COUNT(*)`,
        openCount: sql<number>`COUNT(CASE WHEN ${tickets.status} = 'open' THEN 1 END)`,
        inProgressCount: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('in_progress','escalated','pending_customer') THEN 1 END)`,
        completedCount: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('closed','resolved','resolved_at_techteam','pending_feedback') THEN 1 END)`,
        remindersDueCount: sql<number>`COUNT(CASE WHEN ${tickets.reminderDate} IS NOT NULL AND DATE(${tickets.reminderDate}) = CURRENT_DATE AND ${tickets.status} NOT IN ('closed','resolved','resolved_at_techteam','pending_feedback') THEN 1 END)`,
        supportCount: sql<number>`COUNT(CASE WHEN ${tickets.escalationLevel} < 3 THEN 1 END)`,
        developmentCount: sql<number>`COUNT(CASE WHEN ${tickets.escalationLevel} = 3 THEN 1 END)`,
      }).from(tickets).where(baseWhere),
      db.select().from(tickets).where(tabWhere).orderBy(desc(tickets.createdAt)).limit(pageSize).offset(offset),
    ]);

    const c = countResult[0];
    return {
      tickets: ticketRows,
      total: Number(c.allCount),
      counts: {
        all: Number(c.allCount),
        open: Number(c.openCount),
        inProgress: Number(c.inProgressCount),
        completed: Number(c.completedCount),
        remindersDue: Number(c.remindersDueCount),
        support: Number(c.supportCount),
        development: Number(c.developmentCount),
      },
    };
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async getTicketsByIds(ids: string[]): Promise<Ticket[]> {
    if (!ids.length) return [];
    return await db.select().from(tickets).where(inArray(tickets.id, ids));
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

  // Ticket Assignment History operations
  async getTicketAssignmentHistory(ticketId: string): Promise<any[]> {
    const results = await db.execute(sql`
      SELECT 
        tah.*,
        e.first_name as engineer_first_name,
        e.last_name as engineer_last_name,
        e.email as engineer_email,
        t.first_name as transferred_to_first_name,
        t.last_name as transferred_to_last_name
      FROM ticket_assignment_history tah
      LEFT JOIN users e ON e.id = tah.engineer_id
      LEFT JOIN users t ON t.id = tah.transferred_to_id
      WHERE tah.ticket_id = ${ticketId}
      ORDER BY tah.assigned_at ASC
    `);
    return results.rows as any[];
  }

  async createTicketAssignmentHistory(data: { ticketId: string; engineerId: string; assignedAt?: Date }): Promise<any> {
    const results = await db.execute(sql`
      INSERT INTO ticket_assignment_history (ticket_id, engineer_id, assigned_at)
      VALUES (${data.ticketId}, ${data.engineerId}, ${data.assignedAt || new Date()})
      RETURNING *
    `);
    return (results.rows as any[])[0];
  }

  async updateTicketAssignmentHistory(id: string, data: { unassignedAt?: Date; transferredToId?: string; transferReason?: string; actionsTaken?: string }): Promise<any> {
    const results = await db.execute(sql`
      UPDATE ticket_assignment_history 
      SET 
        unassigned_at = COALESCE(${data.unassignedAt || null}, unassigned_at),
        transferred_to_id = COALESCE(${data.transferredToId || null}, transferred_to_id),
        transfer_reason = COALESCE(${data.transferReason || null}, transfer_reason),
        actions_taken = COALESCE(${data.actionsTaken || null}, actions_taken)
      WHERE id = ${id}
      RETURNING *
    `);
    return (results.rows as any[])[0];
  }

  async getActiveTicketAssignment(ticketId: string): Promise<any | undefined> {
    const results = await db.execute(sql`
      SELECT * FROM ticket_assignment_history 
      WHERE ticket_id = ${ticketId} AND unassigned_at IS NULL
      ORDER BY assigned_at DESC
      LIMIT 1
    `);
    return (results.rows as any[])[0];
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

  async getFeedbackListByTicket(ticketId: string): Promise<(Feedback & { submittedBy?: User; completedBy?: User })[]> {
    const feedbackEntries = await db.select().from(feedback).where(eq(feedback.ticketId, ticketId)).orderBy(desc(feedback.submittedAt));
    
    // Enrich with user details
    const enrichedFeedback = await Promise.all(feedbackEntries.map(async (fb) => {
      let submittedBy: User | undefined;
      let completedBy: User | undefined;
      
      if (fb.submittedById) {
        submittedBy = await this.getUser(fb.submittedById);
      }
      if (fb.completedById) {
        completedBy = await this.getUser(fb.completedById);
      }
      
      return { ...fb, submittedBy, completedBy };
    }));
    
    return enrichedFeedback;
  }

  async updateFeedback(id: string, data: Partial<InsertFeedback>): Promise<Feedback> {
    const [updated] = await db.update(feedback).set(data).where(eq(feedback.id, id)).returning();
    return updated;
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
      seed: "Seeds",
      lead: "Leads",
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

  // Detailed Implementation Report for Export/Email
  async getImplementationDetailReport(): Promise<any> {
    // Get all projects with their modules and engineers
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    
    // Get summary counts
    const stats = {
      totalProjects: allProjects.length,
      inProgress: allProjects.filter(p => p.status === 'in_progress').length,
      inTraining: allProjects.filter(p => p.status === 'training').length,
      completed: allProjects.filter(p => p.status === 'completed').length,
      pendingHandoff: allProjects.filter(p => p.completionPercentage === 100 && p.status !== 'completed').length,
    };

    // Get detailed project data
    const projectDetails = await Promise.all(
      allProjects.map(async (project) => {
        // Get project modules
        const modules = await db
          .select()
          .from(projectModules)
          .where(eq(projectModules.projectId, project.id));
        
        const modulesCompleted = modules.filter(m => m.completed).length;
        
        // Get assigned engineers
        const engineerAssignments = await db
          .select({ user: users })
          .from(projectEngineers)
          .innerJoin(users, eq(projectEngineers.engineerId, users.id))
          .where(eq(projectEngineers.projectId, project.id));
        
        const engineerNames = engineerAssignments
          .map(e => `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim())
          .filter(n => n)
          .join(', ') || 'Unassigned';

        // Get module details
        const moduleDetails = await Promise.all(
          modules.map(async (mod) => {
            const moduleInfo = await this.getModule(mod.moduleId);
            const engineer = mod.assignedEngineerId 
              ? await this.getUser(mod.assignedEngineerId)
              : null;
            
            return {
              moduleName: moduleInfo?.name || 'Unknown',
              status: mod.installationStatus || 'not_started',
              completed: mod.completed,
              assignedEngineer: engineer ? `${engineer.firstName} ${engineer.lastName}` : 'Unassigned',
              department: mod.departmentName || '-',
              startDate: mod.scheduledStartDate ? new Date(mod.scheduledStartDate).toLocaleDateString() : '-',
              endDate: mod.scheduledEndDate ? new Date(mod.scheduledEndDate).toLocaleDateString() : '-',
            };
          })
        );

        return {
          id: project.id,
          clientName: project.clientName,
          status: project.status,
          completionPercentage: project.completionPercentage || 0,
          modulesCompleted,
          totalModules: modules.length,
          assignedEngineers: engineerNames,
          dueDate: project.implementationDate 
            ? new Date(project.implementationDate).toLocaleDateString() 
            : null,
          createdAt: project.createdAt 
            ? new Date(project.createdAt).toLocaleDateString() 
            : null,
          modules: moduleDetails,
        };
      })
    );

    return {
      summary: stats,
      projects: projectDetails,
      generatedAt: new Date().toISOString(),
    };
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

  async getAllAttachments(): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
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

  // Task operations
  async getTasks(filters?: { 
    userId?: string; 
    userIds?: string[];
    assignedTo?: string; 
    createdBy?: string; 
    status?: string;
    includeAll?: boolean;
    limit?: number;
  }): Promise<(Task & { 
    creator?: User; 
    assignee?: User; 
    mentionedUserDetails?: User[];
    commentsCount?: number;
  })[]> {
    const conditions: any[] = [];
    const maxLimit = filters?.limit || 200; // Default limit for performance
    
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    
    if (!filters?.includeAll) {
      // If not admin viewing all, filter by user involvement
      if (filters?.userIds && filters.userIds.length > 0) {
        // Department-based filtering: show tasks where any of the users is creator, assignee, or mentioned
        const userIdConditions = filters.userIds.map(uid => 
          or(
            eq(tasks.createdBy, uid),
            eq(tasks.assignedTo, uid),
            sql`COALESCE(${tasks.mentionedUsers}, ARRAY[]::text[]) @> ARRAY[${uid}]::text[]`
          )
        );
        conditions.push(or(...userIdConditions));
      } else if (filters?.userId) {
        // Show tasks where user is creator, assignee, or mentioned
        // Use raw SQL for the array check to avoid parameterization issues
        conditions.push(
          or(
            eq(tasks.createdBy, filters.userId),
            eq(tasks.assignedTo, filters.userId),
            sql`COALESCE(${tasks.mentionedUsers}, ARRAY[]::text[]) @> ARRAY[${filters.userId}]::text[]`
          )
        );
      }
      if (filters?.assignedTo) {
        conditions.push(eq(tasks.assignedTo, filters.assignedTo));
      }
      if (filters?.createdBy) {
        conditions.push(eq(tasks.createdBy, filters.createdBy));
      }
    }

    const taskList = await db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(maxLimit);

    if (taskList.length === 0) return [];

    // Collect all unique user IDs (creators + assignees + mentioned)
    const allMentioned = taskList.flatMap(t => t.mentionedUsers || []);
    const allUserIds = [...new Set([
      ...taskList.map(t => t.createdBy).filter(Boolean) as string[],
      ...taskList.map(t => t.assignedTo).filter(Boolean) as string[],
      ...allMentioned,
    ])];

    // Bulk fetch users + comment counts in parallel
    const [usersData, commentCounts] = await Promise.all([
      allUserIds.length > 0
        ? db.select().from(users).where(inArray(users.id, allUserIds))
        : Promise.resolve([]),
      db
        .select({ taskId: taskComments.taskId, count: sql<number>`count(*)` })
        .from(taskComments)
        .where(inArray(taskComments.taskId, taskList.map(t => t.id)))
        .groupBy(taskComments.taskId),
    ]);

    const userMap = new Map(usersData.map(u => [u.id, u]));
    const commentCountMap = new Map(commentCounts.map(c => [c.taskId, Number(c.count)]));

    const enrichedTasks = taskList.map(task => ({
      ...task,
      creator: task.createdBy ? (userMap.get(task.createdBy) as User | undefined) : undefined,
      assignee: task.assignedTo ? (userMap.get(task.assignedTo) as User | undefined) : undefined,
      mentionedUserDetails: (task.mentionedUsers || [])
        .map(uid => userMap.get(uid))
        .filter(Boolean) as User[],
      commentsCount: commentCountMap.get(task.id) || 0,
    }));

    return enrichedTasks;
  }

  async getTask(id: string): Promise<(Task & { 
    creator?: User; 
    assignee?: User; 
    mentionedUserDetails?: User[];
  }) | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return undefined;

    const [creator] = task.createdBy 
      ? await db.select().from(users).where(eq(users.id, task.createdBy))
      : [undefined];
    
    const [assignee] = task.assignedTo 
      ? await db.select().from(users).where(eq(users.id, task.assignedTo))
      : [undefined];

    let mentionedUserDetails: User[] = [];
    if (task.mentionedUsers && task.mentionedUsers.length > 0) {
      mentionedUserDetails = await db
        .select()
        .from(users)
        .where(sql`${users.id} IN (${sql.join(task.mentionedUsers.map(id => sql`${id}`), sql`, `)})`);
    }

    return {
      ...task,
      creator,
      assignee,
      mentionedUserDetails,
    };
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task as any).returning();
    return newTask;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Set completedAt when status changes to completed
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Task Comment operations
  async getTaskComments(taskId: string): Promise<(TaskComment & { user?: User })[]> {
    const comments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(desc(taskComments.createdAt));

    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const [user] = comment.userId 
          ? await db.select().from(users).where(eq(users.id, comment.userId))
          : [undefined];
        return { ...comment, user };
      })
    );

    return enrichedComments;
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [newComment] = await db.insert(taskComments).values(comment).returning();
    return newComment;
  }

  async updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment> {
    const [updated] = await db
      .update(taskComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taskComments.id, id))
      .returning();
    return updated;
  }

  async deleteTaskComment(id: string): Promise<void> {
    await db.delete(taskComments).where(eq(taskComments.id, id));
  }

  // Task Followup operations
  async getTaskFollowups(taskId: string): Promise<(TaskFollowup & { user?: User })[]> {
    const followups = await db
      .select()
      .from(taskFollowups)
      .where(eq(taskFollowups.taskId, taskId))
      .orderBy(desc(taskFollowups.createdAt));

    const enrichedFollowups = await Promise.all(
      followups.map(async (followup) => {
        const [user] = followup.userId 
          ? await db.select().from(users).where(eq(users.id, followup.userId))
          : [undefined];
        return { ...followup, user };
      })
    );

    return enrichedFollowups;
  }

  async getTaskFollowup(id: string): Promise<TaskFollowup | undefined> {
    const [followup] = await db.select().from(taskFollowups).where(eq(taskFollowups.id, id));
    return followup;
  }

  async createTaskFollowup(followup: InsertTaskFollowup): Promise<TaskFollowup> {
    const [newFollowup] = await db.insert(taskFollowups).values(followup).returning();
    return newFollowup;
  }

  async updateTaskFollowup(id: string, data: Partial<InsertTaskFollowup>): Promise<TaskFollowup> {
    const [updated] = await db
      .update(taskFollowups)
      .set(data)
      .where(eq(taskFollowups.id, id))
      .returning();
    return updated;
  }

  async deleteTaskFollowup(id: string): Promise<void> {
    await db.delete(taskFollowups).where(eq(taskFollowups.id, id));
  }

  async getTodayTasks(userId?: string, includeAll?: boolean): Promise<(Task & { 
    creator?: User; 
    assignee?: User;
    followupsCount?: number;
    latestFollowup?: TaskFollowup;
  })[]> {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build conditions for today's tasks:
    // 1. Tasks with reminder date today
    // 2. Tasks with due date today
    // 3. Tasks where a followup has next_followup_date = today
    // 4. All pending/followup tasks assigned to user (or all if admin)
    
    let allTasks: Task[] = [];
    
    if (includeAll) {
      // Super admin sees all non-completed tasks
      allTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            or(
              // Tasks with reminder date today
              and(gte(tasks.reminderDate, today), lte(tasks.reminderDate, tomorrow)),
              // Tasks with due date today
              and(gte(tasks.dueDate, today), lte(tasks.dueDate, tomorrow)),
              // Pending tasks
              eq(tasks.status, 'pending'),
              // Followup tasks
              eq(tasks.status, 'followup')
            )
          )
        )
        .orderBy(desc(tasks.createdAt));
    } else if (userId) {
      // Regular user sees their own tasks
      allTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            or(
              eq(tasks.assignedTo, userId),
              eq(tasks.createdBy, userId)
            ),
            or(
              // Tasks with reminder date today
              and(gte(tasks.reminderDate, today), lte(tasks.reminderDate, tomorrow)),
              // Tasks with due date today
              and(gte(tasks.dueDate, today), lte(tasks.dueDate, tomorrow)),
              // Pending tasks
              eq(tasks.status, 'pending'),
              // Followup tasks
              eq(tasks.status, 'followup')
            )
          )
        )
        .orderBy(desc(tasks.createdAt));
    }

    // Also get tasks where followup has next_followup_date = today
    const followupsForToday = await db
      .select()
      .from(taskFollowups)
      .where(
        and(
          gte(taskFollowups.nextFollowupDate, today),
          lte(taskFollowups.nextFollowupDate, tomorrow)
        )
      );

    // Get task IDs from followups
    const followupTaskIds = Array.from(new Set(followupsForToday.map(f => f.taskId)));
    
    // Fetch those tasks if not already included
    if (followupTaskIds.length > 0) {
      const existingTaskIds = new Set(allTasks.map(t => t.id));
      const missingTaskIds = followupTaskIds.filter(id => !existingTaskIds.has(id));
      
      if (missingTaskIds.length > 0) {
        for (const taskId of missingTaskIds) {
          const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
          if (task) {
            // Check if user has access (for non-admin)
            if (includeAll || !userId || task.assignedTo === userId || task.createdBy === userId) {
              allTasks.push(task);
            }
          }
        }
      }
    }

    // Enrich with user details and followup counts
    const enrichedTasks = await Promise.all(
      allTasks.map(async (task) => {
        const [creator] = task.createdBy 
          ? await db.select().from(users).where(eq(users.id, task.createdBy))
          : [undefined];
        
        const [assignee] = task.assignedTo 
          ? await db.select().from(users).where(eq(users.id, task.assignedTo))
          : [undefined];

        // Get followup count
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(taskFollowups)
          .where(eq(taskFollowups.taskId, task.id));
        
        const followupsCount = Number(countResult?.count || 0);

        // Get latest followup
        const [latestFollowup] = await db
          .select()
          .from(taskFollowups)
          .where(eq(taskFollowups.taskId, task.id))
          .orderBy(desc(taskFollowups.createdAt))
          .limit(1);

        return {
          ...task,
          creator,
          assignee,
          followupsCount,
          latestFollowup,
        };
      })
    );

    return enrichedTasks;
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.name, name));
    return dept;
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [newDept] = await db.insert(departments).values(dept).returning();
    return newDept;
  }

  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department> {
    const [updated] = await db
      .update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return updated;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // Department Heads operations (multiple heads per department)
  async getDepartmentHeads(departmentId: string): Promise<(DepartmentHead & { user?: User })[]> {
    const heads = await db.select().from(departmentHeads).where(eq(departmentHeads.departmentId, departmentId));
    const enriched = await Promise.all(
      heads.map(async (head) => {
        const [user] = await db.select().from(users).where(eq(users.id, head.userId));
        return { ...head, user };
      })
    );
    return enriched;
  }

  async setDepartmentHeads(departmentId: string, userIds: string[], primaryUserId?: string): Promise<void> {
    // Delete existing heads for this department
    await db.delete(departmentHeads).where(eq(departmentHeads.departmentId, departmentId));
    
    // Insert new heads
    if (userIds.length > 0) {
      const values = userIds.map((userId) => ({
        departmentId,
        userId,
        isPrimary: userId === primaryUserId,
      }));
      await db.insert(departmentHeads).values(values);
    }
    
    // Also update legacy managerId field with primary head for backward compatibility
    const primaryHead = primaryUserId || userIds[0] || null;
    await db.update(departments)
      .set({ managerId: primaryHead, updatedAt: new Date() })
      .where(eq(departments.id, departmentId));
  }

  async isUserDepartmentHead(userId: string): Promise<{ isDeptHead: boolean; departments: Department[] }> {
    // Check both new junction table and legacy managerId field
    const headAssignments = await db.select().from(departmentHeads).where(eq(departmentHeads.userId, userId));
    const legacyDepts = await db.select().from(departments).where(eq(departments.managerId, userId));
    
    // Combine unique department IDs from both sources
    const deptIds = new Set([
      ...headAssignments.map(h => h.departmentId),
      ...legacyDepts.map(d => d.id)
    ]);
    
    if (deptIds.size === 0) {
      return { isDeptHead: false, departments: [] };
    }
    
    const deptList = await db.select().from(departments).where(inArray(departments.id, Array.from(deptIds)));
    return { isDeptHead: true, departments: deptList };
  }

  async getDepartmentsByHead(userId: string): Promise<Department[]> {
    const result = await this.isUserDepartmentHead(userId);
    return result.departments;
  }

  // System Module operations
  async getSystemModules(): Promise<SystemModule[]> {
    const cached = getCached<SystemModule[]>("modules:all");
    if (cached) return cached;
    const result = await db.select().from(systemModules).orderBy(systemModules.sortOrder);
    setCached("modules:all", result, 600);
    return result;
  }

  async getSystemModule(id: string): Promise<SystemModule | undefined> {
    const [module] = await db.select().from(systemModules).where(eq(systemModules.id, id));
    return module;
  }

  async createSystemModule(module: InsertSystemModule): Promise<SystemModule> {
    const [newModule] = await db.insert(systemModules).values(module).returning();
    return newModule;
  }

  async updateSystemModule(id: string, data: Partial<InsertSystemModule>): Promise<SystemModule> {
    const [updated] = await db
      .update(systemModules)
      .set(data)
      .where(eq(systemModules.id, id))
      .returning();
    return updated;
  }

  async deleteSystemModule(id: string): Promise<void> {
    await db.delete(systemModules).where(eq(systemModules.id, id));
  }

  // User Role Assignment operations
  async getUserRoleAssignments(userId?: string): Promise<(UserRoleAssignment & { role?: UserRole })[]> {
    const query = userId 
      ? db.select().from(userRoleAssignments).where(and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.isActive, true)))
      : db.select().from(userRoleAssignments).where(eq(userRoleAssignments.isActive, true));
    
    const assignments = await query;
    if (assignments.length === 0) return [];

    // Bulk fetch all roles in one query instead of N individual lookups
    const roleIds = [...new Set(assignments.map(a => a.roleId).filter(Boolean))];
    const rolesData = roleIds.length > 0
      ? await db.select().from(userRoles).where(inArray(userRoles.id, roleIds))
      : [];
    const roleMap = new Map(rolesData.map(r => [r.id, r]));

    return assignments.map(assignment => ({
      ...assignment,
      role: roleMap.get(assignment.roleId),
    }));
  }

  async getUserRoleAssignment(id: string): Promise<UserRoleAssignment | undefined> {
    const [assignment] = await db.select().from(userRoleAssignments).where(eq(userRoleAssignments.id, id));
    return assignment;
  }

  async assignRoleToUser(assignment: InsertUserRoleAssignment): Promise<UserRoleAssignment> {
    const [newAssignment] = await db.insert(userRoleAssignments).values(assignment).returning();
    return newAssignment;
  }

  async removeRoleFromUser(id: string): Promise<void> {
    await db.update(userRoleAssignments).set({ isActive: false }).where(eq(userRoleAssignments.id, id));
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    const assignments = await this.getUserRoleAssignments(userId);
    const roles = assignments.map(a => a.role).filter((r): r is UserRole => !!r);
    
    // Get effective permissions
    const permissions = await this.getUserEffectivePermissions(userId);

    return {
      ...user,
      roles,
      permissions: permissions.map(p => ({
        module: p.module,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      })),
    };
  }

  // Role Change History operations
  async getRoleChangeHistory(userId?: string): Promise<(RoleChangeHistory & { 
    previousRole?: UserRole; 
    newRole?: UserRole;
    changedByUser?: User;
  })[]> {
    const query = userId 
      ? db.select().from(roleChangeHistory).where(eq(roleChangeHistory.userId, userId)).orderBy(desc(roleChangeHistory.createdAt))
      : db.select().from(roleChangeHistory).orderBy(desc(roleChangeHistory.createdAt));
    
    const history = await query;
    
    const enriched = await Promise.all(
      history.map(async (h) => {
        const [previousRole] = h.previousRoleId 
          ? await db.select().from(userRoles).where(eq(userRoles.id, h.previousRoleId))
          : [undefined];
        const [newRole] = h.newRoleId 
          ? await db.select().from(userRoles).where(eq(userRoles.id, h.newRoleId))
          : [undefined];
        const [changedByUser] = await db.select().from(users).where(eq(users.id, h.changedBy));
        return { ...h, previousRole, newRole, changedByUser };
      })
    );
    
    return enriched;
  }

  async createRoleChangeHistory(history: InsertRoleChangeHistory): Promise<RoleChangeHistory> {
    const [newHistory] = await db.insert(roleChangeHistory).values(history).returning();
    return newHistory;
  }

  // User Module Permission operations
  async getUserModulePermissions(userId: string): Promise<(UserModulePermission & { module?: SystemModule })[]> {
    const permissions = await db
      .select()
      .from(userModulePermissions)
      .where(eq(userModulePermissions.userId, userId));
    
    const enriched = await Promise.all(
      permissions.map(async (p) => {
        const [module] = await db.select().from(systemModules).where(eq(systemModules.id, p.moduleId));
        return { ...p, module };
      })
    );
    
    return enriched;
  }

  async getUserModulePermission(id: string): Promise<UserModulePermission | undefined> {
    const [permission] = await db.select().from(userModulePermissions).where(eq(userModulePermissions.id, id));
    return permission;
  }

  async setUserModulePermission(permission: InsertUserModulePermission): Promise<UserModulePermission> {
    // Check if permission already exists for this user and module
    const existing = await db
      .select()
      .from(userModulePermissions)
      .where(and(
        eq(userModulePermissions.userId, permission.userId),
        eq(userModulePermissions.moduleId, permission.moduleId)
      ));
    
    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(userModulePermissions)
        .set({ ...permission, updatedAt: new Date() })
        .where(eq(userModulePermissions.id, existing[0].id))
        .returning();
      return updated;
    }
    
    // Create new
    const [newPermission] = await db.insert(userModulePermissions).values(permission).returning();
    return newPermission;
  }

  async updateUserModulePermission(id: string, data: Partial<InsertUserModulePermission>): Promise<UserModulePermission> {
    const [updated] = await db
      .update(userModulePermissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userModulePermissions.id, id))
      .returning();
    return updated;
  }

  async deleteUserModulePermission(id: string): Promise<void> {
    await db.delete(userModulePermissions).where(eq(userModulePermissions.id, id));
  }

  async getUserEffectivePermissions(userId: string): Promise<{
    module: string;
    moduleName: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    source: 'role' | 'user';
  }[]> {
    // Get all system modules
    const allModules = await this.getSystemModules();
    
    // Get user's role assignments from new table
    const assignments = await this.getUserRoleAssignments(userId);
    let roleIds = assignments.filter(a => a.isActive).map(a => a.roleId);
    
    // If no new-style role assignments, check for legacy role in users table
    if (roleIds.length === 0) {
      const user = await this.getUser(userId);
      if (user?.role) {
        // Find role by name matching the legacy role field
        const allRoles = await this.getUserRoles();
        const legacyRole = allRoles.find(r => r.name === user.role && r.isActive);
        if (legacyRole) {
          roleIds = [legacyRole.id];
        }
      }
    }
    
    // Get role rights for all assigned roles
    const allRoleRights = roleIds.length > 0 
      ? await db.select().from(userRoleRights).where(sql`${userRoleRights.roleId} IN (${sql.join(roleIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    
    // Get user's individual permissions
    const userPermissions = await this.getUserModulePermissions(userId);
    
    // Combine permissions for each module
    const effectivePermissions = allModules.map(module => {
      // Check for user-specific override first
      const userPerm = userPermissions.find(p => p.module?.name === module.name);
      if (userPerm) {
        return {
          module: module.name,
          moduleName: module.displayName,
          canView: userPerm.canView || false,
          canCreate: userPerm.canCreate || false,
          canEdit: userPerm.canEdit || false,
          canDelete: userPerm.canDelete || false,
          source: 'user' as const,
        };
      }
      
      // Aggregate permissions from all roles (OR logic - if any role grants permission, user has it)
      // Compare using module.id since userRoleRights.module stores the module ID, not the name
      const rolePerms = allRoleRights.filter(r => r.module === module.id);
      const hasView = rolePerms.some(r => r.canView);
      const hasCreate = rolePerms.some(r => r.canCreate);
      const hasEdit = rolePerms.some(r => r.canEdit);
      const hasDelete = rolePerms.some(r => r.canDelete);
      
      return {
        module: module.name,
        moduleName: module.displayName,
        canView: hasView,
        canCreate: hasCreate,
        canEdit: hasEdit,
        canDelete: hasDelete,
        source: 'role' as const,
      };
    });
    
    return effectivePermissions;
  }

  async getRoleWithRights(roleId: string): Promise<RoleWithRights | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.id, roleId));
    if (!role) return undefined;
    
    const rights = await db.select().from(userRoleRights).where(eq(userRoleRights.roleId, roleId));
    
    return {
      ...role,
      rights,
    };
  }

  // Knowledge Base Source operations
  async getKnowledgeBaseSources(): Promise<KnowledgeBaseSource[]> {
    return await db.select().from(knowledgeBaseSources).orderBy(desc(knowledgeBaseSources.createdAt));
  }

  async getKnowledgeBaseSource(id: string): Promise<KnowledgeBaseSource | undefined> {
    const [source] = await db.select().from(knowledgeBaseSources).where(eq(knowledgeBaseSources.id, id));
    return source;
  }

  async createKnowledgeBaseSource(source: InsertKnowledgeBaseSource): Promise<KnowledgeBaseSource> {
    const [created] = await db.insert(knowledgeBaseSources).values(source).returning();
    return created;
  }

  async updateKnowledgeBaseSource(id: string, data: Partial<InsertKnowledgeBaseSource>): Promise<KnowledgeBaseSource> {
    const [updated] = await db
      .update(knowledgeBaseSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(knowledgeBaseSources.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBaseSource(id: string): Promise<void> {
    await db.delete(knowledgeBaseSources).where(eq(knowledgeBaseSources.id, id));
  }

  // Knowledge Base Chunk operations
  async getKnowledgeBaseChunks(sourceId: string): Promise<KnowledgeBaseChunk[]> {
    return await db.select().from(knowledgeBaseChunks).where(eq(knowledgeBaseChunks.sourceId, sourceId));
  }

  async createKnowledgeBaseChunk(chunk: InsertKnowledgeBaseChunk): Promise<KnowledgeBaseChunk> {
    const [created] = await db.insert(knowledgeBaseChunks).values(chunk as any).returning();
    return created;
  }

  async createKnowledgeBaseChunks(chunks: InsertKnowledgeBaseChunk[]): Promise<KnowledgeBaseChunk[]> {
    if (chunks.length === 0) return [];
    const created = await db.insert(knowledgeBaseChunks).values(chunks as any).returning();
    return created;
  }

  async deleteKnowledgeBaseChunksBySource(sourceId: string): Promise<void> {
    await db.delete(knowledgeBaseChunks).where(eq(knowledgeBaseChunks.sourceId, sourceId));
  }

  async searchKnowledgeBase(embedding: number[], limit: number = 10, category?: string, languageCode?: string, includeCrossLanguage: boolean = false): Promise<(KnowledgeBaseChunk & { similarity: number; source?: KnowledgeBaseSource })[]> {
    const embeddingString = `[${embedding.join(',')}]`;
    
    let query = sql`
      SELECT 
        c.*,
        s.id as source_id,
        s.title as source_title,
        s.category as source_category,
        s.content_type as source_content_type,
        s.language_code as source_language_code,
        s.translation_group_id as source_translation_group_id,
        s.created_by as source_created_by,
        s.created_at as source_created_at,
        1 - (c.embedding <=> ${embeddingString}::vector) as similarity
      FROM knowledge_base_chunks c
      JOIN knowledge_base_sources s ON c.source_id = s.id
      WHERE s.is_active = true
    `;
    
    if (category) {
      query = sql`${query} AND s.category = ${category}`;
    }
    
    // Apply language filter if specified and cross-language search is disabled
    // Handle null/empty language codes by matching default 'en' or the specified language
    if (languageCode && !includeCrossLanguage) {
      query = sql`${query} AND (c.language_code = ${languageCode} OR c.language_code IS NULL OR c.language_code = '')`;
    }
    
    query = sql`${query} ORDER BY c.embedding <=> ${embeddingString}::vector LIMIT ${limit}`;
    
    const results = await db.execute(query);
    
    return (results.rows as any[]).map(row => ({
      id: row.id,
      sourceId: row.source_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      languageCode: row.language_code,
      metadata: row.metadata,
      tokenCount: row.token_count,
      createdAt: row.created_at,
      similarity: parseFloat(row.similarity),
      source: {
        id: row.source_id,
        title: row.source_title,
        category: row.source_category,
        contentType: row.source_content_type,
        languageCode: row.source_language_code,
        translationGroupId: row.source_translation_group_id,
        createdBy: row.source_created_by,
        createdAt: row.source_created_at,
      } as KnowledgeBaseSource,
    })) as any;
  }

  // Knowledge Base Query operations (for analytics)
  async createKnowledgeBaseQuery(query: InsertKnowledgeBaseQuery): Promise<KnowledgeBaseQuery> {
    const [created] = await db.insert(knowledgeBaseQueries).values(query as any).returning();
    return created;
  }

  async getKnowledgeBaseQueries(limit: number = 100): Promise<(KnowledgeBaseQuery & { user?: User })[]> {
    const queries = await db
      .select()
      .from(knowledgeBaseQueries)
      .orderBy(desc(knowledgeBaseQueries.createdAt))
      .limit(limit);
    
    const queriesWithUsers = await Promise.all(
      queries.map(async (q) => {
        if (!q.userId) return { ...q, user: undefined };
        const user = await this.getUser(q.userId);
        return { ...q, user };
      })
    );
    
    return queriesWithUsers;
  }

  // System Settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key));
    return setting;
  }

  async getSystemSettingsByCategory(category: string): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).where(eq(systemSettings.category, category));
  }

  async upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const [upserted] = await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue: setting.settingValue,
          settingType: setting.settingType,
          category: setting.category,
          description: setting.description,
          isSecret: setting.isSecret,
          updatedBy: setting.updatedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async deleteSystemSetting(key: string): Promise<void> {
    await db.delete(systemSettings).where(eq(systemSettings.settingKey, key));
  }

  // SMTP Configuration helpers
  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const settings = await this.getSystemSettingsByCategory("smtp");
    if (settings.length === 0) return null;

    const config: Record<string, any> = {};
    for (const setting of settings) {
      const key = setting.settingKey.replace("smtp_", "");
      if (setting.settingType === "boolean") {
        config[key] = setting.settingValue === "true";
      } else if (setting.settingType === "number") {
        config[key] = parseInt(setting.settingValue || "0", 10);
      } else {
        config[key] = setting.settingValue || "";
      }
    }

    // Check if all required fields are present
    if (!config.host || !config.port || !config.user || !config.pass || !config.from) {
      return null;
    }

    return config as SmtpConfig;
  }

  async saveSmtpConfig(config: SmtpConfig, userId: string): Promise<void> {
    const smtpSettings: InsertSystemSetting[] = [
      {
        settingKey: "smtp_host",
        settingValue: config.host,
        settingType: "string",
        category: "smtp",
        description: "SMTP server hostname",
        isSecret: false,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_port",
        settingValue: config.port.toString(),
        settingType: "number",
        category: "smtp",
        description: "SMTP server port",
        isSecret: false,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_user",
        settingValue: config.user,
        settingType: "string",
        category: "smtp",
        description: "SMTP username/email",
        isSecret: false,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_pass",
        settingValue: config.pass,
        settingType: "string",
        category: "smtp",
        description: "SMTP password or app password",
        isSecret: true,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_from",
        settingValue: config.from,
        settingType: "string",
        category: "smtp",
        description: "From email address",
        isSecret: false,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_secure",
        settingValue: config.secure.toString(),
        settingType: "boolean",
        category: "smtp",
        description: "Use SSL/TLS",
        isSecret: false,
        updatedBy: userId,
      },
      {
        settingKey: "smtp_enabled",
        settingValue: config.enabled.toString(),
        settingType: "boolean",
        category: "smtp",
        description: "Enable SMTP email sending",
        isSecret: false,
        updatedBy: userId,
      },
    ];

    for (const setting of smtpSettings) {
      await this.upsertSystemSetting(setting);
    }
  }

  // Point Categories operations
  async getPointCategories(): Promise<PointCategory[]> {
    return await db.select().from(pointCategories).orderBy(pointCategories.name);
  }

  async getPointCategoriesByModule(moduleType: string): Promise<PointCategory[]> {
    return await db.select().from(pointCategories)
      .where(eq(pointCategories.moduleType, moduleType))
      .orderBy(pointCategories.name);
  }

  async getPointCategory(id: string): Promise<PointCategory | undefined> {
    const [category] = await db.select().from(pointCategories).where(eq(pointCategories.id, id));
    return category;
  }

  async createPointCategory(category: InsertPointCategory): Promise<PointCategory> {
    const [created] = await db.insert(pointCategories).values(category).returning();
    return created;
  }

  async updatePointCategory(id: string, category: Partial<InsertPointCategory>): Promise<PointCategory | undefined> {
    const [updated] = await db.update(pointCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(pointCategories.id, id))
      .returning();
    return updated;
  }

  async deletePointCategory(id: string): Promise<void> {
    await db.delete(pointCategories).where(eq(pointCategories.id, id));
  }

  // Point Category Department Settings operations
  async getPointCategoryDepartmentSettings(categoryId: string): Promise<PointCategoryDepartmentSetting[]> {
    return await db.select().from(pointCategoryDepartmentSettings)
      .where(eq(pointCategoryDepartmentSettings.pointCategoryId, categoryId));
  }

  async createPointCategoryDepartmentSetting(setting: InsertPointCategoryDepartmentSetting): Promise<PointCategoryDepartmentSetting> {
    const [created] = await db.insert(pointCategoryDepartmentSettings).values(setting).returning();
    return created;
  }

  async updatePointCategoryDepartmentSetting(id: string, setting: Partial<InsertPointCategoryDepartmentSetting>): Promise<PointCategoryDepartmentSetting | undefined> {
    const [updated] = await db.update(pointCategoryDepartmentSettings)
      .set({ ...setting, updatedAt: new Date() })
      .where(eq(pointCategoryDepartmentSettings.id, id))
      .returning();
    return updated;
  }

  async deletePointCategoryDepartmentSetting(id: string): Promise<void> {
    await db.delete(pointCategoryDepartmentSettings).where(eq(pointCategoryDepartmentSettings.id, id));
  }

  // User Point Ledger operations
  async getUserPointLedger(userId: string): Promise<UserPointLedger[]> {
    return await db.select().from(userPointLedger)
      .where(eq(userPointLedger.userId, userId))
      .orderBy(desc(userPointLedger.createdAt));
  }

  async getPointLedgerByEntity(moduleType: string, entityId: string): Promise<UserPointLedger[]> {
    return await db.select().from(userPointLedger)
      .where(and(
        eq(userPointLedger.moduleType, moduleType),
        eq(userPointLedger.entityId, entityId)
      ))
      .orderBy(desc(userPointLedger.createdAt));
  }

  async createPointLedgerEntry(entry: InsertUserPointLedger): Promise<UserPointLedger> {
    const [created] = await db.insert(userPointLedger).values(entry).returning();
    return created;
  }

  // User Point Balance operations
  async getUserPointBalance(userId: string): Promise<UserPointBalance | undefined> {
    const [balance] = await db.select().from(userPointBalances)
      .where(eq(userPointBalances.userId, userId));
    return balance;
  }

  async getUserPointBalances(): Promise<UserPointBalance[]> {
    return await db.select().from(userPointBalances).orderBy(desc(userPointBalances.totalPoints));
  }

  async updateUserPointBalance(userId: string, points: number, moduleType: string): Promise<UserPointBalance> {
    // First, try to get existing balance
    let balance = await this.getUserPointBalance(userId);
    
    if (!balance) {
      // Initialize balance if not exists
      balance = await this.initializeUserPointBalance(userId);
    }

    // Update the appropriate module points and total
    const updateData: Partial<UserPointBalance> = {
      totalPoints: balance.totalPoints + points,
      updatedAt: new Date(),
    };

    switch (moduleType) {
      case 'lead':
        updateData.leadPoints = balance.leadPoints + points;
        break;
      case 'task':
        updateData.taskPoints = balance.taskPoints + points;
        break;
      case 'ticket':
        updateData.ticketPoints = balance.ticketPoints + points;
        break;
      case 'project':
        updateData.projectPoints = balance.projectPoints + points;
        break;
    }

    const [updated] = await db.update(userPointBalances)
      .set(updateData)
      .where(eq(userPointBalances.userId, userId))
      .returning();
    
    return updated;
  }

  async initializeUserPointBalance(userId: string): Promise<UserPointBalance> {
    const [created] = await db.insert(userPointBalances)
      .values({
        userId,
        totalPoints: 0,
        leadPoints: 0,
        taskPoints: 0,
        ticketPoints: 0,
        projectPoints: 0,
      })
      .returning();
    return created;
  }

  // Assignment Settings operations
  async getAssignmentSettings(): Promise<AssignmentSetting[]> {
    return await db.select().from(assignmentSettings).orderBy(assignmentSettings.module);
  }

  async getAssignmentSetting(module: string): Promise<AssignmentSetting | undefined> {
    const [setting] = await db.select().from(assignmentSettings)
      .where(eq(assignmentSettings.module, module));
    return setting;
  }

  async upsertAssignmentSetting(setting: InsertAssignmentSetting): Promise<AssignmentSetting> {
    const [upserted] = await db.insert(assignmentSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: assignmentSettings.module,
        set: {
          ...setting,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async updateLastAssignedUser(module: string, userId: string): Promise<void> {
    await db.update(assignmentSettings)
      .set({ lastAssignedUserId: userId, updatedAt: new Date() })
      .where(eq(assignmentSettings.module, module));
  }

  async getNextAssignableUser(module: string): Promise<User | undefined> {
    const setting = await this.getAssignmentSetting(module);
    
    // Return undefined if settings don't exist, disabled, or method is manual/none
    if (!setting || 
        !setting.isEnabled || 
        setting.assignmentMethod === 'manual' || 
        setting.assignmentMethod === 'none') {
      return undefined;
    }

    // Get users with assignable roles
    let assignableUsers: User[] = [];
    
    if (setting.assignableRoles && setting.assignableRoles.length > 0) {
      // Get users with matching roles
      const allUsers = await this.getUsers();
      assignableUsers = allUsers.filter(u => 
        u.isActive !== false && 
        setting.assignableRoles!.includes(u.role)
      );
    } else {
      // Fall back to support assignable users for tickets, or all active users
      if (module === 'tickets') {
        assignableUsers = await this.getSupportAssignableUsers();
      } else {
        const allUsers = await this.getUsers();
        assignableUsers = allUsers.filter(u => u.isActive !== false);
      }
    }

    if (assignableUsers.length === 0) {
      return undefined;
    }

    if (setting.assignmentMethod === 'round_robin') {
      // Round-robin: get next user after last assigned
      if (setting.lastAssignedUserId) {
        const lastIndex = assignableUsers.findIndex(u => u.id === setting.lastAssignedUserId);
        const nextIndex = (lastIndex + 1) % assignableUsers.length;
        return assignableUsers[nextIndex];
      }
      return assignableUsers[0];
    }

    return undefined;
  }

  // Development Task operations
  async getDevelopmentTasks(filters?: { 
    status?: string; 
    assignedTo?: string;
    assignedToIds?: string[];
    sourceType?: string;
    sourceId?: string;
    priority?: string;
    isOverdue?: boolean;
    limit?: number;
  }): Promise<(DevelopmentTask & { 
    assignee?: User; 
    assignedByUser?: User;
  })[]> {
    const conditions: any[] = [];
    const maxLimit = filters?.limit || 200; // Default limit for performance
    
    if (filters?.status) {
      conditions.push(eq(developmentTasks.status, filters.status));
    }
    // Support multi-user filtering for department managers
    if (filters?.assignedToIds && filters.assignedToIds.length > 0) {
      conditions.push(inArray(developmentTasks.assignedTo, filters.assignedToIds));
    } else if (filters?.assignedTo) {
      conditions.push(eq(developmentTasks.assignedTo, filters.assignedTo));
    }
    if (filters?.sourceType) {
      conditions.push(eq(developmentTasks.sourceType, filters.sourceType));
    }
    if (filters?.sourceId) {
      conditions.push(eq(developmentTasks.sourceId, filters.sourceId));
    }
    if (filters?.priority) {
      conditions.push(eq(developmentTasks.priority, filters.priority));
    }
    if (filters?.isOverdue !== undefined) {
      conditions.push(eq(developmentTasks.isOverdue, filters.isOverdue));
    }

    const taskList = await db
      .select()
      .from(developmentTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(developmentTasks.createdAt))
      .limit(maxLimit);

    // Enrich with user details and customer name
    const enrichedTasks = await Promise.all(
      taskList.map(async (task) => {
        const [assignee] = task.assignedTo 
          ? await db.select().from(users).where(eq(users.id, task.assignedTo))
          : [undefined];
        
        const [assignedByUser] = task.assignedBy 
          ? await db.select().from(users).where(eq(users.id, task.assignedBy))
          : [undefined];

        // Fetch customer name based on source type
        let customerName: string | null = null;
        try {
          if (task.sourceType === 'support' && task.sourceId) {
            // Get customer from ticket
            const ticketResult = await db.execute(sql`
              SELECT c.name 
              FROM tickets t 
              LEFT JOIN customers c ON t.customer_id = c.id 
              WHERE t.id = ${task.sourceId}
            `);
            customerName = (ticketResult.rows[0] as any)?.name || null;
          } else if (task.sourceType === 'implementation' && task.sourceId) {
            // Get customer from implementation project
            const projectResult = await db.execute(sql`
              SELECT c.name 
              FROM implementation_projects p 
              LEFT JOIN customers c ON p.customer_id = c.id 
              WHERE p.id = ${task.sourceId}
            `);
            customerName = (projectResult.rows[0] as any)?.name || null;
          } else if (task.sourceType === 'task' && task.sourceId) {
            // Get customer from task if it has customerId
            const taskResult = await db.execute(sql`
              SELECT c.name 
              FROM tasks t 
              LEFT JOIN customers c ON t.customer_id = c.id 
              WHERE t.id = ${task.sourceId}
            `);
            customerName = (taskResult.rows[0] as any)?.name || null;
          }
        } catch (e) {
          // If customer lookup fails, continue without it
        }

        return {
          ...task,
          assignee,
          assignedByUser,
          customerName,
        };
      })
    );

    return enrichedTasks;
  }

  async getDevelopmentTask(id: string): Promise<(DevelopmentTask & { 
    assignee?: User; 
    assignedByUser?: User;
  }) | undefined> {
    const [task] = await db.select().from(developmentTasks).where(eq(developmentTasks.id, id));
    if (!task) return undefined;

    const [assignee] = task.assignedTo 
      ? await db.select().from(users).where(eq(users.id, task.assignedTo))
      : [undefined];
    
    const [assignedByUser] = task.assignedBy 
      ? await db.select().from(users).where(eq(users.id, task.assignedBy))
      : [undefined];

    return {
      ...task,
      assignee,
      assignedByUser,
    };
  }

  async createDevelopmentTask(task: InsertDevelopmentTask): Promise<DevelopmentTask> {
    // Generate task number DEV-XXXXXX based on max existing number
    const maxResult = await db
      .select({ maxNum: sql<string>`MAX(CAST(SUBSTRING(task_number FROM 5) AS INTEGER))` })
      .from(developmentTasks);
    const nextNum = (Number(maxResult[0]?.maxNum) || 0) + 1;
    const taskNumber = `DEV-${String(nextNum).padStart(6, '0')}`;
    
    const [newTask] = await db
      .insert(developmentTasks)
      .values({ ...task, taskNumber })
      .returning();
    return newTask;
  }

  async updateDevelopmentTask(id: string, data: Partial<InsertDevelopmentTask & { 
    isOverdue?: boolean; 
    penaltyApplied?: boolean; 
    penaltyPoints?: number; 
    penaltyReason?: string;
  }>): Promise<DevelopmentTask> {
    const [updated] = await db
      .update(developmentTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(developmentTasks.id, id))
      .returning();
    return updated;
  }

  async deleteDevelopmentTask(id: string): Promise<void> {
    await db.delete(developmentTasks).where(eq(developmentTasks.id, id));
  }

  // Development Task Comment operations
  async getDevelopmentTaskComments(developmentTaskId: string): Promise<(DevelopmentTaskComment & { user?: User })[]> {
    const comments = await db
      .select()
      .from(developmentTaskComments)
      .where(eq(developmentTaskComments.developmentTaskId, developmentTaskId))
      .orderBy(desc(developmentTaskComments.createdAt));

    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const [user] = comment.userId 
          ? await db.select().from(users).where(eq(users.id, comment.userId))
          : [undefined];
        return { ...comment, user };
      })
    );

    return enrichedComments;
  }

  async createDevelopmentTaskComment(comment: InsertDevelopmentTaskComment): Promise<DevelopmentTaskComment> {
    const [newComment] = await db
      .insert(developmentTaskComments)
      .values(comment)
      .returning();
    return newComment;
  }

  // Development-Support Message operations (bidirectional communication)
  async getDevelopmentSupportMessagesByTask(developmentTaskId: string): Promise<(DevelopmentSupportMessage & { sender?: User })[]> {
    const messages = await db
      .select()
      .from(developmentSupportMessages)
      .where(eq(developmentSupportMessages.developmentTaskId, developmentTaskId))
      .orderBy(desc(developmentSupportMessages.createdAt));

    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        const [sender] = message.senderId 
          ? await db.select().from(users).where(eq(users.id, message.senderId))
          : [undefined];
        return { ...message, sender };
      })
    );

    return enrichedMessages;
  }

  async getDevelopmentSupportMessagesByTicket(ticketId: string): Promise<(DevelopmentSupportMessage & { sender?: User })[]> {
    const messages = await db
      .select()
      .from(developmentSupportMessages)
      .where(eq(developmentSupportMessages.ticketId, ticketId))
      .orderBy(desc(developmentSupportMessages.createdAt));

    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        const [sender] = message.senderId 
          ? await db.select().from(users).where(eq(users.id, message.senderId))
          : [undefined];
        return { ...message, sender };
      })
    );

    return enrichedMessages;
  }

  async createDevelopmentSupportMessage(message: InsertDevelopmentSupportMessage): Promise<DevelopmentSupportMessage> {
    const [newMessage] = await db
      .insert(developmentSupportMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  // Development Dashboard metrics
  async getDevelopmentDashboardMetrics(assignedTo?: string, assignedToIds?: string[]): Promise<{
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalPenaltyPoints: number;
    // Enhanced categories
    yetToWorkTasks: number;
    onProcessTasks: number;
    waitingTasks: number;
    // Source breakdown
    supportTasks: number;
    implementationTasks: number;
    taskModuleTasks: number;
    manualTasks: number;
  }> {
    const conditions: any[] = [];
    
    // Support multi-user filtering for department managers
    if (assignedToIds && assignedToIds.length > 0) {
      conditions.push(inArray(developmentTasks.assignedTo, assignedToIds));
    } else if (assignedTo) {
      conditions.push(eq(developmentTasks.assignedTo, assignedTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Single SQL aggregate query — avoids loading every row into JS
    const [agg] = await db.select({
      totalTasks:           sql<number>`COUNT(*)`,
      pendingTasks:         sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
      inProgressTasks:      sql<number>`COUNT(*) FILTER (WHERE status = 'in_progress')`,
      completedTasks:       sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
      overdueTasks:         sql<number>`COUNT(*) FILTER (WHERE is_overdue = true)`,
      totalPenaltyPoints:   sql<number>`COALESCE(SUM(penalty_points), 0)`,
      yetToWorkTasks:       sql<number>`COUNT(*) FILTER (WHERE status = 'pending' AND assigned_to IS NULL)`,
      waitingTasks:         sql<number>`COUNT(*) FILTER (WHERE status = 'pending' AND assigned_to IS NOT NULL)`,
      supportTasks:         sql<number>`COUNT(*) FILTER (WHERE source_type = 'support')`,
      implementationTasks:  sql<number>`COUNT(*) FILTER (WHERE source_type = 'implementation')`,
      taskModuleTasks:      sql<number>`COUNT(*) FILTER (WHERE source_type = 'task')`,
      manualTasks:          sql<number>`COUNT(*) FILTER (WHERE source_type = 'manual')`,
    }).from(developmentTasks).where(whereClause);

    const inProgressTasks = Number(agg.inProgressTasks);

    return {
      totalTasks:          Number(agg.totalTasks),
      pendingTasks:        Number(agg.pendingTasks),
      inProgressTasks,
      completedTasks:      Number(agg.completedTasks),
      overdueTasks:        Number(agg.overdueTasks),
      totalPenaltyPoints:  Number(agg.totalPenaltyPoints),
      yetToWorkTasks:      Number(agg.yetToWorkTasks),
      onProcessTasks:      inProgressTasks,
      waitingTasks:        Number(agg.waitingTasks),
      supportTasks:        Number(agg.supportTasks),
      implementationTasks: Number(agg.implementationTasks),
      taskModuleTasks:     Number(agg.taskModuleTasks),
      manualTasks:         Number(agg.manualTasks),
    };
  }

  // Check and apply penalties for overdue tasks
  async checkAndApplyOverduePenalties(): Promise<number> {
    const now = new Date();
    
    // Find tasks that are past deadline and not completed
    const overdueTasks = await db
      .select()
      .from(developmentTasks)
      .where(
        and(
          lte(developmentTasks.deadline, now),
          or(
            eq(developmentTasks.status, 'pending'),
            eq(developmentTasks.status, 'in_progress')
          ),
          eq(developmentTasks.isOverdue, false)
        )
      );

    let penaltyCount = 0;
    for (const task of overdueTasks) {
      // Calculate penalty points (1 point per day overdue, configurable)
      const deadlineDate = new Date(task.deadline);
      const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
      const penaltyPoints = Math.max(1, daysOverdue);

      await this.updateDevelopmentTask(task.id, {
        isOverdue: true,
        status: 'overdue',
        penaltyApplied: true,
        penaltyPoints,
        penaltyReason: `Task overdue by ${daysOverdue} day(s)`,
      });

      // If assigned to someone, deduct from their point balance
      if (task.assignedTo) {
        await this.createPointLedgerEntry({
          userId: task.assignedTo,
          moduleType: 'development',
          entityId: task.id,
          action: 'penalty',
          points: -penaltyPoints,
          reason: `Penalty for overdue development task ${task.taskNumber}`,
        });
        await this.updateUserPointBalance(task.assignedTo, -penaltyPoints, 'development');
      }

      penaltyCount++;
    }

    return penaltyCount;
  }

  // Marketing Daily Report operations
  async getMarketingDailyReports(filters?: { 
    userId?: string; 
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<(MarketingDailyReport & { user?: User })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(marketingDailyReports.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(marketingDailyReports.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(marketingDailyReports.reportDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(marketingDailyReports.reportDate, filters.endDate));
    }
    
    const reports = await db
      .select()
      .from(marketingDailyReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketingDailyReports.reportDate));
    
    // Get user details for each report
    const reportsWithUser = await Promise.all(
      reports.map(async (report) => {
        const user = await this.getUser(report.userId);
        return { ...report, user };
      })
    );
    
    return reportsWithUser;
  }

  async getMarketingDailyReport(id: string): Promise<(MarketingDailyReport & { 
    user?: User; 
    taskEntries?: MarketingTaskEntry[];
  }) | undefined> {
    const [report] = await db
      .select()
      .from(marketingDailyReports)
      .where(eq(marketingDailyReports.id, id));
    
    if (!report) return undefined;
    
    const user = await this.getUser(report.userId);
    const taskEntries = await this.getMarketingTaskEntries(id);
    
    return { ...report, user, taskEntries };
  }

  async getMarketingDailyReportByDate(userId: string, date: Date): Promise<MarketingDailyReport | undefined> {
    // Get reports for the same day (normalize to start and end of day)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [report] = await db
      .select()
      .from(marketingDailyReports)
      .where(and(
        eq(marketingDailyReports.userId, userId),
        gte(marketingDailyReports.reportDate, startOfDay),
        lte(marketingDailyReports.reportDate, endOfDay)
      ));
    
    return report;
  }

  async createMarketingDailyReport(report: InsertMarketingDailyReport): Promise<MarketingDailyReport> {
    const [newReport] = await db
      .insert(marketingDailyReports)
      .values(report)
      .returning();
    return newReport;
  }

  async updateMarketingDailyReport(id: string, data: Partial<InsertMarketingDailyReport>): Promise<MarketingDailyReport> {
    const [updated] = await db
      .update(marketingDailyReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(marketingDailyReports.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingDailyReport(id: string): Promise<void> {
    // Task entries will be deleted automatically due to cascade
    await db.delete(marketingDailyReports).where(eq(marketingDailyReports.id, id));
  }

  // Marketing Task Entry operations
  async getMarketingTaskEntries(reportId: string): Promise<MarketingTaskEntry[]> {
    return await db
      .select()
      .from(marketingTaskEntries)
      .where(eq(marketingTaskEntries.reportId, reportId))
      .orderBy(marketingTaskEntries.sortOrder);
  }

  async createMarketingTaskEntry(entry: InsertMarketingTaskEntry): Promise<MarketingTaskEntry> {
    const [newEntry] = await db
      .insert(marketingTaskEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateMarketingTaskEntry(id: string, data: Partial<InsertMarketingTaskEntry>): Promise<MarketingTaskEntry> {
    const [updated] = await db
      .update(marketingTaskEntries)
      .set(data)
      .where(eq(marketingTaskEntries.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingTaskEntry(id: string): Promise<void> {
    await db.delete(marketingTaskEntries).where(eq(marketingTaskEntries.id, id));
  }

  async deleteMarketingTaskEntriesByReport(reportId: string): Promise<void> {
    await db.delete(marketingTaskEntries).where(eq(marketingTaskEntries.reportId, reportId));
  }

  // =============================================
  // SYSTEM MODULE SYNC OPERATIONS
  // These ensure modules are automatically registered on server startup
  // =============================================

  async syncSystemModulesFromManifest(): Promise<{ created: number; updated: number }> {
    // Import the manifest dynamically to avoid circular dependencies
    const { SYSTEM_MODULES_MANIFEST } = await import("@shared/system-modules-manifest");
    
    let created = 0;
    let updated = 0;
    
    // Step 1: Sync all modules from manifest
    const existingModules = await this.getSystemModules();
    const existingByName = new Map(existingModules.map(m => [m.name, m]));
    
    for (const moduleDef of SYSTEM_MODULES_MANIFEST) {
      const existing = existingByName.get(moduleDef.name);
      
      if (!existing) {
        // Create new module
        await db.insert(systemModules).values({
          name: moduleDef.name,
          displayName: moduleDef.displayName,
          description: moduleDef.description,
          icon: moduleDef.icon,
          sortOrder: moduleDef.sortOrder,
        });
        created++;
      } else {
        // Update existing module if metadata changed
        if (
          existing.displayName !== moduleDef.displayName ||
          existing.description !== moduleDef.description ||
          existing.icon !== moduleDef.icon ||
          existing.sortOrder !== moduleDef.sortOrder
        ) {
          await db.update(systemModules)
            .set({
              displayName: moduleDef.displayName,
              description: moduleDef.description,
              icon: moduleDef.icon,
              sortOrder: moduleDef.sortOrder,
            })
            .where(eq(systemModules.id, existing.id));
          updated++;
        }
      }
    }
    
    // Step 2: After syncing modules, ensure all roles have rights for all modules
    // Use optimized bulk approach to avoid N+1 queries
    await this.ensureAllRolesHaveAllModuleRightsBulk();
    
    return { created, updated };
  }

  async ensureRoleHasAllModuleRights(roleId: string): Promise<number> {
    // Get all system modules
    const allModules = await this.getSystemModules();
    
    // Get existing rights for this role
    const existingRights = await db.select()
      .from(userRoleRights)
      .where(eq(userRoleRights.roleId, roleId));
    
    const existingModuleIds = new Set(existingRights.map(r => r.module));
    
    // Collect modules that need rights entries
    const missingRights: { roleId: string; module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[] = [];
    
    for (const mod of allModules) {
      if (!existingModuleIds.has(mod.id)) {
        missingRights.push({
          roleId,
          module: mod.id,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        });
      }
    }
    
    // Bulk insert missing rights
    if (missingRights.length > 0) {
      await db.insert(userRoleRights).values(missingRights);
    }
    
    return missingRights.length;
  }

  async ensureAllRolesHaveAllModuleRights(): Promise<number> {
    // Get all roles
    const allRoles = await this.getUserRoles();
    
    let totalCreated = 0;
    
    for (const role of allRoles) {
      const created = await this.ensureRoleHasAllModuleRights(role.id);
      totalCreated += created;
    }
    
    return totalCreated;
  }

  // Optimized bulk version that loads modules once and processes all roles
  async ensureAllRolesHaveAllModuleRightsBulk(): Promise<number> {
    // Get all system modules once
    const allModules = await this.getSystemModules();
    if (allModules.length === 0) return 0;
    
    // Get all roles
    const allRoles = await this.getUserRoles();
    if (allRoles.length === 0) return 0;
    
    // Get all existing rights in one query
    const existingRights = await db.select().from(userRoleRights);
    
    // Build a set of existing role+module combinations
    const existingCombos = new Set(
      existingRights.map(r => `${r.roleId}:${r.module}`)
    );
    
    // Collect all missing rights
    const missingRights: { roleId: string; module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[] = [];
    
    for (const role of allRoles) {
      for (const mod of allModules) {
        const combo = `${role.id}:${mod.id}`;
        if (!existingCombos.has(combo)) {
          missingRights.push({
            roleId: role.id,
            module: mod.id,
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          });
        }
      }
    }
    
    // Bulk insert all missing rights at once
    if (missingRights.length > 0) {
      // Insert in batches of 100 to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < missingRights.length; i += batchSize) {
        const batch = missingRights.slice(i, i + batchSize);
        await db.insert(userRoleRights).values(batch);
      }
    }
    
    return missingRights.length;
  }

  // Extracted Places operations (Google Maps data extraction)
  async getExtractedPlaces(filters?: { 
    extractedById?: string;
    isImported?: boolean;
    city?: string;
    area?: string;
    industry?: string;
  }): Promise<ExtractedPlace[]> {
    const conditions = [];
    
    if (filters?.extractedById) {
      conditions.push(eq(extractedPlaces.extractedById, filters.extractedById));
    }
    if (filters?.isImported !== undefined) {
      conditions.push(eq(extractedPlaces.isImported, filters.isImported));
    }
    if (filters?.city) {
      conditions.push(eq(extractedPlaces.city, filters.city));
    }
    if (filters?.area) {
      conditions.push(eq(extractedPlaces.area, filters.area));
    }
    if (filters?.industry) {
      conditions.push(eq(extractedPlaces.industry, filters.industry));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(extractedPlaces)
        .where(and(...conditions))
        .orderBy(desc(extractedPlaces.createdAt));
    }

    return await db
      .select()
      .from(extractedPlaces)
      .orderBy(desc(extractedPlaces.createdAt));
  }

  async getExtractedPlace(id: string): Promise<ExtractedPlace | undefined> {
    const [place] = await db.select().from(extractedPlaces).where(eq(extractedPlaces.id, id));
    return place;
  }

  async getExistingGooglePlaceIds(googlePlaceIds: string[]): Promise<string[]> {
    if (googlePlaceIds.length === 0) return [];
    
    const existingPlaces = await db
      .select({ googlePlaceId: extractedPlaces.googlePlaceId })
      .from(extractedPlaces)
      .where(inArray(extractedPlaces.googlePlaceId, googlePlaceIds));
    
    return existingPlaces
      .map(p => p.googlePlaceId)
      .filter((id): id is string => id !== null);
  }

  async createExtractedPlace(place: InsertExtractedPlace): Promise<ExtractedPlace> {
    const [newPlace] = await db.insert(extractedPlaces).values(place).returning();
    return newPlace;
  }

  async createExtractedPlaces(places: InsertExtractedPlace[]): Promise<ExtractedPlace[]> {
    if (places.length === 0) return [];
    const newPlaces = await db.insert(extractedPlaces).values(places).returning();
    return newPlaces;
  }

  async updateExtractedPlace(id: string, data: Partial<InsertExtractedPlace & { isImported?: boolean; importedLeadId?: string }>): Promise<ExtractedPlace> {
    const [updated] = await db
      .update(extractedPlaces)
      .set(data)
      .where(eq(extractedPlaces.id, id))
      .returning();
    return updated;
  }

  async deleteExtractedPlace(id: string): Promise<void> {
    await db.delete(extractedPlaces).where(eq(extractedPlaces.id, id));
  }

  async getExtractedPlacesByLeadId(leadId: string): Promise<ExtractedPlace[]> {
    return await db
      .select()
      .from(extractedPlaces)
      .where(eq(extractedPlaces.importedLeadId, leadId));
  }

  async resetExtractedPlaceImportByLeadId(leadId: string): Promise<void> {
    await db
      .update(extractedPlaces)
      .set({ isImported: false, importedLeadId: null })
      .where(eq(extractedPlaces.importedLeadId, leadId));
  }

  async checkDuplicateLead(data: { 
    contactPhone?: string; 
    businessName?: string; 
    contactPerson?: string; 
    contactEmail?: string; 
    city?: string; 
    area?: string; 
  }): Promise<Lead | null> {
    const conditions = [];
    
    // Check for exact match on phone number (primary identifier)
    if (data.contactPhone) {
      conditions.push(eq(leads.contactPhone, data.contactPhone));
    }
    
    // Check for exact match on email (primary identifier)
    if (data.contactEmail) {
      conditions.push(eq(leads.contactEmail, data.contactEmail));
    }
    
    // Check for combination of business name + city + area
    if (data.businessName && data.city) {
      const businessNameConditions = [eq(leads.companyName, data.businessName), eq(leads.city, data.city)];
      if (data.area) {
        businessNameConditions.push(eq(leads.area, data.area));
      }
      conditions.push(and(...businessNameConditions));
    }
    
    if (conditions.length === 0) return null;
    
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(or(...conditions))
      .limit(1);
    
    return existingLead || null;
  }

  // Batch check for duplicate leads by phone numbers
  async checkDuplicateLeadsByPhone(phoneNumbers: string[]): Promise<string[]> {
    if (phoneNumbers.length === 0) return [];
    
    // Filter out null/empty phone numbers
    const validPhones = phoneNumbers.filter(p => p && p.trim());
    if (validPhones.length === 0) return [];
    
    const existingLeads = await db
      .select({ contactPhone: leads.contactPhone })
      .from(leads)
      .where(inArray(leads.contactPhone, validPhones));
    
    return existingLeads
      .map(l => l.contactPhone)
      .filter((phone): phone is string => phone !== null);
  }

  // Batch check for duplicate leads by company name (+ optional city)
  // Returns composite keys in format "name::city" for matched entries
  async checkDuplicateLeadsByCompanyName(companyNames: { name: string; city?: string }[]): Promise<string[]> {
    if (companyNames.length === 0) return [];
    
    // Get all existing leads with matching company names
    const names = companyNames.map(c => c.name).filter(n => n && n.trim());
    if (names.length === 0) return [];
    
    const existingLeads = await db
      .select({ companyName: leads.companyName, city: leads.city })
      .from(leads)
      .where(inArray(leads.companyName, names));
    
    // Return composite keys (name::city) that have matches
    const matchedKeys: string[] = [];
    for (const input of companyNames) {
      const match = existingLeads.find(l => {
        if (l.companyName !== input.name) return false;
        // If input has city, check city match; if no city provided, match any
        if (input.city && l.city && l.city.toLowerCase() !== input.city.toLowerCase()) return false;
        return true;
      });
      if (match) {
        // Return composite key for exact matching
        matchedKeys.push(`${input.name}::${input.city || ""}`);
      }
    }
    
    return matchedKeys;
  }

  // Extractor Options operations
  async getExtractorOptions(type?: 'industry' | 'segment'): Promise<ExtractorOption[]> {
    if (type) {
      return await db.select().from(extractorOptions).where(eq(extractorOptions.type, type)).orderBy(extractorOptions.label);
    }
    return await db.select().from(extractorOptions).orderBy(extractorOptions.type, extractorOptions.label);
  }

  async getExtractorOption(id: string): Promise<ExtractorOption | undefined> {
    const [option] = await db.select().from(extractorOptions).where(eq(extractorOptions.id, id));
    return option;
  }

  async createExtractorOption(option: InsertExtractorOption): Promise<ExtractorOption> {
    const [newOption] = await db.insert(extractorOptions).values(option).returning();
    return newOption;
  }

  async deleteExtractorOption(id: string): Promise<void> {
    await db.delete(extractorOptions).where(eq(extractorOptions.id, id));
  }

  // Sales Planning operations
  async getSalesPlans(filters: { userId?: string; month?: string; userIds?: string[] }): Promise<SalesPlan[]> {
    const conditions: any[] = [];
    
    if (filters.userId) {
      conditions.push(eq(salesPlans.userId, filters.userId));
    }
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salesPlans.userId, filters.userIds));
    }
    if (filters.month) {
      conditions.push(eq(salesPlans.month, filters.month));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(salesPlans).where(and(...conditions)).orderBy(salesPlans.weekNumber, salesPlans.stage);
    }
    return await db.select().from(salesPlans).orderBy(salesPlans.month, salesPlans.weekNumber, salesPlans.stage);
  }

  async getSalesPlan(id: string): Promise<SalesPlan | undefined> {
    const [plan] = await db.select().from(salesPlans).where(eq(salesPlans.id, id));
    return plan;
  }

  async upsertSalesPlan(plan: InsertSalesPlan): Promise<SalesPlan> {
    // Check if plan exists for this user/month/week/stage combination
    const [existing] = await db.select().from(salesPlans).where(
      and(
        eq(salesPlans.userId, plan.userId),
        eq(salesPlans.month, plan.month),
        eq(salesPlans.weekNumber, plan.weekNumber),
        eq(salesPlans.stage, plan.stage)
      )
    );

    if (existing) {
      const [updated] = await db.update(salesPlans)
        .set({
          targetQty: plan.targetQty,
          targetValue: plan.targetValue,
          updatedAt: new Date(),
        })
        .where(eq(salesPlans.id, existing.id))
        .returning();
      return updated;
    }

    const [newPlan] = await db.insert(salesPlans).values(plan).returning();
    return newPlan;
  }

  async deleteSalesPlan(id: string): Promise<void> {
    await db.delete(salesPlans).where(eq(salesPlans.id, id));
  }

  // Sales Monthly Target operations
  async getSalesMonthlyTargets(filters: { userId?: string; month?: string; userIds?: string[] }): Promise<SalesMonthlyTarget[]> {
    const conditions: any[] = [];
    
    if (filters.userId) {
      conditions.push(eq(salesMonthlyTargets.userId, filters.userId));
    }
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salesMonthlyTargets.userId, filters.userIds));
    }
    if (filters.month) {
      conditions.push(eq(salesMonthlyTargets.month, filters.month));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(salesMonthlyTargets).where(and(...conditions));
    }
    return await db.select().from(salesMonthlyTargets);
  }

  async getSalesMonthlyTarget(id: string): Promise<SalesMonthlyTarget | undefined> {
    const [target] = await db.select().from(salesMonthlyTargets).where(eq(salesMonthlyTargets.id, id));
    return target;
  }

  async upsertSalesMonthlyTarget(target: InsertSalesMonthlyTarget): Promise<SalesMonthlyTarget> {
    // Check if target exists for this user/month combination
    const [existing] = await db.select().from(salesMonthlyTargets).where(
      and(
        eq(salesMonthlyTargets.userId, target.userId),
        eq(salesMonthlyTargets.month, target.month)
      )
    );

    if (existing) {
      const [updated] = await db.update(salesMonthlyTargets)
        .set({
          targetQtyTotal: target.targetQtyTotal,
          targetValueTotal: target.targetValueTotal,
          closedWonQtyTarget: target.closedWonQtyTarget,
          closedWonValueTarget: target.closedWonValueTarget,
          notes: target.notes,
          updatedAt: new Date(),
        })
        .where(eq(salesMonthlyTargets.id, existing.id))
        .returning();
      return updated;
    }

    const [newTarget] = await db.insert(salesMonthlyTargets).values(target).returning();
    return newTarget;
  }

  async deleteSalesMonthlyTarget(id: string): Promise<void> {
    await db.delete(salesMonthlyTargets).where(eq(salesMonthlyTargets.id, id));
  }

  // Sales Performance analytics
  async getSalesPerformance(filters: { 
    userId?: string; 
    userIds?: string[];
    month?: string; 
  }): Promise<{
    plans: SalesPlan[];
    monthlyTarget: SalesMonthlyTarget | null;
    achievements: {
      stage: string;
      qty: number;
      value: number;
      weekNumber: number;
    }[];
    dailyAchievements: {
      date: string;
      stage: string;
      qty: number;
      value: number;
    }[];
    prediction: {
      predictedQty: number;
      predictedValue: number;
      daysElapsed: number;
      totalDays: number;
    };
  }> {
    const month = filters.month || new Date().toISOString().substring(0, 7);
    const userFilter = filters.userId ? [filters.userId] : filters.userIds || [];
    
    // Get plans for the month
    const plans = await this.getSalesPlans({ 
      userId: filters.userId, 
      userIds: filters.userIds, 
      month 
    });
    
    // Get monthly target
    const monthlyTargets = await this.getSalesMonthlyTargets({ 
      userId: filters.userId, 
      month 
    });
    const monthlyTarget = monthlyTargets.length > 0 ? monthlyTargets[0] : null;
    
    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month
    const today = new Date();
    
    // Get lead stage history for the month to calculate achievements
    const stageHistory = await this.getLeadStageHistoryByDateRange(startDate, endDate);
    
    // Filter by user if specified
    const filteredHistory = userFilter.length > 0 
      ? stageHistory.filter(h => userFilter.includes(h.changedById || ''))
      : stageHistory;
    
    // Calculate achievements by stage and week
    const achievementsByWeekStage: Record<string, { stage: string; qty: number; value: number; weekNumber: number }> = {};
    const dailyAchievementsMap: Record<string, { date: string; stage: string; qty: number; value: number }> = {};
    
    for (const history of filteredHistory) {
      const changeDate = new Date(history.createdAt || new Date());
      const dayOfMonth = changeDate.getDate();
      const weekNumber = Math.ceil(dayOfMonth / 7);
      const dateStr = changeDate.toISOString().split('T')[0];
      
      // Get lead value (use estimatedValue as fallback)
      const lead = await this.getLead(history.leadId);
      const leadValue = lead?.confirmedOrderValue || lead?.quoteValue || lead?.estimatedValue || 0;
      
      // Weekly aggregation
      const weekStageKey = `${weekNumber}-${history.toStage}`;
      if (!achievementsByWeekStage[weekStageKey]) {
        achievementsByWeekStage[weekStageKey] = { 
          stage: history.toStage, 
          qty: 0, 
          value: 0, 
          weekNumber: Math.min(weekNumber, 4) 
        };
      }
      achievementsByWeekStage[weekStageKey].qty += 1;
      achievementsByWeekStage[weekStageKey].value += leadValue;
      
      // Daily aggregation
      const dailyKey = `${dateStr}-${history.toStage}`;
      if (!dailyAchievementsMap[dailyKey]) {
        dailyAchievementsMap[dailyKey] = { date: dateStr, stage: history.toStage, qty: 0, value: 0 };
      }
      dailyAchievementsMap[dailyKey].qty += 1;
      dailyAchievementsMap[dailyKey].value += leadValue;
    }
    
    const achievements = Object.values(achievementsByWeekStage);
    const dailyAchievements = Object.values(dailyAchievementsMap).sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate prediction based on run rate
    const totalDays = endDate.getDate();
    const daysElapsed = today <= endDate && today >= startDate 
      ? today.getDate() 
      : (today > endDate ? totalDays : 0);
    
    const totalAchievedQty = achievements.reduce((sum, a) => sum + a.qty, 0);
    const totalAchievedValue = achievements.reduce((sum, a) => sum + a.value, 0);
    
    const runRateQty = daysElapsed > 0 ? totalAchievedQty / daysElapsed : 0;
    const runRateValue = daysElapsed > 0 ? totalAchievedValue / daysElapsed : 0;
    
    const prediction = {
      predictedQty: Math.round(runRateQty * totalDays),
      predictedValue: Math.round(runRateValue * totalDays),
      daysElapsed,
      totalDays,
    };
    
    return {
      plans,
      monthlyTarget,
      achievements,
      dailyAchievements,
      prediction,
    };
  }

  // Check if user has completed planning for the current month (mandatory planning check)
  async hasCompletedMonthlyPlanning(userId: string, month?: string): Promise<{
    hasPlanned: boolean;
    planCount: number;
    hasMonthlyTarget: boolean;
    message: string;
  }> {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    
    // Get plans for the month
    const userPlans = await this.getSalesPlans({ userId, month: targetMonth });
    
    // Get monthly target
    const monthlyTargets = await this.getSalesMonthlyTargets({ userId, month: targetMonth });
    
    const planCount = userPlans.length;
    const hasMonthlyTarget = monthlyTargets.length > 0;
    
    // Consider planning complete if user has at least 1 plan entry OR a monthly target set
    const hasPlanned = planCount > 0 || hasMonthlyTarget;
    
    let message = "";
    if (!hasPlanned) {
      const [year, monthNum] = targetMonth.split('-').map(Number);
      const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
      message = `You must complete your sales planning for ${monthName} before performing any sales activities. Please set your weekly targets in the Sales Planning section.`;
    }
    
    return {
      hasPlanned,
      planCount,
      hasMonthlyTarget,
      message,
    };
  }

  // Get monthly comparison data for individual or team
  async getMonthlyComparison(filters: {
    userId?: string;
    userIds?: string[];
    months: string[]; // Array of months to compare (e.g., ["2026-01", "2025-12", "2025-11"])
  }): Promise<Array<{
    month: string;
    userId: string;
    targetQty: number;
    targetValue: number;
    achievedQty: number;
    achievedValue: number;
    achievementPercentQty: number;
    achievementPercentValue: number;
  }>> {
    const results: Array<{
      month: string;
      userId: string;
      targetQty: number;
      targetValue: number;
      achievedQty: number;
      achievedValue: number;
      achievementPercentQty: number;
      achievementPercentValue: number;
    }> = [];

    for (const month of filters.months) {
      // Get performance for this month
      const performance = await this.getSalesPerformance({
        userId: filters.userId,
        userIds: filters.userIds,
        month,
      });
      
      const targetQty = performance.monthlyTarget?.targetQtyTotal || 
        performance.plans.reduce((sum, p) => sum + (p.targetQty || 0), 0);
      const targetValue = performance.monthlyTarget?.targetValueTotal || 
        performance.plans.reduce((sum, p) => sum + (p.targetValue || 0), 0);
      const achievedQty = performance.achievements.reduce((sum, a) => sum + a.qty, 0);
      const achievedValue = performance.achievements.reduce((sum, a) => sum + a.value, 0);
      
      results.push({
        month,
        userId: filters.userId || 'all',
        targetQty,
        targetValue,
        achievedQty,
        achievedValue,
        achievementPercentQty: targetQty > 0 ? Math.round((achievedQty / targetQty) * 100) : 0,
        achievementPercentValue: targetValue > 0 ? Math.round((achievedValue / targetValue) * 100) : 0,
      });
    }
    
    return results;
  }
}

export const storage = new DatabaseStorage();
