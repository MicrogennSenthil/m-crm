import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Columns3, LayoutGrid, List, Filter, Volume2, VolumeX } from "lucide-react";
import { useVoiceAlerts } from "@/providers/VoiceAlertProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectForm } from "@/components/project-form";
import { ProjectDetailModal } from "@/components/project-detail-modal";
import type { Project, User } from "@shared/schema";
import { format } from "date-fns";

const STAGES = [
  { id: "not_started", title: "Not Started", color: "bg-gray-500" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-600" },
  { id: "training", title: "Training", color: "bg-purple-600" },
  { id: "completed", title: "Completed", color: "bg-green-600" },
];

const STATUS_BADGES: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  not_started: { variant: "secondary", label: "Not Started" },
  in_progress: { variant: "default", label: "In Progress" },
  training: { variant: "outline", label: "Training" },
  completed: { variant: "default", label: "Completed", className: "bg-green-600" },
};

type LayoutType = "kanban" | "card" | "table";

export default function Implementations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [layout, setLayout] = useState<LayoutType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("implementations-layout") as LayoutType) || "card";
    }
    return "card";
  });
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(9);

  // Voice alerts for implementation department
  const {
    alerts: voiceAlerts,
    alertCounts,
    isEnabled: voiceAlertsEnabled,
    isSpeaking,
    isSupported: voiceSupported,
    announceAllPending,
    stopSpeaking,
  } = useVoiceAlerts('implementation');

  useEffect(() => {
    localStorage.setItem("implementations-layout", layout);
  }, [layout]);

  const { data: projects, isLoading } = useQuery<(Project & { engineers?: User[] })[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = projects?.filter((project) =>
    searchQuery
      ? project.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const getProjectsByStage = (stageId: string) => {
    return filteredProjects?.filter(p => p.status === stageId) || [];
  };

  const renderProjectCard = (project: Project & { engineers?: User[] }, compact = false) => {
    const statusConfig = STATUS_BADGES[project.status as keyof typeof STATUS_BADGES] || STATUS_BADGES.not_started;
    return (
      <Card
        key={project.id}
        className="hover-elevate cursor-pointer"
        onClick={() => setSelectedProject(project)}
        data-testid={`card-project-${project.id}`}
      >
        <CardHeader className={compact ? "p-3 pb-2" : undefined}>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className={compact ? "text-sm" : "text-base"}>{project.clientName}</CardTitle>
            {!compact && (
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            )}
          </div>
          {project.implementationDate && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(project.implementationDate), "MMM d, yyyy")}
            </p>
          )}
        </CardHeader>
        <CardContent className={compact ? "p-3 pt-0 space-y-2" : "space-y-4"}>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground text-xs">Progress</span>
              <span className="font-medium text-xs">{project.completionPercentage}%</span>
            </div>
            <Progress value={project.completionPercentage || 0} className={compact ? "h-1.5" : undefined} />
          </div>

          {project.engineers && project.engineers.length > 0 && (
            <div className="flex -space-x-2">
              {project.engineers.slice(0, compact ? 2 : 3).map((engineer) => (
                <Avatar key={engineer.id} className={compact ? "h-6 w-6 border-2 border-background" : "h-8 w-8 border-2 border-background"}>
                  <AvatarImage src={engineer.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
              {project.engineers.length > (compact ? 2 : 3) && (
                <div className={`${compact ? "h-6 w-6" : "h-8 w-8"} rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs`}>
                  +{project.engineers.length - (compact ? 2 : 3)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Implementations</h1>
          <p className="text-sm text-muted-foreground">
            Track project implementation progress and training
          </p>
        </div>
        <div className="flex items-center gap-2">
          {voiceSupported && voiceAlertsEnabled && (
            <Button
              variant={isSpeaking ? "destructive" : "outline"}
              size="icon"
              onClick={() => isSpeaking ? stopSpeaking() : announceAllPending()}
              title={isSpeaking ? "Stop speaking" : `Voice alerts (${alertCounts.total} pending)`}
              data-testid="button-voice-alerts"
            >
              {isSpeaking ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <div className="relative">
                  <Volume2 className="h-4 w-4" />
                  {alertCounts.total > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {alertCounts.total > 9 ? "9+" : alertCounts.total}
                    </span>
                  )}
                </div>
              )}
            </Button>
          )}
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-project" className="min-h-[44px] w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new implementation project
              </DialogDescription>
            </DialogHeader>
            <ProjectForm onSuccess={() => setNewProjectOpen(false)} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search and Layout Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
            data-testid="input-search-projects"
          />
        </div>
        <div className="flex border rounded-md">
          <Button 
            variant={layout === "kanban" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-r-none"
            onClick={() => setLayout("kanban")}
            title="Kanban View"
            data-testid="button-layout-kanban"
          >
            <Columns3 className="h-4 w-4" />
          </Button>
          <Button 
            variant={layout === "card" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-none border-x"
            onClick={() => setLayout("card")}
            title="Card View"
            data-testid="button-layout-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={layout === "table" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-l-none"
            onClick={() => setLayout("table")}
            title="Table View"
            data-testid="button-layout-table"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stage Filter Buttons - for card and table views */}
      {(layout === "card" || layout === "table") && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedStage === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStage(null)}
            className="min-h-[40px]"
            data-testid="button-stage-all"
          >
            <span>All</span>
            <Badge variant="secondary" className="ml-2">
              {filteredProjects?.length || 0}
            </Badge>
          </Button>
          {STAGES.map((stage) => {
            const stageProjects = getProjectsByStage(stage.id);
            return (
              <Button
                key={stage.id}
                variant={selectedStage === stage.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                className="min-h-[40px]"
                data-testid={`button-stage-${stage.id}`}
              >
                <div className={`h-2.5 w-2.5 rounded-full mr-2 ${stage.color}`} />
                <span className="hidden sm:inline">{stage.title}</span>
                <span className="sm:hidden">{stage.title.split(' ')[0]}</span>
                <Badge variant="secondary" className="ml-2">
                  {stageProjects.length}
                </Badge>
              </Button>
            );
          })}
        </div>
      )}

      {/* Kanban Board */}
      {layout === "kanban" && (
        <div className="grid grid-cols-4 gap-3 pb-4 overflow-x-auto">
          {STAGES.map((stage) => {
            const stageProjects = getProjectsByStage(stage.id);
            return (
              <div key={stage.id} className="min-w-[200px]">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`} />
                  <h3 className="font-semibold text-xs sm:text-sm truncate">{stage.title}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {stageProjects.length}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {isLoading ? (
                    Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                  ) : stageProjects.length > 0 ? (
                    stageProjects.map((project) => renderProjectCard(project, true))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No projects
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card View */}
      {layout === "card" && (
        <div className="space-y-6">
          {STAGES.filter(stage => selectedStage === null || selectedStage === stage.id).map((stage) => {
            const stageProjects = getProjectsByStage(stage.id);
            if (stageProjects.length === 0) return null;
            return (
              <div key={stage.id}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                  <h3 className="font-semibold text-base">{stage.title}</h3>
                  <Badge variant="secondary">{stageProjects.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stageProjects.map((project) => renderProjectCard(project))}
                </div>
              </div>
            );
          })}
          {filteredProjects?.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No projects found</p>
                <Button onClick={() => setNewProjectOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Table View */}
      {layout === "table" && (
        <div className="space-y-4">
          {STAGES.filter(stage => selectedStage === null || selectedStage === stage.id).map((stage) => {
            const stageProjects = getProjectsByStage(stage.id);
            if (stageProjects.length === 0) return null;
            return (
              <Card key={stage.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <CardTitle className="text-base">{stage.title}</CardTitle>
                    <Badge variant="secondary">{stageProjects.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stageProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover-elevate bg-muted/50"
                      onClick={() => setSelectedProject(project)}
                      data-testid={`row-project-${project.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{project.clientName}</p>
                        {project.implementationDate && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(project.implementationDate), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span>{project.completionPercentage}%</span>
                          </div>
                          <Progress value={project.completionPercentage || 0} className="h-1.5" />
                        </div>
                        {project.engineers && project.engineers.length > 0 && (
                          <div className="flex -space-x-1">
                            {project.engineers.slice(0, 2).map((engineer) => (
                              <Avatar key={engineer.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={engineer.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          open={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
