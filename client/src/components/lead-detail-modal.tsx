import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Plus, CheckCircle, Mail, Phone, DollarSign, Pencil, X, Save } from "lucide-react";
import { format } from "date-fns";
import type { Lead, FollowUp, Quote, User, InsertLead } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AttachmentsList } from "./attachments-list";

const LEAD_SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const STAGES = [
  { value: "new_lead", label: "New Lead" },
  { value: "demo_scheduled", label: "Demo Scheduled" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InsertLead>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setEditForm({
        companyName: lead.companyName,
        contactPerson: lead.contactPerson,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone || "",
        leadSource: lead.leadSource,
        stage: lead.stage,
        estimatedValue: lead.estimatedValue || undefined,
        salesExecutiveId: lead.salesExecutiveId || undefined,
      });
    }
  }, [lead, open]);

  const { data: followUps } = useQuery<FollowUp[]>({
    queryKey: ["/api/leads", lead.id, "follow-ups"],
    enabled: open,
  });

  const { data: quotes } = useQuery<Quote[]>({
    queryKey: ["/api/leads", lead.id, "quotes"],
    enabled: open,
  });

  const { data: salesExecutives } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "sales_executive" }],
    enabled: open,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: Partial<InsertLead>) => {
      await apiRequest("PATCH", `/api/leads/${lead.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Lead updated successfully",
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
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const addFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUpNote || !followUpDate) return;
      await apiRequest("POST", `/api/leads/${lead.id}/follow-ups`, {
        notes: followUpNote,
        followUpDate: followUpDate.toISOString(),
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      setFollowUpNote("");
      setFollowUpDate(undefined);
      toast({
        title: "Success",
        description: "Follow-up added successfully",
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
        description: "Failed to add follow-up",
        variant: "destructive",
      });
    },
  });

  const toggleFollowUpMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await apiRequest("PATCH", `/api/follow-ups/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "follow-ups"] });
    },
  });

  const handleSaveEdit = () => {
    updateLeadMutation.mutate(editForm);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone || "",
      leadSource: lead.leadSource,
      stage: lead.stage,
      estimatedValue: lead.estimatedValue || undefined,
      salesExecutiveId: lead.salesExecutiveId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={editForm.companyName || ""}
                      onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      data-testid="input-edit-company-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={editForm.contactPerson || ""}
                      onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                      data-testid="input-edit-contact-person"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <DialogTitle className="text-2xl">{lead.companyName}</DialogTitle>
                  <DialogDescription className="mt-1">{lead.contactPerson}</DialogDescription>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-save-lead"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateLeadMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit-lead"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Badge variant="secondary" className="capitalize">
                    {lead.stage.replace(/_/g, " ")}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Contact Info & Company Details */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Contact Information</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={editForm.contactEmail || ""}
                      onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                      data-testid="input-edit-contact-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      value={editForm.contactPhone || ""}
                      onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                      data-testid="input-edit-contact-phone"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${lead.contactEmail}`} className="hover:underline">
                      {lead.contactEmail}
                    </a>
                  </div>
                  {lead.contactPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${lead.contactPhone}`} className="hover:underline">
                        {lead.contactPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Lead Details</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="leadSource">Source</Label>
                    <Select
                      value={editForm.leadSource}
                      onValueChange={(value) => setEditForm({ ...editForm, leadSource: value })}
                    >
                      <SelectTrigger data-testid="select-edit-lead-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stage">Stage</Label>
                    <Select
                      value={editForm.stage}
                      onValueChange={(value) => setEditForm({ ...editForm, stage: value })}
                    >
                      <SelectTrigger data-testid="select-edit-stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="estimatedValue">Estimated Value</Label>
                    <Input
                      id="estimatedValue"
                      type="number"
                      value={editForm.estimatedValue || ""}
                      onChange={(e) => setEditForm({ ...editForm, estimatedValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                      data-testid="input-edit-estimated-value"
                    />
                  </div>
                  <div>
                    <Label htmlFor="salesExecutive">Sales Executive</Label>
                    <Select
                      value={editForm.salesExecutiveId || "unassigned"}
                      onValueChange={(value) => setEditForm({ ...editForm, salesExecutiveId: value === "unassigned" ? undefined : value })}
                    >
                      <SelectTrigger data-testid="select-edit-sales-executive">
                        <SelectValue placeholder="Select executive" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {salesExecutives?.map((exec) => (
                          <SelectItem key={exec.id} value={exec.id}>
                            {exec.firstName} {exec.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source:</span>
                    <Badge variant="outline" className="capitalize">{lead.leadSource}</Badge>
                  </div>
                  {lead.estimatedValue && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {lead.estimatedValue.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days in stage:</span>
                    <span className="font-medium">{lead.daysInStage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="font-medium">
                      {lead.salesExecutiveId && salesExecutives
                        ? salesExecutives.find(e => e.id === lead.salesExecutiveId)?.firstName + " " + salesExecutives.find(e => e.id === lead.salesExecutiveId)?.lastName
                        : "Unassigned"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isEditing && quotes && quotes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">Quotes</h3>
                  <div className="space-y-2">
                    {quotes.map((quote) => (
                      <div key={quote.id} className="p-3 border rounded-md text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">${quote.amount.toLocaleString()}</span>
                          <Badge
                            variant={quote.status === "accepted" ? "default" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {quote.status}
                          </Badge>
                        </div>
                        {quote.description && (
                          <p className="text-muted-foreground text-xs">{quote.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!isEditing && (
              <>
                <Separator />
                <AttachmentsList
                  entityType="lead"
                  entityId={lead.id}
                  title="Documents & Files"
                />
              </>
            )}
          </div>

          {/* Right: Activity Timeline & Follow-ups */}
          {!isEditing && (
            <div className="lg:col-span-2 space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Follow-up Tracker</h3>

                {/* Add Follow-up Form */}
                <div className="mb-4 p-4 border rounded-md space-y-3">
                  <Textarea
                    placeholder="Add follow-up notes..."
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    className="min-h-20"
                    data-testid="textarea-follow-up-note"
                  />
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1",
                            !followUpDate && "text-muted-foreground"
                          )}
                          data-testid="button-select-follow-up-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={followUpDate}
                          onSelect={setFollowUpDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={() => addFollowUpMutation.mutate()}
                      disabled={!followUpNote || !followUpDate || addFollowUpMutation.isPending}
                      data-testid="button-add-follow-up"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Follow-ups List */}
                <div className="space-y-2">
                  {followUps && followUps.length > 0 ? (
                    followUps.map((followUp) => (
                      <div
                        key={followUp.id}
                        className={cn(
                          "p-3 border rounded-md flex items-start gap-3",
                          followUp.completed && "opacity-60"
                        )}
                      >
                        <button
                          onClick={() =>
                            toggleFollowUpMutation.mutate({
                              id: followUp.id,
                              completed: !followUp.completed,
                            })
                          }
                          className="mt-1"
                        >
                          <CheckCircle
                            className={cn(
                              "h-5 w-5",
                              followUp.completed ? "text-green-600 fill-green-600" : "text-muted-foreground"
                            )}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", followUp.completed && "line-through")}>
                            {followUp.notes}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(followUp.followUpDate), "PPP")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No follow-ups yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
