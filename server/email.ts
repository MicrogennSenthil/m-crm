// Email service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
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
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

// Email templates and sender functions

export async function sendQuoteEmail(
  toEmail: string,
  recipientName: string,
  companyName: string,
  amount: number,
  validUntil: Date
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
    
    const formattedDate = validUntil.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await client.emails.send({
      from: fromEmail,
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

export async function sendTicketClosureFeedbackEmail(
  toEmail: string,
  recipientName: string,
  ticketNumber: string,
  ticketSubject: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Ticket Closed: ${ticketNumber} - We'd love your feedback`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Your Support Ticket Has Been Resolved</h2>
          <p>Dear ${recipientName},</p>
          <p>We're writing to let you know that your support ticket has been closed:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
            <p><strong>Subject:</strong> ${ticketSubject}</p>
          </div>
          
          <p>We hope we were able to resolve your issue to your satisfaction. Your feedback is important to us!</p>
          
          <div style="margin: 30px 0;">
            <p><strong>How would you rate your support experience?</strong></p>
            <p style="font-size: 12px; color: #6b7280;">Please click on a rating:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px;">⭐ ⭐ ⭐ ⭐ ⭐</span>
            </div>
          </div>
          
          <p>If you're not satisfied with the resolution or need further assistance, you can reopen this ticket by logging into your account.</p>
          
          <p>Thank you for choosing Microgenn!</p>
          
          <p>Best regards,<br>The Microgenn Support Team</p>
        </div>
      `
    });
    
    console.log(`✅ Ticket closure feedback email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send ticket closure email:', error);
    return { success: false, error };
  }
}

export async function sendTrainingConfirmationEmail(
  toEmail: string,
  recipientName: string,
  projectName: string,
  moduleName: string,
  trainingDate: Date,
  hours: number
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const formattedDate = trainingDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Training Scheduled: ${moduleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Training Session Scheduled</h2>
          <p>Dear ${recipientName},</p>
          <p>This email confirms your upcoming training session:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Training Details</h3>
            <p><strong>Project:</strong> ${projectName}</p>
            <p><strong>Module:</strong> ${moduleName}</p>
            <p><strong>Date & Time:</strong> ${formattedDate}</p>
            <p><strong>Duration:</strong> ${hours} hour${hours !== 1 ? 's' : ''}</p>
          </div>
          
          <p>Please ensure you're available at the scheduled time. If you need to reschedule, please contact your implementation engineer as soon as possible.</p>
          
          <p>We look forward to training you on ${moduleName}!</p>
          
          <p>Best regards,<br>The Microgenn Implementation Team</p>
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

export async function sendWelcomeEmail(
  toEmail: string,
  recipientName: string,
  role: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Welcome to Microgenn CRM!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Welcome to Microgenn CRM!</h2>
          <p>Dear ${recipientName},</p>
          <p>Welcome to the Microgenn Customer Relationship Management platform! Your account has been successfully created.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Account Details</h3>
            <p><strong>Email:</strong> ${toEmail}</p>
            <p><strong>Role:</strong> ${role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
          </div>
          
          <p>You can now access all features available to your role. Here's what you can do:</p>
          
          <ul>
            ${role === 'sales_executive' ? `
              <li>Manage leads and sales pipeline</li>
              <li>Schedule demos and follow-ups</li>
              <li>Send quotes to prospects</li>
            ` : ''}
            ${role === 'engineer' ? `
              <li>Track implementation projects</li>
              <li>Manage module completion</li>
              <li>Log training sessions</li>
            ` : ''}
            ${role === 'support' ? `
              <li>Handle support tickets</li>
              <li>Manage escalations</li>
              <li>Track customer satisfaction</li>
            ` : ''}
            ${role === 'admin' ? `
              <li>Full access to all modules</li>
              <li>View reports and analytics</li>
              <li>Manage system settings</li>
            ` : ''}
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to your administrator.</p>
          
          <p>Best regards,<br>The Microgenn Team</p>
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

// Generic email sender for custom emails
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html
    });
    
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
    const { client, fromEmail } = await getUncachableResendClient();
    
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

    await client.emails.send({
      from: fromEmail,
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
    
    console.log(`✅ OTP email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error };
  }
}

// Password reset success email
export async function sendPasswordResetSuccessEmail(toEmail: string, userName: string) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    await client.emails.send({
      from: fromEmail,
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
