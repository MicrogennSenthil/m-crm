import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Ticket, Users, UserCheck, Clock, CheckCircle2, AlertTriangle, 
  RotateCcw, Timer, Search, MessageSquare, Send, ArrowLeft, 
  Phone, Mail, Building2, FileText, AlertCircle, RefreshCcw
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Ticket as TicketType, TicketComment, User } from "@shared/schema";

interface TicketWithAssignee extends TicketType {
  assigneeName: string | null;
}

interface SupportDashboardStats {
  totalTickets: number;
  assignedCount: number;
  unassignedCount: number;
  openCount: number;
  inProcessCount: number;
  completedCount: number;
  pendingCustomerCount: number;
  escalatedCount: number;
  reassignedCount: number;
  reopenedCount: number;
  longProcessingCount: number;
}

interface SupportDashboardData {
  stats: SupportDashboardStats;
  tickets: TicketWithAssignee[];
}

type FilterType = 'all' | 'assigned' | 'unassigned' | 'open' | 'in_progress' | 'completed' | 
                  'pending_customer' | 'escalated' | 'reassigned' | 'reopened' | 'long_processing';

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-red-500 text-white", label: "Critical" },
  high: { color: "bg-orange-500 text-white", label: "High" },
  medium: { color: "bg-yellow-500 text-white", label: "Medium" },
  low: { color: "bg-green-500 text-white", label: "Low" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  open: { color: "bg-blue-100 text-blue-700", label: "Open" },
  in_progress: { color: "bg-yellow-100 text-yellow-700", label: "In Progress" },
  pending_customer: { color: "bg-purple-100 text-purple-700", label: "Pending Customer" },
  escalated: { color: "bg-red-100 text-red-700", label: "Escalated" },
  closed: { color: "bg-green-100 text-green-700", label: "Closed" },
  reopened: { color: "bg-orange-100 text-orange-700", label: "Reopened" },
};

