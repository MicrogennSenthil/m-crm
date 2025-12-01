import { storage } from "./storage";
import type { PointCategory, PointCategoryDepartmentSetting } from "@shared/schema";

export type ModuleType = "leads" | "tasks" | "tickets" | "projects";

const normalizeModuleType = (module: ModuleType): string => {
  const mapping: Record<ModuleType, string> = {
    leads: "lead",
    tasks: "task",
    tickets: "ticket",
    projects: "project",
  };
  return mapping[module];
};

export async function handleAssignment(params: {
  module: ModuleType;
  entityId: string;
  newAssigneeId: string;
  previousAssigneeId?: string | null;
  assignedById: string;
  department?: string | null;
}): Promise<void> {
  const { module, entityId, newAssigneeId, previousAssigneeId, assignedById, department } = params;
  const normalizedModule = normalizeModuleType(module);
  
  try {
    const categories = await storage.getPointCategoriesByModule(normalizedModule);
    const category = categories.find(c => c.isActive);
    
    if (!category) {
      return;
    }

    if (!previousAssigneeId) {
      await handleNewAssignment(category, normalizedModule, entityId, newAssigneeId, assignedById, department);
    } else if (previousAssigneeId !== newAssigneeId) {
      await handleReassignment(category, normalizedModule, entityId, newAssigneeId, previousAssigneeId, assignedById, department);
    }
  } catch (error) {
    console.error("Points service error:", error);
  }
}

async function handleNewAssignment(
  category: PointCategory,
  moduleType: string,
  entityId: string,
  assigneeId: string,
  assignedById: string,
  department: string | null | undefined
): Promise<void> {
  const points = await getEffectivePoints(category, department);
  
  await storage.createPointLedgerEntry({
    userId: assigneeId,
    moduleType,
    entityId,
    categoryId: category.id,
    action: "assign",
    points,
    reason: `Points awarded for ${moduleType} assignment`,
    createdBy: assignedById,
  });

  await storage.updateUserPointBalance(assigneeId, points, moduleType);
}

async function handleReassignment(
  category: PointCategory,
  moduleType: string,
  entityId: string,
  newAssigneeId: string,
  previousAssigneeId: string,
  assignedById: string,
  department: string | null | undefined
): Promise<void> {
  const points = await getEffectivePoints(category, department);
  const penalty = await getEffectivePenalty(category, department);
  
  if (penalty > 0) {
    await storage.createPointLedgerEntry({
      userId: previousAssigneeId,
      moduleType,
      entityId,
      categoryId: category.id,
      action: "reassign_from",
      points: -penalty,
      reason: `Reassignment penalty for ${moduleType}`,
      createdBy: assignedById,
    });
    
    await storage.updateUserPointBalance(previousAssigneeId, -penalty, moduleType);
  }

  await storage.createPointLedgerEntry({
    userId: newAssigneeId,
    moduleType,
    entityId,
    categoryId: category.id,
    action: "reassign_to",
    points,
    reason: `Points awarded for ${moduleType} reassignment`,
    createdBy: assignedById,
  });

  await storage.updateUserPointBalance(newAssigneeId, points, moduleType);
}

export async function handleCompletion(params: {
  module: ModuleType;
  entityId: string;
  completedById: string;
  department?: string | null;
}): Promise<void> {
  const { module, entityId, completedById, department } = params;
  const normalizedModule = normalizeModuleType(module);
  
  try {
    const categories = await storage.getPointCategoriesByModule(normalizedModule);
    const category = categories.find(c => c.isActive);
    
    if (!category || category.completionBonus <= 0) {
      return;
    }

    const deptSettings = await getDepartmentSettings(category.id, department);
    const bonus = deptSettings?.completionBonus ?? category.completionBonus;

    if (bonus > 0) {
      await storage.createPointLedgerEntry({
        userId: completedById,
        moduleType: normalizedModule,
        entityId,
        categoryId: category.id,
        action: "complete",
        points: bonus,
        reason: `Completion bonus for ${normalizedModule}`,
        createdBy: completedById,
      });

      await storage.updateUserPointBalance(completedById, bonus, normalizedModule);
    }
  } catch (error) {
    console.error("Points service error:", error);
  }
}

async function getEffectivePoints(category: PointCategory, department: string | null | undefined): Promise<number> {
  const deptSettings = await getDepartmentSettings(category.id, department);
  return deptSettings?.basePoints ?? category.basePoints;
}

async function getEffectivePenalty(category: PointCategory, department: string | null | undefined): Promise<number> {
  const deptSettings = await getDepartmentSettings(category.id, department);
  return deptSettings?.reassignPenalty ?? category.reassignPenalty;
}

async function getDepartmentSettings(
  categoryId: string, 
  department: string | null | undefined
): Promise<PointCategoryDepartmentSetting | undefined> {
  if (!department) return undefined;
  
  const settings = await storage.getPointCategoryDepartmentSettings(categoryId);
  return settings.find(s => s.department === department && s.isActive);
}
