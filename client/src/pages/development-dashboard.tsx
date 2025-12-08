import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Code2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Timer,
  Search,
  ListTodo,
  TrendingDown,
  Calendar,
  User,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { User as UserType } from "@shared/schema";

interface DevelopmentTask {
  id: string;
  taskNumber: string;
  title: string;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceReference: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  priority: string;
  status: string;
  deadline: string;
  estimatedHours: number | null;
  actualHours: number | null;
  isOverdue: boolean;
  penaltyApplied: boolean;
  penaltyPoints: number | null;
  penaltyReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: UserType;
  assignedByUser?: UserType;
}

interface DashboardMetrics {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalPenaltyPoints: number;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock, label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Code2, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2, label: "Completed" },
  overdue: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: AlertTriangle, label: "Overdue" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: "bg-gray-100 text-gray-700", label: "Low" },
  medium: { color: "bg-yellow-100 text-yellow-700", label: "Medium" },
  high: { color: "bg-orange-100 text-orange-700", label: "High" },
  critical: { color: "bg-red-100 text-red-700", label: "Critical" },
};

const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  implementation: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", label: "Implementation" },
  support: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Support" },
  task: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", label: "Task" },
  manual: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Manual" },
};

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export default function DevelopmentDashboard() {
  const { user } = useAuth();
  const { canView } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const hasAccess = user?.email === SUPER_ADMIN_EMAIL || 
                   user?.role === "admin" || 
                   canView("development_dashboard");

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access the Development Dashboard.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/development/dashboard"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<DevelopmentTask[]>({
    queryKey: ["/api/development/tasks"],
  });

  const filteredTasks = tasks?.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !task.taskNumber.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (sourceFilter !== "all" && task.sourceType !== sourceFilter) return false;
    return true;
  }) || [];

  const isLoading = metricsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const completionRate = metrics && metrics.totalTasks > 0 
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) 
    : 0;

  const overdueTasks = filteredTasks.filter(t => t.isOverdue || t.status === "overdue");
  const recentTasks = [...filteredTasks].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="h-7 w-7 text-indigo-600" />
            Development Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track development tasks, deadlines, and team performance
          </p>
        </div>
        <Link href="/development/tasks">
          <Button data-testid="button-view-all-tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            View All Tasks
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tasks">
              {metrics?.totalTasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.pendingTasks || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Code2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-in-progress">
              {metrics?.inProgressTasks || 0}
            </div>
            <Progress 
              value={metrics && metrics.totalTasks > 0 
                ? (metrics.inProgressTasks / metrics.totalTasks) * 100 
                : 0} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed">
              {metrics?.completedTasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className={metrics && metrics.overdueTasks > 0 ? "border-red-200 dark:border-red-800" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue">
              {metrics?.overdueTasks || 0}
            </div>
            {metrics && metrics.totalPenaltyPoints > 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {metrics.totalPenaltyPoints} penalty points
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="overdue" data-testid="tab-overdue">
            Overdue ({overdueTasks.length})
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="tab-recent">Recent Tasks</TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-tasks"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="implementation">Implementation</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Timer className="h-5 w-5 text-orange-500" />
                  Tasks by Source
                </CardTitle>
                <CardDescription>Distribution of tasks by origin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(SOURCE_CONFIG).map(([source, config]) => {
                  const count = tasks?.filter(t => t.sourceType === source).length || 0;
                  const percentage = tasks?.length ? (count / tasks.length) * 100 : 0;
                  return (
                    <div key={source} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>Tasks due soon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredTasks
                    .filter(t => t.status !== "completed" && t.deadline)
                    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                    .slice(0, 5)
                    .map(task => {
                      const deadline = new Date(task.deadline);
                      const isOverdue = deadline < new Date();
                      return (
                        <div 
                          key={task.id} 
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            isOverdue ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.taskNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : ""}`}>
                              {format(deadline, "MMM d")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {filteredTasks.filter(t => t.status !== "completed" && t.deadline).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No upcoming deadlines
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Overdue Tasks
              </CardTitle>
              <CardDescription>Tasks that have passed their deadline</CardDescription>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No overdue tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueTasks.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{task.taskNumber}</span>
                            <span>•</span>
                            <Badge variant="outline" className={SOURCE_CONFIG[task.sourceType]?.color || ""}>
                              {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {task.assignee && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-xs text-red-600 font-medium">
                            Due: {format(new Date(task.deadline), "MMM d, yyyy")}
                          </p>
                          {task.penaltyPoints && task.penaltyPoints > 0 && (
                            <p className="text-xs text-red-500">-{task.penaltyPoints} pts</p>
                          )}
                        </div>
                        <Link href={`/development/tasks/${task.id}`}>
                          <Button size="sm" variant="ghost">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Recent Tasks
              </CardTitle>
              <CardDescription>Latest assigned development tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTasks.length === 0 ? (
                <div className="text-center py-8">
                  <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tasks yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map(task => {
                    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon className="h-5 w-5" />
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{task.taskNumber}</span>
                              <span>•</span>
                              <Badge variant="outline" className={SOURCE_CONFIG[task.sourceType]?.color || ""}>
                                {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                              </Badge>
                              <span>•</span>
                              <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color || ""}>
                                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {task.assignee && (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {task.assignee.firstName}
                              </span>
                            </div>
                          )}
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          <Link href={`/development/tasks/${task.id}`}>
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
