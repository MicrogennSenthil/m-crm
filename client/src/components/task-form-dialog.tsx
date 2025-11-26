import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Task, User, Lead } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Mic, MicOff, Calendar as CalendarIcon, X, Check, ChevronsUpDown, Play, Pause, Trash2 } from "lucide-react";

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "followup", "completed", "get_information"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().optional(),
  mentionedUsers: z.array(z.string()).optional(),
  reminderDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

type TaskWithDetails = Task & {
  creator?: User;
  assignee?: User;
  mentionedUserDetails?: User[];
};

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithDetails | null;
  onSuccess: () => void;
}

export default function TaskFormDialog({ open, onOpenChange, task, onSuccess }: TaskFormDialogProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch all users for assignment and mentions
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  // Fetch all leads for linking tasks
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      assignedTo: undefined,
      mentionedUsers: [],
      reminderDate: null,
      dueDate: null,
      relatedEntityType: undefined,
      relatedEntityId: undefined,
    },
  });

  // Fetch next followup date when lead is selected
  const handleLeadSelect = async (leadId: string | null) => {
    setSelectedLeadId(leadId);
    form.setValue("relatedEntityType", leadId ? "lead" : undefined);
    form.setValue("relatedEntityId", leadId || undefined);
    
    if (leadId) {
      try {
        const response = await fetch(`/api/leads/${leadId}/next-followup`, {
          credentials: "include",
        });
        const data = await response.json();
        
        // Find the lead to pre-populate title
        const selectedLead = leads.find(l => l.id === leadId);
        
        if (data.nextFollowUpDate) {
          const followUpDate = new Date(data.nextFollowUpDate);
          form.setValue("reminderDate", followUpDate);
          
          if (selectedLead && !form.getValues("title")) {
            form.setValue("title", `Follow up: ${selectedLead.companyName}`);
            form.setValue("status", "followup");
          }
          
          if (data.isPast) {
            toast({ 
              title: "Note: Latest followup date was in the past",
              description: "The reminder date has been set but you may want to update it.",
            });
          } else {
            toast({ 
              title: "Followup date loaded",
              description: `Reminder set to ${followUpDate.toLocaleDateString()}`,
            });
          }
        } else {
          // No pending followups for this lead
          if (selectedLead && !form.getValues("title")) {
            form.setValue("title", `Follow up: ${selectedLead.companyName}`);
            form.setValue("status", "followup");
          }
          toast({ 
            title: "No pending followups",
            description: "This lead has no scheduled followup dates. Please set a reminder manually.",
          });
        }
      } catch (error) {
        console.error("Error fetching lead followup:", error);
      }
    }
    setLeadOpen(false);
  };

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        status: task.status as any,
        priority: (task.priority || "medium") as any,
        assignedTo: task.assignedTo || undefined,
        mentionedUsers: task.mentionedUsers || [],
        reminderDate: task.reminderDate ? new Date(task.reminderDate) : null,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        relatedEntityType: task.relatedEntityType || undefined,
        relatedEntityId: task.relatedEntityId || undefined,
      });
      if (task.voiceNoteUrl) {
        setAudioUrl(task.voiceNoteUrl);
      }
      // Set selected lead if task is linked to a lead
      if (task.relatedEntityType === "lead" && task.relatedEntityId) {
        setSelectedLeadId(task.relatedEntityId);
      } else {
        setSelectedLeadId(null);
      }
    } else {
      form.reset({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        assignedTo: undefined,
        mentionedUsers: [],
        reminderDate: null,
        dueDate: null,
        relatedEntityType: undefined,
        relatedEntityId: undefined,
      });
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingDuration(0);
      setSelectedLeadId(null);
    }
  }, [task, form, open]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormValues & { voiceNoteUrl?: string; voiceNoteDuration?: number }) => {
      if (task) {
        await apiRequest("PATCH", `/api/tasks/${task.id}`, data);
      } else {
        await apiRequest("POST", "/api/tasks", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: task ? "Task updated successfully" : "Task created successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to save task", variant: "destructive" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({ title: "Could not access microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const onSubmit = async (data: TaskFormValues) => {
    let voiceNoteUrl = task?.voiceNoteUrl;
    let voiceNoteDuration = task?.voiceNoteDuration;
    
    // If there's a new audio blob, upload it
    if (audioBlob && !audioUrl?.startsWith("/objects/")) {
      try {
        // Get upload URL
        const uploadResponse = await apiRequest("POST", "/api/tasks/voice-upload", {
          taskId: task?.id,
        });
        const uploadData = await uploadResponse.json();
        
        // Upload the audio file
        await fetch(uploadData.uploadURL, {
          method: "PUT",
          body: audioBlob,
          headers: {
            "Content-Type": "audio/webm",
          },
        });
        
        voiceNoteUrl = uploadData.voiceNoteUrl;
        voiceNoteDuration = recordingDuration;
      } catch (error) {
        console.error("Error uploading voice note:", error);
        toast({ title: "Failed to upload voice note", variant: "destructive" });
      }
    }
    
    createTaskMutation.mutate({
      ...data,
      voiceNoteUrl: voiceNoteUrl || undefined,
      voiceNoteDuration: voiceNoteDuration || undefined,
    });
  };

  const selectedMentionedUsers = form.watch("mentionedUsers") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Link to Sales Lead - Auto-populates reminder date from lead's followup */}
            <div className="space-y-2">
              <FormLabel>Link to Sales Lead (Optional)</FormLabel>
              <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="select-related-lead"
                  >
                    {selectedLeadId 
                      ? leads.find(l => l.id === selectedLeadId)?.companyName || "Select lead..."
                      : "Select lead to link..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search leads..." />
                    <CommandList>
                      <CommandEmpty>No leads found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => handleLeadSelect(null)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${!selectedLeadId ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="text-muted-foreground">No lead linked</span>
                        </CommandItem>
                        {leads.map((lead) => (
                          <CommandItem
                            key={lead.id}
                            onSelect={() => handleLeadSelect(lead.id)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedLeadId === lead.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div className="flex flex-col">
                              <span>{lead.companyName}</span>
                              <span className="text-xs text-muted-foreground">
                                {lead.contactPerson} - {lead.stage?.replace("_", " ")}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedLeadId && (
                <p className="text-xs text-muted-foreground">
                  Reminder date will be auto-filled from the lead's next followup date
                </p>
              )}
            </div>
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} data-testid="input-task-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Task description" 
                      className="min-h-[100px]" 
                      {...field} 
                      data-testid="input-task-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="followup">Follow Up</SelectItem>
                        <SelectItem value="get_information">Get Information</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "_unassigned" ? undefined : value)} 
                    value={field.value || "_unassigned"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-task-assignee">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_unassigned">Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.profileImageUrl || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {user.firstName} {user.lastName}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mentionedUsers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mention Team Members (Get Information From)</FormLabel>
                  <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          data-testid="select-mentioned-users"
                        >
                          {selectedMentionedUsers.length > 0 
                            ? `${selectedMentionedUsers.length} member(s) selected`
                            : "Select team members"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search team members..." />
                        <CommandList>
                          <CommandEmpty>No team member found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => {
                                  const current = field.value || [];
                                  const updated = current.includes(user.id)
                                    ? current.filter(id => id !== user.id)
                                    : [...current, user.id];
                                  field.onChange(updated);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedMentionedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <Avatar className="h-5 w-5 mr-2">
                                  <AvatarImage src={user.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                {user.firstName} {user.lastName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedMentionedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedMentionedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        return user ? (
                          <Badge key={userId} variant="secondary" className="gap-1">
                            {user.firstName} {user.lastName}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => {
                                field.onChange(selectedMentionedUsers.filter(id => id !== userId));
                              }}
                            />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reminderDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Reminder Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            data-testid="button-reminder-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Set reminder"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            data-testid="button-due-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Set due date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-2">
              <FormLabel>Voice Note</FormLabel>
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                {!audioUrl ? (
                  <>
                    <Button
                      type="button"
                      variant={isRecording ? "destructive" : "outline"}
                      size="icon"
                      onClick={isRecording ? stopRecording : startRecording}
                      data-testid="button-record-voice"
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {isRecording 
                        ? `Recording... ${formatDuration(recordingDuration)}`
                        : "Click to record a voice note"
                      }
                    </span>
                    {isRecording && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={togglePlayback}
                      data-testid="button-play-voice"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <span className="text-sm">
                      Voice note ({formatDuration(recordingDuration)})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-destructive"
                      onClick={deleteRecording}
                      data-testid="button-delete-voice"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-save-task">
                {createTaskMutation.isPending ? "Saving..." : task ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
