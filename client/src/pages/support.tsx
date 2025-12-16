import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, ArrowUpDown, ChevronRight, Zap } from "lucide-react";
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
  pending_customer: { variant: "outline", label: "Pending Customer" },
  escalated: { variant: "destructive", label: "Escalated" },
  closed: { variant: "outline", label: "Closed", className: "bg-green-600/10 text-green-700" },
  development: { variant: "secondary", label: "Development", className: "bg-purple-600/20 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
};

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
  const [categoryTab, setCategoryTab] = useState<string>("support"); // support or development
  const [activeTab, setActiveTab] = useState<string>("all");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
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

  // Status order for sorting: in_progress first, then open, then others, closed last
  const STATUS_ORDER: Record<string, number> = {
    in_progress: 0,
    open: 1,
    escalated: 2,
    pending_customer: 3,
    resolved: 4,
    closed: 5,
  };

  const filteredTickets = categoryFilteredTickets.filter((ticket) => {
    // Tab filtering
    if (activeTab === "open" && ticket.status !== "open") return false;
    if (activeTab === "in_progress" && !["in_progress", "escalated", "pending_customer"].includes(ticket.status)) return false;
    if (activeTab === "completed" && !RESOLVED_STATUSES.includes(ticket.status)) return false;
    
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

  const calculateAge = (createdAt: Date | string) => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: false });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track customer support requests
          </p>
        </div>
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

      {/* Category Tabs - Support vs Development */}
      <Tabs value={categoryTab} onValueChange={(val) => { setCategoryTab(val); setActiveTab("all"); }} className="space-y-4">
        <TabsList className="flex-wrap" data-testid="tabs-category">
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
            </TabsList>

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
          {/* Mobile Card View */}
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
