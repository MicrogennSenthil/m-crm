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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus, CheckCircle, Mail, Phone, DollarSign, Pencil, X, Save, Clock, Video, FileText, Handshake, Trophy, XCircle, Package, History, MapPin, Loader2, Camera, Trash2, UserPlus } from "lucide-react";
import { format, startOfDay, isToday } from "date-fns";
import type { Lead, FollowUp, Quote, User, InsertLead, Module } from "@shared/schema";
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
  { value: "seed", label: "Seed" },
  { value: "lead", label: "Lead" },
  { value: "demo_scheduled", label: "Demo Scheduled" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

// Modules are now fetched from the database instead of hardcoded

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [followUpTime, setFollowUpTime] = useState("09:00");
  const [demoDate, setDemoDate] = useState<Date>();
  const [demoTime, setDemoTime] = useState("10:00");
  // Quote state
  const [quoteDate, setQuoteDate] = useState<Date>();
  const [quoteValue, setQuoteValue] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  // Negotiation state
  const [negotiationDate, setNegotiationDate] = useState<Date>();
  // Close deal state
  const [closedDate, setClosedDate] = useState<Date>();
  const [confirmedOrderValue, setConfirmedOrderValue] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [closedReason, setClosedReason] = useState("");
  
  // Seed interest tracking state
  const [interestStatus, setInterestStatus] = useState<string | null>(null);
  const [notInterestedReason, setNotInterestedReason] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState<Date>();
  const [nextFollowupTime, setNextFollowupTime] = useState("10:00");
  const [seedFollowupCalendarOpen, setSeedFollowupCalendarOpen] = useState(false);
  
  // Calendar popover open states for auto-close
  const [demoCalendarOpen, setDemoCalendarOpen] = useState(false);
  const [followUpCalendarOpen, setFollowUpCalendarOpen] = useState(false);
  const [quoteCalendarOpen, setQuoteCalendarOpen] = useState(false);
  const [negotiationCalendarOpen, setNegotiationCalendarOpen] = useState(false);
  const [closedCalendarOpen, setClosedCalendarOpen] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InsertLead>>({});
  const { toast } = useToast();

  // Location state
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Reassign state
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [reassignReason, setReassignReason] = useState("");

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
        city: lead.city || "",
        area: lead.area || "",
        latitude: lead.latitude || undefined,
        longitude: lead.longitude || undefined,
      });
      // Initialize interest tracking state from lead
      setInterestStatus((lead as any).interestStatus || null);
      setNotInterestedReason((lead as any).notInterestedReason || "");
      if ((lead as any).nextFollowupDate) {
        setNextFollowupDate(new Date((lead as any).nextFollowupDate));
      } else {
        setNextFollowupDate(undefined);
      }
    }
  }, [lead, open]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newEditForm = {
          ...editForm,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          locationCapturedAt: new Date(),
        };
        
        // Try to get city/area using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || "";
            const area = data.address.suburb || data.address.neighbourhood || data.address.road || "";
            newEditForm.city = city;
            newEditForm.area = area;
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
        }
        
        setEditForm(newEditForm);
        setIsGettingLocation(false);
        toast({
          title: "Location captured",
          description: "Your current location has been added.",
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Location error",
          description: error.message || "Failed to get your location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const { data: followUps } = useQuery<FollowUp[]>({
    queryKey: ["/api/leads", lead.id, "follow-ups"],
    enabled: open,
  });

  const { data: quotes } = useQuery<Quote[]>({
    queryKey: ["/api/leads", lead.id, "quotes"],
    enabled: open,
  });

  // Fetch all users and filter for both sales_executive and sales_head roles
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
    enabled: open,
  });
  
  const salesExecutives = allUsers?.filter(
    user => user.role === 'sales_executive' || user.role === 'sales_head'
  );

  // Fetch modules from database
  const { data: modules } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
    enabled: open,
  });

  const { data: demoHistory } = useQuery<Array<{
    id: string;
    leadId: string;
    demoDate: string;
    changedById: string | null;
    changeReason: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/leads", lead.id, "demo-history"],
    enabled: open,
  });

  const { data: negotiationHistory } = useQuery<Array<{
    id: string;
    leadId: string;
    negotiationDate: string;
    notes: string | null;
    changedById: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/leads", lead.id, "negotiation-history"],
    enabled: open,
  });

  const { data: stageHistory } = useQuery<Array<{
    id: string;
    leadId: string;
    fromStage: string | null;
    toStage: string;
    changedById: string | null;
    changeReason: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/leads", lead.id, "stage-history"],
    enabled: open,
  });

  const { data: assignmentHistory } = useQuery<Array<{
    id: string;
    leadId: string;
    fromUserId: string | null;
    toUserId: string;
    reassignedById: string | null;
    reason: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/leads", lead.id, "assignment-history"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
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

  // Convert Seed to Lead mutation
  const convertToLeadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/leads/${lead.id}`, { stage: "lead" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
      toast({
        title: "Seed Converted",
        description: "Seed has been successfully converted to Lead",
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
        description: "Failed to convert seed to lead",
        variant: "destructive",
      });
    },
  });

  // Delete Seed mutation - allows re-import from extractor
  const deleteSeedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/leads/${lead.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/places"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      toast({
        title: "Seed Deleted",
        description: "Seed has been removed. You can now re-import this business from the Extractor.",
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
        description: "Failed to delete seed",
        variant: "destructive",
      });
    },
  });

  // Reassign lead to another sales executive mutation
  const reassignLeadMutation = useMutation({
    mutationFn: async () => {
      if (!reassignToUserId) return;
      await apiRequest("POST", `/api/leads/${lead.id}/reassign`, {
        newSalesExecutiveId: reassignToUserId,
        reason: reassignReason || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "assignment-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      setIsReassignDialogOpen(false);
      setReassignToUserId("");
      setReassignReason("");
      toast({
        title: "Lead Reassigned",
        description: "Lead has been successfully reassigned to the new sales executive",
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
        description: "Failed to reassign lead",
        variant: "destructive",
      });
    },
  });

  // Update seed interest status mutation
  const updateInterestMutation = useMutation({
    mutationFn: async (data: { 
      interestStatus: string; 
      notInterestedReason?: string;
      nextFollowupDate?: Date;
    }) => {
      await apiRequest("PATCH", `/api/leads/${lead.id}/interest`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seeds/report"] });
      toast({
        title: "Interest Status Updated",
        description: interestStatus === "interested" 
          ? "Seed marked as interested with followup scheduled" 
          : "Seed marked as not interested",
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
        description: "Failed to update interest status",
        variant: "destructive",
      });
    },
  });

  const addFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!followUpNote || !followUpDate) return;
      // Combine date and time
      const [hours, minutes] = followUpTime.split(":").map(Number);
      const dateWithTime = new Date(followUpDate);
      dateWithTime.setHours(hours, minutes, 0, 0);
      
      await apiRequest("POST", `/api/leads/${lead.id}/follow-ups`, {
        notes: followUpNote,
        followUpDate: dateWithTime.toISOString(),
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      setFollowUpNote("");
      setFollowUpDate(undefined);
      setFollowUpTime("09:00");
      toast({
        title: "Success",
        description: "Follow-up added successfully",
      });
    },
    onError: (error: any) => {
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
      // Check if it's a planning requirement error
      if (error?.code === "PLANNING_REQUIRED" || error?.message?.includes("planning")) {
        toast({
          title: "Planning Required",
          description: error.message || "Please complete your monthly sales planning first",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: error?.message || "Failed to add follow-up",
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

  const isDemoTimeValid = () => {
    if (!demoDate) return false;
    const [hours, minutes] = demoTime.split(":").map(Number);
    const dateWithTime = new Date(demoDate);
    dateWithTime.setHours(hours, minutes, 0, 0);
    return dateWithTime > new Date();
  };

  const scheduleDemoMutation = useMutation({
    mutationFn: async () => {
      if (!demoDate) return;
      const [hours, minutes] = demoTime.split(":").map(Number);
      const dateWithTime = new Date(demoDate);
      dateWithTime.setHours(hours, minutes, 0, 0);
      
      if (dateWithTime <= new Date()) {
        throw new Error("Please select a future date and time");
      }
      
      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        demoDate: dateWithTime.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "demo-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
      setDemoDate(undefined);
      setDemoTime("10:00");
      toast({
        title: "Demo Scheduled",
        description: "Demo has been scheduled and lead moved to Demo Scheduled stage",
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
        description: "Failed to schedule demo",
        variant: "destructive",
      });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteDate || !quoteValue || selectedModules.length === 0) return;
      
      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        quoteSentDate: quoteDate.toISOString(),
        quoteValue: parseInt(quoteValue),
        selectedModules,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
      setQuoteDate(undefined);
      setQuoteValue("");
      setSelectedModules([]);
      toast({
        title: "Quote Sent",
        description: "Quote has been sent and lead moved to Quote Sent stage",
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
        description: "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const startNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!negotiationDate) return;
      
      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        negotiationDate: negotiationDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "negotiation-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
      setNegotiationDate(undefined);
      toast({
        title: "Negotiation Started",
        description: "Lead moved to Negotiation stage",
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
        description: "Failed to start negotiation",
        variant: "destructive",
      });
    },
  });

  const closeDealMutation = useMutation({
    mutationFn: async (isWon: boolean) => {
      if (!closedDate) return;
      
      if (isWon && !confirmedOrderValue) {
        throw new Error("Confirmed order value is required");
      }
      
      if (isWon && !advanceAmount) {
        throw new Error("Advance amount is required");
      }
      
      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        closedDate: closedDate.toISOString(),
        stage: isWon ? "closed_won" : "closed_lost",
        confirmedOrderValue: isWon ? parseInt(confirmedOrderValue) : undefined,
        advanceAmount: isWon ? parseInt(advanceAmount) : undefined,
        specialInstructions: isWon && specialInstructions ? specialInstructions : undefined,
        closedReason: !isWon ? closedReason : undefined,
      });
    },
    onSuccess: (_, isWon) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id, "stage-history"] });
      setClosedDate(undefined);
      setConfirmedOrderValue("");
      setAdvanceAmount("");
      setSpecialInstructions("");
      setClosedReason("");
      toast({
        title: isWon ? "Deal Won!" : "Deal Lost",
        description: isWon 
          ? `Congratulations! Deal closed with confirmed value of $${parseInt(confirmedOrderValue).toLocaleString()}`
          : "Deal has been marked as lost",
        variant: isWon ? "default" : "destructive",
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
        description: error.message || "Failed to close deal",
        variant: "destructive",
      });
    },
  });

  const handleModuleToggle = (module: string) => {
    setSelectedModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

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
            {/* Photo Display */}
            {lead.photoUrl ? (
              <img
                src={lead.photoUrl}
                alt={lead.companyName}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border"
                data-testid="img-lead-detail-photo"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border">
                <Camera className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsReassignDialogOpen(true)}
                    data-testid="button-reassign-lead"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Reassign
                  </Button>
                  {lead.stage === "seed" && (
                    <>
                      {/* Only show Convert to Lead for interested seeds */}
                      {(lead as any).interestStatus === "interested" && !(lead as any).isExistingCustomer && (
                        <Button
                          size="sm"
                          onClick={() => convertToLeadMutation.mutate()}
                          disabled={convertToLeadMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-convert-to-lead"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {convertToLeadMutation.isPending ? "Converting..." : "Convert to Lead"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${lead.companyName}"? This will allow you to re-import it from the Extractor.`)) {
                            deleteSeedMutation.mutate();
                          }
                        }}
                        disabled={deleteSeedMutation.isPending}
                        data-testid="button-delete-seed"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deleteSeedMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </>
                  )}
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
                  {/* Phone Number - Display prominently */}
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {lead.contactPhone ? (
                      <a href={`tel:${lead.contactPhone}`} className="hover:underline font-medium">
                        {lead.contactPhone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                  </div>
                  {/* Email - Check if it's a placeholder email */}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {lead.contactEmail && !lead.contactEmail.endsWith('@pending.com') ? (
                      <a href={`mailto:${lead.contactEmail}`} className="hover:underline">
                        {lead.contactEmail}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                  </div>
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
                  
                  {/* Location Section */}
                  <div className="col-span-2 p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <Label className="font-medium">Location</Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGetLocation}
                        disabled={isGettingLocation}
                        data-testid="button-edit-get-location"
                      >
                        {isGettingLocation ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Getting...
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3 w-3 mr-1" />
                            Use GPS
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="city" className="text-xs">City</Label>
                        <Input
                          id="city"
                          value={editForm.city || ""}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          placeholder="City"
                          data-testid="input-edit-city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="area" className="text-xs">Area / Locality</Label>
                        <Input
                          id="area"
                          value={editForm.area || ""}
                          onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                          placeholder="Area"
                          data-testid="input-edit-area"
                        />
                      </div>
                    </div>
                    {(editForm.latitude || editForm.longitude) && (
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        GPS: {editForm.latitude}, {editForm.longitude}
                      </div>
                    )}
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
                  {(lead.city || lead.area) && (
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Location:
                      </span>
                      <span className="font-medium text-right">
                        {[lead.area, lead.city].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  {lead.latitude && lead.longitude && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GPS:</span>
                      <span className="text-xs text-muted-foreground">
                        {lead.latitude}, {lead.longitude}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assignment History Section */}
            {!isEditing && assignmentHistory && assignmentHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Assignment History
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assignmentHistory.map((history) => {
                      const fromUser = allUsers?.find(u => u.id === history.fromUserId);
                      const toUser = allUsers?.find(u => u.id === history.toUserId);
                      const reassignedBy = allUsers?.find(u => u.id === history.reassignedById);
                      
                      return (
                        <div
                          key={history.id}
                          className="p-2 border rounded-md bg-muted/30 text-sm"
                          data-testid={`history-assignment-${history.id}`}
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            <UserPlus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">
                              {fromUser ? (
                                <>
                                  <span className="font-medium text-foreground">{fromUser.firstName} {fromUser.lastName}</span>
                                  {" → "}
                                </>
                              ) : (
                                "Initial: "
                              )}
                              <span className="font-medium text-foreground">{toUser?.firstName} {toUser?.lastName}</span>
                            </span>
                          </div>
                          {history.reason && (
                            <p className="text-xs text-muted-foreground mt-1 pl-4">
                              Reason: {history.reason}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 pl-4">
                            {history.createdAt && format(new Date(history.createdAt), "PPP 'at' h:mm a")}
                            {reassignedBy && ` by ${reassignedBy.firstName} ${reassignedBy.lastName}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Seed Interest Tracking Section - Only show for seeds */}
            {!isEditing && lead.stage === "seed" && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Interest Status
                  </h3>
                  
                  {/* Current Status Display */}
                  {(lead as any).interestStatus && (
                    <div className={cn(
                      "mb-3 p-3 border rounded-md",
                      (lead as any).interestStatus === "interested" 
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    )}>
                      <div className="flex items-center gap-2 text-sm">
                        {(lead as any).interestStatus === "interested" ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium text-green-700 dark:text-green-300">Interested</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="font-medium text-red-700 dark:text-red-300">Not Interested</span>
                          </>
                        )}
                      </div>
                      {(lead as any).interestStatus === "interested" && (lead as any).nextFollowupDate && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <CalendarIcon className="h-3 w-3" />
                          <span>Next Followup: {format(new Date((lead as any).nextFollowupDate), "PPP 'at' h:mm a")}</span>
                        </div>
                      )}
                      {(lead as any).interestStatus === "not_interested" && (lead as any).notInterestedReason && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                          Reason: {(lead as any).notInterestedReason}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Interest Status Selection */}
                  <div className="space-y-3 p-3 border rounded-md">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={interestStatus === "interested" ? "default" : "outline"}
                        onClick={() => setInterestStatus("interested")}
                        className={interestStatus === "interested" ? "bg-green-600 hover:bg-green-700" : ""}
                        data-testid="button-interested"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant={interestStatus === "not_interested" ? "default" : "outline"}
                        onClick={() => setInterestStatus("not_interested")}
                        className={interestStatus === "not_interested" ? "bg-red-600 hover:bg-red-700" : ""}
                        data-testid="button-not-interested"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Not Interested
                      </Button>
                    </div>

                    {/* Existing Customer Checkbox */}
                    <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                      <Checkbox
                        id="existing-customer"
                        checked={(lead as any).isExistingCustomer || false}
                        onCheckedChange={(checked) => {
                          updateLeadMutation.mutate({ isExistingCustomer: checked === true });
                        }}
                        disabled={updateLeadMutation.isPending}
                        data-testid="checkbox-existing-customer"
                      />
                      <div className="flex flex-col gap-0.5">
                        <Label htmlFor="existing-customer" className="cursor-pointer font-medium text-sm">
                          Existing Customer
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Mark if this is an existing customer (will be added to Customer Master)
                        </span>
                      </div>
                      {(lead as any).isExistingCustomer && (
                        <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          Existing
                        </Badge>
                      )}
                    </div>
                    
                    {/* If Interested - Show Next Followup Date */}
                    {interestStatus === "interested" && (
                      <div className="space-y-2">
                        <Label>Next Followup Date & Time</Label>
                        <div className="flex gap-2">
                          <Popover open={seedFollowupCalendarOpen} onOpenChange={setSeedFollowupCalendarOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal flex-1",
                                  !nextFollowupDate && "text-muted-foreground"
                                )}
                                data-testid="button-pick-followup-date"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {nextFollowupDate ? format(nextFollowupDate, "PPP") : "Pick date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={nextFollowupDate}
                                onSelect={(date) => {
                                  setNextFollowupDate(date);
                                  setSeedFollowupCalendarOpen(false);
                                }}
                                disabled={(date) => date < startOfDay(new Date())}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Select value={nextFollowupTime} onValueChange={setNextFollowupTime}>
                            <SelectTrigger className="w-24" data-testid="select-followup-time">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, "0");
                                return (
                                  <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                                    {hour}:00
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    {/* If Not Interested - Show Reason */}
                    {interestStatus === "not_interested" && (
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Textarea
                          placeholder="Enter reason for not interested..."
                          value={notInterestedReason}
                          onChange={(e) => setNotInterestedReason(e.target.value)}
                          className="min-h-[60px]"
                          data-testid="input-not-interested-reason"
                        />
                      </div>
                    )}
                    
                    {/* Save Button */}
                    {interestStatus && (
                      <Button
                        onClick={() => {
                          const data: any = { interestStatus };
                          if (interestStatus === "not_interested" && notInterestedReason) {
                            data.notInterestedReason = notInterestedReason;
                          }
                          if (interestStatus === "interested" && nextFollowupDate) {
                            const [hours, minutes] = nextFollowupTime.split(":").map(Number);
                            const dateWithTime = new Date(nextFollowupDate);
                            dateWithTime.setHours(hours, minutes, 0, 0);
                            data.nextFollowupDate = dateWithTime;
                          }
                          updateInterestMutation.mutate(data);
                        }}
                        disabled={updateInterestMutation.isPending || (interestStatus === "interested" && !nextFollowupDate)}
                        className="w-full"
                        data-testid="button-save-interest"
                      >
                        {updateInterestMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Interest Status
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

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
              {/* Demo Scheduling Section */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Demo Scheduling
                </h3>
                
                {/* Current Demo Date Display */}
                {lead.demoDate && (
                  <div className="mb-3 p-3 bg-primary/10 border border-primary/20 rounded-md">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">Demo Scheduled:</span>
                      <span>{format(new Date(lead.demoDate), "PPP 'at' h:mm a")}</span>
                    </div>
                  </div>
                )}
                
                {/* Demo Date History */}
                {demoHistory && demoHistory.length > 0 && (
                  <div className="mb-3 p-3 border rounded-md">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Demo Schedule History ({demoHistory.length} changes)
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {demoHistory.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between text-xs border-b last:border-b-0 pb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                            )} />
                            <span>{format(new Date(item.demoDate), "PPP 'at' h:mm a")}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {item.changeReason || "Scheduled"} - {format(new Date(item.createdAt), "MMM d")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Schedule Demo Form - Only show if lead is in seed/lead stage or to reschedule */}
                <div className="p-4 border rounded-md space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {lead.demoDate 
                      ? "Reschedule demo to a different date/time:"
                      : "Schedule a demo to automatically move this lead to Demo Scheduled stage:"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover open={demoCalendarOpen} onOpenChange={setDemoCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1 min-w-[180px]",
                            !demoDate && "text-muted-foreground"
                          )}
                          data-testid="button-select-demo-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {demoDate ? format(demoDate, "PPP") : "Pick demo date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={demoDate}
                          onSelect={(date) => {
                            setDemoDate(date);
                            setDemoCalendarOpen(false);
                          }}
                          initialFocus
                          disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={demoTime}
                      onChange={(e) => setDemoTime(e.target.value)}
                      className="w-[100px]"
                      data-testid="input-demo-time"
                    />
                    <Button
                      onClick={() => scheduleDemoMutation.mutate()}
                      disabled={!demoDate || !isDemoTimeValid() || scheduleDemoMutation.isPending}
                      data-testid="button-schedule-demo"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      {scheduleDemoMutation.isPending ? "Scheduling..." : lead.demoDate ? "Reschedule" : "Schedule Demo"}
                    </Button>
                  </div>
                  {demoDate && isToday(demoDate) && !isDemoTimeValid() && (
                    <p className="text-sm text-destructive mt-1">
                      Please select a time after the current time for today's date
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Quote Sent Section */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Send Quote
                </h3>
                
                {/* Current Quote Display */}
                {lead.quoteSentDate && (
                  <div className="mb-3 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Quote Sent:</span>
                        <span>{format(new Date(lead.quoteSentDate), "PPP")}</span>
                      </div>
                      {lead.quoteValue && (
                        <div className="flex items-center gap-2 ml-6">
                          <DollarSign className="h-3 w-3" />
                          <span>Value: ${lead.quoteValue.toLocaleString()}</span>
                        </div>
                      )}
                      {lead.selectedModules && lead.selectedModules.length > 0 && (
                        <div className="flex items-start gap-2 ml-6">
                          <Package className="h-3 w-3 mt-0.5" />
                          <span>Modules: {lead.selectedModules.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Send Quote Form */}
                {(lead.stage === "demo_scheduled" || lead.stage === "seed" || lead.stage === "lead" || !lead.quoteSentDate) && (
                  <div className="p-4 border rounded-md space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {lead.quoteSentDate ? "Update quote details:" : "Send quote to move lead to Quote Sent stage:"}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Quote Date</Label>
                        <Popover open={quoteCalendarOpen} onOpenChange={setQuoteCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !quoteDate && "text-muted-foreground"
                              )}
                              data-testid="button-select-quote-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {quoteDate ? format(quoteDate, "PPP") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={quoteDate}
                              onSelect={(date) => {
                                setQuoteDate(date);
                                setQuoteCalendarOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Quote Value ($)</Label>
                        <Input
                          type="number"
                          value={quoteValue}
                          onChange={(e) => setQuoteValue(e.target.value)}
                          placeholder="Enter amount"
                          data-testid="input-quote-value"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs mb-2 block">Select Modules</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {modules?.map((module) => (
                          <div key={module.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={module.name}
                              checked={selectedModules.includes(module.name)}
                              onCheckedChange={() => handleModuleToggle(module.name)}
                              data-testid={`checkbox-module-${module.name.toLowerCase().replace(/\s+/g, "-")}`}
                            />
                            <label htmlFor={module.name} className="text-xs cursor-pointer">{module.name}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => sendQuoteMutation.mutate()}
                      disabled={!quoteDate || !quoteValue || selectedModules.length === 0 || sendQuoteMutation.isPending}
                      className="w-full"
                      data-testid="button-send-quote"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {sendQuoteMutation.isPending ? "Sending..." : "Send Quote"}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Negotiation Section */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Handshake className="h-4 w-4" />
                  Negotiation
                </h3>
                
                {/* Current Negotiation Display */}
                {lead.negotiationDate && (
                  <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                    <div className="flex items-center gap-2 text-sm">
                      <Handshake className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">Latest Negotiation:</span>
                      <span>{format(new Date(lead.negotiationDate), "PPP")}</span>
                    </div>
                  </div>
                )}
                
                {/* Negotiation Date History */}
                {negotiationHistory && negotiationHistory.length > 0 && (
                  <div className="mb-3 p-3 border rounded-md">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Negotiation History ({negotiationHistory.length} rounds)
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {negotiationHistory.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between text-xs border-b last:border-b-0 pb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              index === 0 ? "bg-orange-500" : "bg-muted-foreground/30"
                            )} />
                            <span>{format(new Date(item.negotiationDate), "PPP")}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {item.notes || "Negotiation"} - {format(new Date(item.createdAt), "MMM d")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Start Negotiation Form - Show for continuing negotiations or starting new ones */}
                {(lead.stage === "quote_sent" || lead.stage === "demo_scheduled" || lead.stage === "negotiation") && (
                  <div className="p-4 border rounded-md space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {lead.negotiationDate 
                        ? "Record a follow-up negotiation round:"
                        : "Start negotiation to move lead to Negotiation stage:"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Popover open={negotiationCalendarOpen} onOpenChange={setNegotiationCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal flex-1 min-w-[180px]",
                              !negotiationDate && "text-muted-foreground"
                            )}
                            data-testid="button-select-negotiation-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {negotiationDate ? format(negotiationDate, "PPP") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={negotiationDate}
                            onSelect={(date) => {
                              setNegotiationDate(date);
                              setNegotiationCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        onClick={() => startNegotiationMutation.mutate()}
                        disabled={!negotiationDate || startNegotiationMutation.isPending}
                        data-testid="button-start-negotiation"
                      >
                        <Handshake className="h-4 w-4 mr-2" />
                        {startNegotiationMutation.isPending 
                          ? "Recording..." 
                          : lead.negotiationDate 
                            ? "Add Negotiation Round" 
                            : "Start Negotiation"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Close Deal Section */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Close Deal
                </h3>
                
                {/* Closed Deal Display */}
                {(lead.stage === "closed_won" || lead.stage === "closed_lost") && lead.closedDate && (
                  <div className={cn(
                    "mb-3 p-3 border rounded-md",
                    lead.stage === "closed_won" 
                      ? "bg-green-500/10 border-green-500/20" 
                      : "bg-red-500/10 border-red-500/20"
                  )}>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        {lead.stage === "closed_won" ? (
                          <Trophy className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {lead.stage === "closed_won" ? "Deal Won!" : "Deal Lost"}
                        </span>
                        <span>{format(new Date(lead.closedDate), "PPP")}</span>
                      </div>
                      {lead.stage === "closed_won" && lead.confirmedOrderValue && (
                        <div className="flex items-center gap-2 ml-6">
                          <DollarSign className="h-3 w-3" />
                          <span>Order Value: ${lead.confirmedOrderValue.toLocaleString()}</span>
                        </div>
                      )}
                      {lead.stage === "closed_won" && (lead as any).advanceAmount && (
                        <div className="flex items-center gap-2 ml-6">
                          <DollarSign className="h-3 w-3" />
                          <span>Advance Received: ${(lead as any).advanceAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {lead.stage === "closed_won" && lead.specialInstructions && (
                        <div className="ml-6 mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Special Instructions:</span>
                          <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{lead.specialInstructions}</p>
                        </div>
                      )}
                      {lead.stage === "closed_lost" && lead.closedReason && (
                        <div className="ml-6 text-muted-foreground">
                          Reason: {lead.closedReason}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Close Deal Form */}
                {lead.stage !== "closed_won" && lead.stage !== "closed_lost" && (
                  <div className="p-4 border rounded-md space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Close this deal as won or lost:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Close Date</Label>
                        <Popover open={closedCalendarOpen} onOpenChange={setClosedCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !closedDate && "text-muted-foreground"
                              )}
                              data-testid="button-select-close-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {closedDate ? format(closedDate, "PPP") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={closedDate}
                              onSelect={(date) => {
                                setClosedDate(date);
                                setClosedCalendarOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Confirmed Order Value ($)</Label>
                        <Input
                          type="number"
                          value={confirmedOrderValue}
                          onChange={(e) => setConfirmedOrderValue(e.target.value)}
                          placeholder="Required for Won"
                          data-testid="input-confirmed-order-value"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Advance Amount ($) <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="Required for Won deals"
                        data-testid="input-advance-amount"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Advance amount received from the customer
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Special Instructions (for Won deals)</Label>
                      <Textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Third-party integrations, special requests, custom configurations..."
                        className="min-h-20 text-sm"
                        data-testid="textarea-special-instructions"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Include any special requirements, third-party integrations, or notes for implementation
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Reason (for Lost deals)</Label>
                      <Input
                        value={closedReason}
                        onChange={(e) => setClosedReason(e.target.value)}
                        placeholder="Why was the deal lost?"
                        data-testid="input-closed-reason"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => closeDealMutation.mutate(true)}
                        disabled={!closedDate || !confirmedOrderValue || !advanceAmount || closeDealMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        data-testid="button-close-won"
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        {closeDealMutation.isPending ? "Closing..." : "Close as Won"}
                      </Button>
                      <Button
                        onClick={() => closeDealMutation.mutate(false)}
                        disabled={!closedDate || closeDealMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                        data-testid="button-close-lost"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {closeDealMutation.isPending ? "Closing..." : "Close as Lost"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Stage History Section */}
              {stageHistory && stageHistory.length > 0 && (
                <>
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Stage Change History
                    </h3>
                    <div className="p-3 border rounded-md max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {stageHistory.map((item, index) => {
                          const stageLabels: Record<string, string> = {
                            seed: "Seed",
                            lead: "Lead",
                            demo_scheduled: "Demo Scheduled",
                            quote_sent: "Quote Sent",
                            negotiation: "Negotiation",
                            closed_won: "Closed Won",
                            closed_lost: "Closed Lost",
                          };
                          const fromLabel = item.fromStage ? stageLabels[item.fromStage] || item.fromStage : "Initial";
                          const toLabel = stageLabels[item.toStage] || item.toStage;
                          
                          return (
                            <div key={item.id} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                                )} />
                                <span className="text-muted-foreground">{fromLabel}</span>
                                <span className="text-xs">→</span>
                                <Badge variant={
                                  item.toStage === "closed_won" ? "default" :
                                  item.toStage === "closed_lost" ? "destructive" : "secondary"
                                } className="text-xs">
                                  {toLabel}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover open={followUpCalendarOpen} onOpenChange={setFollowUpCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1 min-w-[180px]",
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
                          onSelect={(date) => {
                            setFollowUpDate(date);
                            setFollowUpCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="w-[100px]"
                      data-testid="input-follow-up-time"
                    />
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
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <p>
                              <span className="font-medium">Next Follow-up:</span> {format(new Date(followUp.followUpDate), "PPP 'at' h:mm a")}
                            </p>
                            {followUp.createdAt && (
                              <p>
                                <span className="font-medium">Created:</span> {format(new Date(followUp.createdAt), "PPP 'at' h:mm a")}
                              </p>
                            )}
                          </div>
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

      {/* Reassign Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Reassign Lead
            </DialogTitle>
            <DialogDescription>
              Transfer this lead to another sales executive. The new executive will see this lead, and the current one will lose access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reassign-to">Assign To</Label>
              <Select
                value={reassignToUserId}
                onValueChange={setReassignToUserId}
              >
                <SelectTrigger data-testid="select-reassign-to">
                  <SelectValue placeholder="Select sales executive" />
                </SelectTrigger>
                <SelectContent>
                  {salesExecutives?.filter(exec => exec.id !== lead.salesExecutiveId).map((exec) => (
                    <SelectItem key={exec.id} value={exec.id}>
                      {exec.firstName} {exec.lastName} ({exec.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reassign-reason">Reason (Optional)</Label>
              <Textarea
                id="reassign-reason"
                placeholder="Enter reason for reassignment..."
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                data-testid="input-reassign-reason"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsReassignDialogOpen(false);
                setReassignToUserId("");
                setReassignReason("");
              }}
              data-testid="button-cancel-reassign"
            >
              Cancel
            </Button>
            <Button
              onClick={() => reassignLeadMutation.mutate()}
              disabled={!reassignToUserId || reassignLeadMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {reassignLeadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                "Reassign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
