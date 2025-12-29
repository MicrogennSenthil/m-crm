import { storage } from "./storage";

export const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export interface AccessControlResult {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  hasFullAccess: boolean;
  allowedUserIds: string[] | undefined;
}

export async function getAllowedUserIdsForUser(userId: string): Promise<AccessControlResult> {
  const user = await storage.getUser(userId);
  
  if (!user) {
    return {
      isSuperAdmin: false,
      isAdmin: false,
      hasFullAccess: false,
      allowedUserIds: [],
    };
  }
  
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const isAdmin = user.role === "admin";
  
  // Check if user is a department head using junction table
  const managedDepartments = await storage.getDepartmentsByHead(userId);
  const isDepartmentHead = managedDepartments.length > 0;
  
  // Department heads, admins, and super admins get full access to all leads
  const hasFullAccess = isSuperAdmin || isAdmin || isDepartmentHead;
  
  if (hasFullAccess) {
    return {
      isSuperAdmin,
      isAdmin,
      hasFullAccess: true,
      allowedUserIds: undefined,
    };
  }
  
  return {
    isSuperAdmin,
    isAdmin,
    hasFullAccess: false,
    allowedUserIds: [userId],
  };
}

export function isUserIdAllowed(accessControl: AccessControlResult, targetUserId: string | null | undefined): boolean {
  if (accessControl.hasFullAccess) {
    return true;
  }
  if (!targetUserId) {
    return false;
  }
  return accessControl.allowedUserIds?.includes(targetUserId) ?? false;
}

export function filterAllowedUserId(
  accessControl: AccessControlResult,
  requestedUserId: string | undefined
): { userId?: string; userIds?: string[] } {
  if (accessControl.hasFullAccess) {
    return requestedUserId ? { userId: requestedUserId } : {};
  }
  
  if (!accessControl.allowedUserIds || accessControl.allowedUserIds.length === 0) {
    return { userIds: [] };
  }
  
  if (requestedUserId) {
    if (accessControl.allowedUserIds.includes(requestedUserId)) {
      return { userId: requestedUserId };
    } else {
      return { userIds: accessControl.allowedUserIds };
    }
  }
  
  return { userIds: accessControl.allowedUserIds };
}
