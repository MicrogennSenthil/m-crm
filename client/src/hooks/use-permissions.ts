import { useQuery } from "@tanstack/react-query";

interface Permission {
  moduleId: string;
  moduleName: string;
  moduleDisplayName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  source: 'role' | 'user';
}

interface AssignedRole {
  id: string;
  name: string;
  displayName: string;
}

interface UserPermissions {
  userId: string;
  email: string;
  legacyRole: string;
  assignedRoles: AssignedRole[];
  permissions: Permission[];
  isSuperAdmin: boolean;
  hasAdminRole: boolean;
}

export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ["/api/auth/my-permissions"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Helper to check if user can perform an action on a module
  const can = (module: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    // Super admin can do anything
    if (data?.isSuperAdmin) return true;
    
    // Admin role can do anything
    if (data?.hasAdminRole) return true;
    
    // Find the specific module permission
    const perm = data?.permissions.find(p => p.moduleName === module);
    if (!perm) return false;
    
    switch (action) {
      case 'view': return perm.canView;
      case 'create': return perm.canCreate;
      case 'edit': return perm.canEdit;
      case 'delete': return perm.canDelete;
      default: return false;
    }
  };

  // Helper to check if user can view a module
  const canView = (module: string): boolean => can(module, 'view');
  
  // Helper to check if user can create in a module
  const canCreate = (module: string): boolean => can(module, 'create');
  
  // Helper to check if user can edit in a module
  const canEdit = (module: string): boolean => can(module, 'edit');
  
  // Helper to check if user can delete in a module
  const canDelete = (module: string): boolean => can(module, 'delete');

  // Helper to check if user has any of the specified permissions
  const hasAnyPermission = (permissions: Array<{ module: string; action: 'view' | 'create' | 'edit' | 'delete' }>): boolean => {
    return permissions.some(({ module, action }) => can(module, action));
  };

  // Helper to check if user has all of the specified permissions
  const hasAllPermissions = (permissions: Array<{ module: string; action: 'view' | 'create' | 'edit' | 'delete' }>): boolean => {
    return permissions.every(({ module, action }) => can(module, action));
  };

  // Check if user has a specific role assigned
  const hasRole = (roleName: string): boolean => {
    if (data?.isSuperAdmin) return true;
    return data?.assignedRoles.some(r => r.name === roleName) || data?.legacyRole === roleName || false;
  };

  return {
    permissions: data?.permissions || [],
    assignedRoles: data?.assignedRoles || [],
    isSuperAdmin: data?.isSuperAdmin || false,
    hasAdminRole: data?.hasAdminRole || false,
    isLoading,
    error,
    // Permission check helpers
    can,
    canView,
    canCreate,
    canEdit,
    canDelete,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
}

// Module name constants for type safety
export const MODULES = {
  DASHBOARD: 'dashboard',
  LEADS: 'leads',
  PROJECTS: 'projects',
  TICKETS: 'tickets',
  TASKS: 'tasks',
  REPORTS: 'reports',
  CUSTOMERS: 'customers',
  KNOWLEDGE_BASE: 'knowledge_base',
  DEVELOPMENT: 'development',
  DEVELOPMENT_TASKS: 'development_tasks',
  ADMIN_DASHBOARD: 'admin_dashboard',
  USER_MANAGEMENT: 'user_management',
  SALES_DASHBOARD: 'sales_dashboard',
  SUPPORT_DASHBOARD: 'support_dashboard',
} as const;
