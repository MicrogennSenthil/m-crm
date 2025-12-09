import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, Upload, Clock, Phone, AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm } from "@/components/lead-form";
import { LeadDetailModal } from "@/components/lead-detail-modal";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import type { Lead, FollowUp } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface FollowUpWithLead extends FollowUp {
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
}

// Type for the processed followup data from the dashboard API
interface ProcessedFollowUp {
  id: string;
  leadId: string;
  notes: string | null;
  followUpDate: string;
  completed: boolean;
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}

const STAGES = [
  { id: "new_lead", title: "New Leads", color: "bg-blue-600" },
  { id: "demo_scheduled", title: "Demo Scheduled", color: "bg-purple-600" },
  { id: "quote_sent", title: "Quote Sent", color: "bg-yellow-600" },
  { id: "negotiation", title: "Negotiation", color: "bg-orange-600" },
  { id: "closed_won", title: "Closed Won", color: "bg-green-600" },
];

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch today's followups (pending followups with date <= today)
  const { data: todayFollowups = [], isLoading: followupsLoading } = useQuery<ProcessedFollowUp[]>({
    queryKey: ["/api/sales-dashboard/stats"],
    select: (data: any) => {
      // Extract followups from the dashboard stats and filter for today/overdue
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (!data?.followUps) return [];
      
      return data.followUps.filter((f: any) => {
        if (f.completed === true) return false;
        if (!f.followUpDate) return false;
        const followUpDate = new Date(f.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate <= today;
      }).map((f: any) => {
        const followUpDate = new Date(f.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        const daysOverdue = followUpDate < today 
          ? Math.floor((today.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          ...f,
          isOverdue: daysOverdue > 0,
          daysOverdue
        };
      }).sort((a: ProcessedFollowUp, b: ProcessedFollowUp) => {
        // Sort overdue first, then by days overdue
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return (b.daysOverdue || 0) - (a.daysOverdue || 0);
      });
    }
  });

  // Update selectedLead when leads data changes to ensure modal shows fresh data
  useEffect(() => {
    if (selectedLead && leads) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead && JSON.stringify(updatedLead) !== JSON.stringify(selectedLead)) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads, selectedLead]);

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await apiRequest("PATCH", `/api/leads/${id}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: "Lead stage updated successfully",
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
        description: "Failed to update lead stage",
        variant: "destructive",
      });
    },
  });

  const filteredLeads = leads?.filter((lead) =>
    searchQuery
      ? lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads?.filter((lead) => lead.stage === stageId) || [];
  };

  // Calculate total value for a stage
  const getStageTotalValue = (stageId: string): number => {
    const stageLeads = getLeadsByStage(stageId);
    return stageLeads.reduce((total, lead) => {
      return total + (lead.confirmedOrderValue || lead.estimatedValue || 0);
    }, 0);
  };

  // Currency symbol mapping
  const getCurrencySymbol = (currency: string | null | undefined): string => {
    const symbols: Record<string, string> = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      AED: "د.إ",
      SGD: "S$",
      AUD: "A$",
      CAD: "C$",
      JPY: "¥",
      CNY: "¥",
    };
    return symbols[currency || "INR"] || "₹";
  };

  // Format currency compactly (e.g., 1.2L, 50K)
  const formatCompactCurrency = (value: number): string => {
    if (value >= 10000000) {
      return `${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) {
      return `${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads?.find((l) => l.id === leadId);
    if (lead && lead.stage !== stageId) {
      updateLeadMutation.mutate({ id: leadId, stage: stageId });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage leads through your sales process
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            data-testid="button-import-leads"
            className="min-h-[44px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Import</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lead" className="min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Create a new lead in your sales pipeline
                </DialogDescription>
              </DialogHeader>
              <LeadForm onSuccess={() => setNewLeadOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
            data-testid="input-search-leads"
          />
        </div>
        <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-6 gap-2 sm:gap-3 pb-4">
        {/* Today's Followups Column */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full flex-shrink-0 bg-red-500" />
            <h3 className="font-semibold text-xs sm:text-sm truncate">Today's Calls</h3>
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              <Badge variant="secondary" className="text-xs">
                {todayFollowups.length}
              </Badge>
              {todayFollowups.filter(f => f.isOverdue).length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {todayFollowups.filter(f => f.isOverdue).length} overdue
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
            {followupsLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : todayFollowups.length > 0 ? (
              todayFollowups.map((followup) => {
                const lead = leads?.find(l => l.id === followup.leadId);
                return (
                  <Card
                    key={followup.id}
                    className={`cursor-pointer hover-elevate ${followup.isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
                    onClick={() => lead && setSelectedLead(lead)}
                    data-testid={`card-followup-${followup.id}`}
                  >
                    <CardContent className="p-2 sm:p-3 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        {followup.isOverdue ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold truncate">
                            {followup.leadCompanyName || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {followup.leadContactPerson}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {followup.followUpDate && format(new Date(followup.followUpDate), "MMM d")}
                        </div>
                        {followup.isOverdue && followup.daysOverdue > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1 h-4">
                            {followup.daysOverdue}d overdue
                          </Badge>
                        )}
                      </div>
                      {followup.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{followup.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-3 sm:p-4 text-center text-xs text-muted-foreground">
                  No calls due
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Lead Stage Columns */}
        {STAGES.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <div
              key={stage.id}
              className="min-w-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`} />
                <h3 className="font-semibold text-xs sm:text-sm truncate">{stage.title}</h3>
                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                  {getStageTotalValue(stage.id) > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                      ₹{formatCompactCurrency(getStageTotalValue(stage.id))}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {isLoading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => <Skeleton key={i} className="h-28 sm:h-32 w-full" />)
                ) : stageLeads.length > 0 ? (
                  stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      className="cursor-move hover-elevate active-elevate-2"
                      onClick={() => setSelectedLead(lead)}
                      data-testid={`card-lead-${lead.id}`}
                    >
                      <CardHeader className="p-2 sm:p-3 space-y-0.5">
                        <CardTitle className="text-xs sm:text-sm font-semibold leading-tight truncate">
                          {lead.companyName}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground truncate">
                          {lead.contactPerson}
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-3 pt-0 space-y-1.5">
                        {lead.estimatedValue && (
                          <div className="text-xs sm:text-sm font-medium">
                            {getCurrencySymbol(lead.currency)}{lead.estimatedValue.toLocaleString()}
                          </div>
                        )}
                        {lead.demoDate && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{format(new Date(lead.demoDate), "MMM d, h:mm a")}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <Badge variant="outline" className="capitalize text-xs px-1.5 py-0">
                            {lead.leadSource}
                          </Badge>
                          <span className="text-muted-foreground whitespace-nowrap text-xs">
                            {lead.daysInStage}d
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-3 sm:p-4 text-center text-xs text-muted-foreground">
                      No leads
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}
