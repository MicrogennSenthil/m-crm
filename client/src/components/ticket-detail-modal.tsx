import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, Send, AlertTriangle, CheckCircle2, Mail, RotateCcw, Link2, Code2, Headphones, Wrench, Bell, Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AssignToDevelopmentDialog } from "./assign-to-development-dialog";
import { formatDistanceToNow, format } from "date-fns";
import type { Ticket, TicketComment, User, EscalationHistory, DevelopmentTask, DevelopmentSupportMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AttachmentsList } from "./attachments-list";

interface TicketDetailModalProps {
  ticket: Ticket;
  open: boolean;
  onClose: () => void;
}

const PRIORITY_CONFIG: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string; className?: string; icon: typeof AlertTriangle }> = {
  critical: { variant: "destructive", label: "Critical", icon: AlertTriangle },
  high: { variant: "default", label: "High", className: "bg-orange-600", icon: AlertTriangle },
  medium: { variant: "secondary", label: "Medium", icon: AlertTriangle },
  low: { variant: "outline", label: "Low", icon: AlertTriangle },
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_customer", label: "Pending Customer" },
  { value: "escalated", label: "Escalated" },
  { value: "closed", label: "Closed" },
];

export function TicketDetailModal({ ticket, open, onClose }: TicketDetailModalProps) {
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showAssignDevDialog, setShowAssignDevDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const { toast } = useToast();

  const { data: comments } = useQuery<(TicketComment & { user?: User })[]>({
    queryKey: ["/api/tickets", ticket.id, "comments"],
    enabled: open,
  });

  const { data: escalations } = useQuery<EscalationHistory[]>({
    queryKey: ["/api/tickets", ticket.id, "escalations"],
    enabled: open,
  });

  const { data: supportEngineers } = useQuery<User[]>({
    queryKey: ["/api/users?role=support"],
    enabled: open,
  });

  // hasActiveDevelopmentTask is derived from the ticket prop (enriched by /api/tickets endpoint)
  // This avoids making a separate API call and keeps the logic consistent
  const hasActiveDevelopmentTask = (ticket as any).hasActiveDevelopmentTask || false;

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!newComment.trim()) return;
      await apiRequest("POST", `/api/tickets/${ticket.id}/comments`, {
        comment: newComment,
        isInternal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      setNewComment("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (data: { status?: string; assignedEngineerId?: string; reminderDate?: Date | null; reminderNotes?: string | null }) => {
      await apiRequest("PATCH", `/api/tickets/${ticket.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowReminderForm(false);
      setReminderDate("");
      setReminderNotes("");
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const escalateTicketMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/tickets/${ticket.id}/escalate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket.id, "escalations"] });
      toast({
        title: "Success",
        description: "Ticket escalated to next level",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to escalate ticket",
        variant: "destructive",
      });
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/tickets/${ticket.id}/close`, { closingNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Ticket closed. Feedback email sent to customer.",
      });
      setShowCloseDialog(false);
      setClosingNotes("");
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to close ticket",
        variant: "destructive",
      });
    },
  });

  const reopenTicketMutation = useMutation({
    mutationFn: async () => {
      if (!reopenReason.trim()) {
        throw new Error("Reopen reason is required");
      }
      await apiRequest("POST", `/api/tickets/${ticket.id}/reopen`, {
        reopenReason: reopenReason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowReopenDialog(false);
      setReopenReason("");
      toast({
        title: "Success",
        description: "Ticket reopened with a new ticket number.",
      });
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to reopen ticket",
        variant: "destructive",
      });
    },
  });

  // Query for original ticket if this was reopened
  const { data: originalTicket } = useQuery<Ticket>({
    queryKey: ["/api/tickets", ticket.reopenedFromTicketId],
    enabled: open && !!ticket.reopenedFromTicketId,
  });

  // Query for linked development tasks
  const { data: linkedDevTasks } = useQuery<(DevelopmentTask & { assignee?: User })[]>({
    queryKey: ["/api/tickets", ticket.id, "development-tasks"],
    enabled: open,
  });

  // Query for development-support messages
  const { data: devSupportMessages } = useQuery<(DevelopmentSupportMessage & { sender?: User })[]>({
    queryKey: ["/api/tickets", ticket.id, "dev-messages"],
    enabled: open,
  });

  // Determine resolution source
  const hasDevTasks = linkedDevTasks && linkedDevTasks.length > 0;
  const completedDevTasks = linkedDevTasks?.filter(t => t.status === 'completed') || [];
  const resolutionSource = hasDevTasks 
    ? (completedDevTasks.length > 0 ? 'development' : 'support_with_dev_pending')
    : 'support';

  const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-mono">{ticket.ticketNumber}</DialogTitle>
              <p className="text-muted-foreground mt-1">{ticket.issueSummary}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                {priorityConfig.label}
              </Badge>
              <Badge variant="outline">L{ticket.escalationLevel}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left & Center: Issue Description & Conversation */}
          <div className="lg:col-span-2 space-y-4">
            {/* Reopened From Info */}
            {ticket.reopenedFromTicketId && (
              <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-blue-800 dark:text-blue-200">
                    Reopened from ticket:{" "}
                    <span className="font-mono font-medium">
                      {originalTicket?.ticketNumber || ticket.reopenedFromTicketId}
                    </span>
                  </span>
                </div>
                {ticket.reopenReason && (
                  <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Reason:</span> {ticket.reopenReason}
                  </p>
                )}
                {ticket.reopenedAt && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Reopened on {format(new Date(ticket.reopenedAt), "PPP")}
                  </p>
                )}
              </div>
            )}

            {/* Issue Description */}
            <div className="p-4 border rounded-md bg-muted/30">
              <h3 className="font-semibold mb-2">Issue Description</h3>
              <p className="text-sm whitespace-pre-wrap">{ticket.issueDescription}</p>
            </div>

            {/* Resolution Details - Shows for closed tickets, tickets with dev tasks, or tickets with closing notes (reopened tickets) */}
            {(ticket.status === "closed" || hasDevTasks || ticket.closingNotes) && (
              <div className="p-4 border rounded-md bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    {ticket.status === "closed" ? "Resolution Details" : 
                     ticket.closingNotes ? "Previous Resolution Details" : "Call Details"}
                  </h3>
                  {ticket.reopenedFromTicketId && ticket.status !== "closed" && (
                    <Badge variant="outline" className="text-xs">From Previous Ticket</Badge>
                  )}
                </div>

                {/* Resolution Source Indicator */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Resolution Source:</span>
                    {resolutionSource === 'development' ? (
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        <Wrench className="h-3 w-3 mr-1" />
                        Development End
                      </Badge>
                    ) : resolutionSource === 'support_with_dev_pending' ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Code2 className="h-3 w-3 mr-1" />
                        Dev Task In Progress
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <Headphones className="h-3 w-3 mr-1" />
                        Support End
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Closing Notes / Solution Provided - Always show for closed tickets */}
                {ticket.status === "closed" && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                      Closing Notes / Resolution:
                    </p>
                    <div className="text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded-md border">
                      {ticket.closingNotes ? (
                        <p>{ticket.closingNotes}</p>
                      ) : (
                        <p className="text-muted-foreground italic">No closing notes were provided</p>
                      )}
                    </div>
                    {ticket.closedAt && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        Closed on: {format(new Date(ticket.closedAt), "PPP p")}
                      </p>
                    )}
                  </div>
                )}
                {/* Show previous closing notes for reopened tickets */}
                {ticket.status !== "closed" && ticket.closingNotes && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                      Previous Resolution Notes:
                    </p>
                    <p className="text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded-md border">
                      {ticket.closingNotes}
                    </p>
                  </div>
                )}

                {/* Linked Development Tasks */}
                {hasDevTasks && (
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                      Development Tasks ({linkedDevTasks.length}):
                    </p>
                    <div className="space-y-2">
                      {linkedDevTasks.map((devTask) => (
                        <div 
                          key={devTask.id} 
                          className="text-sm bg-white dark:bg-gray-900 p-3 rounded-md border"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {devTask.taskNumber}
                            </span>
                            <Badge 
                              variant={devTask.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {devTask.status === 'completed' ? 'Completed' : 
                               devTask.status === 'in_progress' ? 'In Progress' : 
                               devTask.status === 'pending' ? 'Pending' : devTask.status}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm">{devTask.title}</p>
                          {devTask.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {devTask.description}
                            </p>
                          )}
                          {devTask.assignee && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Assigned to: {devTask.assignee.firstName} {devTask.assignee.lastName}
                            </p>
                          )}
                          {devTask.completedAt && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Completed on: {format(new Date(devTask.completedAt), "PPP")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Development Team Guidance */}
                {devSupportMessages && devSupportMessages.length > 0 && (
                  <div className="mt-4 pt-4 border-t" data-testid="dev-guidance-section">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                      <Code2 className="h-4 w-4" />
                      Development Team Guidance ({devSupportMessages.length}):
                    </p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {devSupportMessages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={cn(
                            "text-sm p-3 rounded-md border",
                            msg.senderType === 'development' 
                              ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" 
                              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                          )}
                          data-testid={`dev-message-${msg.id}`}
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
                                {msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : (msg.senderType === 'development' ? 'Development Team' : 'Support Team')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {msg.senderType === 'development' ? 'Dev Team' : 'Support'}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {msg.createdAt ? format(new Date(msg.createdAt), "MMM d, HH:mm") : ''}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Attachments - Prominent Position */}
            <div className="p-4 border rounded-md">
              <AttachmentsList
                entityType="ticket"
                entityId={ticket.id}
                title="Attachments"
              />
            </div>

            {/* Conversation Thread */}
            <div>
              <h3 className="font-semibold mb-3">Conversation</h3>
              <div className="space-y-3 mb-4">
                {comments && comments.length > 0 ? (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={cn(
                        "p-3 rounded-md border",
                        comment.isInternal && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.user?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.user?.firstName?.[0]}{comment.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {comment.user?.firstName} {comment.user?.lastName}
                            </span>
                            {comment.isInternal && (
                              <Badge variant="outline" className="text-xs">Internal</Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {comment.createdAt && formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No comments yet
                  </p>
                )}
              </div>

              {/* Add Comment */}
              {ticket.status !== "closed" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-24"
                    data-testid="textarea-new-comment"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      Internal note (not visible to customer)
                    </label>
                    <Button
                      onClick={() => addCommentMutation.mutate()}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Ticket Metadata & Actions */}
          <div className="space-y-4">
            <div className="p-4 border rounded-md space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Customer</p>
                <p className="font-medium">{ticket.customerName}</p>
                <a href={`mailto:${ticket.customerEmail}`} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3" />
                  {ticket.customerEmail}
                </a>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <Select
                  value={ticket.status}
                  onValueChange={(value) => updateTicketMutation.mutate({ status: value })}
                  disabled={ticket.status === "closed"}
                >
                  <SelectTrigger data-testid="select-ticket-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Assigned Engineer</p>
                <Select
                  value={ticket.assignedEngineerId || undefined}
                  onValueChange={(value) => updateTicketMutation.mutate({ assignedEngineerId: value })}
                  disabled={ticket.status === "closed"}
                >
                  <SelectTrigger data-testid="select-assigned-engineer">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportEngineers?.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.id}>
                        {engineer.firstName} {engineer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="text-sm">
                  {ticket.createdAt && format(new Date(ticket.createdAt), "PPP p")}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Age</p>
                <p className="text-sm">
                  {ticket.createdAt && formatDistanceToNow(new Date(ticket.createdAt))}
                </p>
              </div>

              {/* Reminder Date Section */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-muted-foreground">Follow-up Reminder</p>
                  </div>
                  {ticket.status !== "closed" && !showReminderForm && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowReminderForm(true)}
                      data-testid="button-set-reminder"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      {ticket.reminderDate ? "Edit" : "Set Reminder"}
                    </Button>
                  )}
                </div>

                {ticket.reminderDate && !showReminderForm && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          {format(new Date(ticket.reminderDate), "PPP")}
                        </p>
                        {ticket.reminderNotes && (
                          <p className="text-xs text-muted-foreground mt-1">{ticket.reminderNotes}</p>
                        )}
                      </div>
                      {ticket.status !== "closed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateTicketMutation.mutate({ reminderDate: null, reminderNotes: null })}
                          data-testid="button-clear-reminder"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {new Date(ticket.reminderDate).toDateString() === new Date().toDateString() && (
                      <Badge className="mt-2 bg-amber-600">Follow up Today!</Badge>
                    )}
                  </div>
                )}

                {showReminderForm && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <div>
                      <Label className="text-xs">Reminder Date</Label>
                      <Input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        min={format(new Date(), "yyyy-MM-dd")}
                        className="h-8"
                        data-testid="input-reminder-date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Notes (optional)</Label>
                      <Textarea
                        value={reminderNotes}
                        onChange={(e) => setReminderNotes(e.target.value)}
                        placeholder="Why is this reminder set? e.g., Client not available until this date"
                        className="min-h-[60px] text-sm"
                        data-testid="input-reminder-notes"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (reminderDate) {
                            updateTicketMutation.mutate({
                              reminderDate: new Date(reminderDate),
                              reminderNotes: reminderNotes || null,
                            });
                          }
                        }}
                        disabled={!reminderDate || updateTicketMutation.isPending}
                        data-testid="button-save-reminder"
                      >
                        {updateTicketMutation.isPending ? "Saving..." : "Save Reminder"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowReminderForm(false);
                          setReminderDate("");
                          setReminderNotes("");
                        }}
                        data-testid="button-cancel-reminder"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!ticket.reminderDate && !showReminderForm && (
                  <p className="text-xs text-muted-foreground">No reminder set</p>
                )}
              </div>
            </div>

            {/* Escalation Matrix */}
            {escalations && escalations.length > 0 && (
              <div className="p-4 border rounded-md">
                <h4 className="font-semibold mb-3 text-sm">Escalation History</h4>
                <div className="space-y-2">
                  {escalations.map((esc) => (
                    <div key={esc.id} className="text-xs p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUp className="h-3 w-3 text-destructive" />
                        <span className="font-medium">
                          L{esc.fromLevel} → L{esc.toLevel}
                        </span>
                      </div>
                      {esc.reason && <p className="text-muted-foreground">{esc.reason}</p>}
                      <p className="text-muted-foreground mt-1">
                        {esc.escalatedAt && format(new Date(esc.escalatedAt), "PPP")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {ticket.status !== "closed" ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAssignDevDialog(true)}
                  data-testid="button-assign-to-development"
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  Assign to Development
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => escalateTicketMutation.mutate()}
                  disabled={escalateTicketMutation.isPending || (ticket.escalationLevel ?? 1) >= 3}
                  data-testid="button-escalate-ticket"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Escalate to L{(ticket.escalationLevel ?? 1) + 1}
                </Button>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setShowCloseDialog(true)}
                  disabled={hasActiveDevelopmentTask}
                  data-testid="button-close-ticket"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {hasActiveDevelopmentTask ? "Close (Dev Task Pending)" : "Close Ticket"}
                </Button>
                {hasActiveDevelopmentTask && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    Cannot close ticket while development task is in progress
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowReopenDialog(true)}
                  data-testid="button-reopen-ticket"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reopen Ticket
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Assign to Development Dialog */}
        <AssignToDevelopmentDialog
          open={showAssignDevDialog}
          onClose={() => setShowAssignDevDialog(false)}
          sourceType="support"
          sourceId={ticket.id}
          sourceTitle={`[${ticket.ticketNumber}] ${ticket.issueSummary}`}
          sourceReference={ticket.ticketNumber}
          sourceDescription={ticket.issueDescription || undefined}
        />

        {/* Close Ticket Dialog */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close Ticket</DialogTitle>
              <DialogDescription>
                Add closing notes/narration for this ticket. This will be visible in feedback and reports.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="closing-notes">Closing Notes / Narration</Label>
                <Textarea
                  id="closing-notes"
                  placeholder="Describe the resolution, work done, or any notes about closing this ticket..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="min-h-24"
                  data-testid="textarea-closing-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCloseDialog(false);
                  setClosingNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => closeTicketMutation.mutate()}
                disabled={closeTicketMutation.isPending}
                data-testid="button-confirm-close"
              >
                {closeTicketMutation.isPending ? "Closing..." : "Close Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reopen Ticket Dialog */}
        <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen Ticket</DialogTitle>
              <DialogDescription>
                This will create a new ticket linked to the original closed ticket. Please provide a reason for reopening.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reopen-reason">Reason for Reopening</Label>
                <Textarea
                  id="reopen-reason"
                  placeholder="Describe why this ticket needs to be reopened..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="min-h-24"
                  data-testid="textarea-reopen-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReopenDialog(false);
                  setReopenReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => reopenTicketMutation.mutate()}
                disabled={!reopenReason.trim() || reopenTicketMutation.isPending}
                data-testid="button-confirm-reopen"
              >
                {reopenTicketMutation.isPending ? "Reopening..." : "Reopen Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
