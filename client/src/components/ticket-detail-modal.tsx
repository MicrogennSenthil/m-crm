import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, Send, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Ticket, TicketComment, User, EscalationHistory } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";

interface TicketDetailModalProps {
  ticket: Ticket;
  open: boolean;
  onClose: () => void;
}

const PRIORITY_CONFIG = {
  critical: { variant: "destructive" as const, label: "Critical", icon: AlertTriangle },
  high: { variant: "default" as const, label: "High", className: "bg-orange-600", icon: AlertTriangle },
  medium: { variant: "secondary" as const, label: "Medium", icon: AlertTriangle },
  low: { variant: "outline" as const, label: "Low", icon: AlertTriangle },
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
    queryKey: ["/api/users", { role: "support" }],
    enabled: open,
  });

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
    mutationFn: async (data: { status?: string; assignedEngineerId?: string }) => {
      await apiRequest("PATCH", `/api/tickets/${ticket.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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
      await apiRequest("POST", `/api/tickets/${ticket.id}/close`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Ticket closed. Feedback email sent to customer.",
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
        description: "Failed to close ticket",
        variant: "destructive",
      });
    },
  });

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
            {/* Issue Description */}
            <div className="p-4 border rounded-md bg-muted/30">
              <h3 className="font-semibold mb-2">Issue Description</h3>
              <p className="text-sm whitespace-pre-wrap">{ticket.issueDescription}</p>
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
            {ticket.status !== "closed" && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => escalateTicketMutation.mutate()}
                  disabled={escalateTicketMutation.isPending || ticket.escalationLevel >= 3}
                  data-testid="button-escalate-ticket"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Escalate to L{ticket.escalationLevel + 1}
                </Button>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => closeTicketMutation.mutate()}
                  disabled={closeTicketMutation.isPending}
                  data-testid="button-close-ticket"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Close Ticket
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
