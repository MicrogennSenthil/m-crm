import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  User,
  ArrowUpDown,
  Filter,
  Columns3,
  LayoutGrid,
  List,
  MessageSquare,
  Send,
  Building2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnifiedVoiceAlerts } from "@/hooks/use-speech";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  type DevelopmentTask as DevelopmentTaskBase, 
  type User as UserType,
  type Ticket,
  type DevelopmentSupportMessage,
  insertDevelopmentTaskSchema
} from "@shared/schema";

interface SupportMessageWithSender extends DevelopmentSupportMessage {
  sender?: UserType;
}

interface DevelopmentTaskWithDetails extends DevelopmentTaskBase {
  assignee?: UserType;
  assignedByUser?: UserType;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock, label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Code2, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2, label: "Completed" },
  incomplete: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: XCircle, label: "Incomplete" },
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

type LayoutType = "kanban" | "card" | "table";

const DEV_TASK_STAGES = [
  { id: "pending", title: "Pending", color: "bg-gray-600" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-600" },
  { id: "overdue", title: "Overdue", color: "bg-red-600" },
  { id: "completed", title: "Completed", color: "bg-green-600" },
  { id: "incomplete", title: "Incomplete", color: "bg-orange-600" },
];

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
  estimatedMinutes: z.coerce.number().min(0).max(59).nullable().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

// Helper to format duration in hours and minutes
const formatDuration = (hours?: number | null, minutes?: number | null): string => {
  const h = hours || 0;
  const m = minutes || 0;
  if (h === 0 && m === 0) return "-";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export default function DevelopmentTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions();
  
  // Voice alerts for development department
  const {
    alerts: voiceAlerts,
    alertCounts,
    voiceAlertsEnabled,
    isSpeaking,
    isSupported: voiceSupported,
    announceAllPending,
    stopSpeaking,
  } = useUnifiedVoiceAlerts('development', 120000);

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [engineerFilter, setEngineerFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [activeSourceTab, setActiveSourceTab] = useState("all");
  const [layout, setLayout] = useState<LayoutType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("development-tasks-layout") as LayoutType) || "table";
    }
    return "table";
  });
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
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  useEffect(() => {
    localStorage.setItem("development-tasks-layout", layout);
  }, [layout]);

  const getTasksByStatus = (status: string) => {
    return sortedTasks.filter(t => t.status === status);
  };

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      deadline: undefined,
      assignedTo: undefined,
      estimatedHours: undefined,
      estimatedMinutes: undefined,
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
        estimatedMinutes: taskData.estimatedMinutes || 0,
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

  const reassignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { assignedTo: string; notes?: string; deadline?: string } }) => {
      return await apiRequest("POST", `/api/development/tasks/${id}/reassign`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task reassigned successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      setIsReassignDialogOpen(false);
      setIsDetailDialogOpen(false);
      setReassignToUserId("");
      setReassignNotes("");
      setSelectedTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to reassign task", variant: "destructive" });
    },
  });

  // Fetch source ticket details when task is from support
  const sourceTicketId = selectedTask?.sourceType === "support" ? selectedTask.sourceId : null;
  const { data: sourceTicket } = useQuery<Ticket>({
    queryKey: ["/api/tickets", sourceTicketId],
    enabled: !!sourceTicketId,
  });

  // Fetch support-development messages for the selected task
  const { data: supportMessages } = useQuery<SupportMessageWithSender[]>({
    queryKey: ["/api/development/tasks", selectedTask?.id, "support-messages"],
    enabled: !!selectedTask?.id && selectedTask?.sourceType === "support",
  });

  // Mutation to send message to support
  const sendSupportMessageMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: string; message: string }) => {
      return await apiRequest("POST", `/api/development/tasks/${taskId}/support-messages`, { message });
    },
    onSuccess: () => {
      toast({ title: "Message Sent", description: "Your guidance has been sent to the support team" });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks", selectedTask?.id, "support-messages"] });
      setSupportMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to send message", variant: "destructive" });
    },
  });

  const handleSendSupportMessage = () => {
    if (!selectedTask || !supportMessage.trim()) return;
    sendSupportMessageMutation.mutate({ taskId: selectedTask.id, message: supportMessage.trim() });
  };

  const handleReassignTask = () => {
    if (!selectedTask || !reassignToUserId) {
      toast({ title: "Required", description: "Please select an engineer to assign", variant: "destructive" });
      return;
    }
    reassignMutation.mutate({
      id: selectedTask.id,
      data: {
        assignedTo: reassignToUserId,
        notes: reassignNotes || undefined,
      },
    });
  };

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

  // Helper function to calculate age
  const calculateAge = (date: Date | string | null): string => {
    if (!date) return "—";
    const now = new Date();
    const taskDate = new Date(date);
    const diffMs = now.getTime() - taskDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m`;
    }
  };

  const filteredTasks = tasks?.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !task.taskNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(task.assignee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !(task.assignee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !((task as any).customerName?.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return false;
    }
    // Status tab filtering
    if (activeTab === "pending" && task.status !== "pending") return false;
    if (activeTab === "in_progress" && task.status !== "in_progress") return false;
    if (activeTab === "completed" && task.status !== "completed") return false;
    if (activeTab === "incomplete" && task.status !== "incomplete") return false;
    if (activeTab === "overdue" && task.status !== "overdue" && !task.isOverdue) return false;
    // Source tab filtering
    if (activeSourceTab !== "all" && task.sourceType !== activeSourceTab) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (sourceFilter !== "all" && task.sourceType !== sourceFilter) return false;
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (engineerFilter === "unassigned" && task.assignedTo) return false;
    if (engineerFilter !== "all" && engineerFilter !== "unassigned" && task.assignedTo !== engineerFilter) return false;
    return true;
  }) || [];
  
  // Sort tasks by task number in descending order (latest first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Extract numeric part from task number (DEV-XXXXXX format)
    const aNum = parseInt(a.taskNumber.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.taskNumber.replace(/\D/g, '')) || 0;
    return bNum - aNum; // Descending order - higher number first
  });

  const handleStatusChange = (task: DevelopmentTaskWithDetails, newStatus: string, closeDialog: boolean = false) => {
    if (!isAdmin && !canEdit("development_tasks")) {
      toast({ title: "Permission Denied", description: "You don't have permission to update tasks", variant: "destructive" });
      return;
    }
    // Prevent closing a task that hasn't been started - must go through "in_progress" first
    if ((newStatus === "completed" || newStatus === "incomplete") && task.status === "pending") {
      toast({ 
        title: "Cannot Close Task", 
        description: "You must start work on the task before marking it as completed or incomplete. Click 'Start Work' first.", 
        variant: "destructive" 
      });
      return;
    }
    updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } }, {
      onSuccess: () => {
        if (closeDialog) {
          setIsDetailDialogOpen(false);
        }
      }
    });
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

  // Source type counts for categorization tabs (based on full task list)
  const supportCount = tasks?.filter(t => t.sourceType === "support").length || 0;
  const implementationCount = tasks?.filter(t => t.sourceType === "implementation").length || 0;
  const taskModuleCount = tasks?.filter(t => t.sourceType === "task").length || 0;
  const manualCount = tasks?.filter(t => t.sourceType === "manual").length || 0;
  
  // First filter by source tab
  const sourceFilteredTasks = tasks?.filter(t => {
    if (activeSourceTab === "all") return true;
    return t.sourceType === activeSourceTab;
  }) || [];
  
  // Status counts should be based on source-filtered tasks
  const sourceFilteredCount = sourceFilteredTasks.length;
  const pendingCount = sourceFilteredTasks.filter(t => t.status === "pending").length;
  const inProgressCount = sourceFilteredTasks.filter(t => t.status === "in_progress").length;
  const completedCount = sourceFilteredTasks.filter(t => t.status === "completed").length;
  const incompleteCount = sourceFilteredTasks.filter(t => t.status === "incomplete").length;
  const overdueCount = sourceFilteredTasks.filter(t => t.status === "overdue" || t.isOverdue).length;

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
          {(isAdmin || canCreate("development_tasks")) && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Source Type Categorization Tabs */}
      <Tabs value={activeSourceTab} onValueChange={setActiveSourceTab} className="space-y-2">
        <TabsList className="flex-wrap" data-testid="tabs-source-category">
          <TabsTrigger value="all" data-testid="tab-source-all">
            All Sources ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-source-support" className="text-blue-600 dark:text-blue-400">
            Support ({supportCount})
          </TabsTrigger>
          <TabsTrigger value="implementation" data-testid="tab-source-implementation" className="text-purple-600 dark:text-purple-400">
            Implementation ({implementationCount})
          </TabsTrigger>
          <TabsTrigger value="task" data-testid="tab-source-task" className="text-green-600 dark:text-green-400">
            Tasks ({taskModuleCount})
          </TabsTrigger>
          <TabsTrigger value="manual" data-testid="tab-source-manual">
            Manual ({manualCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap" data-testid="tabs-status">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({sourceFilteredCount})
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
          <TabsTrigger value="incomplete" data-testid="tab-incomplete" className={incompleteCount > 0 ? "text-orange-600" : ""}>
            Incomplete ({incompleteCount})
          </TabsTrigger>
          <TabsTrigger value="overdue" data-testid="tab-overdue" className={overdueCount > 0 ? "text-red-600" : ""}>
            Overdue ({overdueCount})
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by task#, title, client, or engineer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-tasks"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={engineerFilter} onValueChange={setEngineerFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-engineer-filter">
              <SelectValue placeholder="Engineer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Engineers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {developers.map((dev) => (
                <SelectItem key={dev.id} value={dev.id}>
                  {dev.firstName} {dev.lastName}
                </SelectItem>
              ))}
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
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {sortedTasks.length === 0 ? (
            <Card data-testid="card-no-tasks">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-tasks">No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Kanban View */}
              {layout === "kanban" && (
                <div className="grid grid-cols-5 gap-3 pb-4 overflow-x-auto" data-testid="kanban-view">
                  {DEV_TASK_STAGES.map((stage) => {
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
                        <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                          {stageTasks.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground py-4 bg-muted/30 rounded-lg">
                              No tasks
                            </div>
                          ) : (
                            stageTasks.map(task => {
                              const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                              const deadline = new Date(task.deadline);
                              const isOverdue = task.isOverdue || (deadline < new Date() && task.status !== "completed");
                              
                              return (
                                <Card 
                                  key={task.id} 
                                  className={`hover-elevate cursor-pointer ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsDetailDialogOpen(true);
                                  }}
                                  data-testid={`kanban-card-${task.id}`}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <span className="font-mono text-xs text-muted-foreground">{task.taskNumber}</span>
                                      {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                    </div>
                                    <h4 className="font-medium text-sm truncate mb-1">{task.title}</h4>
                                    {(task as any).customerName && (
                                      <p className="text-xs text-muted-foreground truncate mb-2" title={(task as any).customerName}>
                                        <Building2 className="h-3 w-3 inline mr-1" />
                                        {(task as any).customerName}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className={`${PRIORITY_CONFIG[task.priority]?.color || ""} text-xs`}>
                                        {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                                      </Badge>
                                      <Badge variant="outline" className={`${SOURCE_CONFIG[task.sourceType]?.color || ""} text-xs`}>
                                        {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      {task.assignee ? (
                                        <div className="flex items-center gap-1">
                                          <Avatar className="h-4 w-4">
                                            <AvatarFallback className="text-[8px]">
                                              {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="truncate max-w-[60px]">{task.assignee.firstName}</span>
                                        </div>
                                      ) : (
                                        <span>Unassigned</span>
                                      )}
                                      <span className={isOverdue ? "text-red-500" : ""}>
                                        {format(deadline, "MMM d")}
                                      </span>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Card View */}
              {layout === "card" && (
                <div className="space-y-3" data-testid="card-view">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {paginateData(sortedTasks).map(task => {
                      const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                      const deadline = new Date(task.deadline);
                      const isOverdue = task.isOverdue || (deadline < new Date() && task.status !== "completed");
                      
                      return (
                        <Card 
                          key={task.id} 
                          className={`hover-elevate cursor-pointer ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailDialogOpen(true);
                          }}
                          data-testid={`card-task-${task.id}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-xs text-muted-foreground">{task.taskNumber}</span>
                                  {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                </div>
                                <CardTitle className="text-sm font-medium truncate">{task.title}</CardTitle>
                                {(task as any).customerName && (
                                  <p className="text-xs text-muted-foreground truncate mt-1" title={(task as any).customerName}>
                                    <Building2 className="h-3 w-3 inline mr-1" />
                                    {(task as any).customerName}
                                  </p>
                                )}
                              </div>
                              <Badge className={`${statusConfig.color} text-xs flex-shrink-0`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mb-3">
                              <Badge variant="outline" className={`${PRIORITY_CONFIG[task.priority]?.color || ""} text-xs`}>
                                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                              </Badge>
                              <Badge variant="outline" className={`${SOURCE_CONFIG[task.sourceType]?.color || ""} text-xs`}>
                                {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              {task.assignee ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px]">
                                      {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{task.assignee.firstName} {task.assignee.lastName}</span>
                                </div>
                              ) : (
                                <span>Unassigned</span>
                              )}
                              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}>
                                <Calendar className="h-3 w-3" />
                                {format(deadline, "MMM d, HH:mm")}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {sortedTasks.length > 0 && (
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={getTotalPages(sortedTasks.length)}
                      pageSize={pageSize}
                      totalItems={sortedTasks.length}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </div>
              )}

              {/* Table View */}
              {layout === "table" && (
            <div className="space-y-3" data-testid="task-list">
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[100px]">Task #</TableHead>
                        <TableHead className="min-w-[200px]">Title</TableHead>
                        <TableHead className="w-[150px]">Client</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[150px]">Engineer</TableHead>
                        <TableHead className="w-[100px]">Priority</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[140px]">Assigned</TableHead>
                        <TableHead className="w-[140px]">Completed</TableHead>
                        <TableHead className="w-[80px]">Age</TableHead>
                        <TableHead className="w-[140px]">Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginateData(sortedTasks).map(task => {
                        const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                        const deadline = new Date(task.deadline);
                        const isOverdue = task.isOverdue || (deadline < new Date() && task.status !== "completed");
                        
                        return (
                          <TableRow 
                            key={task.id} 
                            className={`cursor-pointer ${isOverdue ? "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50" : "hover:bg-muted/50"}`}
                            onClick={() => {
                              setSelectedTask(task);
                              setIsDetailDialogOpen(true);
                            }}
                            data-testid={`row-task-${task.id}`}
                          >
                            <TableCell className="font-mono text-xs" data-testid={`text-task-number-${task.id}`}>
                              <div className="flex items-center gap-1">
                                {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                {task.taskNumber}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-task-title-${task.id}`}>
                              <div className="max-w-[200px] truncate font-medium" title={task.title}>
                                {task.title}
                              </div>
                              {task.sourceReference && (
                                <div className="text-xs text-muted-foreground truncate" title={task.sourceReference}>
                                  Ref: {task.sourceReference}
                                </div>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-client-${task.id}`}>
                              {(task as any).customerName ? (
                                <div className="flex items-center gap-1 text-sm truncate max-w-[140px]" title={(task as any).customerName}>
                                  <Building2 className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{(task as any).customerName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig.color} text-xs`} data-testid={`badge-status-${task.id}`}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`assignee-${task.id}`}>
                              {task.assignee ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm truncate max-w-[100px]" title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
                                    {task.assignee.firstName} {task.assignee.lastName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${PRIORITY_CONFIG[task.priority]?.color || ""} text-xs`} data-testid={`badge-priority-${task.id}`}>
                                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${SOURCE_CONFIG[task.sourceType]?.color || ""} text-xs`} data-testid={`badge-source-${task.id}`}>
                                {SOURCE_CONFIG[task.sourceType]?.label || task.sourceType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-assigned-${task.id}`}>
                              {task.assignedAt ? (
                                <div>
                                  <div>{format(new Date(task.assignedAt), "dd MMM yyyy")}</div>
                                  <div className="text-muted-foreground">{format(new Date(task.assignedAt), "HH:mm")}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-completed-${task.id}`}>
                              {task.completedAt ? (
                                <div>
                                  <div>{format(new Date(task.completedAt), "dd MMM yyyy")}</div>
                                  <div className="text-muted-foreground">{format(new Date(task.completedAt), "HH:mm")}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-age-${task.id}`}>
                              <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {calculateAge(task.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs" data-testid={`text-deadline-${task.id}`}>
                              <div className={isOverdue ? "text-red-600 font-medium" : ""}>
                                <div>{format(deadline, "dd MMM yyyy")}</div>
                                <div className="text-muted-foreground">{format(deadline, "HH:mm")}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              {sortedTasks.length > 0 && (
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={getTotalPages(sortedTasks.length)}
                  pageSize={pageSize}
                  totalItems={sortedTasks.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-task-detail">
          {selectedTask && (
            <>
              <DialogHeader>
                {/* Prominent Task Number Display */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-purple-700 dark:text-purple-300" data-testid="text-detail-task-number">
                        {selectedTask.taskNumber}
                      </span>
                      <Badge variant="outline" className={SOURCE_CONFIG[selectedTask.sourceType]?.color || ""} data-testid="badge-detail-source">
                        {SOURCE_CONFIG[selectedTask.sourceType]?.label || selectedTask.sourceType}
                      </Badge>
                    </div>
                    <Badge 
                      variant={selectedTask.status === "completed" ? "default" : "outline"}
                      className={STATUS_CONFIG[selectedTask.status]?.color || ""}
                      data-testid="badge-detail-status"
                    >
                      {STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                    </Badge>
                  </div>
                  {selectedTask.sourceReference && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Source Reference: <span className="font-medium">{selectedTask.sourceReference}</span>
                    </div>
                  )}
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
                        <SelectItem 
                          value="completed" 
                          disabled={selectedTask.status === "pending"}
                          className={selectedTask.status === "pending" ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          Completed {selectedTask.status === "pending" && "(Start work first)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedTask.status === "pending" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Click "Start Work" before marking as completed
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Badge variant="outline" className={`${PRIORITY_CONFIG[selectedTask.priority]?.color || ""} w-full justify-center py-2`} data-testid="badge-detail-priority">
                      {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Deadline</Label>
                    {editingDeadline && selectedTask.status !== "completed" && (isAdmin || user?.email === SUPER_ADMIN_EMAIL) ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="datetime-local"
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                          className="h-8 text-sm"
                          data-testid="input-edit-deadline"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (newDeadline) {
                              updateTaskMutation.mutate({ 
                                id: selectedTask.id, 
                                data: { deadline: new Date(newDeadline) } 
                              });
                              setSelectedTask({ ...selectedTask, deadline: new Date(newDeadline) });
                            }
                            setEditingDeadline(false);
                          }}
                          data-testid="button-save-deadline"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingDeadline(false)}
                          data-testid="button-cancel-deadline"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${selectedTask.isOverdue ? "text-red-600 font-medium" : ""}`} data-testid="text-detail-deadline">
                          {format(new Date(selectedTask.deadline), "MMM d, yyyy HH:mm")}
                        </p>
                        {selectedTask.status !== "completed" && (isAdmin || user?.email === SUPER_ADMIN_EMAIL) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => {
                              setNewDeadline(format(new Date(selectedTask.deadline), "yyyy-MM-dd'T'HH:mm"));
                              setEditingDeadline(true);
                            }}
                            data-testid="button-edit-deadline"
                          >
                            <Calendar className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
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
                  {(selectedTask.estimatedHours || selectedTask.estimatedMinutes) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Required Time</Label>
                      <p className="text-sm" data-testid="text-detail-estimated">
                        {formatDuration(selectedTask.estimatedHours, selectedTask.estimatedMinutes)}
                      </p>
                    </div>
                  )}
                  {(selectedTask.actualHours || selectedTask.actualMinutes) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Actual Time</Label>
                      <p className="text-sm" data-testid="text-detail-actual">
                        {formatDuration(selectedTask.actualHours, selectedTask.actualMinutes)}
                      </p>
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

                {/* Support Ticket Communication Section */}
                {selectedTask.sourceType === "support" && selectedTask.sourceId && (
                  <div className="space-y-4 pt-4 border-t" data-testid="support-communication-section">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <Label className="text-sm font-medium">Support Ticket Communication</Label>
                    </div>

                    {/* Source Ticket Details */}
                    {sourceTicket && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800" data-testid="source-ticket-details">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Ticket #{sourceTicket.ticketNumber}</span>
                            <Badge variant="outline" className="text-xs">{sourceTicket.status}</Badge>
                          </div>
                          <p className="text-sm font-medium">{sourceTicket.issueSummary}</p>
                          {sourceTicket.issueDescription && (
                            <p className="text-sm text-muted-foreground line-clamp-3">{sourceTicket.issueDescription}</p>
                          )}
                          {sourceTicket.customerName && (
                            <p className="text-xs text-muted-foreground">Customer: {sourceTicket.customerName}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Message History */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Communication History</Label>
                      {supportMessages && supportMessages.length > 0 ? (
                        <div className="max-h-[200px] overflow-y-auto space-y-2" data-testid="support-messages-list">
                          {supportMessages.map((msg) => (
                            <div 
                              key={msg.id} 
                              className={`rounded-lg p-3 ${
                                msg.senderType === 'development' 
                                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ml-4' 
                                  : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 mr-4'
                              }`}
                              data-testid={`support-message-${msg.id}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-xs">
                                      {msg.sender?.firstName?.[0] || (msg.senderType === 'development' ? 'D' : 'S')}
                                      {msg.sender?.lastName?.[0] || ''}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium">
                                    {msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : (msg.senderType === 'development' ? 'Development' : 'Support')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {msg.senderType === 'development' ? 'Dev Team' : 'Support'}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {msg.createdAt ? format(new Date(msg.createdAt), "MMM d, HH:mm") : ''}
                                </span>
                              </div>
                              <p className="text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm" data-testid="no-support-messages">
                          No messages yet. Send guidance to the support team below.
                        </div>
                      )}
                    </div>

                    {/* Send Message Input */}
                    <div className="flex gap-2">
                      <Textarea
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="Type your guidance or message for the support team..."
                        rows={2}
                        className="flex-1"
                        data-testid="input-support-message"
                      />
                      <Button
                        onClick={handleSendSupportMessage}
                        disabled={!supportMessage.trim() || sendSupportMessageMutation.isPending}
                        size="icon"
                        className="h-auto"
                        data-testid="button-send-support-message"
                      >
                        {sendSupportMessageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                {selectedTask.status === "pending" && (isAdmin || canEdit("development_tasks")) && (
                  <Button 
                    onClick={() => handleStatusChange(selectedTask, "in_progress", true)} 
                    disabled={updateTaskMutation.isPending}
                    data-testid="button-start-work"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {updateTaskMutation.isPending ? "Starting..." : "Start Work"}
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
                {selectedTask.status === "incomplete" && isAdmin && (
                  <Button 
                    onClick={() => setIsReassignDialogOpen(true)} 
                    data-testid="button-reassign-task"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Reassign Task
                  </Button>
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
                
                <div className="col-span-2">
                  <FormLabel>Required Time to Complete</FormLabel>
                  <div className="flex items-center gap-2 mt-2">
                    <FormField
                      control={form.control}
                      name="estimatedHours"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <div className="flex items-center gap-1">
                              <Input 
                                type="number" 
                                min="0"
                                {...field} 
                                value={field.value ?? ""} 
                                placeholder="0" 
                                data-testid="input-estimated-hours" 
                              />
                              <span className="text-sm text-muted-foreground">hrs</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estimatedMinutes"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <div className="flex items-center gap-1">
                              <Input 
                                type="number" 
                                min="0"
                                max="59"
                                {...field} 
                                value={field.value ?? ""} 
                                placeholder="0" 
                                data-testid="input-estimated-minutes" 
                              />
                              <span className="text-sm text-muted-foreground">min</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
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

      {/* Reassignment Dialog for Incomplete Tasks */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-reassign-task">
          <DialogHeader>
            <DialogTitle data-testid="text-reassign-title">Reassign Incomplete Task</DialogTitle>
            <DialogDescription>
              Reassign this task to another engineer. The previous assignee has been penalized for incomplete work.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedTask?.previousAssignedTo && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Penalty applied: {selectedTask.penaltyPoints || 5} points for incomplete work
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Assign To Engineer *</Label>
              <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                <SelectTrigger data-testid="select-reassign-to">
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {developers?.map(dev => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.firstName} {dev.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                placeholder="Add notes about the reassignment..."
                rows={3}
                data-testid="textarea-reassign-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsReassignDialogOpen(false);
                setReassignToUserId("");
                setReassignNotes("");
              }}
              disabled={reassignMutation.isPending}
              data-testid="button-cancel-reassign"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReassignTask}
              disabled={reassignMutation.isPending || !reassignToUserId}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                <>
                  <User className="h-4 w-4 mr-2" />
                  Reassign Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
