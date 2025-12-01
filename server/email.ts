// Email service with SMTP and Resend support
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// =============================================
// EMAIL PROVIDER CONFIGURATION
// =============================================
// 
// The system supports two email providers:
// 1. SMTP (Gmail, custom SMTP) - Set these environment variables:
//    - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
//    - SMTP_PORT: SMTP port (587 for TLS, 465 for SSL)
//    - SMTP_USER: Email username (e.g., snayagamk@gmail.com)
//    - SMTP_PASS: Email password or App Password
//    - SMTP_FROM: Sender email (e.g., "Microgenn CRM <snayagamk@gmail.com>")
//    - SMTP_SECURE: "true" for SSL (port 465), "false" for TLS (port 587)
//
// 2. Resend API (fallback) - Set:
//    - RESEND_API_KEY: Your Resend API key
//
// SMTP takes priority if configured. Falls back to Resend if SMTP is not set.
// =============================================

let connectionSettings: any;
let smtpTransporter: Transporter | null = null;

// Check if SMTP is configured
function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

// Get SMTP transporter (cached)
function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    const isSecure = process.env.SMTP_SECURE === 'true';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    console.log(`📧 SMTP configured: ${process.env.SMTP_HOST}:${port} (secure: ${isSecure})`);
  }
  return smtpTransporter;
}

// Get SMTP sender email
function getSmtpFromEmail(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
}

