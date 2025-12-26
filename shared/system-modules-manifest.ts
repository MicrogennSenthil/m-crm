// System Modules Manifest - Single source of truth for all system modules
// Adding a module here will automatically register it on server startup

export interface SystemModuleDefinition {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  sortOrder: number;
  parentModule?: string; // For grouping submenus under parent modules
}

export const SYSTEM_MODULES_MANIFEST: SystemModuleDefinition[] = [
  // Main Dashboard
  { name: "dashboard", displayName: "Dashboard", description: "Main dashboard and analytics", icon: "LayoutDashboard", sortOrder: 1 },
  
  // Sales Module
  { name: "leads", displayName: "Sales / Leads", description: "Lead management and sales pipeline", icon: "Target", sortOrder: 2 },
  { name: "sales_dashboard", displayName: "Sales Dashboard", description: "Sales analytics and performance dashboard", icon: "TrendingUp", sortOrder: 3, parentModule: "leads" },
  { name: "quotes", displayName: "Quotes", description: "Quote generation and management", icon: "FileText", sortOrder: 4, parentModule: "leads" },
  
  // Implementation Module
  { name: "projects", displayName: "Implementation", description: "Project implementation tracking", icon: "FolderKanban", sortOrder: 5 },
  { name: "work_tracking", displayName: "Work Tracking", description: "Daily work log and tracking", icon: "Clock", sortOrder: 6, parentModule: "projects" },
  
  // Support Module
  { name: "tickets", displayName: "Support Tickets", description: "Customer support ticket management", icon: "Ticket", sortOrder: 7 },
  { name: "support_dashboard", displayName: "Support Dashboard", description: "Support analytics and metrics", icon: "Headphones", sortOrder: 8, parentModule: "tickets" },
  
  // Development Module
  { name: "development_dashboard", displayName: "Development Dashboard", description: "Development team analytics", icon: "Code2", sortOrder: 9 },
  { name: "development_tasks", displayName: "Development Tasks", description: "Developer work assignments", icon: "GitBranch", sortOrder: 10, parentModule: "development_dashboard" },
  
  // Accounts Module
  { name: "contracts", displayName: "Contracts", description: "Customer contract management", icon: "FileText", sortOrder: 11 },
  
  // HR Module
  { name: "hr_feedback", displayName: "HR Feedback", description: "Customer feedback and satisfaction", icon: "MessageSquareHeart", sortOrder: 12 },
  
  // Digital Marketing Module
  { name: "digital_marketing", displayName: "Digital Marketing", description: "Digital marketing management", icon: "Megaphone", sortOrder: 13 },
  { name: "marketing_dashboard", displayName: "Marketing Dashboard", description: "Marketing analytics and metrics", icon: "BarChart3", sortOrder: 14, parentModule: "digital_marketing" },
  { name: "marketing_daily_report", displayName: "Daily Activity Report (DAR)", description: "Daily marketing activity tracking", icon: "ClipboardList", sortOrder: 15, parentModule: "digital_marketing" },
  { name: "marketing_planning", displayName: "Marketing Planning", description: "Campaign and content planning", icon: "CalendarDays", sortOrder: 16, parentModule: "digital_marketing" },
  { name: "marketing_reports", displayName: "Marketing Reports", description: "Marketing performance reports", icon: "FileBarChart", sortOrder: 17, parentModule: "digital_marketing" },
  
  // Knowledge Base
  { name: "knowledge_base", displayName: "Knowledge Base", description: "Documentation and knowledge articles", icon: "BookOpen", sortOrder: 18 },
  { name: "knowledge_base_admin", displayName: "Knowledge Base Admin", description: "Manage knowledge base documents", icon: "FileEdit", sortOrder: 19, parentModule: "knowledge_base" },
  
  // Tasks Module
  { name: "tasks", displayName: "All Tasks", description: "Task and follow-up management", icon: "CheckSquare", sortOrder: 20 },
  { name: "today_tasks", displayName: "Today's Tasks", description: "Daily task list and reminders", icon: "CalendarCheck", sortOrder: 21, parentModule: "tasks" },
  
  // Customers
  { name: "customers", displayName: "Customers", description: "Customer master data", icon: "Users", sortOrder: 22 },
  
  // Reports
  { name: "reports", displayName: "Reports", description: "Reports and analytics overview", icon: "BarChart3", sortOrder: 23 },
  { name: "sales_reports", displayName: "Sales Reports", description: "Sales performance reports", icon: "PieChart", sortOrder: 24, parentModule: "reports" },
  { name: "implementation_reports", displayName: "Implementation Reports", description: "Project implementation reports", icon: "ClipboardList", sortOrder: 25, parentModule: "reports" },
  { name: "support_reports", displayName: "Support Reports", description: "Support ticket reports", icon: "FileBarChart", sortOrder: 26, parentModule: "reports" },
  { name: "development_reports", displayName: "Development Reports", description: "Development team performance reports", icon: "FileCode", sortOrder: 27, parentModule: "reports" },
  
  // User Management
  { name: "user_management", displayName: "User Management", description: "User, role, and permission management", icon: "ShieldCheck", sortOrder: 28 },
  { name: "user_master", displayName: "User Master", description: "Create and manage users", icon: "UserPlus", sortOrder: 29, parentModule: "user_management" },
  { name: "user_roles", displayName: "User Roles", description: "Define and manage user roles", icon: "Shield", sortOrder: 30, parentModule: "user_management" },
  { name: "user_rights", displayName: "User Rights Allocation", description: "Configure module permissions per role", icon: "Key", sortOrder: 31, parentModule: "user_management" },
  { name: "user_approval", displayName: "User Approval", description: "Approve or reject new user registrations", icon: "UserCheck", sortOrder: 32, parentModule: "user_management" },
  
  // System Settings
  { name: "settings", displayName: "Settings", description: "System settings and configuration", icon: "Settings", sortOrder: 33 },
  { name: "smtp_config", displayName: "SMTP Configuration", description: "Email server settings", icon: "Mail", sortOrder: 34, parentModule: "settings" },
  { name: "point_categories", displayName: "Point Categories", description: "Configure gamification points", icon: "Award", sortOrder: 35, parentModule: "settings" },
  { name: "assignment_settings", displayName: "Assignment Settings", description: "Configure assignment methods", icon: "GitBranch", sortOrder: 36, parentModule: "settings" },
  { name: "database_control", displayName: "Database Control", description: "Database management tools", icon: "Database", sortOrder: 37, parentModule: "settings" },
  
  // Admin Dashboard
  { name: "admin_dashboard", displayName: "Admin Dashboard", description: "Administration overview", icon: "Gauge", sortOrder: 38 },
  
  // Masters
  { name: "masters", displayName: "Masters", description: "Master data management", icon: "Table", sortOrder: 39 },
  { name: "customer_master", displayName: "Customer Master", description: "Customer data management", icon: "Building2", sortOrder: 40, parentModule: "masters" },
  { name: "departments", displayName: "Departments", description: "Department management", icon: "Layers", sortOrder: 41, parentModule: "masters" },
];

// Helper to get module names
export function getModuleNames(): string[] {
  return SYSTEM_MODULES_MANIFEST.map(m => m.name);
}

// Helper to get parent modules only
export function getParentModules(): SystemModuleDefinition[] {
  return SYSTEM_MODULES_MANIFEST.filter(m => !m.parentModule);
}

// Helper to get child modules for a parent
export function getChildModules(parentName: string): SystemModuleDefinition[] {
  return SYSTEM_MODULES_MANIFEST.filter(m => m.parentModule === parentName);
}
