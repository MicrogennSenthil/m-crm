import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Code2, Calendar, User, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

interface AssignToDevelopmentDialogProps {
  open: boolean;
  onClose: () => void;
  sourceType: "implementation" | "support" | "task";
  sourceId: string;
  sourceTitle: string;
  sourceReference: string;
  sourceDescription?: string;
  onSuccess?: () => void;
}

export function AssignToDevelopmentDialog({
  open,
  onClose,
  sourceType,
  sourceId,
  sourceTitle,
  sourceReference,
  sourceDescription,
  onSuccess,
}: AssignToDevelopmentDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(sourceTitle);
  const [description, setDescription] = useState(sourceDescription || "");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const { data: developers, isLoading: developersLoading, error: developersError } = useQuery<UserType[]>({
    queryKey: ["/api/users/development-assignable"],
    enabled: open,
    staleTime: 0, // Always refetch when dialog opens
  });

  // Log for debugging
  console.log("[AssignToDev] open:", open, "developers:", developers?.length, "loading:", developersLoading, "error:", developersError);

  // Already filtered by the API endpoint to active Development department users
  const activeDevelopers = developers;

  const createDevTaskMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("Task title is required");
      }
      
      let parsedHours: number | undefined = undefined;
      if (estimatedHours) {
        const hours = parseFloat(estimatedHours);
        if (!isNaN(hours) && hours > 0) {
          parsedHours = hours;
        }
      }
      
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || "",
        priority,
        sourceType,
        sourceId,
        sourceReference: sourceReference,
        deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
      if (assignedTo) {
        payload.assignedTo = assignedTo;
      }
      if (parsedHours !== undefined) {
        payload.estimatedHours = parsedHours;
      }
      
      return await apiRequest("POST", "/api/development/tasks", payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task assigned to development successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/development/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/development/dashboard"] });
      resetForm();
      onClose();
      onSuccess?.();
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to assign to development";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle(sourceTitle);
    setDescription(sourceDescription || "");
    setPriority("medium");
    setDeadline("");
    setAssignedTo("");
    setEstimatedHours("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getSourceLabel = () => {
    switch (sourceType) {
      case "implementation":
        return "Implementation Project";
      case "support":
        return "Support Ticket";
      case "task":
        return "Task";
      default:
        return "Source";
    }
  };

  const getSourceColor = () => {
    switch (sourceType) {
      case "implementation":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      case "support":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "task":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-600" />
            Assign to Development
          </DialogTitle>
          <DialogDescription>
            Create a development task from this {getSourceLabel().toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceColor()}`}>
              {getSourceLabel()}
            </span>
            <span className="text-sm text-muted-foreground truncate">
              {sourceTitle}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dev-task-title">Task Title</Label>
            <Input
              id="dev-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              data-testid="input-dev-task-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dev-task-description">Description</Label>
            <Textarea
              id="dev-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the development work needed"
              className="min-h-20"
              data-testid="textarea-dev-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dev-task-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="dev-task-priority" data-testid="select-dev-task-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev-task-deadline">Deadline</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dev-task-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="pl-8"
                  data-testid="input-dev-task-deadline"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dev-task-assignee">Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="dev-task-assignee" data-testid="select-dev-task-assignee">
                  <SelectValue placeholder={developersLoading ? "Loading..." : "Select developer"} />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {developersLoading && (
                    <div className="p-2 text-sm text-muted-foreground">Loading developers...</div>
                  )}
                  {!developersLoading && (!activeDevelopers || activeDevelopers.length === 0) && (
                    <div className="p-2 text-sm text-muted-foreground">No developers available</div>
                  )}
                  {activeDevelopers?.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {dev.firstName} {dev.lastName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev-task-hours">Estimated Hours</Label>
              <Input
                id="dev-task-hours"
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g., 4"
                data-testid="input-dev-task-hours"
              />
            </div>
          </div>

          {!deadline && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span>Default deadline: 7 days from now</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createDevTaskMutation.mutate()}
            disabled={!title.trim() || createDevTaskMutation.isPending}
            data-testid="button-confirm-assign-development"
          >
            {createDevTaskMutation.isPending ? "Creating..." : "Assign to Development"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
