import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { 
  Calendar, Clock, User, Building2, CheckCircle2, AlertCircle, 
  GraduationCap, ClipboardCheck, Send, Plus, Trash2, Settings
} from "lucide-react";
import type { Project, ProjectModule, Module, TrainingRecord, User as UserType, TrainingSession, ProjectHandoff, Lead, Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AttachmentsList } from "./attachments-list";

interface ProjectDetailModalProps {
  project: Project & { engineers?: UserType[] };
  open: boolean;
  onClose: () => void;
}

interface ProjectModuleWithDetails extends ProjectModule {
  module?: Module;
  assignedEngineer?: UserType;
}

interface TrainingSessionWithDetails extends TrainingSession {
  module?: Module;
  engineer?: UserType;
}

const INSTALLATION_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "testing", label: "Testing" },
  { value: "completed", label: "Completed" },
];

const DEPARTMENTS = [
  { value: "front_office", label: "Front Office" },
  { value: "accounts", label: "Accounts" },
  { value: "operations", label: "Operations" },
  { value: "hr", label: "Human Resources" },
  { value: "it", label: "IT" },
  { value: "management", label: "Management" },
];

export function ProjectDetailModal({ project, open, onClose }: ProjectDetailModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [newSession, setNewSession] = useState({
    moduleId: "",
    recipientName: "",
    recipientEmail: "",
    scheduledDate: "",
    scheduledHours: 2,
    notes: "",
  });
  const [handoffData, setHandoffData] = useState({
    completionCertificateIssued: true,
    completionCertificateDate: new Date().toISOString().split('T')[0],
    handoffToTeam: "support",
    handoffDate: new Date().toISOString().split('T')[0],
    notes: "",
  });

  const { data: projectModules } = useQuery<ProjectModuleWithDetails[]>({
    queryKey: ["/api/projects", project.id, "modules"],
    enabled: open,
  });

  // Fetch lead data to get purchased modules
  const { data: leadData } = useQuery<Lead>({
    queryKey: ["/api/leads", project.leadId],
    enabled: open && !!project.leadId,
  });

  // Fetch customer data if no lead (fallback for purchased modules)
  const { data: customerData } = useQuery<Customer>({
    queryKey: ["/api/customers", project.customerId],
    enabled: open && !!project.customerId && !project.leadId,
  });

  // Get purchased module names from lead or customer
  const purchasedModuleNames = leadData?.selectedModules || customerData?.selectedModules || [];

  // Filter project modules to only show purchased modules
  const purchasedProjectModules = projectModules?.filter(pm => 
    purchasedModuleNames.length === 0 || purchasedModuleNames.includes(pm.module?.name || "")
  );

  const { data: trainingRecords } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/projects", project.id, "training"],
    enabled: open,
  });

  const { data: trainingSessions } = useQuery<TrainingSessionWithDetails[]>({
    queryKey: ["/api/projects", project.id, "training-sessions"],
    enabled: open,
  });

  const { data: handoff } = useQuery<ProjectHandoff | null>({
    queryKey: ["/api/projects", project.id, "handoff"],
    enabled: open,
  });

  const { data: engineers } = useQuery<UserType[]>({
    queryKey: ["/api/users/all"],
    enabled: open,
    select: (users) => users.filter((u) => u.role?.toLowerCase() === "engineer"),
  });

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await apiRequest("PATCH", `/api/project-modules/${id}`, {
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Success", description: "Module status updated" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update module", variant: "destructive" });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      await apiRequest("PATCH", `/api/project-modules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "modules"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update schedule", variant: "destructive" });
    },
  });

  const createTrainingSessionMutation = useMutation({
    mutationFn: async (data: typeof newSession) => {
      await apiRequest("POST", `/api/projects/${project.id}/training-sessions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "training-sessions"] });
      setNewSession({ moduleId: "", recipientName: "", recipientEmail: "", scheduledDate: "", scheduledHours: 2, notes: "" });
      toast({ title: "Success", description: "Training session scheduled" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to schedule training", variant: "destructive" });
    },
  });

  const updateTrainingSessionMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      await apiRequest("PATCH", `/api/training-sessions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "training-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "training"] });
      toast({ title: "Success", description: "Training session updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update training session", variant: "destructive" });
    },
  });

  const deleteTrainingSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "training-sessions"] });
      toast({ title: "Success", description: "Training session deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete training session", variant: "destructive" });
    },
  });

  const createHandoffMutation = useMutation({
    mutationFn: async (data: typeof handoffData & { status: string }) => {
      await apiRequest("POST", `/api/projects/${project.id}/handoff`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "handoff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Success", description: "Project handoff completed" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to complete handoff", variant: "destructive" });
    },
  });

  // Use purchased modules for calculations (only modules customer bought)
  const completedModules = purchasedProjectModules?.filter((pm) => pm.completed).length || 0;
  const totalModules = purchasedProjectModules?.length || 0;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      not_started: { variant: "outline", label: "Not Started" },
      scheduled: { variant: "secondary", label: "Scheduled" },
      in_progress: { variant: "default", label: "In Progress" },
      testing: { variant: "secondary", label: "Testing" },
      completed: { variant: "default", label: "Completed" },
    };
    const config = statusConfig[status] || statusConfig.not_started;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{project.clientName}</DialogTitle>
              {project.implementationDate && (
                <p className="text-muted-foreground mt-1">
                  Implementation: {format(new Date(project.implementationDate), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="capitalize">
              {project.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4" data-testid="project-detail-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="installation" data-testid="tab-installation">
              <Settings className="h-4 w-4 mr-2" />
              Installation
            </TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">
              <GraduationCap className="h-4 w-4 mr-2" />
              Training
            </TabsTrigger>
            <TabsTrigger value="handoff" data-testid="tab-handoff">
              <Send className="h-4 w-4 mr-2" />
              Handoff
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-lg font-bold">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {completedModules} of {totalModules} modules completed
              </p>
            </div>

            <Separator />

            {project.engineers && project.engineers.length > 0 && (
              <>
                <div>
                  <h3 className="font-semibold mb-3">Assigned Engineers</h3>
                  <div className="flex flex-wrap gap-3">
                    {project.engineers.map((engineer) => (
                      <div key={engineer.id} className="flex items-center gap-2 p-2 border rounded-md">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={engineer.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-sm">
                          <p className="font-medium">{engineer.firstName} {engineer.lastName}</p>
                          <p className="text-xs text-muted-foreground">{engineer.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div>
              <h3 className="font-semibold mb-3">Purchased Modules</h3>
              {purchasedProjectModules && purchasedProjectModules.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-2">
                  {purchasedProjectModules.map((pm) => (
                    <AccordionItem key={pm.id} value={pm.id} className="border rounded-md px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={pm.completed ?? false}
                            onCheckedChange={(checked) =>
                              toggleModuleMutation.mutate({ id: pm.id, completed: !!checked })
                            }
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-module-${pm.id}`}
                          />
                          <span className="font-medium">{pm.module?.name || "Module"}</span>
                          {pm.completed && pm.completedAt && (
                            <Badge variant="outline" className="ml-auto mr-4 text-xs">
                              Completed {format(new Date(pm.completedAt), "MMM d")}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2 pb-4">
                          {pm.module?.description && (
                            <p className="text-sm text-muted-foreground mb-3">{pm.module.description}</p>
                          )}
                          {trainingRecords && trainingRecords.filter((tr) => tr.moduleId === pm.moduleId).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Training Records:</p>
                              {trainingRecords.filter((tr) => tr.moduleId === pm.moduleId).map((tr) => (
                                <div key={tr.id} className="text-xs p-2 bg-muted rounded">
                                  <div className="flex justify-between mb-1">
                                    <span className="font-medium">{tr.recipientName}</span>
                                    <span className="text-muted-foreground">{tr.trainingHours}h</span>
                                  </div>
                                  <p className="text-muted-foreground">{format(new Date(tr.trainingDate), "PPP")}</p>
                                  {tr.notes && <p className="mt-1">{tr.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No purchased modules found for this project</p>
              )}
            </div>

            <Separator />

            <AttachmentsList entityType="project" entityId={project.id} title="Project Documents" />
          </TabsContent>

          {/* Installation Scheduling Tab */}
          <TabsContent value="installation" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Module Installation Schedule</h3>
              <Badge variant="outline">{completedModules}/{totalModules} Complete</Badge>
            </div>

            {purchasedProjectModules && purchasedProjectModules.length > 0 ? (
              <div className="space-y-4">
                {purchasedProjectModules.map((pm) => (
                  <Card key={pm.id} className={pm.completed ? "bg-muted/50" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {pm.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                          {pm.module?.name || "Module"}
                        </CardTitle>
                        {getStatusBadge(pm.installationStatus || "not_started")}
                      </div>
                      <CardDescription>{pm.module?.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <User className="h-3 w-3" /> Assigned Engineer
                          </Label>
                          <Select
                            value={pm.assignedEngineerId || ""}
                            onValueChange={(value) => 
                              updateModuleMutation.mutate({ id: pm.id, assignedEngineerId: value || null })
                            }
                            data-testid={`select-engineer-${pm.id}`}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select engineer" />
                            </SelectTrigger>
                            <SelectContent>
                              {engineers?.map((eng) => (
                                <SelectItem key={eng.id} value={eng.id}>
                                  {eng.firstName} {eng.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Department
                          </Label>
                          <Select
                            value={pm.departmentName || ""}
                            onValueChange={(value) => 
                              updateModuleMutation.mutate({ id: pm.id, departmentName: value || null })
                            }
                            data-testid={`select-department-${pm.id}`}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept.value} value={dept.value}>
                                  {dept.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Start Date
                          </Label>
                          <Input
                            type="date"
                            className="h-9 text-xs"
                            value={pm.scheduledStartDate?.toString().split('T')[0] || ""}
                            onChange={(e) => 
                              updateModuleMutation.mutate({ 
                                id: pm.id, 
                                scheduledStartDate: e.target.value ? new Date(e.target.value).toISOString() : null 
                              })
                            }
                            data-testid={`input-start-date-${pm.id}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> End Date
                          </Label>
                          <Input
                            type="date"
                            className="h-9 text-xs"
                            value={pm.scheduledEndDate?.toString().split('T')[0] || ""}
                            onChange={(e) => 
                              updateModuleMutation.mutate({ 
                                id: pm.id, 
                                scheduledEndDate: e.target.value ? new Date(e.target.value).toISOString() : null 
                              })
                            }
                            data-testid={`input-end-date-${pm.id}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            Status
                          </Label>
                          <Select
                            value={pm.installationStatus || "not_started"}
                            onValueChange={(value) => 
                              updateModuleMutation.mutate({ id: pm.id, installationStatus: value })
                            }
                            data-testid={`select-status-${pm.id}`}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INSTALLATION_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3">
                        <Label className="text-xs">Installation Notes</Label>
                        <Textarea
                          placeholder="Add notes about installation progress..."
                          className="mt-1 text-sm"
                          value={pm.installationNotes || ""}
                          onChange={(e) => 
                            updateModuleMutation.mutate({ id: pm.id, installationNotes: e.target.value })
                          }
                          rows={2}
                          data-testid={`textarea-notes-${pm.id}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                No purchased modules found for this project
              </Card>
            )}
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Training Schedule</h3>
              <Badge variant="outline">
                {trainingSessions?.filter(s => s.status === 'completed').length || 0} Completed
              </Badge>
            </div>

            {/* Schedule New Training */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Schedule New Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Module</Label>
                    <Select
                      value={newSession.moduleId}
                      onValueChange={(value) => setNewSession({ ...newSession, moduleId: value })}
                      data-testid="select-training-module"
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent>
                        {purchasedProjectModules?.map((pm) => (
                          <SelectItem key={pm.moduleId} value={pm.moduleId}>
                            {pm.module?.name || "Module"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Recipient Name</Label>
                    <Input
                      value={newSession.recipientName}
                      onChange={(e) => setNewSession({ ...newSession, recipientName: e.target.value })}
                      placeholder="Trainee name"
                      className="h-9"
                      data-testid="input-trainee-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Recipient Email</Label>
                    <Input
                      type="email"
                      value={newSession.recipientEmail}
                      onChange={(e) => setNewSession({ ...newSession, recipientEmail: e.target.value })}
                      placeholder="trainee@example.com"
                      className="h-9"
                      data-testid="input-trainee-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Scheduled Date</Label>
                    <Input
                      type="datetime-local"
                      value={newSession.scheduledDate}
                      onChange={(e) => setNewSession({ ...newSession, scheduledDate: e.target.value })}
                      className="h-9"
                      data-testid="input-training-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Duration (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      value={newSession.scheduledHours}
                      onChange={(e) => setNewSession({ ...newSession, scheduledHours: parseInt(e.target.value) || 2 })}
                      className="h-9"
                      data-testid="input-training-hours"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={newSession.notes}
                      onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                      placeholder="Optional notes..."
                      className="h-9"
                      data-testid="input-training-notes"
                    />
                  </div>
                </div>

                <Button
                  className="mt-4"
                  onClick={() => createTrainingSessionMutation.mutate(newSession)}
                  disabled={!newSession.moduleId || !newSession.recipientName || !newSession.scheduledDate || createTrainingSessionMutation.isPending}
                  data-testid="button-schedule-training"
                >
                  {createTrainingSessionMutation.isPending ? "Scheduling..." : "Schedule Training"}
                </Button>
              </CardContent>
            </Card>

            {/* Scheduled Sessions */}
            {trainingSessions && trainingSessions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Upcoming & Completed Sessions</h4>
                {trainingSessions.map((session) => (
                  <Card key={session.id} className={session.status === 'completed' ? "bg-muted/50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{session.module?.name || "Module"}</span>
                            <Badge variant={session.status === 'completed' ? "default" : session.status === 'cancelled' ? "destructive" : "outline"} className="capitalize">
                              {session.status}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-4">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {session.recipientName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {format(new Date(session.scheduledDate), "PPp")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {session.scheduledHours}h
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {session.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => 
                                  updateTrainingSessionMutation.mutate({ 
                                    id: session.id, 
                                    status: 'completed',
                                    completedAt: new Date().toISOString()
                                  })
                                }
                                disabled={updateTrainingSessionMutation.isPending}
                                data-testid={`button-complete-training-${session.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTrainingSessionMutation.mutate(session.id)}
                                disabled={deleteTrainingSessionMutation.isPending}
                                data-testid={`button-delete-training-${session.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Training Records */}
            {trainingRecords && trainingRecords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Training History</h4>
                {trainingRecords.map((record) => (
                  <Card key={record.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium">{record.recipientName}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(record.trainingDate), "PPP")} • {record.trainingHours}h
                          </p>
                          {record.notes && <p className="text-sm mt-1">{record.notes}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Handoff Tab */}
          <TabsContent value="handoff" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Support Handoff</h3>
              {handoff?.status === 'handed_off' && (
                <Badge variant="default" className="bg-green-500">Handed Off</Badge>
              )}
            </div>

            {handoff?.status === 'handed_off' ? (
              <Card className="bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <div>
                      <h4 className="text-lg font-semibold">Project Successfully Handed Off</h4>
                      <p className="text-muted-foreground">
                        {handoff.completionCertificateIssued && handoff.completionCertificateDate && (
                          <>Certificate Issued: {format(new Date(handoff.completionCertificateDate), "PPP")}</>
                        )}
                      </p>
                      <p className="text-sm mt-2">
                        Transferred to: <span className="font-medium capitalize">{handoff.handoffToTeam}</span> team
                        {handoff.handoffDate && <> on {format(new Date(handoff.handoffDate), "PPP")}</>}
                      </p>
                      {handoff.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{handoff.notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Complete Project & Generate Certificate</CardTitle>
                  <CardDescription>
                    Fill in the details below to complete the project and hand it off to the support team.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {completionPercentage < 100 && (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-md flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Project is {completionPercentage}% complete. Complete all modules before handoff.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Certificate Issue Date</Label>
                      <Input
                        type="date"
                        value={handoffData.completionCertificateDate}
                        onChange={(e) => setHandoffData({ ...handoffData, completionCertificateDate: e.target.value })}
                        data-testid="input-certificate-date"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Handoff Date</Label>
                      <Input
                        type="date"
                        value={handoffData.handoffDate}
                        onChange={(e) => setHandoffData({ ...handoffData, handoffDate: e.target.value })}
                        data-testid="input-handoff-date"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Handoff To</Label>
                      <Select
                        value={handoffData.handoffToTeam}
                        onValueChange={(value) => setHandoffData({ ...handoffData, handoffToTeam: value })}
                        data-testid="select-handoff-team"
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="support">Support Team</SelectItem>
                          <SelectItem value="maintenance">Maintenance Team</SelectItem>
                          <SelectItem value="operations">Operations Team</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Handoff Notes</Label>
                    <Textarea
                      value={handoffData.notes}
                      onChange={(e) => setHandoffData({ ...handoffData, notes: e.target.value })}
                      placeholder="Any important notes for the receiving team..."
                      rows={3}
                      data-testid="textarea-handoff-notes"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      onClick={() => createHandoffMutation.mutate({ ...handoffData, status: 'draft' })}
                      variant="outline"
                      disabled={createHandoffMutation.isPending}
                      data-testid="button-save-draft"
                    >
                      Save as Draft
                    </Button>
                    <Button
                      onClick={() => createHandoffMutation.mutate({ 
                        ...handoffData, 
                        status: 'handed_off',
                        completionCertificateDate: new Date(handoffData.completionCertificateDate).toISOString(),
                        handoffDate: new Date(handoffData.handoffDate).toISOString(),
                      })}
                      disabled={completionPercentage < 100 || createHandoffMutation.isPending}
                      data-testid="button-complete-handoff"
                    >
                      {createHandoffMutation.isPending ? "Processing..." : "Complete Handoff"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
