import { storage } from "./storage";
import { getCached, setCached, invalidateCache } from "./cache";

export const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export interface AccessControlResult {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  hasFullAccess: boolean;
  allowedUserIds: string[] | undefined;
}

export async function getAllowedUserIdsForUser(userId: string): Promise<AccessControlResult> {
  const cacheKey = `acl:${userId}`;
  const cached = getCached<AccessControlResult>(cacheKey);
  if (cached) return cached;

  const user = await storage.getUser(userId);
  
  if (!user) {
    const result: AccessControlResult = {
      isSuperAdmin: false,
      isAdmin: false,
      hasFullAccess: false,
      allowedUserIds: [],
    };
    setCached(cacheKey, result, 30);
    return result;
  }
  
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const isAdmin = user.role === "admin";
  
  // Check if user is a department head using junction table
  const managedDepartments = await storage.getDepartmentsByHead(userId);
  const isDepartmentHead = managedDepartments.length > 0;
  
  // Department heads, admins, and super admins get full access to all leads
  const hasFullAccess = isSuperAdmin || isAdmin || isDepartmentHead;
  
  const result: AccessControlResult = hasFullAccess
    ? { isSuperAdmin, isAdmin, hasFullAccess: true, allowedUserIds: undefined }
    : { isSuperAdmin, isAdmin, hasFullAccess: false, allowedUserIds: [userId] };

  setCached(cacheKey, result, 60);
  return result;
}

export function invalidateAccessControlCache(userId: string): void {
  invalidateCache(`acl:${userId}`);
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
