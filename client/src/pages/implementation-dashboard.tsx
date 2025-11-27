import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, FolderKanban, Users, CheckCircle2, Clock, AlertTriangle, 
  Calendar, Building2, User, Settings, GraduationCap, Send, Download, Mail, FileText,
  Camera, Video, ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import type { Project, ProjectModule, Module, User as UserType, TrainingSession, ProjectHandoff, ProjectProgressEntry } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProjectWithDetails extends Project {
  modules: (ProjectModule & { module?: Module; assignedEngineer?: UserType })[];
  purchasedModules: string[];
  engineers: UserType[];
  trainingSessions: TrainingSession[];
  handoff: ProjectHandoff | null;
}

interface DashboardStats {
  totalProjects: number;
  inProgress: number;
  inTraining: number;
  completed: number;
  pendingHandoff: number;
}

interface ImplementationDashboardData {
  projects: ProjectWithDetails[];
  stats: DashboardStats;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_started: { color: "bg-gray-200 text-gray-700", label: "Not Started" },
  scheduled: { color: "bg-blue-100 text-blue-700", label: "Scheduled" },
  in_progress: { color: "bg-yellow-100 text-yellow-700", label: "In Progress" },
  testing: { color: "bg-purple-100 text-purple-700", label: "Testing" },
  completed: { color: "bg-green-100 text-green-700", label: "Completed" },
};

const PROJECT_STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  not_started: { variant: "outline", label: "Not Started" },
  in_progress: { variant: "default", label: "In Progress" },
  training: { variant: "secondary", label: "Training" },
  completed: { variant: "default", label: "Completed" },
  on_hold: { variant: "destructive", label: "On Hold" },
};

interface ReportData {
  summary: DashboardStats;
  projects: {
    id: string;
    clientName: string;
    status: string;
    completionPercentage: number;
    modulesCompleted: number;
    totalModules: number;
    assignedEngineers: string;
    dueDate: string | null;
    modules: any[];
  }[];
  generatedAt: string;
}

