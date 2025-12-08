import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Code2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  Plus,
  MessageSquare,
  Calendar,
  User,
  Play,
  Pause,
  Edit,
  Trash2,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface TaskComment {
  id: string;
  developmentTaskId: string;
  userId: string | null;
  content: string;
  createdAt: string;
  user?: UserType;
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

export default function DevelopmentTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTask, setSelectedTask] = useState<DevelopmentTask | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    sourceType: "manual",
    priority: "medium",
    deadline: "",
    assignedTo: "",
    estimatedHours: "",
  });

  const isAdmin = user?.email === SUPER_ADMIN_EMAIL || user?.role === "admin";
  const hasAccess = isAdmin || canView("development_tasks");

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access Development Tasks.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { data: tasks, isLoading } = useQuery<DevelopmentTask[]>({
    queryKey: ["/api/development/tasks"],
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: comments } = useQuery<TaskComment[]>({
    queryKey: ["/api/development/tasks", selectedTask?.id, "comments"],
    enabled: !!selectedTask,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return await apiRequest("POST", "/api/development/tasks", taskData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      setIsCreateDialogOpen(false);
      setNewTask({
        title: "",
        description: "",
        sourceType: "manual",
        priority: "medium",
        deadline: "",
        assignedTo: "",
        estimatedHours: "",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/development/tasks/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      return await apiRequest("POST", `/api/development/tasks/${taskId}/comments`, { content });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Comment added" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks", selectedTask?.id, "comments"] });
      setNewComment("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/development/tasks/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      setIsDetailDialogOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const filteredTasks = tasks?.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !task.taskNumber.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (activeTab === "pending" && task.status !== "pending") return false;
    if (activeTab === "in_progress" && task.status !== "in_progress") return false;
    if (activeTab === "completed" && task.status !== "completed") return false;
    if (activeTab === "overdue" && task.status !== "overdue" && !task.isOverdue) return false;
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (sourceFilter !== "all" && task.sourceType !== sourceFilter) return false;
    return true;
  }) || [];

  const handleStatusChange = (task: DevelopmentTask, newStatus: string) => {
    updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.deadline) {
      toast({ title: "Error", description: "Title and deadline are required", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate({
      ...newTask,
      estimatedHours: newTask.estimatedHours ? parseInt(newTask.estimatedHours) : null,
      assignedTo: newTask.assignedTo || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingCount = tasks?.filter(t => t.status === "pending").length || 0;
  const inProgressCount = tasks?.filter(t => t.status === "in_progress").length || 0;
  const completedCount = tasks?.filter(t => t.status === "completed").length || 0;
  const overdueCount = tasks?.filter(t => t.status === "overdue" || t.isOverdue).length || 0;

  const developers = users?.filter(u => 
    u.isActive !== false && 
    (u.role === "developer" || u.role === "engineer" || u.role === "admin")
  ) || [];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="h-7 w-7 text-indigo-600" />
            Development Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage development work from Implementation, Support, and Tasks
          </p>
        </div>
        {(isAdmin || canCreate("development_tasks")) && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-task">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress">
            In Progress ({inProgressCount})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedCount})
          </TabsTrigger>
          <TabsTrigger value="overdue" data-testid="tab-overdue" className={overdueCount > 0 ? "text-red-600" : ""}>
            Overdue ({overdueCount})
          </TabsTrigger>
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

        <TabsContent value={activeTab} className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const deadline = new Date(task.deadline);
                const isOverdue = task.isOverdue || deadline < new Date();
                
                return (
                  <Card 
                    key={task.id} 
                    className={`cursor-pointer hover-elevate ${isOverdue && task.status !== "completed" ? "border-red-200 dark:border-red-800" : ""}`}
                    onClick={() => {
                      setSelectedTask(task);
                      setIsDetailDialogOpen(true);
                    }}
                    data-testid={`card-task-${task.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <StatusIcon className={`h-5 w-5 mt-0.5 ${isOverdue && task.status !== "completed" ? "text-red-500" : ""}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">{task.taskNumber}</span>
                              <Badge variant="outline" className={SOURCE_CONFIG[task.sourceType]?.color || ""}>
                                {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                              </Badge>
                              <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color || ""}>
                                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                              </Badge>
                            </div>
                            <h3 className="font-medium mt-1">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due: {format(deadline, "MMM d, yyyy")}
                              </span>
                              {task.sourceReference && (
                                <span className="flex items-center gap-1">
                                  Ref: {task.sourceReference}
                                </span>
                              )}
                              {task.estimatedHours && (
                                <span>Est: {task.estimatedHours}h</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {task.assignee && (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {task.assignee.firstName} {task.assignee.lastName}
                              </span>
                            </div>
                          )}
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {task.penaltyPoints && task.penaltyPoints > 0 && (
                            <span className="text-xs text-red-500">-{task.penaltyPoints} pts</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedTask.taskNumber}</span>
                  <Badge variant="outline" className={SOURCE_CONFIG[selectedTask.sourceType]?.color || ""}>
                    {SOURCE_CONFIG[selectedTask.sourceType]?.label || selectedTask.sourceType}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{selectedTask.title}</DialogTitle>
                <DialogDescription>
                  {selectedTask.description || "No description provided"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select 
                      value={selectedTask.status} 
                      onValueChange={(value) => handleStatusChange(selectedTask, value)}
                      disabled={!(isAdmin || canEdit("development_tasks"))}
                    >
                      <SelectTrigger data-testid="select-task-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Badge variant="outline" className={`${PRIORITY_CONFIG[selectedTask.priority]?.color || ""} w-full justify-center py-2`}>
                      {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Deadline</Label>
                    <p className={`text-sm ${selectedTask.isOverdue ? "text-red-600 font-medium" : ""}`}>
                      {format(new Date(selectedTask.deadline), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    {selectedTask.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {selectedTask.assignee.firstName?.[0]}{selectedTask.assignee.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {selectedTask.assignee.firstName} {selectedTask.assignee.lastName}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unassigned</p>
                    )}
                  </div>
                  {selectedTask.sourceReference && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Source Reference</Label>
                      <p className="text-sm">{selectedTask.sourceReference}</p>
                    </div>
                  )}
                  {selectedTask.estimatedHours && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Estimated Hours</Label>
                      <p className="text-sm">{selectedTask.estimatedHours}h</p>
                    </div>
                  )}
                  {selectedTask.actualHours && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Actual Hours</Label>
                      <p className="text-sm">{selectedTask.actualHours}h</p>
                    </div>
                  )}
                </div>

                {selectedTask.penaltyApplied && selectedTask.penaltyPoints && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Penalty Applied: -{selectedTask.penaltyPoints} points</span>
                    </div>
                    {selectedTask.penaltyReason && (
                      <p className="text-sm text-red-500 mt-1">{selectedTask.penaltyReason}</p>
                    )}
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4" />
                    Comments
                  </h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {comments?.map(comment => (
                      <div key={comment.id} className="flex gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.user?.firstName} {comment.user?.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), "MMM d, HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {(!comments || comments.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="resize-none"
                      rows={2}
                      data-testid="textarea-new-comment"
                    />
                    <Button 
                      size="icon"
                      onClick={() => {
                        if (newComment.trim()) {
                          addCommentMutation.mutate({ taskId: selectedTask.id, content: newComment });
                        }
                      }}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                {selectedTask.status === "pending" && (isAdmin || canEdit("development_tasks")) && (
                  <Button onClick={() => handleStatusChange(selectedTask, "in_progress")}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Work
                  </Button>
                )}
                {selectedTask.status === "in_progress" && (isAdmin || canEdit("development_tasks")) && (
                  <Button variant="secondary" onClick={() => handleStatusChange(selectedTask, "completed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                {(isAdmin || canDelete("development_tasks")) && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this task?")) {
                        deleteTaskMutation.mutate(selectedTask.id);
                      }
                    }}
                    data-testid="button-delete-task"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Development Task</DialogTitle>
            <DialogDescription>
              Create a new development task manually
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
                rows={3}
                data-testid="textarea-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger data-testid="select-new-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="deadline">Deadline *</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  data-testid="input-task-deadline"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select 
                  value={newTask.assignedTo} 
                  onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
                >
                  <SelectTrigger data-testid="select-assign-to">
                    <SelectValue placeholder="Select developer" />
                  </SelectTrigger>
                  <SelectContent>
                    {developers.map(dev => (
                      <SelectItem key={dev.id} value={dev.id}>
                        {dev.firstName} {dev.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  value={newTask.estimatedHours}
                  onChange={(e) => setNewTask({ ...newTask, estimatedHours: e.target.value })}
                  placeholder="Hours"
                  data-testid="input-estimated-hours"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={createTaskMutation.isPending}
              data-testid="button-submit-task"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
