# M-CRM Application

## Overview
M-CRM is a comprehensive Customer Relationship Management platform designed to streamline sales pipeline management, implementation projects, and customer support. It integrates core business workflows within an enterprise-grade application, offering a complete overview of the customer lifecycle from lead generation to ongoing support. Key capabilities include lead tracking, project management, multi-level support ticket handling, and detailed analytics, positioning it as a scalable solution for efficient customer interaction management. The project aims to be a robust, production-ready solution built with Material Design 3 principles.

## User Preferences
I prefer an iterative development approach where we focus on one module or feature at a time, ensuring it's robust before moving on. Please provide detailed explanations for any significant changes or architectural decisions. I like to review the plan before implementation, especially for database schema modifications or new API endpoints. Do not make changes to the existing UI color scheme or typography without explicit approval.

## System Architecture

### UI/UX Decisions
The application adheres to Material Design 3 principles, using navy blue (`#1a2b6d`) as the primary color and golden yellow (`#f5a623`) as the accent. Inter and JetBrains Mono typefaces are used for body text and code, respectively. Shadcn UI components, themed to Material Design 3, are used for the interface, supporting full dark mode. Accessibility is maintained through semantic HTML and ARIA labels.

### Technical Implementations
M-CRM is a full-stack application. The **frontend** uses React 18, TypeScript, Tailwind CSS, and Shadcn UI. State management is handled by TanStack React Query, form management by React Hook Form with Zod, and data visualization by Recharts. The **backend** is an Express.js application interacting with PostgreSQL via Drizzle ORM. Authentication is managed through Replit Auth (OpenID Connect) with role-based access control.

### Feature Specifications
The CRM includes:
-   **Authentication**: Replit Auth with various providers and role-based access (Sales Executive, Engineer, Support, Admin).
-   **Sales Management**: Kanban board for leads, tracking, follow-ups, and quote management.
-   **Sales Planning & Performance**: Weekly stage-wise target setting, monthly goals, daily achievement tracking with graphs, run-rate prediction analytics, and team comparison for department heads/admins. Includes sales executive identification badges for hierarchical visibility.
-   **Implementation Module**: Project cards with progress tracking, multi-engineer assignment, 8-module checklist, and training record logging.
-   **Support Ticket System**: Priority-based ticket creation, assignment, multi-level escalation, conversation threading, and status management. Includes ticket assignment history tracking for all engineers who worked on a ticket.
-   **HR Feedback Management**: Enhanced feedback collection with work completion details, call history timeline showing all engineers who worked on the ticket, client contact tracking, and Level 2 reopen capability for unsatisfied customers.
-   **Task/Followup Management**: Comprehensive task management with multimedia attachments, reminders, due dates, team mentions, and commenting.
-   **Dashboard & Analytics**: Metric cards, activity feed, quick access panels, and trend indicators. Includes Sales Stage Analytics with weekly/monthly stage-wise comparison using bar charts, line charts, pie charts, and statistical tables with trend indicators.
-   **Reports & Analytics**: Sales, Implementation, and Support reports with filtering, export (CSV/Excel), and email functionality (Resend).
-   **Settings & Customization**: User profiles and light/dark mode toggle.
-   **Master Data Management (Admin Only)**: CRUD for customer records and implementation modules.
-   **User Management (Admin Only)**: Comprehensive user administration including user master, role master, rights allocation, and approval workflows.
-   **Knowledge Base (Multilingual)**: AI-powered semantic search documentation with pgvector, supporting 15 languages and cross-language search.
-   **Development Module**: Work assignment system for developers integrated with Support, Implementation, and Tasks. Features include task tracking, penalty points for missed deadlines, and attachment viewing.
-   **Contract Management Module**: Track customer contracts, renewals, payment follow-ups, with configurable contract types, billing frequencies, and email integration for reminders.

### System Design Choices
The database schema comprises 14 tables. Core business logic includes round-robin assignment for support tickets, a three-tier escalation matrix, activity logging, and Zod validation. Error handling uses toast notifications, and optimistic updates enhance UI responsiveness. Email automation is integrated using Resend for various communications. The application is optimized for mobile responsiveness.

### Security Architecture
-   **Authorization Middleware**: `isAdmin` and `requirePermission(moduleName, action)` middlewares enforce role-based and module-level permissions.
-   **Dual Role System Support**: Seamless integration for both new users (via `user_role_assignments`) and legacy users (via `users.role`).
-   **Super Admin**: `senthil@microgenn.com` has full system access.
-   **Frontend Permission Hook**: `usePermissions` hook provides UI permission gating.
-   **Multiple Department Heads**: Departments can have multiple heads via `departmentHeads` junction table with many-to-many relationship. Authorization checks use `/api/auth/is-department-head` API and `storage.getDepartmentsByHead()` method. Legacy `managerId` field retained as fallback for data migration.

## External Dependencies
-   **Authentication**: Replit Auth (OpenID Connect)
-   **Database**: PostgreSQL with pgvector extension (via Drizzle ORM)
-   **AI/Embeddings**: OpenAI text-embedding-3-small
-   **Email Service**: SMTP (Gmail/Custom) or Resend
-   **UI Components**: Shadcn UI (built on Radix UI)
-   **Icons**: Lucide React
-   **Hosting**: Replit (development) / Hostinger VPS (production)

## VPS Deployment Notes
-   **VPS path**: `/var/www/m-crm`
-   **PM2 app name**: `mcrm`, **Port**: `5050`
-   **Database**: `mcrm_db`, user: `mcrm_user`
-   **Nginx**: proxies `crm.microgenn.com` → port 5050
-   **PM2 config**: `ecosystem.config.cjs` with env vars inline (not .env file)
-   **DATABASE_URL** includes `?sslmode=disable` (local PostgreSQL, no SSL)
-   **Git remote on VPS**: `origin` → `git@github-mcrm:MicrogennSenthil/m-crm.git`
-   **Deploy steps**: `git pull origin main` → apply DB migrations → `npm run build` → `fuser -k 5050/tcp && pm2 delete mcrm && pm2 start ecosystem.config.cjs && pm2 save`
-   **DB migrations on VPS**: Run SQL directly via `sudo -u postgres psql -d mcrm_db -c "..."` (no drizzle push needed if column already applied)
-   **Super admin**: `senthil@microgenn.com`
-   **IMPORTANT — Multiple apps on same VPS**: Other apps (irm-backend, infantinteriors.in, srijayamhall.com, etc.) run on same server. Always scope commands to M-CRM only:
    -   File changes: only inside `/var/www/m-crm/`
    -   PM2: only `pm2 restart mcrm` / `pm2 delete mcrm` — NEVER `pm2 restart all`
    -   Port: only `fuser -k 5050/tcp` — NEVER other ports
    -   Nginx: only edit `/etc/nginx/sites-available/mcrm` — NEVER global nginx.conf or other site configs
    -   Database: only `mcrm_db` — NEVER touch other databases

## Recent Changes (March 5, 2026)
-   **Lead creation error handling**: Server returns actual Zod/DB error messages; frontend shows specific reason in toast; PLANNING_REQUIRED (403) redirects to Sales Planning
-   **Custom lead source**: Added `custom_lead_source` column to leads table; selecting "Other" as lead source shows a "Specify Source" text input; custom source shown in badges, filters, reports export, and task-to-lead conversion form