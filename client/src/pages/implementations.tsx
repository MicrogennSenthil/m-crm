import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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

const STATUS_BADGES: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  not_started: { variant: "secondary", label: "Not Started" },
  in_progress: { variant: "default", label: "In Progress" },
  training: { variant: "outline", label: "Training" },
  completed: { variant: "default", label: "Completed", className: "bg-green-600" },
};

export default function Implementations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(9);

  const { data: projects, isLoading } = useQuery<(Project & { engineers?: User[] })[]>({
    queryKey: ["/api/projects"],
  });

  const filteredProjects = projects?.filter((project) =>
    searchQuery
      ? project.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Implementations</h1>
          <p className="text-sm text-muted-foreground">
            Track project implementation progress and training
          </p>
        </div>
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 min-h-[44px]"
          data-testid="input-search-projects"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
        ) : filteredProjects && filteredProjects.length > 0 ? (
          paginateData(filteredProjects).map((project) => {
            const statusConfig = STATUS_BADGES[project.status as keyof typeof STATUS_BADGES] || STATUS_BADGES.not_started;
            return (
              <Card
                key={project.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedProject(project)}
                data-testid={`card-project-${project.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{project.clientName}</CardTitle>
                    <Badge variant={statusConfig.variant} className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  {project.implementationDate && (
                    <p className="text-xs text-muted-foreground">
                      Implementation: {format(new Date(project.implementationDate), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.completionPercentage}%</span>
                    </div>
                    <Progress value={project.completionPercentage || 0} />
                  </div>

                  {project.engineers && project.engineers.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Assigned Engineers</p>
                      <div className="flex -space-x-2">
                        {project.engineers.slice(0, 3).map((engineer) => (
                          <Avatar key={engineer.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={engineer.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {project.engineers.length > 3 && (
                          <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs">
                            +{project.engineers.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
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

      {filteredProjects && filteredProjects.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={getTotalPages(filteredProjects.length)}
          pageSize={pageSize}
          totalItems={filteredProjects.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
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
