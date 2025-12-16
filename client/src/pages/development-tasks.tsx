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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Code2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  Plus,
  Calendar,
  Play,
  Trash2,
  Image,
  Video,
  Mic,
  FileText,
  Paperclip,
  ExternalLink,
  Loader2,
  XCircle,
  Upload,
  ImagePlus,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  type DevelopmentTask as DevelopmentTaskBase, 
  type User as UserType,
  insertDevelopmentTaskSchema
} from "@shared/schema";

interface DevelopmentTaskWithDetails extends DevelopmentTaskBase {
  assignee?: UserType;
  assignedByUser?: UserType;
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

const createTaskFormSchema = insertDevelopmentTaskSchema.pick({
  title: true,
  description: true,
  priority: true,
  deadline: true,
  assignedTo: true,
  estimatedHours: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  deadline: z.coerce.date(),
  estimatedHours: z.coerce.number().nullable().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

export default function DevelopmentTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTask, setSelectedTask] = useState<DevelopmentTaskWithDetails | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [completionType, setCompletionType] = useState<"complete" | "incomplete">("complete");
  const [completionDescription, setCompletionDescription] = useState("");
  const [completionImageFile, setCompletionImageFile] = useState<File | null>(null);
  const [completionImagePreview, setCompletionImagePreview] = useState<string | null>(null);
  const [isUploadingCompletion, setIsUploadingCompletion] = useState(false);
  const [updateSourceTicket, setUpdateSourceTicket] = useState(true);
  const [sourceTicketStatus, setSourceTicketStatus] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      deadline: undefined,
      assignedTo: undefined,
      estimatedHours: undefined,
    },
  });

  // All hooks must be called before any conditional returns
  const { data: tasks, isLoading } = useQuery<DevelopmentTaskWithDetails[]>({
    queryKey: ["/api/development/tasks"],
  });

  // Use the development-assignable endpoint which filters by Development department ID
  const { data: developmentUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users/development-assignable"],
  });
  
  // Also fetch all users for fallback if no development department users
  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users/all"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskFormData) => {
      const payload = {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        deadline: taskData.deadline,
        sourceType: "manual",
        estimatedHours: taskData.estimatedHours || null,
        assignedTo: taskData.assignedTo || null,
      };
      return await apiRequest("POST", "/api/development/tasks", payload);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      setIsCreateDialogOpen(false);
      form.reset();
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

  const completionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { completionStatus: string; completionDescription: string; completionImageUrl: string; updateSourceTicket?: boolean; sourceTicketStatus?: string } }) => {
      return await apiRequest("POST", `/api/development/tasks/${id}/complete`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: `Task marked as ${completionType}` });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsCompletionDialogOpen(false);
      setIsDetailDialogOpen(false);
      resetCompletionForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to complete task", variant: "destructive" });
    },
  });

  const resetCompletionForm = () => {
    setCompletionDescription("");
    setCompletionImageFile(null);
    setCompletionImagePreview(null);
    setCompletionType("complete");
    setUpdateSourceTicket(true);
    setSourceTicketStatus("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Error", description: "Image must be less than 10MB", variant: "destructive" });
        return;
      }
      setCompletionImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletionImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenCompletionDialog = (type: "complete" | "incomplete") => {
    setCompletionType(type);
    resetCompletionForm();
    setIsCompletionDialogOpen(true);
  };

  const handleSubmitCompletion = async () => {
    if (!selectedTask) return;
    
    if (!completionDescription.trim()) {
      toast({ title: "Required", description: "Please provide a description", variant: "destructive" });
      return;
    }
    
    if (!completionImageFile) {
      toast({ title: "Required", description: "Please upload an image", variant: "destructive" });
      return;
    }

    setIsUploadingCompletion(true);
    
    try {
      // Upload image first
      const uploadUrlResponse = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: completionImageFile.name }),
      });
      
      if (!uploadUrlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await uploadUrlResponse.json();
      
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: completionImageFile,
        headers: {
          "Content-Type": completionImageFile.type || "application/octet-stream",
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Now complete the task with the image URL
      const completionData: { 
        completionStatus: string; 
        completionDescription: string; 
        completionImageUrl: string; 
        updateSourceTicket?: boolean; 
        sourceTicketStatus?: string;
      } = {
        completionStatus: completionType,
        completionDescription: completionDescription.trim(),
        completionImageUrl: objectPath,
      };
      
      // Include source ticket update options if task is from support
      if (selectedTask.sourceType === 'support' && updateSourceTicket) {
        completionData.updateSourceTicket = true;
        if (sourceTicketStatus) {
          completionData.sourceTicketStatus = sourceTicketStatus;
        }
      }
      
      completionMutation.mutate({
        id: selectedTask.id,
        data: completionData,
      });
    } catch (error) {
      console.error("Completion error:", error);
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploadingCompletion(false);
    }
  };

  // Permission checks - placed after all hooks
  if (permissionsLoading || !user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  const isAdmin = user.email === SUPER_ADMIN_EMAIL || user.role === "admin";
  const hasAccess = isAdmin || canView("development_tasks");

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access Development Tasks.
        </p>
        <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
          Go Back
        </Button>
      </div>
    );
  }

  const filteredTasks = tasks?.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !task.taskNumber.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (activeTab === "pending" && task.status !== "pending") return false;
    if (activeTab === "in_progress" && task.status !== "in_progress") return false;
    if (activeTab === "completed" && task.status !== "completed") return false;
    if (activeTab === "overdue" && task.status !== "overdue" && !task.isOverdue) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (sourceFilter !== "all" && task.sourceType !== sourceFilter) return false;
    return true;
  }) || [];

  const handleStatusChange = (task: DevelopmentTaskWithDetails, newStatus: string) => {
    if (!isAdmin && !canEdit("development_tasks")) {
      toast({ title: "Permission Denied", description: "You don't have permission to update tasks", variant: "destructive" });
      return;
    }
    updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  const onSubmitTask = (data: CreateTaskFormData) => {
    if (!isAdmin && !canCreate("development_tasks")) {
      toast({ title: "Permission Denied", description: "You don't have permission to create tasks", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate(data);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!isAdmin && !canDelete("development_tasks")) {
      toast({ title: "Permission Denied", description: "You don't have permission to delete tasks", variant: "destructive" });
      return;
    }
    deleteTaskMutation.mutate(taskId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  const pendingCount = tasks?.filter(t => t.status === "pending").length || 0;
  const inProgressCount = tasks?.filter(t => t.status === "in_progress").length || 0;
  const completedCount = tasks?.filter(t => t.status === "completed").length || 0;
  const overdueCount = tasks?.filter(t => t.status === "overdue" || t.isOverdue).length || 0;

  // Use development department users from API, fallback to all active users if none found
  const developers = (developmentUsers && developmentUsers.length > 0)
    ? developmentUsers
    : (allUsers?.filter(u => u.isActive !== false) || []);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="development-tasks-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Code2 className="h-7 w-7 text-indigo-600" />
            Development Tasks
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
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
        <TabsList className="flex-wrap" data-testid="tabs-status">
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
            <Card data-testid="card-no-tasks">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-tasks">No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="task-list">
              {paginateData(filteredTasks).map(task => {
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
                              <span className="text-xs text-muted-foreground" data-testid={`text-task-number-${task.id}`}>{task.taskNumber}</span>
                              <Badge variant="outline" className={SOURCE_CONFIG[task.sourceType]?.color || ""} data-testid={`badge-source-${task.id}`}>
                                {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                              </Badge>
                              <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color || ""} data-testid={`badge-priority-${task.id}`}>
                                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                              </Badge>
                            </div>
                            <h3 className="font-medium mt-1" data-testid={`text-task-title-${task.id}`}>{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-task-description-${task.id}`}>
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1" data-testid={`text-deadline-${task.id}`}>
                                <Calendar className="h-3 w-3" />
                                Due: {format(deadline, "MMM d, yyyy")}
                              </span>
                              {task.sourceReference && (
                                <span className="flex items-center gap-1" data-testid={`text-reference-${task.id}`}>
                                  Ref: {task.sourceReference}
                                </span>
                              )}
                              {task.estimatedHours && (
                                <span data-testid={`text-estimated-${task.id}`}>Est: {task.estimatedHours}h</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {task.assignee && (
                            <div className="flex items-center gap-2" data-testid={`assignee-${task.id}`}>
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
                          <Badge className={statusConfig.color} data-testid={`badge-status-${task.id}`}>
                            {statusConfig.label}
                          </Badge>
                          {task.penaltyPoints && task.penaltyPoints > 0 && (
                            <span className="text-xs text-red-500" data-testid={`text-penalty-${task.id}`}>-{task.penaltyPoints} pts</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-task-detail">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground" data-testid="text-detail-task-number">{selectedTask.taskNumber}</span>
                  <Badge variant="outline" className={SOURCE_CONFIG[selectedTask.sourceType]?.color || ""} data-testid="badge-detail-source">
                    {SOURCE_CONFIG[selectedTask.sourceType]?.label || selectedTask.sourceType}
                  </Badge>
                </div>
                <DialogTitle className="text-xl" data-testid="text-detail-title">{selectedTask.title}</DialogTitle>
                <DialogDescription data-testid="text-detail-description">
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
                      <SelectTrigger data-testid="select-detail-status">
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
                    <Badge variant="outline" className={`${PRIORITY_CONFIG[selectedTask.priority]?.color || ""} w-full justify-center py-2`} data-testid="badge-detail-priority">
                      {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Deadline</Label>
                    <p className={`text-sm ${selectedTask.isOverdue ? "text-red-600 font-medium" : ""}`} data-testid="text-detail-deadline">
                      {format(new Date(selectedTask.deadline), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    {selectedTask.assignee ? (
                      <div className="flex items-center gap-2" data-testid="text-detail-assignee">
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
                      <p className="text-sm" data-testid="text-detail-reference">{selectedTask.sourceReference}</p>
                    </div>
                  )}
                  {selectedTask.estimatedHours && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Estimated Hours</Label>
                      <p className="text-sm" data-testid="text-detail-estimated">{selectedTask.estimatedHours}h</p>
                    </div>
                  )}
                  {selectedTask.actualHours && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Actual Hours</Label>
                      <p className="text-sm" data-testid="text-detail-actual">{selectedTask.actualHours}h</p>
                    </div>
                  )}
                </div>

                {selectedTask.penaltyApplied && selectedTask.penaltyPoints && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800" data-testid="alert-penalty">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Penalty Applied: -{selectedTask.penaltyPoints} points</span>
                    </div>
                    {selectedTask.penaltyReason && (
                      <p className="text-sm text-red-500 mt-1">{selectedTask.penaltyReason}</p>
                    )}
                  </div>
                )}

                {/* Attachments Section */}
                {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                  <div className="space-y-3" data-testid="attachments-section">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attachments ({selectedTask.attachments.length})
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedTask.attachments.map((attachment, index) => {
                        const url = attachment;
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url);
                        const isAudio = /\.(mp3|wav|ogg|m4a|webm)$/i.test(url) || url.includes("voice");
                        
                        if (isImage) {
                          return (
                            <a 
                              key={index}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block rounded-lg overflow-hidden border hover-elevate"
                              data-testid={`attachment-image-${index}`}
                            >
                              <div className="aspect-square relative bg-muted">
                                <img 
                                  src={url} 
                                  alt={`Attachment ${index + 1}`}
                                  className="object-cover w-full h-full"
                                />
                                <div className="absolute bottom-1 right-1">
                                  <Badge variant="secondary" className="text-xs">
                                    <Image className="h-3 w-3 mr-1" />
                                    Image
                                  </Badge>
                                </div>
                              </div>
                            </a>
                          );
                        }
                        
                        if (isVideo) {
                          return (
                            <div 
                              key={index}
                              className="rounded-lg overflow-hidden border"
                              data-testid={`attachment-video-${index}`}
                            >
                              <div className="aspect-square relative bg-muted">
                                <video 
                                  src={url}
                                  controls
                                  className="object-cover w-full h-full"
                                />
                                <div className="absolute bottom-1 right-1">
                                  <Badge variant="secondary" className="text-xs">
                                    <Video className="h-3 w-3 mr-1" />
                                    Video
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        if (isAudio) {
                          return (
                            <div 
                              key={index}
                              className="rounded-lg border p-3 bg-muted/50"
                              data-testid={`attachment-audio-${index}`}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <Mic className="h-8 w-8 text-indigo-500" />
                                <Badge variant="outline" className="text-xs">Voice Recording</Badge>
                                <audio src={url} controls className="w-full h-8" />
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <a 
                            key={index}
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="rounded-lg border p-3 bg-muted/50 hover-elevate flex flex-col items-center gap-2"
                            data-testid={`attachment-file-${index}`}
                          >
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View File
                            </Badge>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                {selectedTask.status === "pending" && (isAdmin || canEdit("development_tasks")) && (
                  <Button onClick={() => handleStatusChange(selectedTask, "in_progress")} data-testid="button-start-work">
                    <Play className="h-4 w-4 mr-2" />
                    Start Work
                  </Button>
                )}
                {selectedTask.status === "in_progress" && (isAdmin || canEdit("development_tasks")) && (
                  <>
                    <Button variant="outline" onClick={() => handleOpenCompletionDialog("incomplete")} data-testid="button-mark-incomplete">
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark Incomplete
                    </Button>
                    <Button variant="secondary" onClick={() => handleOpenCompletionDialog("complete")} data-testid="button-mark-complete">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  </>
                )}
                {(isAdmin || canDelete("development_tasks")) && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this task?")) {
                        handleDeleteTask(selectedTask.id);
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
        <DialogContent className="max-w-lg" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle data-testid="text-create-title">Create Development Task</DialogTitle>
            <DialogDescription>
              Create a new development task manually
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitTask)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Task title" data-testid="input-task-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Task description" rows={3} data-testid="textarea-task-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-new-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline *</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : (field.value || "")}
                          data-testid="input-task-deadline" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-assign-to">
                            <SelectValue placeholder="Select developer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {developers.map(dev => (
                            <SelectItem key={dev.id} value={dev.id}>
                              {dev.firstName} {dev.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} placeholder="Hours" data-testid="input-estimated-hours" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={isCompletionDialogOpen} onOpenChange={(open) => {
        if (!open) resetCompletionForm();
        setIsCompletionDialogOpen(open);
      }}>
        <DialogContent className="max-w-md" data-testid="dialog-completion">
          <DialogHeader>
            <DialogTitle data-testid="text-completion-title">
              {completionType === "complete" ? "Mark Task Complete" : "Mark Task Incomplete"}
            </DialogTitle>
            <DialogDescription>
              {completionType === "complete" 
                ? "Please provide evidence and description for task completion."
                : "Please provide reason and evidence for marking this task as incomplete."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Evidence Image <span className="text-destructive">*</span>
              </Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover-elevate cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="input-completion-image"
                />
                {completionImagePreview ? (
                  <div className="relative">
                    <img 
                      src={completionImagePreview} 
                      alt="Preview" 
                      className="max-h-40 mx-auto rounded-md"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-0 right-0 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompletionImageFile(null);
                        setCompletionImagePreview(null);
                      }}
                      data-testid="button-remove-image"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="py-4">
                    <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click or drag to upload image</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={completionDescription}
                onChange={(e) => setCompletionDescription(e.target.value)}
                placeholder={completionType === "complete" 
                  ? "Describe what was completed and any notes..."
                  : "Describe the reason for incompletion and any issues encountered..."}
                rows={4}
                data-testid="textarea-completion-description"
              />
            </div>

            {/* Source Ticket Update (only for support-sourced tasks) */}
            {selectedTask?.sourceType === "support" && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateSourceTicket"
                    checked={updateSourceTicket}
                    onChange={(e) => setUpdateSourceTicket(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                    data-testid="checkbox-update-source-ticket"
                  />
                  <Label htmlFor="updateSourceTicket" className="text-sm font-medium cursor-pointer">
                    Update source support ticket
                  </Label>
                </div>
                
                {updateSourceTicket && (
                  <div className="space-y-2 pl-6">
                    <Label className="text-sm text-muted-foreground">
                      Change ticket status to (optional):
                    </Label>
                    <Select
                      value={sourceTicketStatus}
                      onValueChange={setSourceTicketStatus}
                    >
                      <SelectTrigger data-testid="select-source-ticket-status">
                        <SelectValue placeholder="Keep current status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resolved_at_techteam">Resolved at Tech Team</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="pending_feedback">Pending Feedback</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A comment will be added to the ticket about this task completion.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                resetCompletionForm();
                setIsCompletionDialogOpen(false);
              }}
              disabled={isUploadingCompletion || completionMutation.isPending}
              data-testid="button-cancel-completion"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitCompletion}
              disabled={isUploadingCompletion || completionMutation.isPending || !completionDescription.trim() || !completionImageFile}
              data-testid="button-submit-completion"
            >
              {isUploadingCompletion || completionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {completionType === "complete" ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  {completionType === "complete" ? "Mark Complete" : "Mark Incomplete"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