export default function SupportDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketWithAssignee | null>(null);
  const [newComment, setNewComment] = useState("");

  const { data: dashboardData, isLoading } = useQuery<SupportDashboardData>({
    queryKey: ["/api/dashboard/support"],
  });

  const commentsQueryKey = selectedTicket ? `/api/tickets/${selectedTicket.id}/comments` : null;
  
  const { data: ticketComments = [], isLoading: commentsLoading } = useQuery<TicketComment[]>({
    queryKey: [commentsQueryKey],
    enabled: !!selectedTicket && !!commentsQueryKey,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ ticketId, comment }: { ticketId: string; comment: string }) => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/comments`, { comment });
      return response.json();
    },
    onSuccess: () => {
      if (commentsQueryKey) {
        queryClient.invalidateQueries({ queryKey: [commentsQueryKey] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/support"] });
      setNewComment("");
      toast({ title: "Comment added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const stats = dashboardData?.stats;
  const allTickets = dashboardData?.tickets || [];

  const filterTickets = (tickets: TicketWithAssignee[], filter: FilterType): TicketWithAssignee[] => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    switch (filter) {
      case 'assigned':
        return tickets.filter(t => t.assignedEngineerId);
      case 'unassigned':
        return tickets.filter(t => !t.assignedEngineerId);
      case 'open':
        return tickets.filter(t => t.status === 'open');
      case 'in_progress':
        return tickets.filter(t => t.status === 'in_progress');
      case 'completed':
        return tickets.filter(t => t.status === 'closed');
      case 'pending_customer':
        return tickets.filter(t => t.status === 'pending_customer');
      case 'escalated':
        return tickets.filter(t => t.status === 'escalated' || (t.escalationLevel && t.escalationLevel > 1));
      case 'reassigned':
        return tickets.filter(t => 
          t.assignedEngineerId && t.updatedAt && t.createdAt && 
          new Date(t.updatedAt).getTime() > new Date(t.createdAt).getTime() + 60000
        );
      case 'reopened':
        return tickets.filter(t => t.status === 'reopened' || t.reopenedFromTicketId);
      case 'long_processing':
        return tickets.filter(t => 
          t.status === 'in_progress' && 
          t.updatedAt && new Date(t.updatedAt) < thirtyMinAgo
        );
      default:
        return tickets;
    }
  };

  const filteredTickets = filterTickets(allTickets, activeFilter).filter(ticket => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.ticketNumber?.toLowerCase().includes(search) ||
      ticket.customerName?.toLowerCase().includes(search) ||
      ticket.issueSummary?.toLowerCase().includes(search) ||
      ticket.assigneeName?.toLowerCase().includes(search)
    );
  });

  const getFilterLabel = (filter: FilterType): string => {
    const labels: Record<FilterType, string> = {
      all: 'All Tickets',
      assigned: 'Assigned Tickets',
      unassigned: 'Unassigned Tickets',
      open: 'Open Tickets',
      in_progress: 'In Progress',
      completed: 'Completed Tickets',
      pending_customer: 'Pending Customer',
      escalated: 'Escalated Tickets',
      reassigned: 'Reassigned Tickets',
      reopened: 'Reopened Tickets',
      long_processing: 'Long Processing (>30 min)',
    };
    return labels[filter];
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const foundUser = users.find(u => u.id === userId);
    return foundUser ? `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim() || foundUser.email : userId;
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedTicket) return;
    addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment.trim() });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold mb-1">Support Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitor and manage support tickets
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Ticket className="h-5 w-5" />}
          label="Total Tickets"
          count={stats?.totalTickets || 0}
          color="bg-slate-500"
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Assigned"
          count={stats?.assignedCount || 0}
          color="bg-blue-500"
          isActive={activeFilter === 'assigned'}
          onClick={() => setActiveFilter('assigned')}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Unassigned"
          count={stats?.unassignedCount || 0}
          color="bg-orange-500"
          isActive={activeFilter === 'unassigned'}
          onClick={() => setActiveFilter('unassigned')}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="In Process"
          count={stats?.inProcessCount || 0}
          color="bg-yellow-500"
          isActive={activeFilter === 'in_progress'}
          onClick={() => setActiveFilter('in_progress')}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed"
          count={stats?.completedCount || 0}
          color="bg-green-500"
          isActive={activeFilter === 'completed'}
          onClick={() => setActiveFilter('completed')}
        />
        <StatCard
          icon={<RefreshCcw className="h-5 w-5" />}
          label="Reassigned"
          count={stats?.reassignedCount || 0}
          color="bg-purple-500"
          isActive={activeFilter === 'reassigned'}
          onClick={() => setActiveFilter('reassigned')}
        />
        <StatCard
          icon={<RotateCcw className="h-5 w-5" />}
          label="Reopened"
          count={stats?.reopenedCount || 0}
          color="bg-red-500"
          isActive={activeFilter === 'reopened'}
          onClick={() => setActiveFilter('reopened')}
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label=">30 Min Processing"
          count={stats?.longProcessingCount || 0}
          color="bg-rose-600"
          isActive={activeFilter === 'long_processing'}
          onClick={() => setActiveFilter('long_processing')}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Escalated"
          count={stats?.escalatedCount || 0}
          color="bg-amber-600"
          isActive={activeFilter === 'escalated'}
          onClick={() => setActiveFilter('escalated')}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Open"
          count={stats?.openCount || 0}
          color="bg-cyan-500"
          isActive={activeFilter === 'open'}
          onClick={() => setActiveFilter('open')}
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Pending Customer"
          count={stats?.pendingCustomerCount || 0}
          color="bg-indigo-500"
          isActive={activeFilter === 'pending_customer'}
          onClick={() => setActiveFilter('pending_customer')}
        />
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">{getFilterLabel(activeFilter)}</CardTitle>
              <CardDescription>
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-tickets"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tickets found for this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Issue</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Assigned To</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`row-ticket-${ticket.id}`}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {ticket.ticketNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ticket.customerName}</div>
                          <div className="text-xs text-muted-foreground hidden sm:block">
                            {ticket.customerEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate">
                        {ticket.issueSummary}
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_CONFIG[ticket.priority]?.color || "bg-gray-500"}>
                          {PRIORITY_CONFIG[ticket.priority]?.label || ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[ticket.status]?.color || "bg-gray-100"}>
                          {STATUS_CONFIG[ticket.status]?.label || ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {ticket.assigneeName || <span className="text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                          }}
                          data-testid={`button-view-ticket-${ticket.id}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedTicket(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTicket?.ticketNumber}
                  <Badge className={STATUS_CONFIG[selectedTicket?.status || 'open']?.color}>
                    {STATUS_CONFIG[selectedTicket?.status || 'open']?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-left">
                  {selectedTicket?.issueSummary}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedTicket?.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedTicket?.customerEmail}</span>
              </div>
              {selectedTicket?.customerPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedTicket.customerPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {selectedTicket?.assigneeName || 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Badge className={PRIORITY_CONFIG[selectedTicket?.priority || 'medium']?.color}>
                  {PRIORITY_CONFIG[selectedTicket?.priority || 'medium']?.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {selectedTicket?.createdAt ? format(new Date(selectedTicket.createdAt), "MMM d, yyyy h:mm a") : "-"}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <Label className="text-sm font-medium">Issue Description</Label>
              <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted/30 rounded-lg">
                {selectedTicket?.issueDescription}
              </p>
            </div>

            <Separator className="my-2" />

            <div className="flex-1 flex flex-col min-h-0">
              <Label className="text-sm font-medium mb-2">Comments & Updates</Label>
              <ScrollArea className="flex-1 border rounded-lg p-3 mb-4 max-h-48">
                {commentsLoading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : ticketComments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No comments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticketComments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getUserName(comment.userId)?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {getUserName(comment.userId)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {comment.createdAt ? format(new Date(comment.createdAt), "MMM d, h:mm a") : ""}
                            </span>
                            {comment.isInternal && (
                              <Badge variant="outline" className="text-xs">Internal</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{comment.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 min-h-[60px] resize-none"
                  data-testid="input-ticket-comment"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="self-end"
                  data-testid="button-add-comment"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

function StatCard({ icon, label, count, color, isActive, onClick }: StatCardProps) {
  return (
    <Button
      variant="outline"
      className={`h-auto p-3 flex flex-col items-center gap-1 transition-all ${
        isActive ? `ring-2 ring-offset-2 ring-primary ${color} text-white` : ''
      }`}
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className={`p-2 rounded-full ${isActive ? 'bg-white/20' : color} ${isActive ? '' : 'text-white'}`}>
        {icon}
      </div>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs text-center leading-tight">{label}</span>
    </Button>
  );
}
