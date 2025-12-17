import { db } from "../server/db";
import { knowledgeBaseSources, knowledgeBaseChunks } from "../shared/schema";
import { generateEmbeddings, chunkText, extractTextFromContent, estimateTokenCount } from "../server/embeddings";

const crmDocuments = [
  // Dashboard
  {
    title: "Dashboard Overview",
    category: "general",
    contentType: "guide",
    description: "Understanding the M-CRM Dashboard and its features",
    content: `# M-CRM Dashboard Guide

The Dashboard is your central hub for monitoring all CRM activities at a glance.

## Key Metrics Cards
- **Active Leads**: Shows total leads in your sales pipeline
- **Ongoing Implementations**: Projects currently being implemented
- **Open Tickets**: Support tickets requiring attention
- **Monthly Closures**: Deals closed this month

## My Tasks Section
View your assigned tasks, upcoming deadlines, and pending follow-ups.

## Activity Feed
Real-time updates showing recent activities across all modules including new leads, ticket updates, and project milestones.

## Department Dashboard
Department heads see their team's performance metrics and workload distribution.

## Quick Actions
- Create new lead
- Open support ticket
- Add new task
- View reports`
  },
  
  // Sales Module
  {
    title: "How to Create a New Lead",
    category: "sales",
    contentType: "guide",
    description: "Step-by-step guide to creating leads in the CRM",
    content: `# Creating a New Lead in M-CRM

## Steps to Create a Lead

1. Navigate to **Sales → Leads** from the sidebar
2. Click the **"New Lead"** button
3. Fill in the required information:
   - Customer Name
   - Contact Person
   - Email and Phone
   - Lead Source (Walk-in, Website, Referral, etc.)
   - Expected Value
   - Assign to Sales Executive

## Lead Stages
Leads progress through these stages:
- **New**: Fresh lead, initial contact
- **Contacted**: First communication made
- **Qualified**: Confirmed as potential customer
- **Proposal**: Quote/proposal sent
- **Closed Won/Lost**: Final outcome

## Managing Leads
- Use the Kanban board view to drag leads between stages
- Add follow-up reminders with the Tasks module
- Track all communication in the activity log
- Generate quotes directly from the lead`
  },
  
  {
    title: "Sales Pipeline Management",
    category: "sales",
    contentType: "guide",
    description: "Managing your sales pipeline effectively",
    content: `# Sales Pipeline Management

## Kanban Board View
The Kanban board provides a visual representation of all leads organized by stage.

### Drag and Drop
Simply drag a lead card from one column to another to update its stage.

### Lead Card Information
Each card displays:
- Customer name
- Contact details
- Expected value
- Assigned sales executive
- Days in current stage

## Filtering Leads
- Filter by sales executive
- Filter by lead source
- Filter by date range
- Search by customer name

## Quote Management
1. Open a lead
2. Click "Create Quote"
3. Add products/services and pricing
4. Send quote via email to customer

## Reporting
Track conversion rates, average deal size, and sales cycle length in the Reports section.`
  },

  // Support Module
  {
    title: "How to Create a Support Ticket",
    category: "support",
    contentType: "guide",
    description: "Creating and managing support tickets",
    content: `# Creating Support Tickets

## Creating a New Ticket

1. Navigate to **Support → Tickets**
2. Click **"New Ticket"** button
3. Fill in the details:
   - Select Customer
   - Issue Summary (brief description)
   - Detailed Description
   - Priority (Low, Medium, High, Critical)
   - Category

## Ticket Number Format
Tickets are automatically assigned numbers like TKT-000001.

## Manual vs Auto-Assignment
- **First 10 minutes**: Ticket remains unassigned for manual allocation
- **After 10 minutes**: System auto-assigns using round-robin to available engineers
- Auto-assigned tickets display a ⚡Auto badge

## Priority Levels
- **Low**: Minor issues, can wait
- **Medium**: Standard issues
- **High**: Urgent, affecting business
- **Critical**: System down, immediate attention`
  },

  {
    title: "Support Ticket Escalation Process",
    category: "support",
    contentType: "procedure",
    description: "How the 3-tier escalation system works",
    content: `# Support Ticket Escalation

## 3-Level Escalation Matrix

### Level 1 (L1) - First Line Support
- Initial ticket handling
- Basic troubleshooting
- Common issue resolution
- Response time: Same day

### Level 2 (L2) - Technical Support
- Complex technical issues
- Requires deeper investigation
- May involve remote access
- Response time: Within 24 hours

### Level 3 (L3) - Development Team
- Code-level fixes required
- Feature modifications
- Database issues
- Creates Development Task automatically

## How to Escalate
1. Open the ticket
2. Click "Escalate" button
3. Select escalation level
4. Add escalation reason
5. System notifies the next level team

## Viewing Escalation History
Each ticket shows complete escalation timeline with dates, levels, and reasons.`
  },

  {
    title: "Closing Support Tickets",
    category: "support",
    contentType: "procedure",
    description: "Proper ticket closure workflow",
    content: `# Closing Support Tickets

## Prerequisites for Closing
- Issue must be resolved
- Customer confirmation (if applicable)
- All development tasks completed (for L3 tickets)

## Closure Process
1. Update ticket status to "Resolved"
2. Add resolution notes
3. Request customer feedback
4. Click "Close Ticket"

## Automatic Notifications
- Customer receives closure email
- Satisfaction survey is sent
- Activity logged for reporting

## Reopening Tickets
If issue recurs within 7 days, the same ticket can be reopened rather than creating a new one.

## Ticket Views
- **Open**: New tickets awaiting attention
- **In Progress**: Being actively worked on
- **Completed**: Resolved and closed
- Today's closed tickets remain visible until midnight`
  },

  // Implementation Module  
  {
    title: "Implementation Project Overview",
    category: "implementation",
    contentType: "guide",
    description: "Understanding implementation projects",
    content: `# Implementation Projects

## What is an Implementation Project?
When a sale is closed, the product needs to be set up and configured for the customer. This process is tracked as an Implementation Project.

## Creating a Project
1. Navigate to **Operations → Projects**
2. Click **"New Project"**
3. Select the customer
4. Assign implementation engineers
5. Set target completion date

## Project Modules
Each project has 8 standard modules to implement:
1. Front Office
2. Power Automation
3. POS (Point of Sale)
4. Inventory Management
5. HR & Payroll
6. Accounting
7. CRM Integration
8. Reporting & Analytics

## Progress Tracking
- Each module shows completion percentage
- Overall project progress calculated automatically
- Visual progress bars on project cards`
  },

  {
    title: "Managing Implementation Modules",
    category: "implementation",
    contentType: "guide",
    description: "Working with the 8-module implementation checklist",
    content: `# Implementation Module Checklist

## Standard 8 Modules

### 1. Front Office
- Reception management
- Guest check-in/check-out
- Room assignment
- Billing setup

### 2. Power Automation
- Automated workflows
- Email notifications
- Scheduled tasks

### 3. POS (Point of Sale)
- Register configuration
- Payment methods
- Receipt templates

### 4. Inventory Management
- Stock tracking
- Purchase orders
- Vendor management

### 5. HR & Payroll
- Employee database
- Attendance tracking
- Salary processing

### 6. Accounting
- Chart of accounts
- Tax configuration
- Financial reports

### 7. CRM Integration
- Customer database sync
- Sales pipeline connection
- Support ticket linking

### 8. Reporting & Analytics
- Dashboard configuration
- Custom reports
- Data exports

## Updating Module Status
1. Open project
2. Select module
3. Update percentage complete
4. Add notes if needed`
  },

  {
    title: "Recording Training Sessions",
    category: "implementation",
    contentType: "procedure",
    description: "How to log customer training during implementation",
    content: `# Training Record Management

## Why Record Training?
- Track which modules have been taught
- Document who was trained
- Maintain audit trail
- Ensure complete handover

## Creating Training Records
1. Open the Implementation Project
2. Go to "Training" tab
3. Click "Add Training Record"
4. Fill in details:
   - Training date
   - Module covered
   - Attendees
   - Duration
   - Notes/feedback

## Training Confirmation
- System sends confirmation email to customer
- Customer can provide feedback
- Training marked as complete

## Viewing Training History
All training sessions are listed chronologically with full details accessible for reporting.`
  },

  // Development Module
  {
    title: "Development Module Overview",
    category: "general",
    contentType: "guide",
    description: "Understanding the Development Task system",
    content: `# Development Module

## Purpose
The Development Module handles technical work requests that require code changes, bug fixes, or feature development.

## Access
Navigate to **Development → Dev Dashboard** or **Dev Tasks**

## Task Sources
Development tasks can come from:
- **Support Tickets** (L3 escalations)
- **Implementation Projects** (customization requests)
- **Tasks Module** (assigned development work)
- **Manual Creation** (direct development requests)

## Task Number Format
Tasks use format: DEV-000001

## Dashboard Metrics
- Total tasks by status
- Tasks by source type
- Overdue task count
- Developer workload`
  },

  {
    title: "Creating Development Tasks",
    category: "general",
    contentType: "guide",
    description: "How to create and assign development tasks",
    content: `# Creating Development Tasks

## From Support Ticket
1. Open an L3 escalated ticket
2. Click "Assign to Development"
3. Fill in task details:
   - Task description
   - Assign to developer
   - Set deadline
   - Estimated hours
4. Task is created and linked to ticket

## From Implementation Project
1. Open the project
2. Click "Assign to Development"
3. Describe the customization needed
4. Assign and set deadline

## From Tasks Module
1. Open a task
2. Click "Assign to Development"
3. Link becomes bidirectional

## Manual Creation
1. Go to Dev Tasks page
2. Click "New Task"
3. Fill in all fields
4. Source marked as "Manual"

## Important Notes
- Linked tickets show "Development" status badge
- Tickets cannot be closed until dev task completes`
  },

  {
    title: "Development Task Workflow",
    category: "general",
    contentType: "procedure",
    description: "Managing development task lifecycle",
    content: `# Development Task Workflow

## Task Statuses
- **Pending**: New task, not started
- **In Progress**: Actively being worked on
- **Completed**: Work finished
- **Overdue**: Past deadline

## Working on Tasks
1. Review task details and requirements
2. Change status to "In Progress"
3. Log actual hours worked
4. Add comments for updates
5. Attach any deliverables
6. Mark as "Completed" when done

## Deadline Tracking
- Tasks past deadline marked "Overdue"
- Penalty points assigned for missed deadlines
- Visible in developer performance reports

## Filtering Tasks
- By source (Support, Implementation, Tasks, Manual)
- By status (Pending, In Progress, Completed, Overdue)
- By assigned developer
- By priority level`
  },

  // Task/Followup Module
  {
    title: "Task Management System",
    category: "general",
    contentType: "guide",
    description: "Complete guide to the Tasks/Followup module",
    content: `# Task Management System

## Overview
The Tasks module helps track follow-ups, assignments, and action items across all CRM activities.

## Creating Tasks
1. Go to **Tasks** from sidebar
2. Click **"New Task"**
3. Fill in details:
   - Title and description
   - Assign to team member
   - Set due date and time
   - Set reminder date and time
   - Priority level

## Task Statuses
- **Pending**: Not started
- **Follow-up**: Requires additional action
- **Get Information**: Waiting for input
- **Completed**: Finished

## Attachments
Tasks support multiple attachment types:
- Voice recordings (record directly)
- Video recordings (camera capture)
- Photos (camera capture)
- File uploads

## Team Mentions
Use @username to mention team members in task descriptions or comments.`
  },

  {
    title: "Task Attachments Guide",
    category: "general",
    contentType: "guide",
    description: "Adding voice, video, and photo attachments to tasks",
    content: `# Task Attachments

## Voice Recordings
1. Click the microphone icon
2. Allow microphone access
3. Record your message
4. Click stop when done
5. Recording attaches automatically

## Video Recordings
1. Click the video camera icon
2. Allow camera and microphone access
3. Record your video
4. Click stop when done
5. Video attaches to task

## Photo Capture
1. Click the camera icon
2. Allow camera access
3. Position and capture photo
4. Photo attaches to task

## File Uploads
1. Click the attachment/clip icon
2. Select file from device
3. Supported: Images, PDFs, Documents
4. File uploads and attaches

## Viewing Attachments
All attachments display with preview thumbnails and can be downloaded or viewed in full screen.`
  },

  // User Management
  {
    title: "User Management Overview",
    category: "general",
    contentType: "guide",
    description: "Managing users, roles, and permissions",
    content: `# User Management

## Accessing User Management
Navigate to **Administration → User Master**

## Sub-Modules
1. **User Master**: Create and manage user accounts
2. **User Role Master**: Define roles (Sales, Engineer, Support, Admin)
3. **User Rights Allocation**: Configure module permissions per role
4. **User Approval**: Approve or reject new user registrations

## Creating Users
1. Go to User Master
2. Click "New User"
3. Enter email and name
4. Assign role(s)
5. Set active status
6. Save

## User Roles
- **Sales Executive**: Access to leads and quotes
- **Implementation Engineer**: Access to projects
- **Support Engineer**: Access to tickets
- **Developer**: Access to development tasks
- **Admin**: Full system access`
  },

  {
    title: "Role-Based Permissions",
    category: "general",
    contentType: "guide",
    description: "Understanding the permission system",
    content: `# Role-Based Permission System

## Permission Levels
Each role can have these permissions per module:
- **View**: See data in the module
- **Create**: Add new records
- **Edit**: Modify existing records
- **Delete**: Remove records

## Configuring Permissions
1. Go to **Administration → User Rights Allocation**
2. Select a role
3. For each module, toggle View/Create/Edit/Delete
4. Click "Update Permissions"

## Module List
- Dashboard
- Leads
- Projects
- Tickets
- Tasks
- Development
- Reports
- Knowledge Base
- User Management

## Super Admin
The super admin (senthil@microgenn.com) has unrestricted access to all modules regardless of role settings.

## Permission Caching
Permissions are cached for 5 minutes. Changes take effect after cache expires or user re-logs in.`
  },

  {
    title: "User Approval Workflow",
    category: "general",
    contentType: "procedure",
    description: "Approving new user registrations",
    content: `# User Approval Process

## When Users Register
1. New user signs up
2. Account created with "pending" status
3. Admin notified of pending approval
4. User cannot access system until approved

## Approving Users
1. Go to **Administration → User Approval**
2. View list of pending users
3. Review user details
4. Click "Approve" to grant access
5. Or click "Reject" with reason

## After Approval
- User receives welcome email
- Can log in and access assigned modules
- Activity logged for audit

## Revoking Access
1. Find user in approval list
2. Click "Revoke"
3. User immediately loses access
4. Account deactivated`
  },

  // Reports
  {
    title: "Reports Module Overview",
    category: "general",
    contentType: "guide",
    description: "Using the Reports module for analytics",
    content: `# Reports Module

## Available Reports

### Sales Reports
- Fresh/Pending/Completed calls
- Lead conversion rates
- Sales by executive
- Revenue forecasting

### Implementation Reports
- Project status overview
- Module completion rates
- Engineer workload
- Training statistics

### Support Reports
- Ticket volume trends
- Resolution times
- Escalation rates
- Customer satisfaction

## Report Features
- **Date Range Filters**: Select custom periods
- **Export Options**: Download as CSV or Excel
- **Email Reports**: Send directly via email
- **Search**: Find specific records
- **Sort**: Order by any column

## Accessing Reports
Navigate to **Reports** from the sidebar, then select the report type (Sales, Implementation, or Support).`
  },

  // Knowledge Base
  {
    title: "Knowledge Base Search",
    category: "general",
    contentType: "guide",
    description: "How to use the AI-powered Knowledge Base search",
    content: `# Knowledge Base Search

## Semantic Search
The Knowledge Base uses AI to understand your questions and find relevant answers, not just keyword matching.

## How to Search
1. Go to **Knowledge Base → Search**
2. Type your question naturally
3. Example: "How do I escalate a support ticket?"
4. Click Search or press Enter

## Filters
- **Category**: Filter by Sales, Support, Implementation, etc.
- **Language**: Search in specific language
- **Include All Languages**: Cross-language search

## Search Results
Results show:
- Matching document title
- Relevant excerpt
- Category tag
- Relevance score

## Quick Suggestions
Common questions appear as clickable suggestions for quick access.`
  },

  {
    title: "Managing Knowledge Base Documents",
    category: "general",
    contentType: "guide",
    description: "Adding and maintaining KB documentation",
    content: `# Managing Knowledge Base

## Adding Documents
1. Go to **Knowledge Base → Manage Documents**
2. Click "Add Document"
3. Fill in:
   - Title
   - Category (sales, support, implementation, hr, general)
   - Content Type (guide, faq, procedure, policy, troubleshooting)
   - Language
   - Content (the actual documentation)
4. Save

## Re-indexing
After adding/editing documents:
1. Click "Re-index All"
2. Wait for completion
3. New content is now searchable

## Multilingual Support
Documents can be added in 15 languages:
- English, Spanish, French, German
- Chinese, Japanese, Korean
- Hindi, Tamil, Telugu
- Arabic, Russian, Italian, Dutch, Portuguese

## Analytics
View statistics on:
- Total documents
- Search queries
- Popular topics
- Language distribution`
  },

  // Mobile/PWA
  {
    title: "Mobile App Installation",
    category: "general",
    contentType: "guide",
    description: "Installing M-CRM as a mobile app",
    content: `# Installing M-CRM Mobile App

## Android Installation
1. Open Chrome browser on your phone
2. Navigate to the M-CRM website
3. Tap the menu (three dots)
4. Select "Add to Home screen"
5. Tap "Install" when prompted
6. App icon appears on home screen

## iOS Installation
1. Open Safari on your iPhone
2. Navigate to the M-CRM website
3. Tap the Share button
4. Select "Add to Home Screen"
5. Tap "Add"
6. App icon appears on home screen

## Benefits of PWA
- Works offline (basic features)
- Faster than browser access
- Full-screen experience
- Push notifications (when enabled)
- Automatic updates

## Login
Open the installed app and log in with your M-CRM credentials.`
  }
];

