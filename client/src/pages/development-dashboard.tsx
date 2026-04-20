import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Code2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ListTodo,
  TrendingDown,
  ArrowRight,
  PlayCircle,
  PauseCircle,
  Hourglass,
  Headphones,
  Wrench,
  ClipboardCheck,
  FileText,
  Users,
  Building2
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface DashboardMetrics {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalPenaltyPoints: number;
  // Enhanced categories
  yetToWorkTasks: number;
  onProcessTasks: number;
  waitingTasks: number;
  // Source breakdown
  supportTasks: number;
  implementationTasks: number;
  taskModuleTasks: number;
  manualTasks: number;
}

interface DeveloperSummary {
  developer: { id: string; firstName: string; lastName: string; email: string };
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  total: number;
}

interface ClientSummary {
  customer: { id: string; name: string; code: string };
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  total: number;
  sources: { support: number; implementation: number; task: number; manual: number };
}

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export default function DevelopmentDashboard() {
  const { user } = useAuth();
  const { canView, isLoading: permissionsLoading } = usePermissions();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/development/dashboard"],
  });

  const { data: developerSummary } = useQuery<DeveloperSummary[]>({
    queryKey: ["/api/development/developer-summary"],
  });

  const { data: clientSummary } = useQuery<ClientSummary[]>({
    queryKey: ["/api/development/client-summary"],
  });

  if (permissionsLoading || !user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }
  
  const hasAccess = user.email === SUPER_ADMIN_EMAIL || 
                   user.role === "admin" || 
                   canView("development_dashboard");

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access the Development Dashboard.
        </p>
        <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
          Go Back
        </Button>
      </div>
    );
  }

  const completionRate = metrics && metrics.totalTasks > 0 
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) 
    : 0;

  const inProgressRate = metrics && metrics.totalTasks > 0 
    ? Math.round((metrics.inProgressTasks / metrics.totalTasks) * 100) 
    : 0;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="development-dashboard-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Code2 className="h-7 w-7 text-indigo-600" />
            Development Dashboard
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Track development tasks, deadlines, and team performance
          </p>
        </div>
        <Link href="/development/tasks">
          <Button data-testid="button-view-all-tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            View All Tasks
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid">
        <Card data-testid="card-total-tasks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tasks">
              {metrics?.totalTasks || 0}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-pending-count">
              {metrics?.pendingTasks || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-in-progress">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Code2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-in-progress">
              {metrics?.inProgressTasks || 0}
            </div>
            <Progress 
              value={inProgressRate} 
              className="h-2 mt-2"
              data-testid="progress-in-progress"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {inProgressRate}% of total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-completed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed">
              {metrics?.completedTasks || 0}
            </div>
            <Progress 
              value={completionRate} 
              className="h-2 mt-2"
              data-testid="progress-completed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className={metrics && metrics.overdueTasks > 0 ? "border-red-200 dark:border-red-800" : ""} data-testid="card-overdue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue">
              {metrics?.overdueTasks || 0}
            </div>
            {metrics && metrics.totalPenaltyPoints > 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1" data-testid="text-penalty-points">
                <TrendingDown className="h-3 w-3" />
                {metrics.totalPenaltyPoints} penalty points
              </p>
            )}
            {(!metrics || metrics.overdueTasks === 0) && (
              <p className="text-xs text-muted-foreground">
                No overdue tasks
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Work Status Categories - Tech Head & Super Admin View */}
      <Card data-testid="card-work-status">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-500" />
            Work Status Categories
          </CardTitle>
          <CardDescription>Overview of task status for Tech Head and Super Admin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-center" data-testid="card-yet-to-work">
              <Hourglass className="h-8 w-8 mx-auto text-gray-500 mb-2" />
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{metrics?.yetToWorkTasks || 0}</div>
              <p className="text-sm text-muted-foreground">Yet to Work</p>
              <p className="text-xs text-muted-foreground mt-1">Unassigned tasks</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-center" data-testid="card-on-process">
              <PlayCircle className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics?.onProcessTasks || 0}</div>
              <p className="text-sm text-blue-600 dark:text-blue-400">On Process</p>
              <p className="text-xs text-muted-foreground mt-1">Work in progress</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-center" data-testid="card-waiting">
              <PauseCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{metrics?.waitingTasks || 0}</div>
              <p className="text-sm text-amber-600 dark:text-amber-400">Pending</p>
              <p className="text-xs text-muted-foreground mt-1">Assigned, not started</p>
            </div>
            <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/40 text-center" data-testid="card-completed-status">
              <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics?.completedTasks || 0}</div>
              <p className="text-sm text-green-600 dark:text-green-400">Completed</p>
              <p className="text-xs text-muted-foreground mt-1">Work finished</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Breakdown */}
      <Card data-testid="card-source-breakdown">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            Tasks by Source
          </CardTitle>
          <CardDescription>Breakdown of development tasks from different modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border text-center hover-elevate" data-testid="card-support-tasks">
              <Headphones className="h-6 w-6 mx-auto text-orange-500 mb-2" />
              <div className="text-xl font-bold">{metrics?.supportTasks || 0}</div>
              <p className="text-sm text-muted-foreground">From Support</p>
            </div>
            <div className="p-4 rounded-lg border text-center hover-elevate" data-testid="card-implementation-tasks">
              <Wrench className="h-6 w-6 mx-auto text-amber-500 mb-2" />
              <div className="text-xl font-bold">{metrics?.implementationTasks || 0}</div>
              <p className="text-sm text-muted-foreground">From Implementation</p>
            </div>
            <div className="p-4 rounded-lg border text-center hover-elevate" data-testid="card-task-module-tasks">
              <ClipboardCheck className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <div className="text-xl font-bold">{metrics?.taskModuleTasks || 0}</div>
              <p className="text-sm text-muted-foreground">From Tasks</p>
            </div>
            <div className="p-4 rounded-lg border text-center hover-elevate" data-testid="card-manual-tasks">
              <ListTodo className="h-6 w-6 mx-auto text-gray-500 mb-2" />
              <div className="text-xl font-bold">{metrics?.manualTasks || 0}</div>
              <p className="text-sm text-muted-foreground">Manual</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Developer-wise Work List */}
      <Card data-testid="card-developer-summary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Developer-wise Work List
          </CardTitle>
          <CardDescription>Task distribution across developers</CardDescription>
        </CardHeader>
        <CardContent>
          {!developerSummary || developerSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No developer assignments found</p>
          ) : (
            <div className="space-y-3">
              {developerSummary.map((dev) => (
                <div key={dev.developer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate" data-testid={`developer-row-${dev.developer.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                        {dev.developer.firstName?.[0]}{dev.developer.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{dev.developer.firstName} {dev.developer.lastName}</p>
                      <p className="text-xs text-muted-foreground">{dev.total} total tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {dev.pending > 0 && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs">
                        {dev.pending} Pending
                      </Badge>
                    )}
                    {dev.inProgress > 0 && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                        {dev.inProgress} In Progress
                      </Badge>
                    )}
                    {dev.completed > 0 && (
                      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                        {dev.completed} Done
                      </Badge>
                    )}
                    {dev.overdue > 0 && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">
                        {dev.overdue} Overdue
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client-based Work List */}
      <Card data-testid="card-client-summary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-500" />
            Client-based Work List
          </CardTitle>
          <CardDescription>Task distribution by customer with source breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {!clientSummary || clientSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No client-based tasks found</p>
          ) : (
            <div className="space-y-3">
              {clientSummary.map((client) => (
                <div key={client.customer.id} className="p-3 rounded-lg bg-muted/50 hover-elevate" data-testid={`client-row-${client.customer.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
                          {client.customer.name?.[0]?.toUpperCase() || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{client.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{client.customer.code} • {client.total} total tasks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {client.pending > 0 && (
                        <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs">
                          {client.pending} Pending
                        </Badge>
                      )}
                      {client.inProgress > 0 && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                          {client.inProgress} In Progress
                        </Badge>
                      )}
                      {client.completed > 0 && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                          {client.completed} Done
                        </Badge>
                      )}
                      {client.overdue > 0 && (
                        <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">
                          {client.overdue} Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Source breakdown for this client */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground pl-12">
                    {client.sources.support > 0 && (
                      <span className="flex items-center gap-1">
                        <Headphones className="h-3 w-3 text-orange-500" />
                        {client.sources.support} Support
                      </span>
                    )}
                    {client.sources.implementation > 0 && (
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-amber-500" />
                        {client.sources.implementation} Implementation
                      </span>
                    )}
                    {client.sources.task > 0 && (
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="h-3 w-3 text-green-500" />
                        {client.sources.task} Task
                      </span>
                    )}
                    {client.sources.manual > 0 && (
                      <span className="flex items-center gap-1">
                        <ListTodo className="h-3 w-3 text-gray-500" />
                        {client.sources.manual} Manual
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="info-grid">
        <Card data-testid="card-quick-stats">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Quick Stats
            </CardTitle>
            <CardDescription>Overview of development workload</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Pending
                  </Badge>
                </span>
                <span className="text-muted-foreground" data-testid="stat-pending">{metrics?.pendingTasks || 0}</span>
              </div>
              <Progress value={metrics ? (metrics.pendingTasks / (metrics.totalTasks || 1)) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    In Progress
                  </Badge>
                </span>
                <span className="text-muted-foreground" data-testid="stat-in-progress">{metrics?.inProgressTasks || 0}</span>
              </div>
              <Progress value={inProgressRate} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Completed
                  </Badge>
                </span>
                <span className="text-muted-foreground" data-testid="stat-completed">{metrics?.completedTasks || 0}</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    Overdue
                  </Badge>
                </span>
                <span className="text-muted-foreground" data-testid="stat-overdue">{metrics?.overdueTasks || 0}</span>
              </div>
              <Progress value={metrics ? (metrics.overdueTasks / (metrics.totalTasks || 1)) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-actions">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-indigo-500" />
              Quick Actions
            </CardTitle>
            <CardDescription>Navigate to task management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/development/tasks" className="block">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer" data-testid="link-all-tasks">
                <div className="flex items-center gap-3">
                  <ListTodo className="h-5 w-5 text-indigo-500" />
                  <div>
                    <p className="font-medium">View All Tasks</p>
                    <p className="text-xs text-muted-foreground">Manage and track all development tasks</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            {metrics && metrics.overdueTasks > 0 && (
              <Link href="/development/tasks" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 hover-elevate cursor-pointer border border-red-200 dark:border-red-800" data-testid="link-overdue-tasks">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-300">Overdue Tasks</p>
                      <p className="text-xs text-red-500">{metrics.overdueTasks} task{metrics.overdueTasks > 1 ? 's' : ''} need attention</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-500" />
                </div>
              </Link>
            )}
            {metrics && metrics.inProgressTasks > 0 && (
              <Link href="/development/tasks" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover-elevate cursor-pointer" data-testid="link-in-progress-tasks">
                  <div className="flex items-center gap-3">
                    <Code2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-300">In Progress</p>
                      <p className="text-xs text-blue-500">{metrics.inProgressTasks} task{metrics.inProgressTasks > 1 ? 's' : ''} being worked on</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