// Send email via SMTP
async function sendEmailViaSMTP(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; messageId?: string }> {
  const transporter = getSmtpTransporter();
  const fromEmail = getSmtpFromEmail();
  
  console.log(`📧 Sending email via SMTP from: ${fromEmail} to: ${params.to}`);
  
  const result = await transporter.sendMail({
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  
  console.log(`✅ SMTP email sent successfully. MessageId: ${result.messageId}`);
  return { success: true, messageId: result.messageId };
}

// Resend credentials
async function getResendCredentials() {
  // First try environment variable (preferred)
  if (process.env.RESEND_API_KEY) {
    console.log('📧 Using RESEND_API_KEY from environment');
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: 'onboarding@resend.dev' // Default sender for unverified domains
    };
  }
  
  // Fallback to Replit connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected - please set RESEND_API_KEY environment variable');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableResendClient() {
  const credentials = await getResendCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

// Send email via Resend
async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean }> {
  const { client, fromEmail } = await getUncachableResendClient();
  
  console.log(`📧 Sending email via Resend from: ${fromEmail} to: ${params.to}`);
  
  const result = await client.emails.send({
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  
  console.log(`📬 Resend response for ${params.to}:`, JSON.stringify(result));
  
  if (result.error) {
    console.error(`❌ Resend error for ${params.to}:`, result.error);
    throw new Error(result.error.message || 'Failed to send email');
  }
  
  console.log(`✅ Email sent successfully via Resend to ${params.to}`);
  return { success: true };
}

// Unified email sending function - uses SMTP if configured, otherwise Resend
async function sendEmailUnified(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean }> {
  if (isSmtpConfigured()) {
    return sendEmailViaSMTP(params);
  } else {
    return sendEmailViaResend(params);
  }
}

// Get current email provider info
export function getEmailProviderInfo(): { provider: 'smtp' | 'resend'; configured: boolean; details: string } {
  if (isSmtpConfigured()) {
    return {
      provider: 'smtp',
      configured: true,
      details: `SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`
    };
  } else if (process.env.RESEND_API_KEY) {
    return {
      provider: 'resend',
      configured: true,
      details: 'Resend API'
    };
  } else {
    return {
      provider: 'resend',
      configured: false,
      details: 'No email provider configured'
    };
  }
}

// =============================================
// EMAIL TEMPLATES AND SENDER FUNCTIONS
// =============================================

export async function sendQuoteEmail(
  toEmail: string,
  recipientName: string,
  companyName: string,
  amount: number,
  validUntil: Date
) {
  try {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
    
    const formattedDate = validUntil.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await sendEmailUnified({
      to: toEmail,
      subject: `Quote from Microgenn - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Your Quote from Microgenn</h2>
          <p>Dear ${recipientName},</p>
          <p>Thank you for your interest in our services. We're pleased to provide you with the following quote:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Quote Details</h3>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Valid Until:</strong> ${formattedDate}</p>
          </div>
          
          <p>This quote is valid until ${formattedDate}. If you have any questions or would like to proceed, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>The Microgenn Team</p>
        </div>
      `
    });
    
    console.log(`✅ Quote email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send quote email:', error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail(toEmail: string, userName: string, role: string) {
  try {
    const roleDisplay = {
      admin: 'Administrator',
      sales_executive: 'Sales Executive',
      engineer: 'Implementation Engineer',
      support: 'Support Staff'
    }[role] || role;

    await sendEmailUnified({
      to: toEmail,
      subject: 'Welcome to Microgenn CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Welcome to Microgenn CRM</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Hello, ${userName}!</h2>
            
            <p>Your account has been successfully created. You have been assigned the role of <strong>${roleDisplay}</strong>.</p>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1a2b6d;">Getting Started</h3>
              <ul style="padding-left: 20px; color: #374151;">
                <li>Access the dashboard to view your tasks and activities</li>
                <li>Explore the Sales, Implementation, and Support modules</li>
                <li>Update your profile in the Settings section</li>
              </ul>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact your administrator.</p>
            
            <p>Best regards,<br>The Microgenn Team</p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ Welcome email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

export async function sendTicketClosedEmail(
  toEmail: string,
  customerName: string,
  ticketNumber: string,
  resolution: string
) {
  try {
    await sendEmailUnified({
      to: toEmail,
      subject: `Ticket ${ticketNumber} Resolved - Microgenn CRM`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Ticket Resolved</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Hello, ${customerName}!</h2>
            
            <p>Good news! Your support ticket <strong>${ticketNumber}</strong> has been resolved.</p>
            
            <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; border: 1px solid #6ee7b7; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #065f46;">Resolution</h3>
              <p style="color: #065f46;">${resolution}</p>
            </div>
            
            <p>If you have any further questions or if this issue persists, please don't hesitate to contact us again.</p>
            
            <p>Thank you for your patience and understanding.</p>
            
            <p>Best regards,<br>The Microgenn Support Team</p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ Ticket closed email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send ticket closed email:', error);
    return { success: false, error };
  }
}

// Ticket closure feedback email (sent when ticket is closed to request feedback)
export async function sendTicketClosureFeedbackEmail(
  toEmail: string,
  customerName: string,
  ticketNumber: string,
  issueSummary: string
) {
  try {
    await sendEmailUnified({
      to: toEmail,
      subject: `Your Ticket ${ticketNumber} Has Been Closed - We'd Love Your Feedback`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Ticket Closed</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Hello, ${customerName}!</h2>
            
            <p>Your support ticket <strong>${ticketNumber}</strong> has been closed.</p>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1a2b6d;">Issue Summary</h3>
              <p style="color: #374151;">${issueSummary}</p>
            </div>
            
            <p>We hope your issue has been resolved to your satisfaction. Your feedback is valuable to us and helps us improve our support services.</p>
            
            <p>If you have any remaining concerns or if the issue persists, please don't hesitate to open a new ticket.</p>
            
            <p>Thank you for choosing Microgenn!</p>
            
            <p>Best regards,<br>The Microgenn Support Team</p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ Ticket closure feedback email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send ticket closure feedback email:', error);
    return { success: false, error };
  }
}

export async function sendTrainingConfirmationEmail(
  toEmail: string,
  recipientName: string,
  projectName: string,
  moduleName: string,
  scheduledDate: Date
) {
  try {
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await sendEmailUnified({
      to: toEmail,
      subject: `Training Scheduled: ${moduleName} - ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Training Confirmation</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Hello, ${recipientName}!</h2>
            
            <p>Your training session has been scheduled:</p>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; border: 1px solid #93c5fd; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">Training Details</h3>
              <p><strong>Project:</strong> ${projectName}</p>
              <p><strong>Module:</strong> ${moduleName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
            </div>
            
            <p>Please ensure you're available at the scheduled time. If you need to reschedule, please contact your implementation engineer.</p>
            
            <p>Best regards,<br>The Microgenn Implementation Team</p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ Training confirmation email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send training confirmation email:', error);
    return { success: false, error };
  }
}

// Generic email sender for custom emails
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await sendEmailUnified(params);
    console.log(`✅ Email sent to ${params.to}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// OTP verification email
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  purpose: 'signup' | 'login' | 'password_reset'
) {
  try {
    const purposeText = {
      signup: 'complete your registration',
      login: 'verify your login',
      password_reset: 'reset your password'
    }[purpose];
    
    const subjectText = {
      signup: 'Verify Your Email - Microgenn CRM',
      login: 'Login Verification Code - Microgenn CRM',
      password_reset: 'Password Reset Code - Microgenn CRM'
    }[purpose];

    await sendEmailUnified({
      to: toEmail,
      subject: subjectText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Microgenn CRM</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Verification Code</h2>
            
            <p>Use the following code to ${purposeText}:</p>
            
            <div style="background-color: #1a2b6d; color: #f5a623; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${otpCode}
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes. Do not share this code with anyone.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you did not request this code, please ignore this email.
            </p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ OTP email sent successfully to ${toEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
}

// Password reset success email
export async function sendPasswordResetSuccessEmail(toEmail: string, userName: string) {
  try {
    await sendEmailUnified({
      to: toEmail,
      subject: 'Password Changed Successfully - Microgenn CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a2b6d; padding: 20px; text-align: center;">
            <h1 style="color: #f5a623; margin: 0;">Microgenn CRM</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f8f9fa;">
            <h2 style="color: #1a2b6d; margin-top: 0;">Password Changed</h2>
            
            <p>Hello ${userName},</p>
            
            <p>Your password has been successfully changed. You can now log in with your new password.</p>
            
            <p style="color: #666; font-size: 14px;">
              If you did not make this change, please contact your administrator immediately.
            </p>
          </div>
          
          <div style="background-color: #1a2b6d; color: #f5a623; padding: 15px; text-align: center; font-size: 12px;">
            Microgenn - Empowering Your Hotel's Digital Evolution
          </div>
        </div>
      `
    });
    
    console.log(`✅ Password reset success email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset success email:', error);
    return { success: false, error };
  }
}
