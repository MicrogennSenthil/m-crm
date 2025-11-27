# Microgenn CRM Application

## Overview
Microgenn is a comprehensive Customer Relationship Management platform designed to streamline sales pipeline management, implementation projects, and customer support. It aims to integrate these core business workflows seamlessly within an enterprise-grade application. The project vision is to provide a robust, production-ready solution built with Material Design 3 principles, offering a complete overview of the customer lifecycle from lead generation to ongoing support. Its capabilities include lead tracking, project management, multi-level support ticket handling, and detailed analytics, positioning it as a scalable tool for businesses to manage customer interactions efficiently.

## User Preferences
I prefer an iterative development approach where we focus on one module or feature at a time, ensuring it's robust before moving on. Please provide detailed explanations for any significant changes or architectural decisions. I like to review the plan before implementation, especially for database schema modifications or new API endpoints. Do not make changes to the existing UI color scheme or typography without explicit approval.

## System Architecture

### UI/UX Decisions
The application adheres to Material Design 3 principles, utilizing the official Microgenn branding. The primary color is navy blue (`#1a2b6d` / HSL: 228, 65%, 26%) with golden yellow (`#f5a623` / HSL: 42, 92%, 55%) as the accent color for highlights and interactive elements. The Inter typeface is used for body text and JetBrains Mono for code/IDs. A consistent 4px grid system ensures harmonious spacing. The sidebar features the Microgenn logo with a navy blue background and light text for contrast. Shadcn UI components, themed to Material Design 3, are used for the interface, supporting full dark mode with automatic color adaptation. Interactions include clear hover and active states with smooth transitions, and accessibility is maintained through semantic HTML and ARIA labels.

### Technical Implementations
The system is a full-stack application. The **frontend** is built with React 18 and TypeScript, styled with Tailwind CSS and Shadcn UI. State management is handled by TanStack React Query, featuring optimistic updates. React Hook Form with Zod validation manages forms, while Recharts is used for data visualization. Wouter provides SPA navigation. The **backend** is an Express.js application interacting with a PostgreSQL database via Drizzle ORM. Authentication is managed through Replit Auth (OpenID Connect), supporting various providers and ensuring role-based access control. The backend exposes over 40 API endpoints for various modules.

### Feature Specifications
The CRM includes:
- **Authentication**: Replit Auth integration with Google, GitHub, X, Apple, and email/password, supporting role-based access (Sales Executive, Engineer, Support, Admin) and protected routes.
- **Sales Management**: Kanban board for lead visualization (5 stages), lead tracking by source, follow-up system, quote management, and sales executive assignment.
- **Implementation Module**: Project cards with progress tracking, multi-engineer assignment, 8-module checklist (Front Office, Power Automation, POS, Inventory, HR & Payroll, Accounting, CRM Integration, Reporting), training record logging, and project status tracking. New projects automatically initialize all 8 module records atomically.
- **Support Ticket System**: Priority-based ticket creation (TKT-XXXXXX auto-numbering), round-robin or manual assignment, multi-level escalation (L1 → L2 → L3), conversation threading, status management, and ticket closure workflow with feedback.
- **Task/Followup Management**: Complete task management with voice recording, video recording (camera capture), photo capture, file attachments, reminder date/time, due date/time, status tracking (pending/followup/get_information/completed), team member mentions, task assignment with assignment timestamp tracking, commenting system, and super admin oversight. Tasks display dates with full time information.
- **Dashboard & Analytics**: Metric cards (Active Leads, Ongoing Implementations, Open Tickets, Monthly Closures), activity feed, quick access panels, My Tasks section, and trend indicators.
- **Reports & Analytics**: Enhanced reports module with collapsible sidebar menu and three dedicated report pages:
  - **Sales Reports** (/reports/sales): Fresh/Pending/Completed calls tabs, date range filtering, customer/status filters, stage-based stats cards
  - **Implementation Reports** (/reports/implementation): Planning/In Progress/Completed tabs, project status tracking
  - **Support Reports** (/reports/support): Open/In Progress/Resolved tabs, priority filtering, ticket metrics
  - All reports include: export to CSV/Excel functionality, send via email (using Resend), search, and comprehensive filtering
- **Settings & Customization**: User profile display, light/dark mode toggle, and placeholder for notification preferences.
- **Master Data Management (Admin Only)**: CRUD operations for customer records and implementation modules via a tabbed interface.

### System Design Choices
The database schema consists of 14 tables, including `users` (with role-based access), `leads`, `projects`, `tickets`, `quotes`, `followUps`, and `trainingRecords`, among others, providing a comprehensive data model for the CRM. Core business logic includes round-robin assignment for support tickets, a three-tier escalation matrix, comprehensive activity logging for audit trails, and robust validation using Zod on both frontend and backend. Error handling is graceful with toast notifications, and optimistic updates enhance UI responsiveness. Email automation is integrated using Resend for quote emails, ticket closure feedback, training confirmations, and welcome emails for new users. The application is also optimized for mobile responsiveness across various viewports.

## External Dependencies
- **Authentication**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (via Drizzle ORM)
- **Email Service**: Resend
- **UI Components**: Shadcn UI (built on Radix UI)
- **Icons**: Lucide React
- **Hosting**: Replit (implicitly for environment variables and project setup)