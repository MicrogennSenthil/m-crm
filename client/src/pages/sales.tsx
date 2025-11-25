import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, Upload, Clock } from "lucide-react";
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
import type { Lead } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

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
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Sales Pipeline</h1>
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
      <div className="flex gap-3 sm:gap-6 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
        {STAGES.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72 sm:w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="mb-2 sm:mb-3 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-sm sm:text-base">{stage.title}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {stageLeads.length}
                </Badge>
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
                      <CardHeader className="p-3 sm:p-4 space-y-1 sm:space-y-2">
                        <CardTitle className="text-sm font-semibold leading-tight">
                          {lead.companyName}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">
                          {lead.contactPerson}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
                        {lead.estimatedValue && (
                          <div className="text-sm font-medium">
                            ${lead.estimatedValue.toLocaleString()}
                          </div>
                        )}
                        {lead.demoDate && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(lead.demoDate), "MMM d, h:mm a")}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                          <Badge variant="outline" className="capitalize">
                            {lead.leadSource}
                          </Badge>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {lead.daysInStage}d in stage
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 sm:p-8 text-center text-sm text-muted-foreground">
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
