import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import TaskFormDialog from "@/components/task-form-dialog";
import TaskDetailModal from "@/components/task-detail-modal";

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
  const [viewFilter, setViewFilter] = useState<string>("own"); // own, all (admin only)
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;

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

  // Group tasks by status for kanban-like view
  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === "pending"),
    followup: filteredTasks.filter(t => t.status === "followup"),
    get_information: filteredTasks.filter(t => t.status === "get_information"),
    completed: filteredTasks.filter(t => t.status === "completed"),
  };

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
          
          {task.mentionedUserDetails && task.mentionedUserDetails.length > 0 && (
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
        
        <Button onClick={() => {
          setEditingTask(null);
          setShowCreateDialog(true);
        }} data-testid="button-create-task">
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
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

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-list-view">List View</TabsTrigger>
          <TabsTrigger value="board" data-testid="tab-board-view">Board View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4">
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
              <div className="grid gap-4">
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
        </TabsContent>
        
        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-sm text-muted-foreground">({statusTasks.length})</span>
                  </div>
                  <div className="space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-2">
                    {statusTasks.map(renderTaskCard)}
                    {statusTasks.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

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
