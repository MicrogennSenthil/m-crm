import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, ArrowUpDown, ChevronRight, Zap, Columns3, LayoutGrid, List, Bell, Volume2, VolumeX, Calendar as CalendarIcon, Filter } from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { useVoiceAlerts } from "@/providers/VoiceAlertProvider";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TicketForm } from "@/components/ticket-form";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import { DatePickerCompact } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Ticket } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const PRIORITY_CONFIG: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  critical: { variant: "destructive", label: "Critical" },
  high: { variant: "default", label: "High", className: "bg-orange-600" },
  medium: { variant: "secondary", label: "Medium" },
  low: { variant: "outline", label: "Low" },
};

const STATUS_CONFIG: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  open: { variant: "default", label: "Open" },
  in_progress: { variant: "secondary", label: "In Progress" },
  in_development: { variant: "secondary", label: "In Development", className: "bg-purple-600/20 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  pending_customer: { variant: "outline", label: "Pending Customer" },
  escalated: { variant: "destructive", label: "Escalated" },
  closed: { variant: "outline", label: "Closed", className: "bg-green-600/10 text-green-700" },
  development: { variant: "secondary", label: "Development", className: "bg-purple-600/20 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
};

const TICKET_STAGES = [
  { id: "followup_due", title: "Follow-up Due", color: "bg-amber-600" },
  { id: "open", title: "Open", color: "bg-blue-600" },
  { id: "in_progress", title: "In Progress", color: "bg-yellow-600" },
  { id: "in_development", title: "In Development", color: "bg-purple-600" },
  { id: "pending_customer", title: "Pending Customer", color: "bg-orange-500" },
  { id: "escalated", title: "Escalated", color: "bg-red-600" },
  { id: "closed", title: "Closed", color: "bg-green-600" },
];

type LayoutType = "kanban" | "card" | "table";

// Helper to get display status config (shows "Development" if ticket has active dev task)
const getDisplayStatusConfig = (ticket: any) => {
  if (ticket.hasActiveDevelopmentTask) {
    return STATUS_CONFIG.development;
  }
  return STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
};

export default function Support() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [sortOrder, setSortOrder] = useState<string>("status");
  const [categoryTab, setCategoryTab] = useState<string>("all"); // all, support or development
  const [activeTab, setActiveTab] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [asOnDate, setAsOnDate] = useState<Date | undefined>(undefined);
  const [dateFilterMode, setDateFilterMode] = useState<"range" | "asOn">("range");
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [layout, setLayout] = useState<LayoutType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("support-layout") as LayoutType) || "table";
    }
    return "table";
  });
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  // Voice alerts for support department
  const {
    alerts: voiceAlerts,
    alertCounts,
    isEnabled: voiceAlertsEnabled,
    isSpeaking,
    isSupported: voiceSupported,
    announceAllPending,
    stopSpeaking,
  } = useVoiceAlerts('support');

  useEffect(() => {
    localStorage.setItem("support-layout", layout);
  }, [layout]);

  const getTicketsByStatus = (status: string) => {
    const todayStr = new Date().toDateString();
    const RESOLVED = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
    
    // Special handling for followup_due stage - show tickets with reminder due today
    if (status === "followup_due") {
      return categoryFilteredTickets?.filter(t => 
        t.reminderDate && 
        new Date(t.reminderDate).toDateString() === todayStr && 
        !RESOLVED.includes(t.status)
      ) || [];
    }
    
    // For in_development, check hasActiveDevelopmentTask
    if (status === "in_development") {
      return categoryFilteredTickets?.filter(t => 
        (t as any).hasActiveDevelopmentTask && 
        !RESOLVED.includes(t.status) &&
        !(t.reminderDate && new Date(t.reminderDate).toDateString() === todayStr)
      ) || [];
    }
    
    // For other stages, exclude tickets that have reminders due today (they go to followup_due)
    return categoryFilteredTickets?.filter(t => {
      // Skip if has reminder due today (goes to followup_due stage)
      if (t.reminderDate && new Date(t.reminderDate).toDateString() === todayStr && !RESOLVED.includes(t.status)) {
        return false;
      }
      // Skip if has active dev task and status is not in_development (those go to in_development stage)
      if ((t as any).hasActiveDevelopmentTask && status !== "in_development" && !RESOLVED.includes(status)) {
        return false;
      }
      return t.status === status;
    }) || [];
  };

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  // Fetch support-assignable employees for filtering
  const { data: supportEmployees } = useQuery<any[]>({
    queryKey: ["/api/users/support-assignable"],
  });

  // Resolved statuses for counting completed tickets
  const RESOLVED_STATUSES = ['closed', 'resolved', 'resolved_at_techteam', 'pending_feedback'];
  
  // Helper to check if ticket is in development (level 3 OR has active development task)
  const isDevelopmentTicket = (t: any) => t.escalationLevel === 3 || t.hasActiveDevelopmentTask;
  
  // Filter tickets by category first (Support = level 1-2 with no dev task, Development = level 3 OR has active dev task)
  const categoryFilteredTickets = tickets?.filter(t => {
    if (categoryTab === "support") return !isDevelopmentTicket(t);
    if (categoryTab === "development") return isDevelopmentTicket(t);
    return true;
  }) || [];

  // Category counts
  const supportCount = tickets?.filter(t => !isDevelopmentTicket(t)).length || 0;
  const developmentCount = tickets?.filter(t => isDevelopmentTicket(t)).length || 0;
  
  // Calculate counts for status tabs (based on category-filtered tickets)
  const allCount = categoryFilteredTickets.length;
  const openCount = categoryFilteredTickets.filter(t => t.status === "open").length;
  const inProgressCount = categoryFilteredTickets.filter(t => t.status === "in_progress" || t.status === "escalated" || t.status === "pending_customer").length;
  const completedCount = categoryFilteredTickets.filter(t => RESOLVED_STATUSES.includes(t.status)).length;
  // Reminders due today - tickets with reminder date matching today
  const today = new Date().toDateString();
  const remindersDueCount = categoryFilteredTickets.filter(t => 
    t.reminderDate && new Date(t.reminderDate).toDateString() === today && !RESOLVED_STATUSES.includes(t.status)
  ).length;

  // Status order for sorting: in_progress first, then open, then others, closed last
  const STATUS_ORDER: Record<string, number> = {
    in_progress: 0,
    open: 1,
    escalated: 2,
    pending_customer: 3,
    resolved: 4,
    closed: 5,
  };

  // Calculate age helper - defined before use
  const calculateAge = (createdAt: Date | string) => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: false });
  };

  const filteredTickets = categoryFilteredTickets.filter((ticket) => {
    // Tab filtering
    if (activeTab === "open" && ticket.status !== "open") return false;
    if (activeTab === "in_progress" && !["in_progress", "escalated", "pending_customer"].includes(ticket.status)) return false;
    if (activeTab === "completed" && !RESOLVED_STATUSES.includes(ticket.status)) return false;
    if (activeTab === "reminders_due" && (!ticket.reminderDate || new Date(ticket.reminderDate).toDateString() !== today || RESOLVED_STATUSES.includes(ticket.status))) return false;
    
    // Date filtering
    if (ticket.createdAt) {
      const ticketDate = new Date(ticket.createdAt);
      
      if (dateFilterMode === "asOn" && asOnDate) {
        // "As On Date" - show tickets created on or before this date
        if (ticketDate > endOfDay(asOnDate)) return false;
      } else if (dateFilterMode === "range") {
        // Date range filtering
        if (fromDate && ticketDate < startOfDay(fromDate)) return false;
        if (toDate && ticketDate > endOfDay(toDate)) return false;
      }
    }
    
    // Employee filtering
    if (selectedEmployee !== "all") {
      if (ticket.assignedTo !== parseInt(selectedEmployee)) return false;
    }
    
    // Search filtering
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const priorityLabel = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG]?.label?.toLowerCase() || ticket.priority?.toLowerCase();
    const statusLabel = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]?.label?.toLowerCase() || ticket.status?.toLowerCase();
    const escalationLabel = `l${ticket.escalationLevel}`;
    const ageText = ticket.createdAt ? calculateAge(ticket.createdAt).toLowerCase() : "";
    
    return (
      ticket.ticketNumber.toLowerCase().includes(query) ||
      ticket.customerName.toLowerCase().includes(query) ||
      ticket.issueSummary.toLowerCase().includes(query) ||
      priorityLabel.includes(query) ||
      statusLabel.includes(query) ||
      escalationLabel.includes(query) ||
      ageText.includes(query)
    );
  });

  // Sort tickets based on selected sort order
  const sortedTickets = [...(filteredTickets || [])].sort((a, b) => {
    switch (sortOrder) {
      case "status":
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      case "priority":
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      case "newest":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case "oldest":
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case "ticket_id":
        return a.ticketNumber.localeCompare(b.ticketNumber);
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track customer support requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          {voiceSupported && voiceAlertsEnabled && (
            <Button
              variant={isSpeaking ? "destructive" : "outline"}
              size="icon"
              onClick={() => isSpeaking ? stopSpeaking() : announceAllPending()}
              title={isSpeaking ? "Stop speaking" : `Voice alerts (${alertCounts.total} pending)`}
              data-testid="button-voice-alerts"
            >
              {isSpeaking ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <div className="relative">
                  <Volume2 className="h-4 w-4" />
                  {alertCounts.total > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {alertCounts.total > 9 ? "9+" : alertCounts.total}
                    </span>
                  )}
                </div>
              )}
            </Button>
          )}
          <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-ticket" className="min-h-[44px] w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Log a new customer support request
              </DialogDescription>
            </DialogHeader>
            <TicketForm onSuccess={() => setNewTicketOpen(false)} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Category Tabs - All, Support, Development */}
      <Tabs value={categoryTab} onValueChange={(val) => { setCategoryTab(val); setActiveTab("all"); }} className="space-y-4">
        <TabsList className="flex-wrap" data-testid="tabs-category">
          <TabsTrigger value="all" data-testid="tab-all-categories">
            All ({tickets?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support">
            Support ({supportCount})
          </TabsTrigger>
          <TabsTrigger value="development" data-testid="tab-development">
            Development ({developmentCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={categoryTab} className="space-y-4">
          {/* Status Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex-wrap" data-testid="tabs-status">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({allCount})
              </TabsTrigger>
              <TabsTrigger value="open" data-testid="tab-open">
                Open ({openCount})
              </TabsTrigger>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress">
                In Progress ({inProgressCount})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                Completed ({completedCount})
              </TabsTrigger>
              {remindersDueCount > 0 && (
                <TabsTrigger 
                  value="reminders_due" 
                  data-testid="tab-reminders-due"
                  className="text-amber-600 dark:text-amber-400"
                >
                  <Bell className="h-3 w-3 mr-1" />
                  Follow-up Today ({remindersDueCount})
                </TabsTrigger>
              )}
            </TabsList>

        {/* Date Filters */}
        <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-md border">
          <div className="flex items-center gap-2">
            <Button
              variant={dateFilterMode === "range" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilterMode("range");
                setAsOnDate(undefined);
              }}
              data-testid="button-date-range-mode"
            >
              Date Range
            </Button>
            <Button
              variant={dateFilterMode === "asOn" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilterMode("asOn");
                setFromDate(undefined);
                setToDate(undefined);
              }}
              data-testid="button-as-on-mode"
            >
              As On Date
            </Button>
          </div>
          
          {dateFilterMode === "range" ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <DatePickerCompact
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <DatePickerCompact
                  value={toDate}
                  onChange={setToDate}
                  placeholder="End date"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">As On Date</Label>
              <DatePickerCompact
                value={asOnDate}
                onChange={setAsOnDate}
                placeholder="Select date"
              />
            </div>
          )}
          
          {(fromDate || toDate || asOnDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromDate(undefined);
                setToDate(undefined);
                setAsOnDate(undefined);
              }}
              data-testid="button-clear-date-filters"
            >
              Clear Dates
            </Button>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Assigned To</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px] min-h-[36px]" data-testid="select-employee-filter">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {supportEmployees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.firstName} {emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedEmployee !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEmployee("all")}
              data-testid="button-clear-employee-filter"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
              data-testid="input-search-tickets"
            />
          </div>
          <div className="flex border rounded-md">
            <Button 
              variant={layout === "kanban" ? "secondary" : "ghost"} 
              size="icon" 
              className="min-h-[44px] min-w-[44px] rounded-r-none"
              onClick={() => setLayout("kanban")}
              title="Kanban View"
              data-testid="button-layout-kanban"
            >
              <Columns3 className="h-4 w-4" />
            </Button>
            <Button 
              variant={layout === "card" ? "secondary" : "ghost"} 
              size="icon" 
              className="min-h-[44px] min-w-[44px] rounded-none border-x"
              onClick={() => setLayout("card")}
              title="Card View"
              data-testid="button-layout-card"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={layout === "table" ? "secondary" : "ghost"} 
              size="icon" 
              className="min-h-[44px] min-w-[44px] rounded-l-none"
              onClick={() => setLayout("table")}
              title="Table View"
              data-testid="button-layout-table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]" data-testid="select-sort-order">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">By Status</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="ticket_id">By Ticket ID</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Kanban View */}
          {layout === "kanban" && (
            <div className="grid grid-cols-7 gap-3 pb-4 overflow-x-auto">
              {TICKET_STAGES.map((stage) => {
                const stageTickets = getTicketsByStatus(stage.id);
                return (
                  <div key={stage.id} className="min-w-[180px]">
                    <div className="mb-2 flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`} />
                      <h3 className="font-semibold text-xs sm:text-sm truncate">{stage.title}</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {stageTickets.length}
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                      {isLoading ? (
                        Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                      ) : stageTickets.length > 0 ? (
                        stageTickets.map((ticket) => {
                          const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                          return (
                            <Card
                              key={ticket.id}
                              className="hover-elevate cursor-pointer"
                              onClick={() => setSelectedTicket(ticket)}
                              data-testid={`card-ticket-kanban-${ticket.id}`}
                            >
                              <CardContent className="p-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                                  <Badge variant={priorityConfig.variant} className={`${priorityConfig.className} text-xs`}>
                                    {priorityConfig.label}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium leading-tight line-clamp-1">{ticket.customerName}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{ticket.issueSummary}</p>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs">L{ticket.escalationLevel}</Badge>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {ticket.createdAt && calculateAge(ticket.createdAt)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          No tickets
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Card View */}
          {layout === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : sortedTickets && sortedTickets.length > 0 ? (
                sortedTickets.map((ticket) => {
                  const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                  const statusConfig = getDisplayStatusConfig(ticket);
                  const isAutoAssigned = (ticket as any).assignmentMethod === "auto";
                  return (
                    <Card
                      key={ticket.id}
                      className={`hover-elevate cursor-pointer ${isAutoAssigned ? 'auto-assigned-ticket' : ''}`}
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`card-ticket-${ticket.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{ticket.ticketNumber}</span>
                            {isAutoAssigned && (
                              <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>
                        <h3 className="font-medium text-sm mb-1 leading-tight">{ticket.customerName}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{ticket.issueSummary}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                            {priorityConfig.label}
                          </Badge>
                          <Badge variant={statusConfig.variant} className={statusConfig.className}>
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline">L{ticket.escalationLevel}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {ticket.createdAt && calculateAge(ticket.createdAt)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">No tickets found</p>
                    <Button onClick={() => setNewTicketOpen(true)} className="min-h-[44px]">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Ticket
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Table View - Mobile Card View */}
          {layout === "table" && (
            <>
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array(5)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))
        ) : sortedTickets && sortedTickets.length > 0 ? (
          sortedTickets.map((ticket) => {
            const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
            const statusConfig = getDisplayStatusConfig(ticket);
            const isAutoAssigned = (ticket as any).assignmentMethod === "auto";
            return (
              <Card
                key={ticket.id}
                className={`hover-elevate active-elevate-2 cursor-pointer touch-manipulation ${isAutoAssigned ? 'auto-assigned-ticket' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{ticket.ticketNumber}</span>
                      {isAutoAssigned && (
                        <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Auto
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <h3 className="font-medium text-sm mb-1 leading-tight">{ticket.customerName}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{ticket.issueSummary}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryTab === "all" && (
                      <Badge 
                        variant="outline" 
                        className={isDevelopmentTicket(ticket) 
                          ? "bg-purple-600/20 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" 
                          : "bg-blue-600/20 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        }
                      >
                        {isDevelopmentTicket(ticket) ? "Development" : "Support"}
                      </Badge>
                    )}
                    <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                      {priorityConfig.label}
                    </Badge>
                    <Badge variant={statusConfig.variant} className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                    <Badge variant="outline">L{ticket.escalationLevel}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {ticket.createdAt && calculateAge(ticket.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No tickets found</p>
              <Button onClick={() => setNewTicketOpen(true)} className="min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Create First Ticket
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  Ticket ID
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {categoryTab === "all" && <TableHead>Source</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Issue Summary</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Escalation Level</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
            ) : sortedTickets && sortedTickets.length > 0 ? (
              paginateData(sortedTickets).map((ticket) => {
                const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                const statusConfig = getDisplayStatusConfig(ticket);
                const isAutoAssigned = (ticket as any).assignmentMethod === "auto";
                return (
                  <TableRow
                    key={ticket.id}
                    className={`cursor-pointer hover-elevate ${isAutoAssigned ? 'auto-assigned-row' : ''}`}
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`row-ticket-${ticket.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {ticket.ticketNumber}
                        {isAutoAssigned && (
                          <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {categoryTab === "all" && (
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={isDevelopmentTicket(ticket) 
                            ? "bg-purple-600/20 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" 
                            : "bg-blue-600/20 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                          }
                        >
                          {isDevelopmentTicket(ticket) ? "Development" : "Support"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>{ticket.customerName}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.issueSummary}</TableCell>
                    <TableCell>
                      <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                        {priorityConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">L{ticket.escalationLevel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ticket.createdAt && calculateAge(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(ticket);
                        }}
                        data-testid={`button-view-ticket-${ticket.id}`}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <p className="text-muted-foreground mb-4">No tickets found</p>
                  <Button onClick={() => setNewTicketOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Ticket
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {sortedTickets && sortedTickets.length > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={getTotalPages(sortedTickets.length)}
            pageSize={pageSize}
            totalItems={sortedTickets.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
            </>
          )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
