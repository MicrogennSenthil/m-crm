import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Task, TaskComment, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Users,
  Bell,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  Send,
  ArrowLeft,
  Video,
  Image,
  FileIcon,
  Paperclip,
  ExternalLink,
  UserCircle,
} from "lucide-react";

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  mentionedUserDetails?: User[];
};

type CommentWithUser = TaskComment & {
  user?: User;
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

export default function TaskDetail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/tasks/:id");
  const taskId = params?.id;
  const [newComment, setNewComment] = useState("");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: task, isLoading: loadingTask } = useQuery<TaskWithDetails>({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
    enabled: !!taskId,
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/tasks", taskId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!taskId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/tasks/${taskId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "comments"] });
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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadingTask) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading task...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="outline" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";
  const canEdit = isAdmin || task.createdBy === currentUser?.id || task.assignedTo === currentUser?.id;
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const priorityConfig = PRIORITY_CONFIG[task.priority || "medium"];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/tasks")} data-testid="button-back-to-tasks">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-3" data-testid="text-task-title">{task.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
              </div>
            </div>
            {canEdit && (
              <Select value={task.status} onValueChange={(value) => updateStatusMutation.mutate(value)}>
                <SelectTrigger className="w-[160px]" data-testid="select-update-status">
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
        </CardHeader>

        <CardContent className="space-y-8">
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <p className="whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Created By
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.creator ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={task.creator.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {task.creator.firstName?.[0]}{task.creator.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{task.creator.firstName} {task.creator.lastName}</p>
                      <p className="text-sm text-muted-foreground">{task.creator.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Unknown</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.assignee ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={task.assignee.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{task.assignee.firstName} {task.assignee.lastName}</p>
                        <p className="text-sm text-muted-foreground">{task.assignee.role}</p>
                      </div>
                    </div>
                    {(task as any).assignedAt && (
                      <p className="text-xs text-muted-foreground">
                        Assigned: {format(new Date((task as any).assignedAt), "PPP 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Unassigned</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Dates & Times
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Due: {format(new Date(task.dueDate), "PPP 'at' h:mm a")}</span>
                  </div>
                )}
                {task.reminderDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span>Reminder: {format(new Date(task.reminderDate), "PPP 'at' h:mm a")}</span>
                  </div>
                )}
                {task.createdAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Created: {format(new Date(task.createdAt), "PPP 'at' h:mm a")}</span>
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Completed: {format(new Date(task.completedAt), "PPP 'at' h:mm a")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {task.mentionedUserDetails && task.mentionedUserDetails.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Mentioned Team Members
              </h4>
              <div className="flex flex-wrap gap-3">
                {task.mentionedUserDetails.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.voiceNoteUrl && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Voice Note</h4>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    const audio = document.getElementById("task-voice-audio-page") as HTMLAudioElement;
                    if (audio) {
                      if (isPlayingVoice) {
                        audio.pause();
                      } else {
                        audio.play();
                      }
                      setIsPlayingVoice(!isPlayingVoice);
                    }
                  }}
                  data-testid="button-play-voice"
                >
                  {isPlayingVoice ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-muted-foreground" />
                  <span>Voice Note ({formatDuration(task.voiceNoteDuration)})</span>
                </div>
                <audio
                  id="task-voice-audio-page"
                  src={task.voiceNoteUrl}
                  onEnded={() => setIsPlayingVoice(false)}
                  className="hidden"
                />
              </div>
            </div>
          )}

          <div data-testid="section-attachments">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments ({task.attachments?.length || 0})
            </h4>
            
            {task.attachments && task.attachments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {task.attachments.filter(a => a.type === "video").map((attachment) => (
                  <Card key={attachment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">{attachment.name}</span>
                      </div>
                      <video
                        src={attachment.url}
                        className="w-full rounded-lg aspect-video bg-black"
                        controls
                        data-testid={`video-attachment-${attachment.id}`}
                      />
                    </CardContent>
                  </Card>
                ))}
                
                {task.attachments.filter(a => a.type === "photo").map((attachment) => (
                  <Card key={attachment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Image className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{attachment.name}</span>
                      </div>
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full rounded-lg max-h-80 object-contain"
                        data-testid={`photo-attachment-${attachment.id}`}
                      />
                    </CardContent>
                  </Card>
                ))}
                
                {task.attachments.filter(a => a.type === "file").map((attachment) => (
                  <Card key={attachment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{attachment.name}</p>
                          {attachment.size && (
                            <p className="text-sm text-muted-foreground">
                              {attachment.size < 1024 
                                ? `${attachment.size} B`
                                : attachment.size < 1024 * 1024
                                  ? `${(attachment.size / 1024).toFixed(1)} KB`
                                  : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
                              }
                            </p>
                          )}
                        </div>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`file-attachment-${attachment.id}`}
                        >
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No attachments added
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </h4>
            
            <div className="space-y-4 mb-6">
              {loadingComments ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-10 w-10 bg-muted rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No comments yet. Be the first to comment!
                  </CardContent>
                </Card>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id} data-testid={`comment-${comment.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={comment.user?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {comment.user?.firstName} {comment.user?.lastName}
                            </span>
                            {comment.user?.role === "admin" && (
                              <Badge variant="outline" className="text-xs py-0">Admin</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {comment.createdAt && format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={currentUser?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-3">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px] resize-none"
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
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
