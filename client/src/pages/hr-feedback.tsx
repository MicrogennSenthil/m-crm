import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  RotateCcw,
  Send,
  ListTodo,
  CalendarClock,
  MessageCircle,
  PlayCircle,
  Building2,
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

interface DepartmentTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  createdBy: string;
  assignedTo: string | null;
  assignedAt: string | null;
  reminderDate: string | null;
  dueDate: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeDepartmentId: string | null;
  nextFollowupDate: string | null;
  lastFollowupDate: string | null;
  isOverdue: boolean;
  isFollowupDue: boolean;
}

interface DepartmentTasksResponse {
  tasks: DepartmentTask[];
  stats: {
    pending: number;
    followup: number;
    completed: number;
    overdue: number;
  };
}

interface TaskFollowup {
  id: string;
  taskId: string;
  userId: string;
  followupType: string;
  description: string | null;
  nextFollowupDate: string | null;
  status: string;
  createdAt: string;
  userFirstName: string | null;
  userLastName: string | null;
}

export default function HRFeedback() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<PendingTicket | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackSatisfied, setFeedbackSatisfied] = useState<string>("");
  const [reopenReason, setReopenReason] = useState("");
  
  // Department Tasks state
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [deptStatusFilter, setDeptStatusFilter] = useState<string>("active");
  const [selectedTask, setSelectedTask] = useState<DepartmentTask | null>(null);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  const [showTaskHistoryDialog, setShowTaskHistoryDialog] = useState(false);
  const [followupDescription, setFollowupDescription] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<FeedbackStats>({
    queryKey: ["/api/hr/feedback/stats"],
  });

  const { data: pendingTickets, isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingTicket[]>({
    queryKey: ["/api/hr/feedback/pending", { search: searchQuery, priority: priorityFilter !== 'all' ? priorityFilter : '' }],
    enabled: activeTab === "pending",
    staleTime: 0, // Always refetch
  });

  const { data: completedTickets, isLoading: completedLoading, refetch: refetchCompleted } = useQuery<CompletedTicket[]>({
    queryKey: ["/api/hr/feedback/completed", { search: searchQuery }],
    enabled: activeTab === "completed",
    staleTime: 0, // Always refetch
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: { ticketId: string; rating: number | null; comments: string | null; satisfied: boolean | null }) => {
      const res = await apiRequest("POST", "/api/hr/feedback/submit", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Customer feedback has been recorded successfully.",
      });
      setShowFeedbackDialog(false);
      setSelectedTicket(null);
      resetFeedbackForm();
      refetchPending();
      refetchCompleted();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["/api/hr/feedback"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const reopenTicketMutation = useMutation({
    mutationFn: async (data: { ticketId: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/hr/feedback/reopen", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Ticket Reopened",
        description: "The ticket has been reopened and assigned back to the support team.",
      });
      setShowReopenDialog(false);
      setSelectedTicket(null);
      setReopenReason("");
      refetchPending();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reopen ticket",
        variant: "destructive",
      });
    },
  });

  // Department Tasks queries
  const { data: deptTasksData, isLoading: deptTasksLoading, refetch: refetchDeptTasks } = useQuery<DepartmentTasksResponse>({
    queryKey: ["/api/hr/department-tasks", { department: deptFilter !== 'all' ? deptFilter : '', status: deptStatusFilter }],
    enabled: activeTab === "tasks",
  });

  const { data: taskFollowups, isLoading: followupsLoading, refetch: refetchFollowups } = useQuery<TaskFollowup[]>({
    queryKey: ["/api/hr/department-tasks", selectedTask?.id, "followups"],
    enabled: !!selectedTask && showTaskHistoryDialog,
  });

  const addFollowupMutation = useMutation({
    mutationFn: async (data: { taskId: string; description: string; nextFollowupDate: string | null }) => {
      const res = await apiRequest("POST", `/api/hr/department-tasks/${data.taskId}/followup`, {
        description: data.description,
        nextFollowupDate: data.nextFollowupDate,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Follow-up Added",
        description: "Your follow-up has been recorded successfully.",
      });
      setShowFollowupDialog(false);
      setSelectedTask(null);
      setFollowupDescription("");
      setNextFollowupDate("");
      refetchDeptTasks();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add follow-up",
        variant: "destructive",
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/hr/department-tasks/${taskId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Task Completed",
        description: "The task has been marked as complete.",
      });
      refetchDeptTasks();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    },
  });

  // Track if we've shown reminder toast for this session
  const [hasShownReminder, setHasShownReminder] = useState(false);

  // Show reminder toast for overdue and upcoming follow-up tasks when data loads
  useEffect(() => {
    if (deptTasksData && activeTab === "tasks" && !hasShownReminder) {
      const overdueTasks = deptTasksData.tasks.filter(t => t.isOverdue);
      const followupDueTasks = deptTasksData.tasks.filter(t => t.isFollowupDue && !t.isOverdue);
      
      // Show overdue tasks toast
      if (overdueTasks.length > 0) {
        const taskNames = overdueTasks.slice(0, 2).map(t => t.title).join(", ");
        const moreText = overdueTasks.length > 2 ? ` +${overdueTasks.length - 2} more` : "";
        
        toast({
          title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? "s" : ""}`,
          description: `Past due: ${taskNames}${moreText}`,
          variant: "destructive",
        });
      }
      
      // Show follow-up reminder toast (separate from overdue)
      if (followupDueTasks.length > 0) {
        const taskNames = followupDueTasks.slice(0, 2).map(t => t.title).join(", ");
        const moreText = followupDueTasks.length > 2 ? ` +${followupDueTasks.length - 2} more` : "";
        
        toast({
          title: `${followupDueTasks.length} Follow-up Reminder${followupDueTasks.length > 1 ? "s" : ""}`,
          description: `Upcoming: ${taskNames}${moreText}`,
        });
      }
      
      // Mark as shown to prevent repeated toasts
      if (overdueTasks.length > 0 || followupDueTasks.length > 0) {
        setHasShownReminder(true);
      }
    }
  }, [deptTasksData, activeTab, hasShownReminder, toast]);
  
  // Reset reminder flag when leaving the tasks tab
  useEffect(() => {
    if (activeTab !== "tasks") {
      setHasShownReminder(false);
    }
  }, [activeTab]);

  const resetFeedbackForm = () => {
    setFeedbackRating(0);
    setFeedbackComments("");
    setFeedbackSatisfied("");
  };

  const handleAddFollowup = () => {
    if (!selectedTask) return;
    
    if (!followupDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a follow-up description.",
        variant: "destructive",
      });
      return;
    }
    
    addFollowupMutation.mutate({
      taskId: selectedTask.id,
      description: followupDescription.trim(),
      nextFollowupDate: nextFollowupDate || null,
    });
  };

  const openFollowupDialog = (task: DepartmentTask) => {
    setSelectedTask(task);
    setFollowupDescription("");
    setNextFollowupDate("");
    setShowFollowupDialog(true);
  };

  const openTaskHistoryDialog = (task: DepartmentTask) => {
    setSelectedTask(task);
    setShowTaskHistoryDialog(true);
  };

  const getTaskStatusBadge = (status: string, isOverdue: boolean, isFollowupDue: boolean) => {
    if (isOverdue || isFollowupDue) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Overdue</Badge>;
    }
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      followup: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      get_information: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    };
    const labels: Record<string, string> = {
      pending: "Pending",
      followup: "Follow Up",
      completed: "Completed",
      get_information: "Get Info",
    };
    return <Badge className={styles[status] || styles.pending}>{labels[status] || status}</Badge>;
  };

  const getTaskPriorityBadge = (priority: string | null) => {
    const styles: Record<string, string> = {
      urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    };
    return <Badge className={styles[priority || "medium"] || styles.medium}>{priority || "medium"}</Badge>;
  };

  const handleSubmitFeedback = () => {
    if (!selectedTicket) return;
    
    // Client-side validation - require either a rating (1-5) OR satisfaction selection
    if (feedbackRating < 1 && feedbackSatisfied === '') {
      toast({
        title: "Validation Error",
        description: "Please provide at least a star rating or indicate if the customer was satisfied.",
        variant: "destructive",
      });
      return;
    }
    
    submitFeedbackMutation.mutate({
      ticketId: selectedTicket.id,
      rating: feedbackRating > 0 ? feedbackRating : null,
      comments: feedbackComments.trim() || null,
      satisfied: feedbackSatisfied === 'yes' ? true : feedbackSatisfied === 'no' ? false : null,
    });
  };

  const handleReopenTicket = () => {
    if (!selectedTicket) return;
    
    // Client-side validation
    if (!reopenReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for reopening the ticket.",
        variant: "destructive",
      });
      return;
    }
    
    reopenTicketMutation.mutate({
      ticketId: selectedTicket.id,
      reason: reopenReason,
    });
  };

  const openFeedbackDialog = (ticket: PendingTicket) => {
    setSelectedTicket(ticket);
    resetFeedbackForm();
    setShowFeedbackDialog(true);
  };

  const openReopenDialog = (ticket: PendingTicket) => {
    setSelectedTicket(ticket);
    setReopenReason("");
    setShowReopenDialog(true);
  };

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

  const renderClickableStars = () => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setFeedbackRating(star)}
            className="p-1 hover:scale-110 transition-transform"
            data-testid={`button-star-${star}`}
          >
            <Star
              className={`h-8 w-8 ${star <= feedbackRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
            />
          </button>
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
            refetchStats();
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

      {/* Tabs for Pending/Completed/Tasks */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Feedback ({stats?.closedWithoutFeedback || 0})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({stats?.closedWithFeedback || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ListTodo className="h-4 w-4 mr-1" />
            Dept Tasks ({deptTasksData?.stats.pending || 0})
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
                        <TableHead className="text-right">Actions</TableHead>
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
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetail(ticket)}
                                data-testid={`button-detail-${ticket.id}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openFeedbackDialog(ticket)}
                                data-testid={`button-feedback-${ticket.id}`}
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Feedback
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                                onClick={() => openReopenDialog(ticket)}
                                data-testid={`button-reopen-${ticket.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
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
                        <TableHead>Comments</TableHead>
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
                          <TableCell className="max-w-[200px] truncate">
                            {ticket.feedbackComments || <span className="text-muted-foreground">-</span>}
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

        {/* Department Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  HR & Accounts Department Tasks
                </div>
                <div className="flex gap-2">
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-department">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="accounts">Accounts</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={deptStatusFilter} onValueChange={setDeptStatusFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-task-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="followup">Follow Up</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Task Stats */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{deptTasksData?.stats.pending || 0}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground">Follow Up</p>
                  <p className="text-xl font-bold text-blue-600">{deptTasksData?.stats.followup || 0}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-bold text-red-600">{deptTasksData?.stats.overdue || 0}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-xl font-bold text-green-600">{deptTasksData?.stats.completed || 0}</p>
                </div>
              </div>

              {deptTasksLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !deptTasksData?.tasks?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No tasks found for this department.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Next Follow-up</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptTasksData.tasks.map((task) => (
                        <TableRow 
                          key={task.id} 
                          data-testid={`row-task-${task.id}`}
                          className={task.isOverdue || task.isFollowupDue ? "bg-red-50/50 dark:bg-red-900/10" : ""}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{task.title}</span>
                              {task.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {task.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.assigneeFirstName ? (
                              <span>{task.assigneeFirstName} {task.assigneeLastName}</span>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                          <TableCell>
                            {getTaskStatusBadge(task.status, task.isOverdue, task.isFollowupDue)}
                          </TableCell>
                          <TableCell>
                            {task.dueDate ? (
                              <div className={`flex items-center gap-1 ${task.isOverdue ? "text-red-600 font-medium" : ""}`}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.dueDate), "dd/MM/yyyy")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.nextFollowupDate ? (
                              <div className={`flex items-center gap-1 ${task.isFollowupDue ? "text-red-600 font-medium" : ""}`}>
                                <CalendarClock className="h-3 w-3" />
                                {format(new Date(task.nextFollowupDate), "dd/MM/yyyy")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTaskHistoryDialog(task)}
                                data-testid={`button-history-${task.id}`}
                                title="View History"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openFollowupDialog(task)}
                                data-testid={`button-followup-${task.id}`}
                                title="Add Follow-up"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                              {task.status !== 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => completeTaskMutation.mutate(task.id)}
                                  disabled={completeTaskMutation.isPending}
                                  data-testid={`button-complete-${task.id}`}
                                  title="Mark Complete"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                            </div>
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

      {/* Follow-up Dialog */}
      <Dialog open={showFollowupDialog} onOpenChange={setShowFollowupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-500" />
              Add Follow-up
            </DialogTitle>
            <DialogDescription>
              Add a follow-up note for task: {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="followup-description">Follow-up Description *</Label>
              <Textarea
                id="followup-description"
                placeholder="Enter your follow-up notes..."
                value={followupDescription}
                onChange={(e) => setFollowupDescription(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-followup-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-followup-date">Next Follow-up Date (optional)</Label>
              <Input
                id="next-followup-date"
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                data-testid="input-next-followup-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowupDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddFollowup} 
              disabled={addFollowupMutation.isPending}
              data-testid="button-submit-followup"
            >
              {addFollowupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Add Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task History Dialog */}
      <Dialog open={showTaskHistoryDialog} onOpenChange={setShowTaskHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              Task Follow-up History
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {followupsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !taskFollowups?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No follow-ups recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4 p-1">
                {taskFollowups.map((followup) => (
                  <div 
                    key={followup.id} 
                    className="p-4 border rounded-lg bg-muted/30"
                    data-testid={`followup-${followup.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {followup.userFirstName} {followup.userLastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {followup.createdAt ? format(new Date(followup.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                          </p>
                        </div>
                      </div>
                      {followup.nextFollowupDate && (
                        <Badge variant="outline" className="text-xs">
                          <CalendarClock className="h-3 w-3 mr-1" />
                          Next: {format(new Date(followup.nextFollowupDate), "dd/MM/yyyy")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm">{followup.description}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskHistoryDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowTaskHistoryDialog(false);
              if (selectedTask) openFollowupDialog(selectedTask);
            }}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Add Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  </div>
                </div>

                {/* Ticket Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <FileText className="h-5 w-5 text-green-500" />
                    Ticket Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Priority</p>
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="secondary">{selectedTicket.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p>{format(new Date(selectedTicket.createdAt), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Closed</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedTicket.closedAt ? format(new Date(selectedTicket.closedAt), "dd/MM/yyyy HH:mm") : "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Summary</p>
                    <p className="font-medium">{selectedTicket.issueSummary}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Description</p>
                    <p className="text-sm bg-muted/50 p-3 rounded-md">{selectedTicket.issueDescription || "No description provided"}</p>
                  </div>
                </div>

                {/* Engineer Information */}
                {selectedTicket.assignedEngineerName && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                      <User className="h-5 w-5 text-purple-500" />
                      Assigned Engineer
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedTicket.assignedEngineerName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p>{selectedTicket.assignedEngineerEmail || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p>{selectedTicket.assignedEngineerPhone || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowDetailDialog(false);
                if (selectedTicket) openFeedbackDialog(selectedTicket);
              }}
              data-testid="button-add-feedback-from-detail"
            >
              <Star className="h-4 w-4 mr-2" />
              Add Feedback
            </Button>
            <Button
              variant="outline"
              className="text-orange-600 border-orange-300"
              onClick={() => {
                setShowDetailDialog(false);
                if (selectedTicket) openReopenDialog(selectedTicket);
              }}
              data-testid="button-reopen-from-detail"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reopen Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Submission Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Submit Customer Feedback
            </DialogTitle>
            <DialogDescription>
              Record feedback from customer for ticket {selectedTicket?.ticketNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Customer Info Summary */}
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium">{selectedTicket?.customerName}</p>
              <p className="text-sm text-muted-foreground">{selectedTicket?.customerPhone || selectedTicket?.customerEmail}</p>
              <p className="text-sm mt-1">{selectedTicket?.issueSummary}</p>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Customer Rating</Label>
              <div className="flex justify-center py-2">
                {renderClickableStars()}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {feedbackRating === 0 ? "Click to rate" : `${feedbackRating} out of 5 stars`}
              </p>
            </div>

            {/* Satisfaction */}
            <div className="space-y-2">
              <Label>Was the customer satisfied with the resolution?</Label>
              <RadioGroup
                value={feedbackSatisfied}
                onValueChange={setFeedbackSatisfied}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="satisfied-yes" data-testid="radio-satisfied-yes" />
                  <Label htmlFor="satisfied-yes" className="text-green-600 font-medium">Yes, Satisfied</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="satisfied-no" data-testid="radio-satisfied-no" />
                  <Label htmlFor="satisfied-no" className="text-red-600 font-medium">No, Not Satisfied</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="feedback-comments">Feedback Comments</Label>
              <Textarea
                id="feedback-comments"
                placeholder="Enter customer's feedback comments..."
                value={feedbackComments}
                onChange={(e) => setFeedbackComments(e.target.value)}
                rows={4}
                data-testid="input-feedback-comments"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={submitFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {submitFeedbackMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Ticket Dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <RotateCcw className="h-5 w-5" />
              Reopen Ticket
            </DialogTitle>
            <DialogDescription>
              Reopen ticket {selectedTicket?.ticketNumber} for further investigation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Ticket Summary */}
            <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md border border-orange-200 dark:border-orange-800">
              <p className="font-medium">{selectedTicket?.customerName}</p>
              <p className="text-sm text-muted-foreground">{selectedTicket?.issueSummary}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Closed on: {selectedTicket?.closedAt ? format(new Date(selectedTicket.closedAt), "dd/MM/yyyy") : "-"}
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <span>Reopening will send this ticket back to the support team for further action. The ticket will appear as "Reopened" in their queue.</span>
              </p>
            </div>

            {/* Reopen Reason */}
            <div className="space-y-2">
              <Label htmlFor="reopen-reason">Reason for Reopening *</Label>
              <Textarea
                id="reopen-reason"
                placeholder="Enter the reason why this ticket needs to be reopened..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={4}
                data-testid="input-reopen-reason"
              />
              <p className="text-xs text-muted-foreground">
                This reason will be visible to the support team.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleReopenTicket}
              disabled={reopenTicketMutation.isPending || !reopenReason.trim()}
              data-testid="button-confirm-reopen"
            >
              {reopenTicketMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reopen Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
