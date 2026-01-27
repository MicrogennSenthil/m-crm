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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { 
  Calendar, Clock, User, Building2, CheckCircle2, AlertCircle, 
  GraduationCap, ClipboardCheck, Send, Plus, Trash2, Settings,
  Camera, Video, FileText, Image, Loader2, CalendarIcon, Code2
} from "lucide-react";
import { AssignToDevelopmentDialog } from "./assign-to-development-dialog";
import { DatePickerCompact } from "@/components/ui/date-picker";
import type { Project, ProjectModule, Module, TrainingRecord, User as UserType, TrainingSession, ProjectHandoff, Lead, Customer, ProjectProgressEntry } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MediaCapture } from "./media-capture";
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

interface DepartmentType {
  id: string;
  name: string;
}

// Separate component for module installation with local state and save button
function ModuleInstallationCard({ 
  pm, 
  engineers, 
  departments,
  updateModuleMutation,
  getStatusBadge 
}: { 
  pm: ProjectModuleWithDetails;
  engineers: UserType[];
  departments: DepartmentType[];
  updateModuleMutation: any;
  getStatusBadge: (status: string) => JSX.Element;
}) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [localData, setLocalData] = useState({
    assignedEngineerId: pm.assignedEngineerId || "",
    departmentName: pm.departmentName || "",
    scheduledStartDate: pm.scheduledStartDate?.toString().split('T')[0] || "",
    scheduledEndDate: pm.scheduledEndDate?.toString().split('T')[0] || "",
    installationStatus: pm.installationStatus || "not_started",
    installationNotes: pm.installationNotes || "",
    actualEngineerId: (pm as any).actualEngineerId || "",
    actualVisitDate: (pm as any).actualVisitDate?.toString().split('T')[0] || "",
  });

  const updateField = (field: string, value: string) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateModuleMutation.mutate({
      id: pm.id,
      assignedEngineerId: localData.assignedEngineerId || null,
      departmentName: localData.departmentName || null,
      scheduledStartDate: localData.scheduledStartDate ? new Date(localData.scheduledStartDate).toISOString() : null,
      scheduledEndDate: localData.scheduledEndDate ? new Date(localData.scheduledEndDate).toISOString() : null,
      installationStatus: localData.installationStatus,
      installationNotes: localData.installationNotes || null,
      actualEngineerId: localData.actualEngineerId || null,
      actualVisitDate: localData.actualVisitDate ? new Date(localData.actualVisitDate).toISOString() : null,
    }, {
      onSuccess: () => {
        setHasChanges(false);
        toast({ title: "Saved", description: "Module installation details updated" });
      }
    });
  };

  return (
    <Card className={pm.completed ? "bg-muted/50" : ""}>
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
          <div className="flex items-center gap-2">
            {getStatusBadge(localData.installationStatus)}
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">Unsaved</Badge>
            )}
          </div>
        </div>
        <CardDescription>{pm.module?.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Planning Section */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Planning
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Planned Engineer</Label>
              <Select
                value={localData.assignedEngineerId}
                onValueChange={(value) => updateField("assignedEngineerId", value)}
                data-testid={`select-planned-engineer-${pm.id}`}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((eng) => (
                    <SelectItem key={eng.id} value={eng.id}>
                      <div className="flex flex-col">
                        <span>{eng.firstName} {eng.lastName}</span>
                        <span className="text-xs text-muted-foreground">{eng.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Department</Label>
              <Select
                value={localData.departmentName}
                onValueChange={(value) => updateField("departmentName", value)}
                data-testid={`select-department-${pm.id}`}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.length > 0 ? (
                    departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))
                  ) : (
                    DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Scheduled Start</Label>
              <DatePickerCompact
                value={localData.scheduledStartDate}
                onChange={(date) => updateField("scheduledStartDate", date ? date.toISOString().split('T')[0] : "")}
                placeholder="Select start date"
                data-testid={`input-scheduled-start-${pm.id}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Scheduled End</Label>
              <DatePickerCompact
                value={localData.scheduledEndDate}
                onChange={(date) => updateField("scheduledEndDate", date ? date.toISOString().split('T')[0] : "")}
                placeholder="Select end date"
                data-testid={`input-scheduled-end-${pm.id}`}
              />
            </div>
          </div>
        </div>

        {/* Actual Work Section */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Actual Work
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Visiting Engineer</Label>
              <Select
                value={localData.actualEngineerId}
                onValueChange={(value) => updateField("actualEngineerId", value)}
                data-testid={`select-actual-engineer-${pm.id}`}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Engineer who visited" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((eng) => (
                    <SelectItem key={eng.id} value={eng.id}>
                      <div className="flex flex-col">
                        <span>{eng.firstName} {eng.lastName}</span>
                        <span className="text-xs text-muted-foreground">{eng.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Actual Visit Date</Label>
              <DatePickerCompact
                value={localData.actualVisitDate}
                onChange={(date) => updateField("actualVisitDate", date ? date.toISOString().split('T')[0] : "")}
                placeholder="Select visit date"
                data-testid={`input-actual-visit-${pm.id}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select
                value={localData.installationStatus}
                onValueChange={(value) => updateField("installationStatus", value)}
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
        </div>

        {/* Notes */}
        <div className="border-t pt-4">
          <Label className="text-xs">Installation Notes</Label>
          <Textarea
            placeholder="Add notes about installation progress..."
            className="mt-1 text-sm"
            value={localData.installationNotes}
            onChange={(e) => updateField("installationNotes", e.target.value)}
            rows={2}
            data-testid={`textarea-notes-${pm.id}`}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateModuleMutation.isPending}
            data-testid={`button-save-module-${pm.id}`}
          >
            {updateModuleMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectDetailModal({ project, open, onClose }: ProjectDetailModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [trainingDatePickerOpen, setTrainingDatePickerOpen] = useState(false);
  const [trainingDateTime, setTrainingDateTime] = useState<Date | undefined>(undefined);
  const [trainingTime, setTrainingTime] = useState("09:00");
  const [showAssignDevDialog, setShowAssignDevDialog] = useState(false);
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
  const [newProgress, setNewProgress] = useState({
    description: "",
    progressType: "installation" as "installation" | "training" | "handoff",
    attachments: [] as Array<{ type: 'photo' | 'video' | 'file'; url: string; name: string; size?: number }>,
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

  // Progress entries query
  const { data: progressEntries, isLoading: progressLoading } = useQuery<(ProjectProgressEntry & { engineer?: UserType })[]>({
    queryKey: ["/api/projects", project.id, "progress"],
    enabled: open,
  });

  const { data: engineers } = useQuery<UserType[]>({
    queryKey: ["/api/users/all"],
    enabled: open,
    // Include technical, engineer, and support roles for implementation work
    select: (users) => users.filter((u) => {
      const role = u.role?.toLowerCase() || "";
      return role === "engineer" || role === "technical" || role === "support" || 
             role.includes("engineer") || role.includes("implementation") || role.includes("support");
    }),
  });

  const { data: departments } = useQuery<DepartmentType[]>({
    queryKey: ["/api/departments"],
    enabled: open,
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
      setTrainingDateTime(undefined);
      setTrainingTime("09:00");
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

  // Progress entry mutations
  const createProgressMutation = useMutation({
    mutationFn: async (data: typeof newProgress) => {
      await apiRequest("POST", `/api/projects/${project.id}/progress`, {
        ...data,
        progressDate: new Date().toISOString(), // Auto-set to current timestamp
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "progress"] });
      setNewProgress({
        description: "",
        progressType: newProgress.progressType,
        attachments: [],
      });
      toast({ title: "Success", description: "Progress recorded" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add progress", variant: "destructive" });
    },
  });

  const deleteProgressMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${project.id}/progress/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "progress"] });
      toast({ title: "Success", description: "Progress entry deleted" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete progress", variant: "destructive" });
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignDevDialog(true)}
                data-testid="button-assign-to-development"
              >
                <Code2 className="h-4 w-4 mr-2" />
                Assign to Dev
              </Button>
              <Badge variant="secondary" className="capitalize">
                {project.status.replace(/_/g, " ")}
              </Badge>
            </div>
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
                      <div className="flex items-center gap-3 py-4">
                        <Checkbox
                          checked={pm.completed ?? false}
                          onCheckedChange={(checked) =>
                            toggleModuleMutation.mutate({ id: pm.id, completed: !!checked })
                          }
                          data-testid={`checkbox-module-${pm.id}`}
                        />
                        <AccordionTrigger className="hover:no-underline flex-1 py-0">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-medium">{pm.module?.name || "Module"}</span>
                            {pm.completed && pm.completedAt && (
                              <Badge variant="outline" className="ml-auto mr-4 text-xs">
                                Completed {format(new Date(pm.completedAt), "MMM d")}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                      </div>
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
                  <ModuleInstallationCard 
                    key={pm.id} 
                    pm={pm} 
                    engineers={engineers || []}
                    departments={departments || []}
                    updateModuleMutation={updateModuleMutation}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                No purchased modules found for this project
              </Card>
            )}

            <Separator className="my-6" />

            {/* Installation Progress Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Installation Progress</h3>
                <Badge variant="outline">
                  {progressEntries?.filter(e => e.progressType === 'installation').length || 0} Entries
                </Badge>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <Textarea
                    placeholder="Describe installation work completed..."
                    value={newProgress.progressType === 'installation' ? newProgress.description : ''}
                    onChange={(e) => setNewProgress({ 
                      description: e.target.value, 
                      progressType: 'installation',
                      attachments: newProgress.progressType === 'installation' ? newProgress.attachments : []
                    })}
                    rows={2}
                    data-testid="textarea-installation-progress"
                  />
                  
                  <MediaCapture
                    entityType="project_progress"
                    entityId={`${project.id}-installation`}
                    attachments={newProgress.progressType === 'installation' ? newProgress.attachments : []}
                    onMediaCaptured={(atts) => setNewProgress({
                      ...newProgress,
                      progressType: 'installation',
                      attachments: atts
                    })}
                  />

                  <Button
                    size="sm"
                    onClick={() => {
                      setNewProgress({ ...newProgress, progressType: 'installation' });
                      createProgressMutation.mutate({ ...newProgress, progressType: 'installation' });
                    }}
                    disabled={!(newProgress.progressType === 'installation' && newProgress.description.trim()) || createProgressMutation.isPending}
                    data-testid="button-add-installation-progress"
                  >
                    {createProgressMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Camera className="h-4 w-4 mr-2" /> Record Progress</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Installation Progress History */}
              {progressEntries && progressEntries.filter(e => e.progressType === 'installation').length > 0 && (
                <div className="space-y-2">
                  {progressEntries.filter(e => e.progressType === 'installation').map((entry) => (
                    <Card key={entry.id} className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.progressDate), "MMM d, h:mm a")}
                              </span>
                              {entry.engineer && (
                                <span className="text-xs text-muted-foreground">
                                  by {entry.engineer.firstName}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{entry.description}</p>
                            {entry.attachments && entry.attachments.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {entry.attachments.map((att, idx) => (
                                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.type === 'photo' ? (
                                      <div className="w-12 h-12 rounded border overflow-hidden">
                                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                                        <Video className="h-4 w-4" />
                                      </div>
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => deleteProgressMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
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
                    <Popover open={trainingDatePickerOpen} onOpenChange={setTrainingDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-9 justify-start text-left font-normal"
                          data-testid="input-training-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {trainingDateTime ? (
                            <span>{format(trainingDateTime, "dd/MM/yyyy")} {trainingTime}</span>
                          ) : (
                            <span className="text-muted-foreground">dd/mm/yyyy --:--</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={trainingDateTime}
                          onSelect={(date) => {
                            setTrainingDateTime(date);
                            if (date) {
                              const dateStr = format(date, "yyyy-MM-dd");
                              setNewSession({ ...newSession, scheduledDate: `${dateStr}T${trainingTime}` });
                              setTrainingDatePickerOpen(false);
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                        <div className="p-3 border-t">
                          <Label className="text-xs">Time</Label>
                          <Input
                            type="time"
                            value={trainingTime}
                            onChange={(e) => {
                              setTrainingTime(e.target.value);
                              if (trainingDateTime) {
                                const dateStr = format(trainingDateTime, "yyyy-MM-dd");
                                setNewSession({ ...newSession, scheduledDate: `${dateStr}T${e.target.value}` });
                              }
                            }}
                            className="mt-1 h-8"
                            data-testid="input-training-time"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
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

            <Separator className="my-6" />

            {/* Training Progress Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Training Progress</h3>
                <Badge variant="outline">
                  {progressEntries?.filter(e => e.progressType === 'training').length || 0} Entries
                </Badge>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <Textarea
                    placeholder="Describe training session completed..."
                    value={newProgress.progressType === 'training' ? newProgress.description : ''}
                    onChange={(e) => setNewProgress({ 
                      description: e.target.value, 
                      progressType: 'training',
                      attachments: newProgress.progressType === 'training' ? newProgress.attachments : []
                    })}
                    rows={2}
                    data-testid="textarea-training-progress"
                  />
                  
                  <MediaCapture
                    entityType="project_progress"
                    entityId={`${project.id}-training`}
                    attachments={newProgress.progressType === 'training' ? newProgress.attachments : []}
                    onMediaCaptured={(atts) => setNewProgress({
                      ...newProgress,
                      progressType: 'training',
                      attachments: atts
                    })}
                  />

                  <Button
                    size="sm"
                    onClick={() => {
                      setNewProgress({ ...newProgress, progressType: 'training' });
                      createProgressMutation.mutate({ ...newProgress, progressType: 'training' });
                    }}
                    disabled={!(newProgress.progressType === 'training' && newProgress.description.trim()) || createProgressMutation.isPending}
                    data-testid="button-add-training-progress"
                  >
                    {createProgressMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Camera className="h-4 w-4 mr-2" /> Record Progress</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Training Progress History */}
              {progressEntries && progressEntries.filter(e => e.progressType === 'training').length > 0 && (
                <div className="space-y-2">
                  {progressEntries.filter(e => e.progressType === 'training').map((entry) => (
                    <Card key={entry.id} className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.progressDate), "MMM d, h:mm a")}
                              </span>
                              {entry.engineer && (
                                <span className="text-xs text-muted-foreground">
                                  by {entry.engineer.firstName}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{entry.description}</p>
                            {entry.attachments && entry.attachments.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {entry.attachments.map((att, idx) => (
                                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.type === 'photo' ? (
                                      <div className="w-12 h-12 rounded border overflow-hidden">
                                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                                        <Video className="h-4 w-4" />
                                      </div>
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => deleteProgressMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
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
                      <DatePickerCompact
                        value={handoffData.completionCertificateDate}
                        onChange={(date) => setHandoffData({ ...handoffData, completionCertificateDate: date ? date.toISOString().split('T')[0] : "" })}
                        placeholder="Select certificate date"
                        size="default"
                        data-testid="input-certificate-date"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Handoff Date</Label>
                      <DatePickerCompact
                        value={handoffData.handoffDate}
                        onChange={(date) => setHandoffData({ ...handoffData, handoffDate: date ? date.toISOString().split('T')[0] : "" })}
                        placeholder="Select handoff date"
                        size="default"
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

            <Separator className="my-6" />

            {/* Handoff Progress Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Record Handoff Progress</h3>
                <Badge variant="outline">
                  {progressEntries?.filter(e => e.progressType === 'handoff').length || 0} Entries
                </Badge>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <Textarea
                    placeholder="Describe handoff preparation or completion work..."
                    value={newProgress.progressType === 'handoff' ? newProgress.description : ''}
                    onChange={(e) => setNewProgress({ 
                      description: e.target.value, 
                      progressType: 'handoff',
                      attachments: newProgress.progressType === 'handoff' ? newProgress.attachments : []
                    })}
                    rows={2}
                    data-testid="textarea-handoff-progress"
                  />
                  
                  <MediaCapture
                    entityType="project_progress"
                    entityId={`${project.id}-handoff`}
                    attachments={newProgress.progressType === 'handoff' ? newProgress.attachments : []}
                    onMediaCaptured={(atts) => setNewProgress({
                      ...newProgress,
                      progressType: 'handoff',
                      attachments: atts
                    })}
                  />

                  <Button
                    size="sm"
                    onClick={() => {
                      setNewProgress({ ...newProgress, progressType: 'handoff' });
                      createProgressMutation.mutate({ ...newProgress, progressType: 'handoff' });
                    }}
                    disabled={!(newProgress.progressType === 'handoff' && newProgress.description.trim()) || createProgressMutation.isPending}
                    data-testid="button-add-handoff-progress"
                  >
                    {createProgressMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Camera className="h-4 w-4 mr-2" /> Record Progress</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Handoff Progress History */}
              {progressEntries && progressEntries.filter(e => e.progressType === 'handoff').length > 0 && (
                <div className="space-y-2">
                  {progressEntries.filter(e => e.progressType === 'handoff').map((entry) => (
                    <Card key={entry.id} className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.progressDate), "MMM d, h:mm a")}
                              </span>
                              {entry.engineer && (
                                <span className="text-xs text-muted-foreground">
                                  by {entry.engineer.firstName}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{entry.description}</p>
                            {entry.attachments && entry.attachments.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {entry.attachments.map((att, idx) => (
                                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.type === 'photo' ? (
                                      <div className="w-12 h-12 rounded border overflow-hidden">
                                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                                        <Video className="h-4 w-4" />
                                      </div>
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => deleteProgressMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Assign to Development Dialog */}
        <AssignToDevelopmentDialog
          open={showAssignDevDialog}
          onClose={() => setShowAssignDevDialog(false)}
          sourceType="implementation"
          sourceId={project.id}
          sourceTitle={project.clientName}
          sourceReference={`PRJ-${project.id.slice(0, 8)}`}
          sourceDescription={`Implementation project for ${project.clientName}`}
        />
      </DialogContent>
    </Dialog>
  );
}
