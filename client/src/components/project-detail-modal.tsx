import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import type { Project, ProjectModule, Module, TrainingRecord, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface ProjectDetailModalProps {
  project: Project & { engineers?: User[] };
  open: boolean;
  onClose: () => void;
}

export function ProjectDetailModal({ project, open, onClose }: ProjectDetailModalProps) {
  const { toast } = useToast();

  const { data: projectModules } = useQuery<(ProjectModule & { module?: Module })[]>({
    queryKey: ["/api/projects", project.id, "modules"],
    enabled: open,
  });

  const { data: trainingRecords } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/projects", project.id, "training"],
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
      toast({
        title: "Success",
        description: "Module status updated",
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
        description: "Failed to update module",
        variant: "destructive",
      });
    },
  });

  const completedModules = projectModules?.filter((pm) => pm.completed).length || 0;
  const totalModules = projectModules?.length || 0;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{project.clientName}</DialogTitle>
              {project.implementationDate && (
                <p className="text-muted-foreground mt-1">
                  Due: {format(new Date(project.implementationDate), "MMMM d, yyyy")}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="capitalize">
              {project.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Overview */}
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

          {/* Assigned Engineers */}
          {project.engineers && project.engineers.length > 0 && (
            <>
              <div>
                <h3 className="font-semibold mb-3">Assigned Engineers</h3>
                <div className="flex flex-wrap gap-3">
                  {project.engineers.map((engineer) => (
                    <div
                      key={engineer.id}
                      className="flex items-center gap-2 p-2 border rounded-md"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={engineer.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {engineer.firstName?.[0]}{engineer.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">
                          {engineer.firstName} {engineer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{engineer.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Module Checklist */}
          <div>
            <h3 className="font-semibold mb-3">Implementation Modules</h3>
            {projectModules && projectModules.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-2">
                {projectModules.map((pm) => (
                  <AccordionItem key={pm.id} value={pm.id} className="border rounded-md px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={pm.completed}
                          onCheckedChange={(checked) =>
                            toggleModuleMutation.mutate({
                              id: pm.id,
                              completed: !!checked,
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
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
                          <p className="text-sm text-muted-foreground mb-3">
                            {pm.module.description}
                          </p>
                        )}

                        {/* Training records for this module */}
                        {trainingRecords && trainingRecords.filter((tr) => tr.moduleId === pm.moduleId).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Training Records:</p>
                            {trainingRecords
                              .filter((tr) => tr.moduleId === pm.moduleId)
                              .map((tr) => (
                                <div key={tr.id} className="text-xs p-2 bg-muted rounded">
                                  <div className="flex justify-between mb-1">
                                    <span className="font-medium">{tr.recipientName}</span>
                                    <span className="text-muted-foreground">{tr.trainingHours}h</span>
                                  </div>
                                  <p className="text-muted-foreground">
                                    {format(new Date(tr.trainingDate), "PPP")}
                                  </p>
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
              <p className="text-sm text-muted-foreground text-center py-8">
                No modules assigned to this project
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
