import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, TaskComment, TaskFollowup, User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AttachmentsList } from "@/components/attachments-list";
import {
  Calendar,
  Clock,
  MessageSquare,
  Mic,
  User as UserIcon,
  Users,
  Bell,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  Send,
  Edit,
  Video,
  Image,
  FileIcon,
  Paperclip,
  ExternalLink,
  Maximize2,
  Plus,
  ChevronDown,
  CalendarClock,
  History,
  MicOff,
  Square,
  X,
  Camera,
  Type,
  Code2,
  Target,
  Building2,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { AssignToDevelopmentDialog } from "./assign-to-development-dialog";

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  mentionedUserDetails?: User[];
};

type CommentWithUser = TaskComment & {
  user?: User;
};

type FollowupWithUser = TaskFollowup & {
  createdByUser?: User;
};

interface TaskDetailModalProps {
  task: TaskWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: () => void;
}

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

export default function TaskDetailModal({ task, open, onOpenChange, onTaskUpdate }: TaskDetailModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [newComment, setNewComment] = useState("");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  
  // Follow-up state
  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [followupType, setFollowupType] = useState<"voice" | "video" | "text" | "image">("text");
  const [followupDescription, setFollowupDescription] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState<Date | undefined>(undefined);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null);
  const [videoRecordingUrl, setVideoRecordingUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [followupsOpen, setFollowupsOpen] = useState(true);
  const [showAssignDevDialog, setShowAssignDevDialog] = useState(false);
  
  // Convert to Lead state
  const [showConvertToLeadDialog, setShowConvertToLeadDialog] = useState(false);
  const [convertLeadForm, setConvertLeadForm] = useState({
    companyName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    leadSource: "task_conversion",
    customLeadSource: "",
    currency: "INR",
    estimatedValue: "",
    city: "",
    area: "",
  });
  
  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isAdmin = currentUser?.role === "admin";
  const canEdit = isAdmin || task.createdBy === currentUser?.id || task.assignedTo === currentUser?.id;

  // Fetch comments for this task
  const { data: comments = [], isLoading: loadingComments } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/tasks", task.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
  });

  // Fetch followups for this task
  const { data: followups = [], isLoading: loadingFollowups } = useQuery<FollowupWithUser[]>({
    queryKey: ["/api/tasks", task.id, "followups"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/followups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch followups");
      return res.json();
    },
  });

  // Fetch linked customer details if task is linked to a customer
  const { data: linkedCustomer } = useQuery<{
    id: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  }>({
    queryKey: ["/api/customers", task.relatedEntityId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${task.relatedEntityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer");
      return res.json();
    },
    enabled: task.relatedEntityType === "customer" && !!task.relatedEntityId,
  });

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      onTaskUpdate?.();
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  // Add comment mutation with optimistic update
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/tasks/${task.id}/comments`, { content });
      return response as unknown as CommentWithUser;
    },
    onMutate: async (content: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/tasks", task.id, "comments"] });
      
      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<CommentWithUser[]>(["/api/tasks", task.id, "comments"]);
      
      // Optimistically update to the new value
      const optimisticComment: CommentWithUser = {
        id: `temp-${Date.now()}`,
        taskId: task.id,
        userId: currentUser?.id || "",
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
        mentionedUsers: null,
        voiceNoteUrl: null,
        voiceNoteDuration: null,
        user: currentUser,
      };
      
      queryClient.setQueryData<CommentWithUser[]>(["/api/tasks", task.id, "comments"], (old) => 
        old ? [optimisticComment, ...old] : [optimisticComment]
      );
      
      setNewComment("");
      
      return { previousComments };
    },
    onSuccess: (newComment) => {
      // Replace optimistic comment with actual comment from server
      queryClient.setQueryData<CommentWithUser[]>(["/api/tasks", task.id, "comments"], (old) => {
        if (!old) return [newComment];
        // Remove temp comment and add real one
        const filtered = old.filter(c => !c.id.startsWith('temp-'));
        return [newComment, ...filtered];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Comment added" });
    },
    onError: (err, content, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(["/api/tasks", task.id, "comments"], context.previousComments);
      }
      setNewComment(content);
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  // Add followup mutation
  const addFollowupMutation = useMutation({
    mutationFn: async (data: {
      type: string;
      description?: string;
      contentUrl?: string;
      nextFollowupDate?: string;
    }) => {
      await apiRequest("POST", `/api/tasks/${task.id}/followups`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      resetFollowupForm();
      toast({ title: "Follow-up added" });
    },
    onError: () => {
      toast({ title: "Failed to add follow-up", variant: "destructive" });
    },
  });

  const resetFollowupForm = () => {
    setShowAddFollowup(false);
    setFollowupType("text");
    setFollowupDescription("");
    setNextFollowupDate(undefined);
    setVoiceRecordingUrl(null);
    setVideoRecordingUrl(null);
    setImageUrl(null);
  };

  // Convert to Lead mutation
  const convertToLeadMutation = useMutation({
    mutationFn: async (data: typeof convertLeadForm) => {
      const response = await apiRequest("POST", `/api/tasks/${task.id}/convert-to-lead`, data);
      return response as unknown as { success: boolean; lead: { id: string }; message: string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setShowConvertToLeadDialog(false);
      resetConvertLeadForm();
      onOpenChange(false);
      onTaskUpdate?.();
      toast({ 
        title: "Task converted to lead", 
        description: result.message,
      });
      // Navigate to the new lead
      navigate(`/sales?lead=${result.lead.id}`);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to convert task to lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetConvertLeadForm = () => {
    setConvertLeadForm({
      companyName: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      leadSource: "task_conversion",
      customLeadSource: "",
      currency: "INR",
      estimatedValue: "",
      city: "",
      area: "",
    });
  };

  const handleConvertToLead = () => {
    if (!convertLeadForm.companyName || !convertLeadForm.contactPerson || !convertLeadForm.contactEmail) {
      toast({ 
        title: "Required fields missing", 
        description: "Please fill in company name, contact person, and email",
        variant: "destructive" 
      });
      return;
    }
    convertToLeadMutation.mutate(convertLeadForm);
  };

  const openConvertToLeadDialog = () => {
    // Pre-fill form with task title as company name
    setConvertLeadForm(prev => ({
      ...prev,
      companyName: task.title,
    }));
    setShowConvertToLeadDialog(true);
  };

  const handleAddFollowup = () => {
    const data: {
      type: string;
      description?: string;
      contentUrl?: string;
      nextFollowupDate?: string;
    } = {
      type: followupType,
    };

    if (followupDescription.trim()) {
      data.description = followupDescription.trim();
    }

    if (followupType === "voice" && voiceRecordingUrl) {
      data.contentUrl = voiceRecordingUrl;
    } else if (followupType === "video" && videoRecordingUrl) {
      data.contentUrl = videoRecordingUrl;
    } else if (followupType === "image" && imageUrl) {
      data.contentUrl = imageUrl;
    }

    if (nextFollowupDate) {
      data.nextFollowupDate = nextFollowupDate.toISOString();
    }

    addFollowupMutation.mutate(data);
  };

  // Voice recording functions
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoiceRecordingUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (err) {
      toast({ title: "Could not access microphone", variant: "destructive" });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  // Video recording functions
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoRecordingUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecordingVideo(true);
    } catch (err) {
      toast({ title: "Could not access camera", variant: "destructive" });
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  };

  // Image capture
  const handleImageCapture = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setImageUrl(url);
      }
    };
    input.click();
  };

  const getFollowupTypeIcon = (type: string) => {
    switch (type) {
      case "voice": return <Mic className="h-4 w-4 text-blue-500" />;
      case "video": return <Video className="h-4 w-4 text-purple-500" />;
      case "image": return <Image className="h-4 w-4 text-green-500" />;
      default: return <Type className="h-4 w-4 text-gray-500" />;
    }
  };

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priorityConfig = PRIORITY_CONFIG[task.priority || "medium"];
  const StatusIcon = statusConfig.icon;

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{task.title}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openConvertToLeadDialog}
                data-testid="button-convert-to-lead"
              >
                <Target className="h-4 w-4 mr-2" />
                Convert to Lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignDevDialog(true)}
                data-testid="button-assign-to-development"
              >
                <Code2 className="h-4 w-4 mr-2" />
                Assign to Dev
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/tasks/${task.id}`);
                }}
                title="View Full Page"
                data-testid="button-view-full-page"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              {canEdit && (
                <Select value={task.status} onValueChange={(value) => updateStatusMutation.mutate(value)}>
                  <SelectTrigger className="w-[140px]" data-testid="select-update-status">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="followup">Follow Up</SelectItem>
                    <SelectItem value="get_information">Get Info</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6 pb-4">
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Created By</h4>
                  {task.creator && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={task.creator.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {task.creator.firstName?.[0]}{task.creator.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{task.creator.firstName} {task.creator.lastName}</p>
                        <p className="text-xs text-muted-foreground">{task.creator.role}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Assigned To</h4>
                  {task.assignee ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={task.assignee.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{task.assignee.firstName} {task.assignee.lastName}</p>
                          <p className="text-xs text-muted-foreground">{task.assignee.role}</p>
                        </div>
                      </div>
                      {(task as any).assignedAt && (
                        <p className="text-xs text-muted-foreground ml-10">
                          Assigned on {format(new Date((task as any).assignedAt), "PPP 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
                
                {(linkedCustomer || task.contactName || task.contactPhone) && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Contact Details</h4>
                    <div className="space-y-2 text-sm">
                      {linkedCustomer && (
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium" data-testid="text-customer-name">{linkedCustomer.name}</span>
                        </div>
                      )}
                      {(linkedCustomer?.contactPerson || task.contactName) && (
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span data-testid="text-contact-name">
                            {linkedCustomer?.contactPerson || task.contactName}
                          </span>
                        </div>
                      )}
                      {(linkedCustomer?.phone || task.contactPhone) && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`tel:${linkedCustomer?.phone || task.contactPhone}`} 
                            className="text-primary hover:underline"
                            data-testid="link-contact-phone"
                          >
                            {linkedCustomer?.phone || task.contactPhone}
                          </a>
                        </div>
                      )}
                      {linkedCustomer?.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`mailto:${linkedCustomer.email}`} 
                            className="text-primary hover:underline"
                            data-testid="link-contact-email"
                          >
                            {linkedCustomer.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Dates & Times</h4>
                  <div className="space-y-2 text-sm">
                    {task.dueDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Due: {format(new Date(task.dueDate), "PPP 'at' h:mm a")}</span>
                      </div>
                    )}
                    {task.reminderDate && (
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span>Reminder: {format(new Date(task.reminderDate), "PPP 'at' h:mm a")}</span>
                      </div>
                    )}
                    {task.createdAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Created: {format(new Date(task.createdAt), "PPP 'at' h:mm a")}</span>
                      </div>
                    )}
                    {task.completedAt && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Completed: {format(new Date(task.completedAt), "PPP 'at' h:mm a")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {Array.isArray(task.mentionedUserDetails) && task.mentionedUserDetails.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Mentioned Team Members</h4>
                <div className="flex flex-wrap gap-2">
                  {task.mentionedUserDetails.map((user) => (
                    <div key={user.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.firstName} {user.lastName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Task Media Section - Voice Note, Video, Image from attachments */}
            {(() => {
              const videoAttachments = task.attachments?.filter(a => a.type === "video") || [];
              const photoAttachments = task.attachments?.filter(a => a.type === "photo") || [];
              const hasMedia = task.voiceNoteUrl || videoAttachments.length > 0 || photoAttachments.length > 0;
              
              if (!hasMedia) return null;
              
              return (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    Task Media
                  </h4>
                  
                  {/* Voice Note */}
                  {task.voiceNoteUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg" data-testid="task-voice-note">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          const audio = document.getElementById("task-voice-audio") as HTMLAudioElement;
                          if (audio) {
                            if (isPlayingVoice) {
                              audio.pause();
                            } else {
                              audio.play();
                            }
                            setIsPlayingVoice(!isPlayingVoice);
                          }
                        }}
                        data-testid="button-play-task-voice"
                      >
                        {isPlayingVoice ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Mic className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Voice Note {task.voiceNoteDuration ? `(${formatDuration(task.voiceNoteDuration)})` : ""}
                        </span>
                      </div>
                      <audio
                        id="task-voice-audio"
                        src={task.voiceNoteUrl}
                        onEnded={() => setIsPlayingVoice(false)}
                        className="hidden"
                      />
                    </div>
                  )}
                  
                  {/* Video Recordings from attachments */}
                  {videoAttachments.map((video, idx) => (
                    <div key={video.id || idx} className="space-y-2" data-testid={`task-video-${idx}`}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Video className="h-4 w-4" />
                        <span>{video.name || "Video Recording"}</span>
                      </div>
                      <video 
                        src={video.url} 
                        controls 
                        className="w-full rounded-lg max-h-64 bg-black" 
                        data-testid={`video-task-recording-${idx}`}
                      />
                    </div>
                  ))}
                  
                  {/* Photos from attachments */}
                  {photoAttachments.map((photo, idx) => (
                    <div key={photo.id || idx} className="space-y-2" data-testid={`task-image-${idx}`}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Image className="h-4 w-4" />
                        <span>{photo.name || "Photo"}</span>
                      </div>
                      <img 
                        src={photo.url} 
                        alt={photo.name || "Task photo"} 
                        className="w-full rounded-lg max-h-64 object-contain bg-muted" 
                        data-testid={`image-task-photo-${idx}`}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
            
            {/* Attachments Section - with upload capability for images, audio, video, documents */}
            <div className="p-4 border rounded-lg" data-testid="section-attachments">
              <AttachmentsList
                entityType="task"
                entityId={task.id}
                title="Attachments"
              />
            </div>
            
            <Separator />
            
            {/* Follow-ups Section */}
            <div data-testid="section-followups">
              <Collapsible open={followupsOpen} onOpenChange={setFollowupsOpen}>
                <div className="flex items-center justify-between mb-4">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Follow-ups ({followups.length})
                        <ChevronDown className={`h-4 w-4 transition-transform ${followupsOpen ? "rotate-180" : ""}`} />
                      </h4>
                    </Button>
                  </CollapsibleTrigger>
                  {canEdit && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddFollowup(!showAddFollowup)}
                      data-testid="button-add-followup"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Follow-up
                    </Button>
                  )}
                </div>
                
                {/* Add Follow-up Form */}
                {showAddFollowup && (
                  <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">New Follow-up</h5>
                      <Button variant="ghost" size="icon" onClick={() => setShowAddFollowup(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Type Selection */}
                    <div className="flex gap-2">
                      <Button
                        variant={followupType === "text" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFollowupType("text")}
                        data-testid="button-followup-type-text"
                      >
                        <Type className="h-4 w-4 mr-1" />
                        Text
                      </Button>
                      <Button
                        variant={followupType === "voice" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFollowupType("voice")}
                        data-testid="button-followup-type-voice"
                      >
                        <Mic className="h-4 w-4 mr-1" />
                        Voice
                      </Button>
                      <Button
                        variant={followupType === "video" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFollowupType("video")}
                        data-testid="button-followup-type-video"
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Video
                      </Button>
                      <Button
                        variant={followupType === "image" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFollowupType("image")}
                        data-testid="button-followup-type-image"
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Image
                      </Button>
                    </div>
                    
                    {/* Voice Recording */}
                    {followupType === "voice" && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {!isRecordingVoice ? (
                            <Button onClick={startVoiceRecording} variant="outline" data-testid="button-start-voice-recording">
                              <Mic className="h-4 w-4 mr-1" />
                              Start Recording
                            </Button>
                          ) : (
                            <Button onClick={stopVoiceRecording} variant="destructive" data-testid="button-stop-voice-recording">
                              <Square className="h-4 w-4 mr-1" />
                              Stop Recording
                            </Button>
                          )}
                        </div>
                        {voiceRecordingUrl && (
                          <audio src={voiceRecordingUrl} controls className="w-full" data-testid="audio-voice-preview" />
                        )}
                      </div>
                    )}
                    
                    {/* Video Recording */}
                    {followupType === "video" && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {!isRecordingVideo ? (
                            <Button onClick={startVideoRecording} variant="outline" data-testid="button-start-video-recording">
                              <Video className="h-4 w-4 mr-1" />
                              Start Recording
                            </Button>
                          ) : (
                            <Button onClick={stopVideoRecording} variant="destructive" data-testid="button-stop-video-recording">
                              <Square className="h-4 w-4 mr-1" />
                              Stop Recording
                            </Button>
                          )}
                        </div>
                        {isRecordingVideo && (
                          <video ref={videoRef} className="w-full rounded-lg aspect-video bg-black" muted />
                        )}
                        {videoRecordingUrl && !isRecordingVideo && (
                          <video src={videoRecordingUrl} controls className="w-full rounded-lg aspect-video" data-testid="video-preview" />
                        )}
                      </div>
                    )}
                    
                    {/* Image Capture */}
                    {followupType === "image" && (
                      <div className="space-y-2">
                        <Button onClick={handleImageCapture} variant="outline" data-testid="button-capture-image">
                          <Camera className="h-4 w-4 mr-1" />
                          {imageUrl ? "Change Image" : "Capture / Upload Image"}
                        </Button>
                        {imageUrl && (
                          <img src={imageUrl} alt="Captured" className="w-full rounded-lg max-h-48 object-contain" data-testid="image-preview" />
                        )}
                      </div>
                    )}
                    
                    {/* Description */}
                    <div>
                      <Label className="text-sm">Description</Label>
                      <Textarea
                        value={followupDescription}
                        onChange={(e) => setFollowupDescription(e.target.value)}
                        placeholder="Add notes about this follow-up..."
                        className="mt-1"
                        data-testid="input-followup-description"
                      />
                    </div>
                    
                    {/* Next Follow-up Date */}
                    <div>
                      <Label className="text-sm">Next Follow-up Date (Optional)</Label>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal mt-1" data-testid="button-next-followup-date">
                            <CalendarClock className="mr-2 h-4 w-4" />
                            {nextFollowupDate ? format(nextFollowupDate, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={nextFollowupDate}
                            onSelect={(date) => {
                              setNextFollowupDate(date);
                              setDatePickerOpen(false);
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground mt-1">
                        Task will appear in "Today's Tasks" on this date
                      </p>
                    </div>
                    
                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleAddFollowup}
                        disabled={addFollowupMutation.isPending || (!followupDescription.trim() && followupType === "text" && !nextFollowupDate)}
                        data-testid="button-submit-followup"
                      >
                        {addFollowupMutation.isPending ? "Adding..." : "Add Follow-up"}
                      </Button>
                    </div>
                  </div>
                )}
                
                <CollapsibleContent>
                  <div className="space-y-4">
                    {loadingFollowups ? (
                      <div className="animate-pulse space-y-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex gap-3">
                            <div className="h-8 w-8 bg-muted rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                              <div className="h-3 bg-muted rounded w-3/4"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : followups.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No follow-ups recorded yet.
                      </p>
                    ) : (
                      followups.map((followup) => (
                        <div key={followup.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`followup-${followup.id}`}>
                          <div className="flex-shrink-0 mt-1">
                            {getFollowupTypeIcon(followup.followupType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {followup.createdByUser?.firstName} {followup.createdByUser?.lastName}
                              </span>
                              <Badge variant="outline" className="text-xs py-0 capitalize">{followup.followupType}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {followup.createdAt && format(new Date(followup.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                            
                            {followup.description && (
                              <p className="text-sm whitespace-pre-wrap mb-2">{followup.description}</p>
                            )}
                            
                            {followup.voiceNoteUrl && followup.followupType === "voice" && (
                              <audio src={followup.voiceNoteUrl} controls className="w-full" data-testid={`audio-followup-${followup.id}`} />
                            )}
                            
                            {followup.videoUrl && followup.followupType === "video" && (
                              <video src={followup.videoUrl} controls className="w-full rounded-lg max-h-48" data-testid={`video-followup-${followup.id}`} />
                            )}
                            
                            {followup.imageUrl && followup.followupType === "image" && (
                              <img src={followup.imageUrl} alt="Follow-up" className="w-full rounded-lg max-h-48 object-contain" data-testid={`image-followup-${followup.id}`} />
                            )}
                            
                            {followup.nextFollowupDate && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 mt-2">
                                <CalendarClock className="h-3 w-3" />
                                Next follow-up: {format(new Date(followup.nextFollowupDate), "PPP")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </h4>
              
              <div className="space-y-4">
                {loadingComments ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex gap-3">
                        <div className="h-8 w-8 bg-muted rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-3/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={comment.user?.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {comment.user?.firstName} {comment.user?.lastName}
                          </span>
                          {comment.user?.role === "admin" && (
                            <Badge variant="outline" className="text-xs py-0">Admin</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt && format(new Date(comment.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                        
                        {/* Voice Note for Comment */}
                        {comment.voiceNoteUrl && (
                          <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-lg" data-testid={`comment-voice-${comment.id}`}>
                            <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <audio 
                              src={comment.voiceNoteUrl} 
                              controls 
                              className="h-8 flex-1"
                              data-testid={`audio-comment-${comment.id}`}
                            />
                            {comment.voiceNoteDuration && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatDuration(comment.voiceNoteDuration)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <Separator className="my-4 flex-shrink-0" />
        
        <div className="flex gap-3 flex-shrink-0">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={currentUser?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">
              {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] resize-none"
              data-testid="input-task-comment"
            />
            <Button 
              onClick={handleAddComment} 
              disabled={!newComment.trim() || addCommentMutation.isPending}
              data-testid="button-add-comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Assign to Development Dialog */}
        <AssignToDevelopmentDialog
          open={showAssignDevDialog}
          onClose={() => setShowAssignDevDialog(false)}
          sourceType="task"
          sourceId={task.id}
          sourceTitle={task.title}
          sourceReference={task.id}
          sourceDescription={task.description || undefined}
        />

        {/* Convert to Lead Dialog */}
        <Dialog open={showConvertToLeadDialog} onOpenChange={setShowConvertToLeadDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Convert Task to Lead
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Create a new sales lead from this task. All comments will be transferred to the new lead.
              </p>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      placeholder="Company name"
                      value={convertLeadForm.companyName}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, companyName: e.target.value }))}
                      className="pl-10"
                      data-testid="input-convert-company-name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactPerson"
                      placeholder="Contact person name"
                      value={convertLeadForm.contactPerson}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                      className="pl-10"
                      data-testid="input-convert-contact-person"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="email@example.com"
                      value={convertLeadForm.contactEmail}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                      className="pl-10"
                      data-testid="input-convert-contact-email"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactPhone"
                      placeholder="Phone number"
                      value={convertLeadForm.contactPhone}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                      className="pl-10"
                      data-testid="input-convert-contact-phone"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="leadSource">Lead Source</Label>
                    <Select
                      value={convertLeadForm.leadSource}
                      onValueChange={(value) => setConvertLeadForm(prev => ({ ...prev, leadSource: value, customLeadSource: value !== "other" ? "" : prev.customLeadSource }))}
                    >
                      <SelectTrigger data-testid="select-convert-lead-source">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task_conversion">Task Conversion</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="cold_call">Cold Call</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {convertLeadForm.leadSource === "other" && (
                      <div className="mt-2">
                        <Label htmlFor="customLeadSource">Specify Source</Label>
                        <Input
                          id="customLeadSource"
                          placeholder="Enter custom lead source"
                          value={convertLeadForm.customLeadSource || ""}
                          onChange={(e) => setConvertLeadForm(prev => ({ ...prev, customLeadSource: e.target.value }))}
                          data-testid="input-convert-custom-lead-source"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={convertLeadForm.currency}
                      onValueChange={(value) => setConvertLeadForm(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger data-testid="select-convert-currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="estimatedValue">Estimated Value</Label>
                  <Input
                    id="estimatedValue"
                    type="number"
                    placeholder="Enter estimated value"
                    value={convertLeadForm.estimatedValue}
                    onChange={(e) => setConvertLeadForm(prev => ({ ...prev, estimatedValue: e.target.value }))}
                    data-testid="input-convert-estimated-value"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={convertLeadForm.city}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, city: e.target.value }))}
                      data-testid="input-convert-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="area">Area</Label>
                    <Input
                      id="area"
                      placeholder="Area/Locality"
                      value={convertLeadForm.area}
                      onChange={(e) => setConvertLeadForm(prev => ({ ...prev, area: e.target.value }))}
                      data-testid="input-convert-area"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConvertToLeadDialog(false);
                  resetConvertLeadForm();
                }}
                data-testid="button-cancel-convert-lead"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConvertToLead}
                disabled={convertToLeadMutation.isPending || !convertLeadForm.companyName || !convertLeadForm.contactPerson || !convertLeadForm.contactEmail}
                data-testid="button-confirm-convert-lead"
              >
                {convertToLeadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Convert to Lead
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
