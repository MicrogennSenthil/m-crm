# Microgenn CRM Design Guidelines

## Design Approach: Enterprise Application System

**Selected Framework**: Material Design 3 for web applications
**Rationale**: CRM requires information density, clear data hierarchy, and efficient workflows. Material Design provides robust patterns for tables, forms, and complex data visualization while maintaining visual polish.

**Key Design Principles**:
- Clarity over decoration: Every element serves workflow efficiency
- Consistent patterns: Users should learn once, apply everywhere
- Data-first hierarchy: Information visibility drives all layout decisions

---

## Core Design Elements

### Typography
- **Primary Font**: Inter (via Google Fonts CDN)
- **Headings**: 
  - H1: 32px/Bold (Page titles, Dashboard headers)
  - H2: 24px/Semibold (Section headers, Module titles)
  - H3: 18px/Semibold (Card headers, Table sections)
- **Body Text**:
  - Primary: 14px/Regular (Data entries, descriptions)
  - Secondary: 13px/Regular (Meta information, timestamps)
  - Small: 12px/Regular (Labels, helper text)
- **Monospace**: JetBrains Mono for ticket IDs, timestamps, system data

### Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-6
- Card spacing: p-6 for content cards
- Form field spacing: space-y-4
- Dashboard grid gaps: gap-6

**Grid Structure**:
- Main dashboard: 12-column grid (grid-cols-12)
- Two-column forms: grid-cols-1 md:grid-cols-2
- Stat cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Table layouts: Full-width with horizontal scroll on mobile

---

## Application Structure

### Navigation Architecture
**Top Navigation Bar** (fixed, sticky):
- Logo/branding (left)
- Global search bar (center-left, expandable)
- Quick actions: Create Ticket, Add Lead, Schedule Demo (center-right)
- Notifications bell with badge count
- User profile dropdown (right)

**Left Sidebar** (collapsible):
- Dashboard (home icon)
- Sales Pipeline (trending-up icon)
- Implementations (tools icon)
- Support Tickets (headphones icon)
- Reports & Analytics (chart icon)
- Settings (gear icon)
- Role-based visibility: Show/hide sections based on user permissions

### Dashboard Layout
**Hero Stats Section** (top):
- 4-column grid of metric cards showing: Active Leads, Ongoing Implementations, Open Tickets, This Month's Closures
- Each card: Large number (32px), label below (14px), trend indicator (up/down arrow with percentage)

**Activity Feed** (left, 2/3 width):
- Timeline view of recent actions across all modules
- Mixed content: New leads, demo scheduled, tickets opened, implementations completed
- Each item: Icon, timestamp, description, assigned user, quick action button

**Quick Actions Panel** (right, 1/3 width):
- Upcoming demos calendar widget
- Escalated tickets requiring attention
- Training sessions due this week

---

## Module-Specific Components

### Sales Pipeline View
**Kanban Board Layout**:
- 5 columns: New Leads, Demo Scheduled, Quote Sent, Negotiation, Closed
- Drag-and-drop cards with: Company name, contact person, value, sales executive, days in stage
- Filter bar above: Date range, sales executive, lead source (social channel)

**Lead Detail Modal**:
- Split view: Left (contact info, company details), Right (activity timeline)
- Action buttons prominently displayed: Schedule Demo, Create Quote, Add Follow-up
- Follow-up tracker showing all touchpoints with dates and notes

### Implementation Module
**Project Cards Grid**:
- 3-column layout on desktop
- Each card shows: Client name, assigned engineers (avatars), implementation date, progress bar, modules checklist
- Status badges: Not Started, In Progress, Training, Completed

**Module Checklist Component**:
- Expandable accordion showing all modules (Front Office, Power Automation, POS, etc.)
- Checkboxes with completion status
- Training hours input field per module
- Training recipient tags (multiple people possible)

### Support Ticket System
**Ticket List Table**:
- Columns: Ticket ID, Customer, Issue Summary, Priority, Assigned Engineer, Status, Age, Actions
- Color-coded priority badges: Critical (red), High (orange), Medium (yellow), Low (blue)
- Sortable columns and advanced filters

**Ticket Detail View**:
- Top section: Ticket metadata (customer, creation date, current assignee, escalation level)
- Center: Issue description and conversation thread
- Right sidebar: Escalation matrix timeline, customer history, related tickets
- Action buttons: Assign, Escalate, Mark Pending, Close Ticket
- Escalation indicator: Visual timeline showing levels and time remaining before auto-escalation

**Escalation Matrix Visualization**:
- Horizontal timeline showing: Level 1 (Support Engineer) → Level 2 (Senior Support) → Level 3 (Development Team)
- Each level shows: Time threshold, current timer, responsible party
- Visual warning states when approaching escalation deadline

---

## Component Library

### Data Display
- **Tables**: Striped rows, hover highlighting, sticky header, pagination at bottom
- **Cards**: Elevated shadow, rounded corners (rounded-lg), consistent padding
- **Badges**: Pill-shaped status indicators with semantic colors
- **Progress Bars**: Thin (h-2), rounded, showing completion percentage
- **Timeline**: Vertical connector line with circular nodes for events

### Forms & Inputs
- **Input Fields**: Full-width with floating labels, clear validation states
- **Dropdowns**: Searchable select for engineer assignment, customer selection
- **Date Pickers**: Calendar popover for demo scheduling, implementation dates
- **Rich Text Editor**: For ticket descriptions, follow-up notes
- **File Upload**: Drag-and-drop zone for quotes, training materials

### Interactive Elements
- **Primary Buttons**: Solid fill, medium size (px-6 py-2.5), rounded-md
- **Secondary Buttons**: Outlined variant
- **Icon Buttons**: Circular for quick actions in tables
- **Action Menus**: Three-dot overflow menu for row actions

### Feedback Components
- **Toast Notifications**: Top-right corner for success/error messages
- **Confirmation Modals**: For destructive actions (close ticket, delete lead)
- **Loading States**: Skeleton screens for data tables, spinner for actions
- **Empty States**: Illustrations with call-to-action for empty lists

---

## Icons
**Library**: Heroicons via CDN (outline style for navigation, solid for emphasis)

---

## Critical Features

### Customer History Tracking
- Dedicated "Customer 360" view accessible from any module
- Unified timeline showing all interactions: Sales calls, demos, implementations, support tickets
- Searchable and filterable by date range, interaction type
- Export capability for reporting

### Feedback Email System
- Automated email trigger on ticket closure
- Email template preview before sending
- Satisfaction rating capture (1-5 stars)
- Reopen ticket button directly in email if customer unsatisfied

### Role-Based Dashboards
- **Sales Executive**: Pipeline view, demo calendar, quote tracker
- **Implementation Engineer**: Assigned projects, training schedule, module completion
- **Support Engineer**: Ticket queue, escalation alerts, customer history
- **Admin**: Team workload distribution, performance metrics, system settings

---

## Responsive Behavior
- Desktop (lg): Full multi-column layouts, expanded sidebar
- Tablet (md): Condensed sidebar to icons-only, 2-column grids become single
- Mobile: Bottom navigation bar, stacked layouts, swipe-enabled kanban cards

---

## Performance & Polish
- Lazy load ticket history and long lists
- Optimistic UI updates for status changes
- Real-time updates for ticket assignments using WebSocket indicators
- Keyboard shortcuts for power users (Cmd+K for search, N for new ticket)
- Minimal animations: Smooth transitions for modals (200ms), subtle hover states only