export default function ImplementationDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressTypeFilter, setProgressTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailName, setEmailName] = useState("");

  const { data: dashboardData, isLoading } = useQuery<ImplementationDashboardData>({
    queryKey: ["/api/dashboard/implementation"],
  });

  // Fetch all progress entries across all projects
  interface ProgressEntryWithProject extends ProjectProgressEntry {
    engineer?: UserType;
    project?: {
      id: string;
      clientName: string;
    };
  }
  
  const { data: allProgressEntries } = useQuery<ProgressEntryWithProject[]>({
    queryKey: ["/api/dashboard/progress-entries"],
  });

  const { data: reportData, refetch: fetchReportData } = useQuery<ReportData>({
    queryKey: ["/api/reports/implementation-detail"],
    enabled: false,
  });

  const emailReportMutation = useMutation({
    mutationFn: async (data: { recipientEmail: string; recipientName: string; reportData: ReportData }) => {
      await apiRequest("POST", "/api/reports/implementation/email", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Report sent successfully!" });
      setEmailDialogOpen(false);
      setEmailTo("");
      setEmailName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send report", variant: "destructive" });
    },
  });

  const exportToCSV = async () => {
    const { data } = await fetchReportData();
    if (!data) return;

    const headers = ["Client Name", "Status", "Progress %", "Modules Completed", "Total Modules", "Engineers", "Due Date"];
    const rows = data.projects.map(p => [
      p.clientName,
      p.status,
      p.completionPercentage,
      p.modulesCompleted,
      p.totalModules,
      p.assignedEngineers,
      p.dueDate || "Not set"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `implementation_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: "Success", description: "CSV downloaded successfully!" });
  };

  const exportDetailedCSV = async () => {
    const { data } = await fetchReportData();
    if (!data) return;

    const headers = ["Client", "Module", "Status", "Engineer", "Department", "Start Date", "End Date", "Completed"];
    const rows: string[][] = [];
    
    data.projects.forEach(project => {
      project.modules.forEach(mod => {
        rows.push([
          project.clientName,
          mod.moduleName,
          mod.status,
          mod.assignedEngineer,
          mod.department,
          mod.startDate,
          mod.endDate,
          mod.completed ? "Yes" : "No"
        ]);
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `implementation_detailed_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: "Success", description: "Detailed CSV downloaded!" });
  };

  const handleEmailReport = async () => {
    const { data } = await fetchReportData();
    if (!data) {
      toast({ title: "Error", description: "Failed to fetch report data", variant: "destructive" });
      return;
    }
    emailReportMutation.mutate({
      recipientEmail: emailTo,
      recipientName: emailName,
      reportData: data,
    });
  };

  const filteredProjects = dashboardData?.projects.filter((project) => {
    const matchesSearch = project.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getModuleStatusCount = (project: ProjectWithDetails) => {
    const counts = { not_started: 0, scheduled: 0, in_progress: 0, testing: 0, completed: 0 };
    project.modules.forEach((m) => {
      const status = m.installationStatus || "not_started";
      if (counts[status as keyof typeof counts] !== undefined) {
        counts[status as keyof typeof counts]++;
      }
    });
    return counts;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-state">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded"></div>
          <div className="h-32 w-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    totalProjects: 0,
    inProgress: 0,
    inTraining: 0,
    completed: 0,
    pendingHandoff: 0,
  };

  return (
      <div className="space-y-6 p-6" data-testid="implementation-dashboard">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Implementation Dashboard</h1>
            <p className="text-muted-foreground">Track work progress, schedules, and handoffs</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              data-testid="button-export-summary"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDetailedCSV}
              data-testid="button-export-detailed"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export Detailed
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setEmailDialogOpen(true)}
              data-testid="button-email-report"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Report
            </Button>
          </div>
        </div>

        {/* Email Report Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Implementation Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={emailName}
                  onChange={(e) => setEmailName(e.target.value)}
                  placeholder="Enter recipient name"
                  data-testid="input-email-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Email Address</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="Enter email address"
                  data-testid="input-email-address"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                The report will include a summary of all implementation projects with their current status, progress, and assigned engineers.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEmailReport}
                disabled={!emailTo || !emailName || emailReportMutation.isPending}
                data-testid="button-send-email"
              >
                {emailReportMutation.isPending ? "Sending..." : "Send Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card data-testid="stat-total">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalProjects}</p>
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-in-progress">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-training">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inTraining}</p>
                  <p className="text-xs text-muted-foreground">In Training</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-pending-handoff">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Send className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingHandoff}</p>
                  <p className="text-xs text-muted-foreground">Pending Handoff</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-completed">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="dashboard-tabs">
            <TabsTrigger value="overview">Projects Overview</TabsTrigger>
            <TabsTrigger value="modules">Module Tracking</TabsTrigger>
            <TabsTrigger value="work-tracking" data-testid="tab-work-tracking">
              <ClipboardList className="h-4 w-4 mr-2" />
              Work Tracking
            </TabsTrigger>
            <TabsTrigger value="engineers">Engineer Assignments</TabsTrigger>
          </TabsList>

          {/* Projects Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {filteredProjects.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No projects found matching your criteria
              </Card>
            ) : (
              filteredProjects.map((project) => {
                const statusCounts = getModuleStatusCount(project);
                const projectStatus = PROJECT_STATUS_CONFIG[project.status] || PROJECT_STATUS_CONFIG.not_started;

                return (
                  <Card key={project.id} data-testid={`project-card-${project.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{project.clientName}</CardTitle>
                            <Badge variant={projectStatus.variant}>{projectStatus.label}</Badge>
                            {project.handoff?.status === 'handed_off' && (
                              <Badge className="bg-green-500">Handed Off</Badge>
                            )}
                          </div>
                          <CardDescription className="flex flex-wrap gap-4 mt-1">
                            {project.implementationDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Implementation: {format(new Date(project.implementationDate), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              {project.modules.length} Modules
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {project.engineers.length} Engineers
                            </span>
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{project.completionPercentage || 0}%</p>
                          <p className="text-xs text-muted-foreground">Complete</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={project.completionPercentage || 0} className="h-2 mb-4" />

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                          <span>Not Started: {statusCounts.not_started}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                          <span>Scheduled: {statusCounts.scheduled}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <span>In Progress: {statusCounts.in_progress}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                          <span>Testing: {statusCounts.testing}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                          <span>Completed: {statusCounts.completed}</span>
                        </div>
                      </div>

                      {/* Engineers */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">Assigned:</span>
                        <div className="flex -space-x-2">
                          {project.engineers.slice(0, 5).map((eng) => (
                            <Avatar key={eng.id} className="h-8 w-8 border-2 border-background">
                              <AvatarImage src={eng.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {eng.firstName?.[0]}{eng.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {project.engineers.length > 5 && (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                              +{project.engineers.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Module Tracking Tab */}
          <TabsContent value="modules" className="space-y-4 mt-4">
            {filteredProjects.map((project) => {
              const purchasedModulesList = project.purchasedModules || [];
              const filteredModules = project.modules.filter(mod => 
                purchasedModulesList.includes(mod.module?.name || '')
              );
              
              return (
              <Card key={project.id} data-testid={`module-card-${project.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{project.clientName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {filteredModules.length} Purchased Module{filteredModules.length !== 1 ? 's' : ''}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredModules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No purchased modules found for this project
                      </p>
                    ) : filteredModules.map((mod) => {
                      const statusConfig = STATUS_CONFIG[mod.installationStatus || "not_started"] || STATUS_CONFIG.not_started;
                      return (
                        <div
                          key={mod.id}
                          className="flex items-center justify-between p-3 border rounded-md"
                          data-testid={`module-row-${mod.id}`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-2 h-8 rounded-full ${
                              mod.completed ? "bg-green-500" : 
                              mod.installationStatus === "in_progress" ? "bg-yellow-500" :
                              mod.installationStatus === "scheduled" ? "bg-blue-500" : "bg-gray-300"
                            }`}></div>
                            <div>
                              <p className="font-medium">{mod.module?.name || "Module"}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                {mod.departmentName && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {mod.departmentName.replace(/_/g, " ")}
                                  </span>
                                )}
                                {mod.scheduledStartDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(mod.scheduledStartDate), "MMM d")}
                                    {mod.scheduledEndDate && ` - ${format(new Date(mod.scheduledEndDate), "MMM d")}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {mod.assignedEngineer && (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={mod.assignedEngineer.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {mod.assignedEngineer.firstName?.[0]}{mod.assignedEngineer.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm hidden md:inline">
                                  {mod.assignedEngineer.firstName} {mod.assignedEngineer.lastName}
                                </span>
                              </div>
                            )}
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              );
            })
            }
          </TabsContent>

          {/* Work Tracking Tab */}
          <TabsContent value="work-tracking" className="space-y-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Daily Progress Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Photo/video evidence of installation, training, and handoff work
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select 
                  value={progressTypeFilter} 
                  onValueChange={setProgressTypeFilter}
                  data-testid="select-progress-type-filter"
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="handoff">Handoff</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline">
                  {allProgressEntries?.filter(e => 
                    progressTypeFilter === 'all' || e.progressType === progressTypeFilter
                  ).length || 0} Entries
                </Badge>
              </div>
            </div>

            {/* Progress Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card 
                className={`cursor-pointer transition-colors ${progressTypeFilter === 'installation' ? 'ring-2 ring-blue-500' : 'hover-elevate'}`}
                onClick={() => setProgressTypeFilter(progressTypeFilter === 'installation' ? 'all' : 'installation')}
                data-testid="stat-installation-progress"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {allProgressEntries?.filter(e => e.progressType === 'installation').length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Installation Logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-colors ${progressTypeFilter === 'training' ? 'ring-2 ring-purple-500' : 'hover-elevate'}`}
                onClick={() => setProgressTypeFilter(progressTypeFilter === 'training' ? 'all' : 'training')}
                data-testid="stat-training-progress"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {allProgressEntries?.filter(e => e.progressType === 'training').length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Training Logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-colors ${progressTypeFilter === 'handoff' ? 'ring-2 ring-green-500' : 'hover-elevate'}`}
                onClick={() => setProgressTypeFilter(progressTypeFilter === 'handoff' ? 'all' : 'handoff')}
                data-testid="stat-handoff-progress"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {allProgressEntries?.filter(e => e.progressType === 'handoff').length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Handoff Logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Entries List */}
            {allProgressEntries && allProgressEntries.length > 0 ? (
              <div className="space-y-3">
                {allProgressEntries
                  .filter(entry => progressTypeFilter === 'all' || entry.progressType === progressTypeFilter)
                  .map((entry) => {
                    const typeConfig = {
                      installation: { icon: Settings, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Installation' },
                      training: { icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Training' },
                      handoff: { icon: Send, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Handoff' },
                    };
                    const config = typeConfig[entry.progressType as keyof typeof typeConfig] || typeConfig.installation;
                    const IconComponent = config.icon;

                    return (
                      <Card key={entry.id} data-testid={`progress-entry-${entry.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${config.bg}`}>
                              <IconComponent className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {config.label}
                                </Badge>
                                {entry.project && (
                                  <span className="text-sm font-medium">
                                    {entry.project.clientName}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(entry.progressDate), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                              <p className="text-sm mb-2">{entry.description}</p>
                              
                              {/* Engineer Info */}
                              {entry.engineer && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={entry.engineer.profileImageUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {entry.engineer.firstName?.[0]}{entry.engineer.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>by {entry.engineer.firstName} {entry.engineer.lastName}</span>
                                </div>
                              )}

                              {/* Media Attachments */}
                              {entry.attachments && entry.attachments.length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  {entry.attachments.map((att: any, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={att.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      {att.type === 'photo' ? (
                                        <div className="w-16 h-16 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                                          <img src={att.url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                      ) : (
                                        <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary transition-all">
                                          <Video className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No progress entries yet</p>
                <p className="text-sm mt-1">
                  Progress entries with photos and videos will appear here
                </p>
              </Card>
            )}
          </TabsContent>

          {/* Engineer Assignments Tab */}
          <TabsContent value="engineers" className="space-y-4 mt-4">
            <EngineerAssignmentsView projects={filteredProjects} />
          </TabsContent>
        </Tabs>
      </div>
  );
}

function EngineerAssignmentsView({ projects }: { projects: ProjectWithDetails[] }) {
  const engineerWorkload: Record<string, { 
    engineer: UserType; 
    modules: { project: Project; module: ProjectModule & { module?: Module } }[];
  }> = {};

  projects.forEach((project) => {
    project.modules.forEach((mod) => {
      if (mod.assignedEngineerId && mod.assignedEngineer) {
        if (!engineerWorkload[mod.assignedEngineerId]) {
          engineerWorkload[mod.assignedEngineerId] = {
            engineer: mod.assignedEngineer,
            modules: [],
          };
        }
        engineerWorkload[mod.assignedEngineerId].modules.push({ project, module: mod });
      }
    });
  });

  const engineers = Object.values(engineerWorkload);

  if (engineers.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No engineer assignments found
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {engineers.map(({ engineer, modules }) => {
        const completedCount = modules.filter((m) => m.module.completed).length;
        const inProgressCount = modules.filter((m) => m.module.installationStatus === "in_progress").length;

        return (
          <Card key={engineer.id} data-testid={`engineer-card-${engineer.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={engineer.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">
                    {engineer.firstName} {engineer.lastName}
                  </CardTitle>
                  <CardDescription>{engineer.email}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{modules.length}</p>
                  <p className="text-xs text-muted-foreground">Modules Assigned</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Completed: {completedCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>In Progress: {inProgressCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span>Pending: {modules.length - completedCount - inProgressCount}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {modules.map(({ project, module }) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{module.module?.name}</p>
                      <p className="text-xs text-muted-foreground">{project.clientName}</p>
                    </div>
                    <Badge 
                      variant={module.completed ? "default" : "outline"}
                      className="capitalize"
                    >
                      {module.installationStatus?.replace(/_/g, " ") || "Not Started"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
