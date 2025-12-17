import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquareHeart,
  Search,
  Phone,
  Mail,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  Filter,
  RefreshCw,
  FileText,
} from "lucide-react";

interface FeedbackStats {
  totalOpen: number;
  totalInProgress: number;
  totalPendingCustomer: number;
  totalEscalated: number;
  totalClosed: number;
  totalResolved: number;
  closedWithFeedback: number;
  closedWithoutFeedback: number;
}

interface PendingTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  issueSummary: string;
  issueDescription: string;
  priority: string;
  status: string;
  createdAt: string;
  closedAt: string;
  resolvedAt: string | null;
  escalationLevel: number;
  assignedEngineerId: string | null;
  assignedEngineerName: string | null;
  assignedEngineerEmail: string | null;
  assignedEngineerPhone: string | null;
  daysSinceClosed: number;
}

interface CompletedTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  issueSummary: string;
  priority: string;
  closedAt: string;
  assignedEngineerName: string | null;
  feedbackRating: number | null;
  feedbackComments: string | null;
  feedbackSatisfied: boolean | null;
  feedbackSubmittedAt: string | null;
}

export default function HRFeedback() {
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<PendingTicket | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<FeedbackStats>({
    queryKey: ["/api/hr/feedback/stats"],
  });

  const { data: pendingTickets, isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingTicket[]>({
    queryKey: ["/api/hr/feedback/pending", { search: searchQuery, priority: priorityFilter }],
    enabled: activeTab === "pending",
  });

  const { data: completedTickets, isLoading: completedLoading, refetch: refetchCompleted } = useQuery<CompletedTicket[]>({
    queryKey: ["/api/hr/feedback/completed", { search: searchQuery }],
    enabled: activeTab === "completed",
  });

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    };
    return (
      <Badge className={styles[priority] || styles.medium} variant="secondary">
        {priority}
      </Badge>
    );
  };

  const getDaysBadge = (days: number) => {
    if (days <= 3) {
      return <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">{days} days</Badge>;
    } else if (days <= 7) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{days} days</Badge>;
    } else {
      return <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{days} days</Badge>;
    }
  };

  const handleViewDetail = (ticket: PendingTicket) => {
    setSelectedTicket(ticket);
    setShowDetailDialog(true);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">No rating</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
            <MessageSquareHeart className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">HR Feedback</h1>
            <p className="text-muted-foreground">Track and manage customer feedback for closed support tickets</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchPending();
            refetchCompleted();
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-blue-600" data-testid="stat-open">
                    {stats?.totalOpen || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-amber-600" data-testid="stat-inprogress">
                    {stats?.totalInProgress || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Loader2 className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Escalated</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-red-600" data-testid="stat-escalated">
                    {stats?.totalEscalated || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Closed</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-green-600" data-testid="stat-closed">
                    {stats?.totalClosed || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">With Feedback</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-pink-600" data-testid="stat-with-feedback">
                    {stats?.closedWithFeedback || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-full">
                <Star className="h-4 w-4 text-pink-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Feedback</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold text-orange-600" data-testid="stat-pending-feedback">
                    {stats?.closedWithoutFeedback || 0}
                  </p>
                )}
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <XCircle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticket number, customer name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-priority">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Pending/Completed */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Feedback ({stats?.closedWithoutFeedback || 0})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({stats?.closedWithFeedback || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-orange-500" />
                Closed Tickets Awaiting Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !pendingTickets?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>All closed tickets have received feedback!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Engineer</TableHead>
                        <TableHead>Closed On</TableHead>
                        <TableHead>Days Since</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingTickets.map((ticket) => (
                        <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                          <TableCell className="font-medium">
                            {ticket.ticketNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{ticket.customerName}</span>
                              <span className="text-xs text-muted-foreground">{ticket.customerEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {ticket.customerPhone ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {ticket.customerPhone}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No phone</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {ticket.issueSummary}
                          </TableCell>
                          <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                          <TableCell>
                            {ticket.assignedEngineerName ? (
                              <div className="flex flex-col">
                                <span className="text-sm">{ticket.assignedEngineerName}</span>
                                {ticket.assignedEngineerPhone && (
                                  <span className="text-xs text-muted-foreground">{ticket.assignedEngineerPhone}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ticket.closedAt ? format(new Date(ticket.closedAt), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>{getDaysBadge(ticket.daysSinceClosed)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetail(ticket)}
                              data-testid={`button-detail-${ticket.id}`}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Details
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
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-pink-500" />
                Tickets with Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !completedTickets?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-2" />
                  <p>No feedback received yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Engineer</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Satisfied</TableHead>
                        <TableHead>Feedback Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedTickets.map((ticket) => (
                        <TableRow key={ticket.id} data-testid={`row-completed-${ticket.id}`}>
                          <TableCell className="font-medium">
                            {ticket.ticketNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{ticket.customerName}</span>
                              <span className="text-xs text-muted-foreground">{ticket.customerEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {ticket.issueSummary}
                          </TableCell>
                          <TableCell>
                            {ticket.assignedEngineerName || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>{renderStars(ticket.feedbackRating)}</TableCell>
                          <TableCell>
                            {ticket.feedbackSatisfied === true ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Yes</Badge>
                            ) : ticket.feedbackSatisfied === false ? (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">No</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ticket.feedbackSubmittedAt
                              ? format(new Date(ticket.feedbackSubmittedAt), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ticket Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ticket Details - {selectedTicket?.ticketNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 p-1">
                {/* Customer Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <User className="h-5 w-5 text-blue-500" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedTicket.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedTicket.customerEmail}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Number</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-lg">{selectedTicket.customerPhone || "Not provided"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Priority</p>
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                  </div>
                </div>

                {/* Issue Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Issue Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Issue Summary</p>
                      <p className="font-medium">{selectedTicket.issueSummary}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm bg-muted/50 p-3 rounded-md">{selectedTicket.issueDescription}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Escalation Level</p>
                      <Badge variant="outline">Level {selectedTicket.escalationLevel}</Badge>
                    </div>
                  </div>
                </div>

                {/* Engineer Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <User className="h-5 w-5 text-green-500" />
                    Assigned Engineer
                  </h3>
                  {selectedTicket.assignedEngineerName ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedTicket.assignedEngineerName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p>{selectedTicket.assignedEngineerEmail || "-"}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{selectedTicket.assignedEngineerPhone || "Not available"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No engineer assigned</p>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    Timeline
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Created On</p>
                      <p>{selectedTicket.createdAt ? format(new Date(selectedTicket.createdAt), "dd/MM/yyyy HH:mm") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved On</p>
                      <p>{selectedTicket.resolvedAt ? format(new Date(selectedTicket.resolvedAt), "dd/MM/yyyy HH:mm") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Closed On</p>
                      <p>{selectedTicket.closedAt ? format(new Date(selectedTicket.closedAt), "dd/MM/yyyy HH:mm") : "-"}</p>
                    </div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md">
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      Days since closed: {selectedTicket.daysSinceClosed} days - Feedback pending
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
