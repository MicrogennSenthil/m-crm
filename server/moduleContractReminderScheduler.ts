import { db } from "./db";
import { customerModuleContracts, customers, modules, activityLog } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { log } from "./app";
import { Resend } from "resend";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const CHECK_INTERVAL_HOURS = 24;

async function getContractsDueForReminder() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const contracts = await db.select({
    contract: customerModuleContracts,
    customerName: sql<string>`(SELECT name FROM customers WHERE id = ${customerModuleContracts.customerId})`,
    customerEmail: sql<string>`(SELECT email FROM customers WHERE id = ${customerModuleContracts.customerId})`,
    moduleName: sql<string>`(SELECT name FROM modules WHERE id = ${customerModuleContracts.moduleId})`,
  })
    .from(customerModuleContracts)
    .where(eq(customerModuleContracts.status, "active"));
  
  return contracts.filter(c => {
    if (!c.contract.contractEndDate) return false;
    
    const endDate = new Date(c.contract.contractEndDate);
    const reminderDate = new Date(endDate);
    reminderDate.setDate(reminderDate.getDate() - (c.contract.renewalReminderDays || 30));
    reminderDate.setHours(0, 0, 0, 0);
    
    // Check if we're within the reminder window (between reminderDate and endDate)
    const inReminderWindow = today >= reminderDate && endDate >= today;
    if (!inReminderWindow) return false;
    
    // Check if a reminder was already sent during this reminder window
    if (c.contract.lastReminderSentAt) {
      const lastReminder = new Date(c.contract.lastReminderSentAt);
      lastReminder.setHours(0, 0, 0, 0);
      // Only skip if reminder was sent on or after the start of the current reminder window
      if (lastReminder >= reminderDate) return false;
    }
    
    return true;
  });
}

async function sendReminderEmail(contract: any, customerEmail: string, customerName: string, moduleName: string) {
  if (!process.env.RESEND_API_KEY) {
    log("[ModuleContractReminder] RESEND_API_KEY not configured, skipping email", "scheduler");
    return false;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const endDate = new Date(contract.contractEndDate);
    const daysUntilExpiry = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    const amcAmount = contract.amcCalculationType === 'percentage' 
      ? (contract.orderValue * (contract.amcPercentage || 0) / 100)
      : (contract.amcAmount || 0);
    const gstAmount = amcAmount * ((contract.gstPercentage || 18) / 100);
    const totalAmount = amcAmount + gstAmount;

    await resend.emails.send({
      from: "M-CRM <noreply@microgenn.com>",
      to: customerEmail,
      subject: `Module Contract Renewal Reminder - ${moduleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2b6d;">Contract Renewal Reminder</h2>
          <p>Dear ${customerName},</p>
          <p>This is a reminder that your <strong>${moduleName}</strong> module contract is approaching renewal.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Module:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${moduleName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Contract End Date:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${endDate.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Until Expiry:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${daysUntilExpiry} days</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>AMC Amount:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">INR ${amcAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>GST (${contract.gstPercentage || 18}%):</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">INR ${gstAmount.toLocaleString()}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>INR ${totalAmount.toLocaleString()}</strong></td>
            </tr>
          </table>
          
          <p>Please contact us to renew your contract and ensure uninterrupted service.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated reminder from M-CRM.
          </p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    log(`[ModuleContractReminder] Failed to send email to ${customerEmail}: ${error}`, "scheduler");
    return false;
  }
}

async function processModuleContractReminders() {
  if (isRunning) {
    log("[ModuleContractReminder] Already running, skipping...", "scheduler");
    return;
  }

  isRunning = true;

  try {
    log("[ModuleContractReminder] Starting reminder check...", "scheduler");

    const contractsDue = await getContractsDueForReminder();

    if (contractsDue.length === 0) {
      log("[ModuleContractReminder] No contracts due for reminder", "scheduler");
      isRunning = false;
      return;
    }

    log(`[ModuleContractReminder] Found ${contractsDue.length} contracts due for reminder`, "scheduler");

    let sentCount = 0;
    let failedCount = 0;

    for (const item of contractsDue) {
      if (!item.customerEmail) {
        log(`[ModuleContractReminder] No email for customer ${item.customerName}, skipping`, "scheduler");
        continue;
      }

      const emailSent = await sendReminderEmail(
        item.contract,
        item.customerEmail,
        item.customerName || "Customer",
        item.moduleName || "Module"
      );

      if (emailSent) {
        await db.update(customerModuleContracts)
          .set({ 
            lastReminderSentAt: new Date()
          })
          .where(eq(customerModuleContracts.id, item.contract.id));

        await db.insert(activityLog).values({
          entityType: "module_contract",
          entityId: item.contract.id,
          action: "renewal_reminder_sent",
          description: `Renewal reminder sent for ${item.moduleName} to ${item.customerEmail}`,
          userId: null,
        });

        sentCount++;
        log(`[ModuleContractReminder] Sent reminder for ${item.moduleName} to ${item.customerEmail}`, "scheduler");
      } else {
        failedCount++;
      }
    }

    log(`[ModuleContractReminder] Completed: ${sentCount} sent, ${failedCount} failed`, "scheduler");
  } catch (error) {
    log(`[ModuleContractReminder] Error during processing: ${error}`, "scheduler");
  } finally {
    isRunning = false;
  }
}

export function startModuleContractReminderScheduler() {
  log("[ModuleContractReminder] Starting scheduler (checking every 24 hours)", "scheduler");
  
  processModuleContractReminders();
  
  intervalId = setInterval(processModuleContractReminders, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
}

export function stopModuleContractReminderScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    log("[ModuleContractReminder] Scheduler stopped", "scheduler");
  }
}

export async function triggerModuleContractReminderCheck() {
  await processModuleContractReminders();
}