async function seedKnowledgeBase() {
  console.log("Starting Knowledge Base seeding...");
  console.log(`Total documents to add: ${crmDocuments.length}`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const doc of crmDocuments) {
    try {
      console.log(`\nProcessing: ${doc.title}`);
      
      // Extract and chunk content
      const extractedText = extractTextFromContent(doc.content, doc.contentType);
      const chunks = chunkText(extractedText);
      
      if (chunks.length === 0) {
        console.log(`  ⚠ Skipping: Content too short`);
        continue;
      }
      
      // Generate embeddings
      const chunkTexts = chunks.map(c => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);
      
      // Create source record
      const groupId = `tg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const [source] = await db.insert(knowledgeBaseSources).values({
        title: doc.title,
        category: doc.category,
        contentType: doc.contentType,
        description: doc.description,
        originalContent: doc.content,
        languageCode: "en",
        translationGroupId: groupId,
        translationStatus: "original",
        isActive: true,
        createdBy: "system",
      }).returning();
      
      // Create chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        await db.insert(knowledgeBaseChunks).values({
          sourceId: source.id,
          chunkIndex: i,
          content: chunks[i].text,
          languageCode: "en",
          tokenCount: estimateTokenCount(chunks[i].text),
          embedding: embeddings[i],
          metadata: {
            startPosition: chunks[i].metadata.startChar,
            endPosition: chunks[i].metadata.endChar,
          },
        });
      }
      
      console.log(`  ✓ Created: ${chunks.length} chunks`);
      successCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error}`);
      errorCount++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Knowledge Base seeding complete!`);
  console.log(`  ✓ Success: ${successCount} documents`);
  console.log(`  ✗ Errors: ${errorCount} documents`);
  console.log(`========================================`);
}

seedKnowledgeBase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
