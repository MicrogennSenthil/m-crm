import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, TaskComment, User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  mentionedUserDetails?: User[];
};

type CommentWithUser = TaskComment & {
  user?: User;
};

interface TaskDetailModalProps {
  task: TaskWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate: () => void;
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
  const [newComment, setNewComment] = useState("");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

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

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onTaskUpdate();
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/tasks/${task.id}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{task.title}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
              </div>
            </div>
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
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
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
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Dates</h4>
                  <div className="space-y-2 text-sm">
                    {task.dueDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Due: {format(new Date(task.dueDate), "PPP")}</span>
                      </div>
                    )}
                    {task.reminderDate && (
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span>Reminder: {format(new Date(task.reminderDate), "PPP")}</span>
                      </div>
                    )}
                    {task.createdAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Created: {format(new Date(task.createdAt), "PPP")}</span>
                      </div>
                    )}
                    {task.completedAt && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Completed: {format(new Date(task.completedAt), "PPP")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {task.mentionedUserDetails && task.mentionedUserDetails.length > 0 && (
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
            
            {task.voiceNoteUrl && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Voice Note</h4>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
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
                      Voice Note ({formatDuration(task.voiceNoteDuration)})
                    </span>
                  </div>
                  <audio
                    id="task-voice-audio"
                    src={task.voiceNoteUrl}
                    onEnded={() => setIsPlayingVoice(false)}
                    className="hidden"
                  />
                </div>
              </div>
            )}
            
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <Separator className="my-4" />
        
        <div className="flex gap-3">
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
      </DialogContent>
    </Dialog>
  );
}
