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

export default function Home() {
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/dashboard/activities"],
  });

  const { data: recentLeads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads?limit=5"],
  });

  const { data: activeProjects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects?status=in_progress"],
  });

  const { data: openTickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets?status=open&limit=5"],
  });

  // Fetch current user to check if admin
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isAdmin = currentUser?.role === "admin";

  // Fetch user's tasks for dashboard display (no view param = user's own tasks)
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks"],
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

  const metricCards = [
    {
      title: "Active Leads",
      value: stats?.activeLeads || 0,
      change: stats?.leadsChange || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      title: "Ongoing Implementations",
      value: stats?.ongoingProjects || 0,
      change: stats?.projectsChange || 0,
      icon: Wrench,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: "Open Tickets",
      value: stats?.openTickets || 0,
      change: stats?.ticketsChange || 0,
      icon: Headphones,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
    },
    {
      title: "This Month's Closures",
      value: stats?.monthlyClosures || 0,
      change: stats?.closuresChange || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
    },
  ];

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold mb-1" data-testid="text-greeting">
          Hi {userName}, {greeting}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome to your M-CRM dashboard
        </p>
      </div>

      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statsLoading
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
              <Card key={card.title} data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
                    {card.change > 0 ? (
                      <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                    ) : card.change < 0 ? (
                      <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
                    ) : null}
                    <span className={card.change > 0 ? "text-green-600" : card.change < 0 ? "text-red-600" : ""}>
                      {card.change > 0 ? "+" : ""}{card.change}%
                    </span>
                    <span className="ml-1 hidden sm:inline">vs last month</span>
                  </div>
                </CardContent>
              </Card>
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
          {/* My Tasks Panel */}
          <Card>
            <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                My Tasks
              </CardTitle>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  {pendingTasks.length} pending
                </Badge>
                {recentlyCompletedTasks.length > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                    {recentlyCompletedTasks.length} done
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {tasksLoading ? (
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
            </CardFooter>
          </Card>

          {/* Recent Leads */}
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
