import { useQuery } from "@tanstack/react-query";

interface Permission {
  moduleId: string;
  moduleName: string;
  moduleDisplayName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UserPermissions {
  role: string;
  roleId: string | null;
  roleName?: string;
  permissions: Permission[];
  isSuperAdmin: boolean;
}

export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ["/api/auth/my-permissions"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasModuleAccess = (moduleName: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    if (!data) return false;
    if (data.isSuperAdmin) return true;
    
    const permission = data.permissions.find(p => p.moduleName === moduleName);
    if (!permission) return false;
    
    switch (action) {
      case 'view': return permission.canView;
      case 'create': return permission.canCreate;
      case 'edit': return permission.canEdit;
      case 'delete': return permission.canDelete;
      default: return false;
    }
  };

  const canView = (moduleName: string): boolean => hasModuleAccess(moduleName, 'view');
  const canCreate = (moduleName: string): boolean => hasModuleAccess(moduleName, 'create');
  const canEdit = (moduleName: string): boolean => hasModuleAccess(moduleName, 'edit');
  const canDelete = (moduleName: string): boolean => hasModuleAccess(moduleName, 'delete');

  return {
    permissions: data?.permissions || [],
    role: data?.role || '',
    roleName: data?.roleName || '',
    isSuperAdmin: data?.isSuperAdmin || false,
    isLoading,
    error,
    hasModuleAccess,
    canView,
    canCreate,
    canEdit,
    canDelete,
  };
}
