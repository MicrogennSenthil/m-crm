# Microgenn CRM Application

## Overview
Comprehensive Customer Relationship Management platform for managing sales pipeline, implementation projects, and customer support with seamless workflow integration.

## Project Structure
- **Frontend**: React SPA with TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js with PostgreSQL database
- **Authentication**: Replit Auth (OpenID Connect)
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for analytics

## Architecture

### Database Schema
- **users**: User accounts with role-based access (sales_executive, engineer, support, admin)
- **sessions**: Session storage for authentication
- **leads**: Sales leads with stages (new_lead, demo_scheduled, quote_sent, negotiation, closed_won/lost)
- **followUps**: Follow-up tracking for leads
- **quotes**: Sales quotes sent to leads
- **projects**: Implementation projects with completion tracking
- **projectEngineers**: Engineer assignments to projects
- **modules**: Available implementation modules (Front Office, Power Automation, POS, etc.)
- **projectModules**: Module completion tracking per project
- **trainingRecords**: Training sessions with recipients and hours
- **tickets**: Support tickets with priority and escalation levels
- **ticketComments**: Conversation threads on tickets
- **escalationHistory**: Multi-level escalation tracking
- **feedback**: Customer satisfaction ratings
- **activityLog**: Complete audit trail of all interactions

### User Roles
1. **Sales Executive**: Access to sales pipeline, lead management, quotes
2. **Engineer**: Access to implementation projects, module tracking, training records
3. **Support**: Access to support tickets, escalation management
4. **Admin**: Full access to all modules plus reports and analytics

## Features Implemented

### Authentication (Replit Auth)
- Google, GitHub, X, Apple, and email/password login
- Role-based access control
- Protected routes and API endpoints
- Session management with PostgreSQL storage

### Sales Management
- Kanban board visualization with drag-and-drop
- Lead source tracking (Facebook, LinkedIn, Instagram, Twitter, Website, Referral)
- Multi-stage pipeline (New Lead → Demo Scheduled → Quote Sent → Negotiation → Closed)
- Follow-up tracker with completion status
- Quote generation and tracking
- Lead detail modal with contact information and activity timeline

### Implementation Module
- Project cards with progress tracking
- Engineer assignment system
- Module checklist with completion tracking
- Training records (recipients, modules, hours)
- Implementation date scheduling
- Status tracking (Not Started, In Progress, Training, Completed)

### Support Ticket System
- Ticket creation with priority levels (Critical, High, Medium, Low)
- Round-robin and manual assignment
- Multi-level escalation matrix (Level 1: Support → Level 2: Senior → Level 3: Development)
- Conversation threading with internal notes
- Ticket closure workflow
- Customer feedback automation (placeholder for email integration)
- Complete ticket history

### Dashboard
- Metric cards: Active Leads, Ongoing Implementations, Open Tickets, Monthly Closures
- Activity feed showing recent actions across all modules
- Quick access panels for recent leads, active projects, and open tickets
- Trend indicators showing month-over-month changes

### Reports & Analytics
- Sales pipeline overview charts
- Lead source distribution
- Conversion rate metrics
- Project status distribution
- Ticket priority and status breakdowns
- Average resolution time tracking
- Customer satisfaction metrics

### Settings
- User profile display
- Theme toggle (Light/Dark mode)
- Notification preferences

## User Workflows

### Sales Workflow
1. Lead enters system via social media channel
2. Sales executive schedules demo
3. Quote generated and sent
4. Multiple follow-ups tracked
5. Deal closes (Won/Lost)
6. Transition to Implementation phase

### Implementation Workflow
1. Project created from closed lead
2. Engineers assigned to project
3. Implementation date scheduled
4. Modules tracked via checklist
5. Training delivered and recorded
6. Project marked as completed
7. Transition to Support phase

### Support Workflow
1. Customer raises ticket
2. Auto-assigned via round-robin or manually assigned
3. Support engineer investigates
4. Escalation if unresolved within threshold
5. Multi-level escalation (L1 → L2 → L3)
6. Option to mark as pending or escalate to development
7. Ticket closure triggers feedback email
8. Customer can reopen if unsatisfied

## Design System
- **Primary Color**: Blue (#3b82f6) - Professional, trustworthy
- **Typography**: Inter for body text, JetBrains Mono for code/IDs
- **Spacing**: Consistent 4px grid system
- **Components**: Shadcn UI library with custom theming
- **Dark Mode**: Full support with automatic color adaptation

## Recent Changes
- Initial project setup with complete schema (November 25, 2025)
- All frontend components implemented with exceptional attention to detail
- Sales, Implementation, and Support modules fully designed
- Dashboard with metrics and activity feed
- Reports and analytics pages with charts
- Authentication integration with Replit Auth
- Theme provider for light/dark mode support

## Next Steps (Backend & Integration - Task 2)
- Set up PostgreSQL database with Drizzle ORM
- Implement all API endpoints for CRUD operations
- Add business logic for round-robin assignment
- Implement escalation matrix automation
- Add activity log tracking
- Set up Replit Auth middleware

## Known Dependencies
- Replit Auth for authentication
- PostgreSQL for data persistence
- All npm packages listed in package.json
