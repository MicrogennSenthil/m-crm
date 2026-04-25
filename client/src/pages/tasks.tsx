import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Calendar,
  Clock,
  MessageSquare,
  Mic,
  MoreVertical,
  CheckCircle2,
  Circle,
  AlertCircle,
  Users,
  User as UserIcon,
  Bell,
  Trash2,
  Edit,
  Filter,
  Columns3,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useVoiceAlerts } from "@/providers/VoiceAlertProvider";
import TaskFormDialog from "@/components/task-form-dialog";
import TaskDetailModal from "@/components/task-detail-modal";

type LayoutType = "kanban" | "card" | "table";

const TASK_STAGES = [
  { id: "pending", title: "Pending", color: "bg-yellow-600" },
  { id: "followup", title: "Follow Up", color: "bg-blue-600" },
  { id: "get_information", title: "Get Info", color: "bg-purple-600" },
  { id: "completed", title: "Completed", color: "bg-green-600" },
];

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  mentionedUserDetails?: User[];
  commentsCount?: number;
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

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export default function TasksPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Admin users default to seeing all tasks, non-admins see their own
  const [viewFilter, setViewFilter] = useState<string>("all"); // own, all (admin only) - defaults to "all" for admins
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [layout, setLayout] = useState<LayoutType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tasks-layout") as LayoutType) || "card";
    }
    return "card";
  });
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  // Voice alerts for tasks department
  const {
    alerts: voiceAlerts,
    alertCounts,
    isEnabled: voiceAlertsEnabled,
    isSpeaking,
    isSupported: voiceSupported,
    announceAllPending,
    stopSpeaking,
  } = useVoiceAlerts('tasks');

  useEffect(() => {
    localStorage.setItem("tasks-layout", layout);
  }, [layout]);

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(t => t.status === status);
  };

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
  const isAdmin = currentUser?.role?.toLowerCase() === "admin" || isSuperAdmin;

  // Fetch tasks based on view filter (own vs all for admins)
  const { data: tasks = [], isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks", { view: viewFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isAdmin && viewFilter === "all") params.set("view", "all");
      const url = `/api/tasks${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!currentUser,
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  // Filter tasks (server handles own/all filtering, client handles search and status)
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.creator?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee?.firstName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const renderTaskCard = (task: TaskWithDetails) => {
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const priorityConfig = PRIORITY_CONFIG[task.priority || "medium"];
    const StatusIcon = statusConfig.icon;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";
    const hasReminder = task.reminderDate && new Date(task.reminderDate) <= new Date();
    
    return (
      <Card 
        key={task.id} 
        className={`hover-elevate cursor-pointer transition-all ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}
        onClick={() => setSelectedTask(task)}
        data-testid={`task-card-${task.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h3 className="font-medium truncate">{task.title}</h3>
              </div>
              
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {task.description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={statusConfig.color} variant="secondary">
                  {statusConfig.label}
                </Badge>
                <Badge className={priorityConfig.color} variant="secondary">
                  {priorityConfig.label}
                </Badge>
                {task.voiceNoteUrl && (
                  <Badge variant="outline" className="gap-1">
                    <Mic className="h-3 w-3" />
                    Voice
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {task.dueDate && (
                  <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.dueDate), "MMM d, h:mm a")}
                  </span>
                )}
                {task.reminderDate && (
                  <span className={`flex items-center gap-1 ${hasReminder ? "text-orange-500" : ""}`}>
                    <Bell className="h-3 w-3" />
                    {format(new Date(task.reminderDate), "MMM d, h:mm a")}
                  </span>
                )}
                {task.commentsCount && task.commentsCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {task.commentsCount}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`task-menu-${task.id}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                    setShowCreateDialog(true);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatusMutation.mutate({ taskId: task.id, status: "completed" });
                    }}
                    disabled={task.status === "completed"}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </DropdownMenuItem>
                  {(isAdmin || task.createdBy === currentUser?.id) && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this task?")) {
                          deleteTaskMutation.mutate(task.id);
                        }
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex -space-x-2">
                {task.assignee && (
                  <Avatar className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={task.assignee.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </div>
          
          {Array.isArray(task.mentionedUserDetails) && task.mentionedUserDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Mentioned:</span>
                <div className="flex -space-x-1">
                  {task.mentionedUserDetails.slice(0, 3).map((user) => (
                    <Avatar key={user.id} className="h-5 w-5 border border-background">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {user.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {task.mentionedUserDetails.length > 3 && (
                  <span>+{task.mentionedUserDetails.length - 3}</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" data-testid="page-title">Tasks & Follow-ups</h1>
          <p className="text-muted-foreground">Manage your tasks and follow-ups</p>
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
          <Button onClick={() => {
            setEditingTask(null);
            setShowCreateDialog(true);
          }} data-testid="button-create-task">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tasks"
          />
        </div>
        
        <div className="flex gap-2">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
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
          
          {/* Admin/Super Admin can toggle between Own and All tasks */}
          {isAdmin && (
            <Select value={viewFilter} onValueChange={setViewFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-view-filter">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own">My Tasks</SelectItem>
                <SelectItem value="all">All Tasks</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Kanban View */}
      {layout === "kanban" && (
        <div className="grid grid-cols-4 gap-3 pb-4 overflow-x-auto">
          {TASK_STAGES.map((stage) => {
            const stageTasks = getTasksByStatus(stage.id);
            return (
              <div key={stage.id} className="min-w-[220px]">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`} />
                  <h3 className="font-semibold text-xs sm:text-sm truncate">{stage.title}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {stageTasks.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {isLoading ? (
                    Array(2).fill(0).map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-3">
                          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-1/2"></div>
                        </CardContent>
                      </Card>
                    ))
                  ) : stageTasks.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4 bg-muted/30 rounded-lg">
                      No tasks
                    </div>
                  ) : (
                    stageTasks.map(renderTaskCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card View */}
      {layout === "card" && (
        <>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search or filters" : "Create your first task to get started"}
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginateData(filteredTasks).map(renderTaskCard)}
              </div>
              {filteredTasks.length > 0 && (
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={getTotalPages(filteredTasks.length)}
                  pageSize={pageSize}
                  totalItems={filteredTasks.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Table View */}
      {layout === "table" && (
        <>
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ) : filteredTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search or filters" : "Create your first task to get started"}
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </Card>
          ) : (
            <>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Reminder</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginateData(filteredTasks).map((task) => {
                        const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                        const priorityConfig = PRIORITY_CONFIG[task.priority || "medium"];
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";
                        const hasReminder = task.reminderDate && new Date(task.reminderDate) <= new Date();
                        
                        return (
                          <TableRow 
                            key={task.id} 
                            className={`cursor-pointer ${isOverdue ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                            onClick={() => setSelectedTask(task)}
                            data-testid={`row-task-${task.id}`}
                          >
                            <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-task-title-${task.id}`}>
                              <div className="flex items-center gap-2">
                                {isOverdue && <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                <span className="truncate">{task.title}</span>
                                {task.voiceNoteUrl && <Mic className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.color} variant="secondary" data-testid={`badge-status-${task.id}`}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={priorityConfig.color} variant="secondary" data-testid={`badge-priority-${task.id}`}>
                                {priorityConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {task.assignee ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={task.assignee.profileImageUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm truncate max-w-[80px]">
                                    {task.assignee.firstName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-due-${task.id}`}>
                              {task.dueDate ? (
                                <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                                  {format(new Date(task.dueDate), "MMM d, h:mm a")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-reminder-${task.id}`}>
                              {task.reminderDate ? (
                                <span className={hasReminder ? "text-orange-500 font-medium" : ""}>
                                  {format(new Date(task.reminderDate), "MMM d")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`task-menu-${task.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTask(task);
                                    setShowCreateDialog(true);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStatusMutation.mutate({ taskId: task.id, status: "completed" });
                                    }}
                                    disabled={task.status === "completed"}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                  {(isAdmin || task.createdBy === currentUser?.id) && (
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Are you sure you want to delete this task?")) {
                                          deleteTaskMutation.mutate(task.id);
                                        }
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              {filteredTasks.length > 0 && (
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={getTotalPages(filteredTasks.length)}
                  pageSize={pageSize}
                  totalItems={filteredTasks.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </>
          )}
        </>
      )}

      <TaskFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        task={editingTask}
        onSuccess={() => {
          setShowCreateDialog(false);
          setEditingTask(null);
        }}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onTaskUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          }}
        />
      )}
    </div>
  );
}
