import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Wrench,
  Headphones,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Clock,
  ListTodo,
  RotateCcw,
  Circle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Video,
  Image,
  Paperclip,
  Mic,
  Calendar,
  ExternalLink,
  Code2,
  Building2,
  Target,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Lead, Project, Ticket, ActivityLog, Task, User } from "@shared/schema";

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
};

// Calculate overdue days for a task
function getTaskOverdueInfo(task: Task): { isOverdue: boolean; daysOverdue: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check due date
  if (task.dueDate && task.status !== 'completed') {
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return { isOverdue: true, daysOverdue };
    }
  }
  
  // Check reminder date
  if (task.reminderDate && task.status !== 'completed') {
    const reminderDate = new Date(task.reminderDate);
    reminderDate.setHours(0, 0, 0, 0);
    if (reminderDate < today) {
      const daysOverdue = Math.floor((today.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));
      return { isOverdue: true, daysOverdue };
    }
  }
  
  return { isOverdue: false, daysOverdue: 0 };
}

// Get greeting based on Indian Standard Time (IST = UTC+5:30)
function getISTGreeting(): string {
  const now = new Date();
  // Convert to IST by adding 5 hours 30 minutes to UTC
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const istTotalMinutes = (utcHours * 60 + utcMinutes) + 330; // 330 minutes = 5h 30m
  const istHours = Math.floor((istTotalMinutes % 1440) / 60); // 1440 = 24 * 60
  
  if (istHours >= 5 && istHours < 12) {
    return "Good Morning";
  } else if (istHours >= 12 && istHours < 17) {
    return "Good Afternoon";
  } else if (istHours >= 17 && istHours < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
}

interface DashboardStats {
  activeLeads: number;
  ongoingProjects: number;
  openTickets: number;
  monthlyClosures: number;
  leadsChange: number;
  projectsChange: number;
  ticketsChange: number;
  closuresChange: number;
}

interface DepartmentDashboard {
  departmentName: string;
  isDepartmentHead: boolean;
  memberCount: number;
  members: Array<{ id: string; name: string; email: string; role: string }>;
  stats: {
    type: 'sales' | 'support' | 'implementation' | 'development' | 'admin';
    // Sales stats
    totalLeads?: number;
    activeLeads?: number;
    wonLeads?: number;
    lostLeads?: number;
    pendingFollowups?: number;
    // Support stats
    totalTickets?: number;
    openTickets?: number;
    resolvedTickets?: number;
    criticalTickets?: number;
    overdueTickets?: number;
    // Implementation stats
    totalProjects?: number;
    activeProjects?: number;
    completedProjects?: number;
    avgCompletion?: number;
    // Development stats
    totalTasks?: number;
    yetToWork?: number;
    onProcess?: number;
    pending?: number;
    completed?: number;
    overdue?: number;
  };
  myTasks: {
    total: number;
    pending: number;
    followup: number;
    completed: number;
    overdue: number;
  };
}

export default function Home() {
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  // Fetch department-specific dashboard data
  const { data: deptDashboard, isLoading: deptLoading } = useQuery<DepartmentDashboard>({
    queryKey: ["/api/dashboard/my-department"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/dashboard/activities"],
  });

  const { data: recentLeads, isLoading: leadsLoading, isError: leadsError } = useQuery<Lead[]>({
    queryKey: ["/api/leads?limit=5"],
  });

  const { data: activeProjects, isLoading: projectsLoading, isError: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects?status=in_progress"],
  });

  const { data: openTickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets?status=open&limit=5"],
  });
  
  // Fetch user's assigned tickets for dashboard display
  const { data: myTickets = [], isLoading: myTicketsLoading, isSuccess: myTicketsLoaded } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets/my-assigned"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Fetch current user to check role and department
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isAdmin = currentUser?.role === "admin";
  const isSupport = currentUser?.role === "support" || currentUser?.role === "engineer";
  const isSales = currentUser?.role === "sales" || currentUser?.role === "sales_executive";
  
  // Determine if user has assigned tickets (support-related role) - only after data loads
  const hasAssignedTickets = myTicketsLoaded && myTickets.length > 0;
  const openTicketsCount = myTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length;
  const closedTicketsCount = myTickets.filter(t => t.status === 'closed' || t.status === 'resolved').length;

  // Fetch user's tasks for dashboard display
  // Super admin gets all tasks (view=all), regular users get their own tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks", isAdmin ? "all" : "user"],
    queryFn: async () => {
      const url = isAdmin ? "/api/tasks?view=all" : "/api/tasks";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Mutation to revoke (revert) a completed task back to pending
  const revokeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { status: "pending" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task revoked", description: "Task status changed back to pending" });
    },
    onError: () => {
      toast({ title: "Failed to revoke task", variant: "destructive" });
    },
  });

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "followup":
        return Clock;
      case "get_information":
        return Users;
      default:
        return Circle;
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "followup":
        return "text-blue-600";
      case "get_information":
        return "text-purple-600";
      case "pending":
        return "text-yellow-600";
      default:
        return "text-muted-foreground";
    }
  };

  // Generate department-specific metric cards with clickable links
  const getDepartmentMetricCards = () => {
    const deptStats = deptDashboard?.stats;
    const deptType = deptStats?.type || 'admin';

    // Sales Department Cards
    if (deptType === 'sales') {
      return [
        { title: "My Active Leads", value: deptStats?.activeLeads || 0, icon: TrendingUp, color: "text-blue-600", bgColor: "bg-blue-600/10", link: "/leads?status=new,contacted,qualified,proposal" },
        { title: "Won Deals", value: deptStats?.wonLeads || 0, icon: Target, color: "text-green-600", bgColor: "bg-green-600/10", link: "/leads?status=won" },
        { title: "Pending Followups", value: deptStats?.pendingFollowups || 0, icon: Clock, color: "text-orange-600", bgColor: "bg-orange-600/10", link: "/tasks?status=pending,followup" },
        { title: "Total Leads", value: deptStats?.totalLeads || 0, icon: Users, color: "text-purple-600", bgColor: "bg-purple-600/10", link: "/leads" },
      ];
    }

    // Support Department Cards
    if (deptType === 'support') {
      return [
        { title: "My Open Tickets", value: deptStats?.openTickets || 0, icon: Headphones, color: "text-orange-600", bgColor: "bg-orange-600/10", link: "/tickets?status=open,in_progress" },
        { title: "Resolved", value: deptStats?.resolvedTickets || 0, icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-600/10", link: "/tickets?status=resolved,closed" },
        { title: "Critical", value: deptStats?.criticalTickets || 0, icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-600/10", link: "/tickets?priority=critical" },
        { title: "Overdue", value: deptStats?.overdueTickets || 0, icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-600/10", link: "/tickets?overdue=true" },
      ];
    }

    // Implementation/Technical Department Cards
    if (deptType === 'implementation') {
      return [
        { title: "Active Projects", value: deptStats?.activeProjects || 0, icon: Wrench, color: "text-blue-600", bgColor: "bg-blue-600/10", link: "/implementation?status=planning,in_progress" },
        { title: "Completed", value: deptStats?.completedProjects || 0, icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-600/10", link: "/implementation?status=completed" },
        { title: "Avg Progress", value: `${deptStats?.avgCompletion || 0}%`, icon: Target, color: "text-purple-600", bgColor: "bg-purple-600/10", link: "/implementation" },
        { title: "Total Projects", value: deptStats?.totalProjects || 0, icon: Building2, color: "text-orange-600", bgColor: "bg-orange-600/10", link: "/implementation" },
      ];
    }

    // Development Department Cards
    if (deptType === 'development') {
      return [
        { title: "Yet to Work", value: deptStats?.yetToWork || 0, icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-600/10", link: "/development/tasks?status=yet_to_work" },
        { title: "In Progress", value: deptStats?.onProcess || 0, icon: Code2, color: "text-blue-600", bgColor: "bg-blue-600/10", link: "/development/tasks?status=on_process" },
        { title: "Completed", value: deptStats?.completed || 0, icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-600/10", link: "/development/tasks?status=completed" },
        { title: "Overdue", value: deptStats?.overdue || 0, icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-600/10", link: "/development/tasks?overdue=true" },
      ];
    }

    // Admin/Default - Show overall stats
    return [
      { title: "Active Leads", value: stats?.activeLeads || 0, icon: TrendingUp, color: "text-blue-600", bgColor: "bg-blue-600/10", link: "/leads" },
      { title: "Ongoing Implementations", value: stats?.ongoingProjects || 0, icon: Wrench, color: "text-green-600", bgColor: "bg-green-600/10", link: "/implementation" },
      { title: "Open Tickets", value: stats?.openTickets || 0, icon: Headphones, color: "text-orange-600", bgColor: "bg-orange-600/10", link: "/tickets" },
      { title: "This Month's Closures", value: stats?.monthlyClosures || 0, icon: CheckCircle, color: "text-emerald-600", bgColor: "bg-emerald-600/10", link: "/leads?status=won" },
    ];
  };

  const metricCards = getDepartmentMetricCards();
  const deptType = deptDashboard?.stats?.type || 'admin';

  const getActivityIcon = (entityType: string) => {
    switch (entityType) {
      case "lead":
        return TrendingUp;
      case "project":
        return Wrench;
      case "ticket":
        return Headphones;
      default:
        return Clock;
    }
  };

  // Filter pending tasks (not completed) - these should always show
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  
  // Filter recently completed tasks (within last 48 hours)
  const recentlyCompletedTasks = tasks.filter(t => {
    if (t.status !== "completed") return false;
    if (!t.updatedAt) return false;
    const completedDate = new Date(t.updatedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 48;
  });

  // Helper to check if user is creator or assignee of a task
  const getTaskRole = (task: TaskWithDetails): string => {
    const isCreator = task.createdBy === currentUser?.id;
    const isAssignee = task.assignedTo === currentUser?.id;
    if (isCreator && isAssignee) return "You created & completed";
    if (isCreator) return "Created by you";
    if (isAssignee) return "Assigned to you";
    return "";
  };

  const greeting = getISTGreeting();
  const userName = currentUser?.firstName || "User";
  const departmentName = deptDashboard?.departmentName || '';
  const isDepartmentHead = deptDashboard?.isDepartmentHead || false;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1" data-testid="text-greeting">
            Hi {userName}, {greeting}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {departmentName ? `${departmentName} Department` : 'M-CRM Dashboard'}
            {isDepartmentHead && <Badge variant="secondary" className="ml-2 text-xs">Department Head</Badge>}
          </p>
        </div>
        {/* Department Head Team Summary */}
        {isDepartmentHead && (deptDashboard?.memberCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{deptDashboard?.memberCount} team members</span>
          </div>
        )}
      </div>

      {/* Hero Stats Section - Department Specific */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {(statsLoading || deptLoading)
          ? Array(4)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-3 sm:p-6">
                    <Skeleton className="h-4 w-16 sm:w-24" />
                    <Skeleton className="h-5 w-5" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0">
                    <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 mb-2" />
                    <Skeleton className="h-3 w-16 sm:w-20" />
                  </CardContent>
                </Card>
              ))
          : metricCards.map((card) => (
              <Link key={card.title} href={card.link || "#"}>
                <Card className="cursor-pointer hover-elevate transition-all" data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 sm:gap-2 space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">
                      {card.title}
                    </CardTitle>
                    <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-md ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <card.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="text-xl sm:text-2xl font-bold" data-testid={`value-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>{card.value}</div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <span className="text-primary underline-offset-2 hover:underline">View details</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Activity Feed - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {activitiesLoading ? (
              <div className="space-y-3 sm:space-y-4">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-3 sm:space-y-4" data-testid="activity-feed">
                {activities.map((activity) => {
                  const Icon = getActivityIcon(activity.entityType);
                  return (
                    <div key={activity.id} className="flex gap-3 items-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.createdAt && formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Tasks and Quick Panels */}
        <div className="space-y-3 sm:space-y-4">
          {/* My Work Panel - Department-aware: Shows tickets for Support, tasks for others */}
          <Card>
            <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                {deptType === 'support' ? (
                  <>
                    <Headphones className="h-4 w-4" />
                    My Tickets
                  </>
                ) : (
                  <>
                    <ListTodo className="h-4 w-4" />
                    {isAdmin ? 'All Pending Tasks' : 'My Tasks'}
                  </>
                )}
              </CardTitle>
              <div className="flex gap-1">
                {deptType === 'support' ? (
                  <>
                    {openTicketsCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {openTicketsCount} open
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {closedTicketsCount} closed
                    </Badge>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {pendingTasks.length} pending
                    </Badge>
                    {recentlyCompletedTasks.length > 0 && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        {recentlyCompletedTasks.length} done
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {/* Support users see their tickets */}
              {deptType === 'support' ? (
                myTicketsLoading ? (
                  <div className="space-y-2">
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} className="flex gap-2">
                        <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ) : myTickets && myTickets.length > 0 ? (
                  <div className="space-y-2" data-testid="dashboard-my-tickets">
                    {[...myTickets]
                      .sort((a, b) => {
                        // Sort order: open first, then in_progress, then resolved/closed
                        const statusOrder: Record<string, number> = { open: 0, in_progress: 1, escalated: 2, pending_customer: 3, resolved: 4, closed: 5 };
                        return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
                      })
                      .slice(0, 6).map((ticket: Ticket) => (
                      <Link key={ticket.id} href={`/tickets`}>
                        <div className="flex gap-2 items-start p-1.5 rounded hover-elevate cursor-pointer" data-testid={`dashboard-ticket-${ticket.id}`}>
                          <div className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                            ticket.status === 'open' ? 'text-orange-500' :
                            ticket.status === 'in_progress' ? 'text-blue-500' :
                            ticket.status === 'resolved' ? 'text-green-500' :
                            'text-muted-foreground'
                          }`}>
                            {ticket.status === 'resolved' || ticket.status === 'closed' ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${ticket.status === 'closed' ? 'line-through text-muted-foreground' : ''}`}>
                              {ticket.ticketNumber}: {ticket.issueSummary}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                ticket.priority === 'critical' ? 'destructive' :
                                ticket.priority === 'high' ? 'destructive' :
                                'secondary'
                              } className="text-[10px] h-4">
                                {ticket.priority}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground capitalize">{ticket.status?.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {myTickets.length > 6 && (
                      <p className="text-xs text-muted-foreground text-center">+{myTickets.length - 6} more tickets</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tickets assigned
                  </p>
                )
              ) : tasksLoading ? (
                <div className="space-y-2">
                  {Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex gap-2">
                        <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                </div>
              ) : (pendingTasks.length > 0 || recentlyCompletedTasks.length > 0) ? (
                <div className="space-y-3" data-testid="dashboard-tasks">
                  {/* Pending Tasks Section */}
                  {pendingTasks.length > 0 && (
                    <div className="space-y-2">
                      {pendingTasks.slice(0, 5).map((task) => {
                        const StatusIcon = getTaskStatusIcon(task.status);
                        const hasVoiceNote = !!task.voiceNoteUrl;
                        const hasVideo = task.attachments?.some(a => a.type === "video");
                        const hasPhoto = task.attachments?.some(a => a.type === "photo");
                        const hasFile = task.attachments?.some(a => a.type === "file");
                        const hasAttachments = hasVoiceNote || hasVideo || hasPhoto || hasFile;
                        const { isOverdue, daysOverdue } = getTaskOverdueInfo(task);
                        const taskRole = getTaskRole(task);
                        return (
                          <div 
                            key={task.id} 
                            className={`flex gap-2 items-start group p-1.5 rounded ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                            data-testid={`dashboard-task-${task.id}`}
                          >
                            <div className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-500' : getTaskStatusColor(task.status)}`}>
                              {isOverdue ? <AlertTriangle className="h-4 w-4" /> : <StatusIcon className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{task.title}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {taskRole && (
                                  <span className="text-[10px] text-muted-foreground">{taskRole}</span>
                                )}
                                {isOverdue && (
                                  <span className="text-[10px] text-red-500 font-medium">
                                    {daysOverdue} day{daysOverdue > 1 ? 's' : ''} overdue
                                  </span>
                                )}
                              </div>
                              {hasAttachments && (
                                <div className="flex gap-1.5 mt-1" data-testid={`task-attachments-${task.id}`}>
                                  {hasVoiceNote && <span className="text-blue-500" title="Voice note"><Mic className="h-3 w-3" /></span>}
                                  {hasVideo && <span className="text-purple-500" title="Video"><Video className="h-3 w-3" /></span>}
                                  {hasPhoto && <span className="text-green-500" title="Photo"><Image className="h-3 w-3" /></span>}
                                  {hasFile && <span className="text-orange-500" title="File"><Paperclip className="h-3 w-3" /></span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {pendingTasks.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">+{pendingTasks.length - 5} more pending</p>
                      )}
                    </div>
                  )}
                  
                  {/* Recently Completed Section */}
                  {recentlyCompletedTasks.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Recently Completed (48h)
                      </p>
                      <div className="space-y-1.5">
                        {recentlyCompletedTasks.slice(0, 3).map((task) => {
                          const taskRole = getTaskRole(task);
                          return (
                            <div 
                              key={task.id} 
                              className="flex gap-2 items-start group p-1.5 rounded bg-green-50 dark:bg-green-900/20"
                              data-testid={`dashboard-completed-task-${task.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate line-through text-muted-foreground">{task.title}</p>
                                <div className="flex items-center gap-2">
                                  {taskRole && (
                                    <span className="text-[10px] text-green-600 font-medium">{taskRole}</span>
                                  )}
                                  {task.assignee && task.assignedTo !== currentUser?.id && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Completed by {task.assignee.firstName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isAdmin && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  onClick={() => revokeTaskMutation.mutate(task.id)}
                                  disabled={revokeTaskMutation.isPending}
                                  title="Revoke completion"
                                  data-testid={`button-revoke-task-${task.id}`}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                        {recentlyCompletedTasks.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">+{recentlyCompletedTasks.length - 3} more completed</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tasks yet
                </p>
              )}
            </CardContent>
            <CardFooter className="p-4 sm:p-6 pt-0 flex gap-2 justify-end">
              {deptType === 'support' ? (
                <>
                  <Button variant="outline" size="sm" asChild data-testid="link-open-tickets">
                    <Link href="/tickets?status=open,in_progress">
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      Open Tickets
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild data-testid="link-all-tickets">
                    <Link href="/tickets">
                      View All
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild data-testid="link-todays-tasks">
                    <Link href="/tasks/today">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      Today's Tasks
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild data-testid="link-all-tasks">
                    <Link href="/tasks">
                      View All
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>

          {/* My Tickets Panel - Shows assigned tickets for non-support users who have tickets */}
          {hasAssignedTickets && deptType !== 'support' && (
            <Card>
              <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Headphones className="h-4 w-4" />
                  My Assigned Tickets
                </CardTitle>
                <div className="flex gap-1">
                  {openTicketsCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {openTicketsCount} open
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {closedTicketsCount} closed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {myTicketsLoading ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : openTicketsCount > 0 ? (
                  <div className="space-y-2" data-testid="dashboard-my-tickets">
                    {myTickets
                      .filter(t => t.status !== 'closed' && t.status !== 'resolved')
                      .slice(0, 5)
                      .map((ticket) => {
                        const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date();
                        return (
                          <div 
                            key={ticket.id}
                            className={`flex gap-2 items-start p-2 rounded ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                            data-testid={`dashboard-ticket-${ticket.id}`}
                          >
                            <div className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                              ticket.priority === 'critical' ? 'text-red-500' :
                              ticket.priority === 'high' ? 'text-orange-500' :
                              ticket.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                            }`}>
                              {isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Headphones className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate font-medium">{ticket.ticketNumber}</p>
                              <p className="text-xs text-muted-foreground truncate">{ticket.issueSummary}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={ticket.priority === 'critical' ? 'destructive' : 'outline'} className="text-[10px] h-4">
                                  {ticket.priority}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  {ticket.status.replace('_', ' ')}
                                </Badge>
                                {isOverdue && (
                                  <span className="text-[10px] text-red-500 font-medium">Overdue</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {openTicketsCount > 5 && (
                      <p className="text-xs text-muted-foreground text-center">+{openTicketsCount - 5} more open tickets</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">All tickets resolved!</p>
                    <p className="text-xs text-muted-foreground mt-1">{closedTicketsCount} tickets closed</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 sm:p-6 pt-0 flex justify-end">
                <Button variant="ghost" size="sm" asChild data-testid="link-all-tickets">
                  <Link href="/tickets">
                    View All Tickets
                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Recent Leads - Only show for users with leads permission and no assigned tickets */}
          {!hasAssignedTickets && !leadsError && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Recent Leads</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {leadsLoading ? (
                  <div className="space-y-3">
                    {Array(3)
                      .fill(0)
                      .map((_, i) => (
                        <Skeleton key={i} className="h-12 sm:h-16 w-full" />
                      ))}
                  </div>
                ) : recentLeads && recentLeads.length > 0 ? (
                  <div className="space-y-3">
                    {recentLeads.map((lead) => (
                      <div key={lead.id} className="text-sm space-y-1">
                        <div className="font-medium truncate">{lead.companyName}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {lead.stage.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent leads
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active Projects - Only show for users with projects permission */}
          {!projectsError && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Active Projects</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {projectsLoading ? (
                  <div className="space-y-3">
                    {Array(3)
                      .fill(0)
                      .map((_, i) => (
                        <Skeleton key={i} className="h-12 sm:h-16 w-full" />
                      ))}
                  </div>
                ) : activeProjects && activeProjects.length > 0 ? (
                  <div className="space-y-3">
                    {activeProjects.map((project) => (
                      <div key={project.id} className="text-sm space-y-1">
                        <div className="font-medium truncate">{project.clientName}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {project.status.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {project.completionPercentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active projects
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {ticketsLoading ? (
                <div className="space-y-3">
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Skeleton key={i} className="h-12 sm:h-16 w-full" />
                    ))}
                </div>
              ) : openTickets && openTickets.length > 0 ? (
                <div className="space-y-3">
                  {openTickets.map((ticket) => (
                    <div key={ticket.id} className="text-sm space-y-1">
                      <div className="font-medium font-mono text-xs">
                        {ticket.ticketNumber}
                      </div>
                      <div className="truncate text-xs">{ticket.issueSummary}</div>
                      <Badge
                        variant={
                          ticket.priority === "critical"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {ticket.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No open tickets
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
