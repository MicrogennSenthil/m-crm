import { db } from "./db";
import { tickets, users, departments, activityLog } from "@shared/schema";
import { eq, and, isNull, lte, sql } from "drizzle-orm";
import { log } from "./app";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const AUTO_ASSIGN_THRESHOLD_MINUTES = 30;
const CHECK_INTERVAL_MINUTES = 5;

async function getSupportAssignableUsers() {
  const supportDept = await db
    .select()
    .from(departments)
    .where(eq(departments.name, "Support"))
    .limit(1);

  if (!supportDept.length) {
    log("[AutoAssign] Support department not found", "scheduler");
    return [];
  }

  const supportUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.departmentId, supportDept[0].id),
        eq(users.isActive, true),
        eq(users.isApproved, true)
      )
    );

  return supportUsers;
}

async function getUnassignedOldTickets() {
  const thresholdTime = new Date(Date.now() - AUTO_ASSIGN_THRESHOLD_MINUTES * 60 * 1000);

  const unassignedTickets = await db
    .select()
    .from(tickets)
    .where(
      and(
        isNull(tickets.assignedEngineerId),
        lte(tickets.createdAt, thresholdTime),
        sql`${tickets.status} NOT IN ('closed', 'resolved')`
      )
    );

  return unassignedTickets;
}

async function getLastAutoAssignedUserId(activeUserIds: string[]): Promise<string | null> {
  if (activeUserIds.length === 0) return null;
  
  const lastAutoAssigned = await db
    .select({ assignedEngineerId: tickets.assignedEngineerId })
    .from(tickets)
    .where(
      and(
        eq(tickets.assignmentMethod, "auto"),
        sql`${tickets.assignedEngineerId} = ANY(${activeUserIds})`
      )
    )
    .orderBy(sql`${tickets.assignedAt} DESC NULLS LAST`)
    .limit(1);

  return lastAutoAssigned.length > 0 ? lastAutoAssigned[0].assignedEngineerId : null;
}

async function autoAssignTickets() {
  if (isRunning) {
    log("[AutoAssign] Already running, skipping...", "scheduler");
    return;
  }

  isRunning = true;

  try {
    log("[AutoAssign] Starting auto-assignment check...", "scheduler");

    const unassignedTickets = await getUnassignedOldTickets();

    if (unassignedTickets.length === 0) {
      log("[AutoAssign] No unassigned tickets older than 30 minutes", "scheduler");
      return;
    }

    log(`[AutoAssign] Found ${unassignedTickets.length} unassigned tickets older than 30 minutes`, "scheduler");

    const supportUsers = await getSupportAssignableUsers();

    if (supportUsers.length === 0) {
      log("[AutoAssign] No support engineers available for assignment", "scheduler");
      return;
    }

    log(`[AutoAssign] ${supportUsers.length} support engineers available`, "scheduler");

    const activeUserIds = supportUsers.map(u => u.id);
    const lastAssignedUserId = await getLastAutoAssignedUserId(activeUserIds);
    let currentIndex = 0;

    if (lastAssignedUserId) {
      const lastIndex = supportUsers.findIndex(u => u.id === lastAssignedUserId);
      if (lastIndex !== -1) {
        currentIndex = (lastIndex + 1) % supportUsers.length;
      }
    }

    let assignedCount = 0;
    for (const ticket of unassignedTickets) {
      const assignee = supportUsers[currentIndex];
      const now = new Date();

      // Use optimistic concurrency - only update if ticket is still unassigned
      // This prevents race conditions where a manual assignment happens between query and update
      const updatedRows = await db
        .update(tickets)
        .set({
          assignedEngineerId: assignee.id,
          assignmentMethod: "auto",
          assignedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(tickets.id, ticket.id),
            isNull(tickets.assignedEngineerId) // Only assign if still unassigned
          )
        )
        .returning({ id: tickets.id });

      // Only log, count, and advance pointer if the ticket was actually assigned
      if (updatedRows.length > 0) {
        const assigneeName = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email || 'Unknown';
        
        await db.insert(activityLog).values({
          action: "auto_assign_ticket",
          entityType: "ticket",
          entityId: ticket.id,
          description: `Auto-assigned to ${assigneeName} (unassigned for more than 30 minutes)`,
          metadata: {
            ticketNumber: ticket.ticketNumber,
            assignedTo: assignee.id,
            assigneeName: assigneeName,
            reason: "Unassigned for more than 30 minutes",
            method: "round_robin",
          },
        });

        log(`[AutoAssign] Ticket ${ticket.ticketNumber} assigned to ${assigneeName}`, "scheduler");
        assignedCount++;

        // Only advance the round-robin pointer when assignment actually succeeded
        currentIndex = (currentIndex + 1) % supportUsers.length;
      } else {
        log(`[AutoAssign] Ticket ${ticket.ticketNumber} was already manually assigned, skipping`, "scheduler");
      }
    }

    log(`[AutoAssign] Auto-assigned ${assignedCount} of ${unassignedTickets.length} tickets successfully`, "scheduler");

  } catch (error) {
    log(`[AutoAssign] Error during auto-assignment: ${error}`, "scheduler");
  } finally {
    isRunning = false;
  }
}

export function startAutoAssignmentScheduler() {
  log(`[AutoAssign] Starting scheduler (checking every ${CHECK_INTERVAL_MINUTES} minutes for tickets unassigned > ${AUTO_ASSIGN_THRESHOLD_MINUTES} minutes)`, "scheduler");

  autoAssignTickets();

  intervalId = setInterval(autoAssignTickets, CHECK_INTERVAL_MINUTES * 60 * 1000);
}

export function stopAutoAssignmentScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    log("[AutoAssign] Scheduler stopped", "scheduler");
  }
}
