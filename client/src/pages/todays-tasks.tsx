import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, User, TaskFollowup } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Users,
  User as UserIcon,
  Bell,
  Mic,
  Video,
  Image,
  MessageSquare,
  Filter,
  RefreshCcw,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import TaskDetailModal from "@/components/task-detail-modal";

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  followupsCount?: number;
  latestFollowup?: TaskFollowup;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Circle },
  followup: { label: "Follow Up", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  get_information: { label: "Get Info", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: Users },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export default function TodaysTasksPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isSuperAdmin = currentUser?.email === 'senthil@microgenn.com';

  // Fetch today's tasks
  const { data: tasks = [], isLoading, refetch } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks/today"],
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.creator?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee?.firstName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Group by assignee for super admin view
  const tasksByAssignee = isSuperAdmin ? 
    filteredTasks.reduce((acc, task) => {
      const assigneeId = task.assignedTo || 'unassigned';
      const assigneeName = task.assignee ? 
        `${task.assignee.firstName} ${task.assignee.lastName}` : 
        'Unassigned';
      if (!acc[assigneeId]) {
        acc[assigneeId] = { name: assigneeName, tasks: [] };
      }
      acc[assigneeId].tasks.push(task);
      return acc;
    }, {} as Record<string, { name: string; tasks: TaskWithDetails[] }>) : null;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return format(new Date(date), "MMM d, yyyy h:mm a");
  };

  const getFollowupTypeIcon = (type: string) => {
    switch (type) {
      case 'voice': return <Mic className="h-3 w-3" />;
      case 'video': return <Video className="h-3 w-3" />;
      case 'image': return <Image className="h-3 w-3" />;
      default: return <MessageSquare className="h-3 w-3" />;
    }
  };

  const renderTaskRow = (task: TaskWithDetails) => {
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const priorityConfig = PRIORITY_CONFIG[task.priority || "medium"];
    const StatusIcon = statusConfig.icon;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";

    return (
      <TableRow 
        key={task.id} 
        className={`cursor-pointer hover:bg-muted/50 ${isOverdue ? "bg-red-50 dark:bg-red-900/10" : ""}`}
        onClick={() => setSelectedTask(task)}
        data-testid={`row-task-${task.id}`}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <p className="font-medium truncate max-w-[200px]">{task.title}</p>
              {task.description && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{task.description}</p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={statusConfig.color}>
            {statusConfig.label}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={priorityConfig.color}>
            {priorityConfig.label}
          </Badge>
        </TableCell>
        <TableCell>
          {task.assignee ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={task.assignee.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(task.assignee.firstName, task.assignee.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{task.assignee.firstName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Unassigned</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col text-sm">
            {task.reminderDate && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Bell className="h-3 w-3" />
                {formatDate(task.reminderDate)}
              </span>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {task.followupsCount || 0} follow-ups
            </Badge>
            {task.latestFollowup && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getFollowupTypeIcon(task.latestFollowup.followupType)}
                <span>{formatDate(task.latestFollowup.createdAt)}</span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(task);
            }}
            data-testid={`button-view-task-${task.id}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CalendarDays className="h-6 w-6 text-primary" />
            Today's Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin ? "All team tasks for today" : "Your tasks for today"} - {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Circle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'followup').length}</p>
                <p className="text-xs text-muted-foreground">Follow-up</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length}
                </p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="followup">Follow Up</SelectItem>
                <SelectItem value="get_information">Get Info</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      {isSuperAdmin && tasksByAssignee ? (
        // Super Admin View - Grouped by Assignee
        <div className="space-y-6">
          {Object.entries(tasksByAssignee).map(([assigneeId, { name, tasks: assigneeTasks }]) => (
            <Card key={assigneeId}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  {name}
                  <Badge variant="secondary" className="ml-2">{assigneeTasks.length} tasks</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Follow-ups</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assigneeTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No tasks for today
                        </TableCell>
                      </TableRow>
                    ) : (
                      assigneeTasks.map(renderTaskRow)
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Regular User View
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Tasks ({filteredTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Follow-ups</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {tasks.length === 0 ? "No tasks for today" : "No tasks match your filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map(renderTaskRow)
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
}
