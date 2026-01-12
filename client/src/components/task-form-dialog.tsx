import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Task, User, Lead, TaskAttachment, Customer } from "@shared/schema";
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
import { 
  Mic, MicOff, Calendar as CalendarIcon, X, Check, ChevronsUpDown, Play, Pause, Trash2,
  Video, VideoOff, Camera, Image, Paperclip, FileIcon, StopCircle, Clock, Plus, Building2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "followup", "completed", "get_information"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().min(1, "Assignee is required"),
  mentionedUsers: z.array(z.string()).optional(),
  reminderDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
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
  
  // Video recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  // Photo capture state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // File attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  
  // Customer selection state
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
  });
  
  // Calendar popover open states for auto-close
  const [reminderCalendarOpen, setReminderCalendarOpen] = useState(false);
  const [dueCalendarOpen, setDueCalendarOpen] = useState(false);

  // Fetch all users for assignment and mentions
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  // Fetch all leads for linking tasks
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });
  
  // Fetch all customers
  const { data: customers = [], refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  
  // Filter active customers (status = "active")
  const activeCustomers = customers.filter((c) => c.status === "active");

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      assignedTo: "",
      mentionedUsers: [],
      reminderDate: null,
      dueDate: null,
      relatedEntityType: undefined,
      relatedEntityId: undefined,
      contactName: "",
      contactPhone: "",
    },
  });

  // Handle customer selection
  const handleCustomerSelect = (customerId: string | null) => {
    if (customerId === "new") {
      setIsNewCustomer(true);
      setSelectedCustomerId(null);
      setNewCustomerData({ name: "", contactPerson: "", email: "", phone: "" });
    } else {
      setIsNewCustomer(false);
      setSelectedCustomerId(customerId);
      if (customerId) {
        const customer = activeCustomers.find(c => c.id === customerId);
        if (customer) {
          form.setValue("relatedEntityType", "customer");
          form.setValue("relatedEntityId", customerId);
          // Auto-fill contact details from customer
          if (customer.contactPerson) {
            form.setValue("contactName", customer.contactPerson);
          }
          if (customer.phone) {
            form.setValue("contactPhone", customer.phone);
          }
        }
      } else {
        form.setValue("relatedEntityType", undefined);
        form.setValue("relatedEntityId", undefined);
        // Clear contact details when unlinking customer
        form.setValue("contactName", "");
        form.setValue("contactPhone", "");
      }
    }
    setCustomerOpen(false);
  };

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
      // Get contact info from linked customer if available
      let contactName = task.contactName || "";
      let contactPhone = task.contactPhone || "";
      
      if (task.relatedEntityType === "customer" && task.relatedEntityId) {
        const linkedCustomer = activeCustomers.find(c => c.id === task.relatedEntityId);
        if (linkedCustomer) {
          // Use customer contact info if task doesn't have its own
          if (!contactName && linkedCustomer.contactPerson) {
            contactName = linkedCustomer.contactPerson;
          }
          if (!contactPhone && linkedCustomer.phone) {
            contactPhone = linkedCustomer.phone;
          }
          setSelectedCustomerId(linkedCustomer.id);
        }
      }
      
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
        contactName,
        contactPhone,
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
        assignedTo: "",
        mentionedUsers: [],
        reminderDate: null,
        dueDate: null,
        relatedEntityType: undefined,
        relatedEntityId: undefined,
        contactName: "",
        contactPhone: "",
      });
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingDuration(0);
      setSelectedLeadId(null);
      // Reset customer state
      setSelectedCustomerId(null);
      setIsNewCustomer(false);
      setNewCustomerData({ name: "", contactPerson: "", email: "", phone: "" });
      // Reset video/photo/attachment state
      setVideoBlob(null);
      setVideoUrl(null);
      setVideoDuration(0);
      setShowVideoPreview(false);
      setCapturedPhoto(null);
      setPhotoBlob(null);
      setShowCamera(false);
      setAttachments([]);
    }
    
    // Load existing attachments when editing
    if (task?.attachments) {
      setAttachments(task.attachments);
    }
  }, [task, form, open, activeCustomers]);

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: { name: string; contactPerson: string; email: string; phone: string }) => {
      const response = await apiRequest("POST", "/api/customers", data);
      return response.json();
    },
    onSuccess: async (newCustomer) => {
      // Immediately refetch customers to get the new one in the list
      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      await refetchCustomers();
      
      setSelectedCustomerId(newCustomer.id);
      setIsNewCustomer(false);
      form.setValue("relatedEntityType", "customer");
      form.setValue("relatedEntityId", newCustomer.id);
      toast({ title: "Customer created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create customer", variant: "destructive" });
    },
  });

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

  // Video recording functions
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      videoRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      };
      
      mediaRecorder.start();
      setIsRecordingVideo(true);
      setShowVideoPreview(true);
      setVideoDuration(0);
      
      videoTimerRef.current = setInterval(() => {
        setVideoDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({ title: "Could not access camera", variant: "destructive" });
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
      }
    }
  };

  const deleteVideoRecording = () => {
    setVideoBlob(null);
    setVideoUrl(null);
    setVideoDuration(0);
    setShowVideoPreview(false);
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
  };

  // Photo capture functions
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
      setShowCamera(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({ title: "Could not access camera", variant: "destructive" });
    }
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current && canvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            setPhotoBlob(blob);
            setCapturedPhoto(URL.createObjectURL(blob));
          }
        }, 'image/jpeg', 0.8);
      }
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setShowCamera(false);
  };

  const deletePhoto = () => {
    setCapturedPhoto(null);
    setPhotoBlob(null);
  };

  // File upload function
  const uploadAttachment = async (file: File, type: "video" | "photo" | "file") => {
    setIsUploading(true);
    try {
      // Get upload URL
      const response = await apiRequest("POST", "/api/tasks/attachment-upload", {
        taskId: task?.id,
        type,
        fileName: file.name,
        mimeType: file.type,
      });
      const data = await response.json();
      
      // Upload the file
      await fetch(data.uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      // Create attachment metadata
      const newAttachment: TaskAttachment = {
        id: crypto.randomUUID(),
        type,
        url: data.attachmentUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      toast({ title: `${type === 'file' ? 'File' : type === 'photo' ? 'Photo' : 'Video'} uploaded successfully` });
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast({ title: "Failed to upload attachment", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await uploadAttachment(file, "file");
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await uploadAttachment(files[0], "photo");
    }
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const onSubmit = async (data: TaskFormValues) => {
    let voiceNoteUrl = task?.voiceNoteUrl;
    let voiceNoteDuration = task?.voiceNoteDuration;
    let finalAttachments = [...attachments];
    
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
    
    // If there's a new video blob, upload it
    if (videoBlob && !videoUrl?.startsWith("/objects/")) {
      try {
        const response = await apiRequest("POST", "/api/tasks/attachment-upload", {
          taskId: task?.id,
          type: "video",
          fileName: "video_recording.webm",
          mimeType: "video/webm",
        });
        const uploadData = await response.json();
        
        await fetch(uploadData.uploadURL, {
          method: "PUT",
          body: videoBlob,
          headers: { "Content-Type": "video/webm" },
        });
        
        finalAttachments.push({
          id: crypto.randomUUID(),
          type: "video",
          url: uploadData.attachmentUrl,
          name: "Video Recording",
          size: videoBlob.size,
          duration: videoDuration,
          mimeType: "video/webm",
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error uploading video:", error);
        toast({ title: "Failed to upload video recording", variant: "destructive" });
      }
    }
    
    // If there's a captured photo, upload it
    if (photoBlob && !capturedPhoto?.startsWith("/objects/")) {
      try {
        const response = await apiRequest("POST", "/api/tasks/attachment-upload", {
          taskId: task?.id,
          type: "photo",
          fileName: "captured_photo.jpg",
          mimeType: "image/jpeg",
        });
        const uploadData = await response.json();
        
        await fetch(uploadData.uploadURL, {
          method: "PUT",
          body: photoBlob,
          headers: { "Content-Type": "image/jpeg" },
        });
        
        finalAttachments.push({
          id: crypto.randomUUID(),
          type: "photo",
          url: uploadData.attachmentUrl,
          name: "Captured Photo",
          size: photoBlob.size,
          mimeType: "image/jpeg",
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error uploading photo:", error);
        toast({ title: "Failed to upload photo", variant: "destructive" });
      }
    }
    
    createTaskMutation.mutate({
      ...data,
      voiceNoteUrl: voiceNoteUrl || undefined,
      voiceNoteDuration: voiceNoteDuration || undefined,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
    } as any);
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

            {/* Customer Selection Section */}
            <div className="space-y-2">
              <FormLabel>Link to Customer (Optional)</FormLabel>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="select-customer"
                  >
                    {isNewCustomer 
                      ? "Adding new customer..."
                      : selectedCustomerId 
                        ? activeCustomers.find(c => c.id === selectedCustomerId)?.name || "Select customer..."
                        : "Select customer or add new..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => handleCustomerSelect(null)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${!selectedCustomerId && !isNewCustomer ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="text-muted-foreground">No customer linked</span>
                        </CommandItem>
                        <Separator className="my-1" />
                        <CommandItem
                          onSelect={() => handleCustomerSelect("new")}
                          className="text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          <span className="font-medium">Add New Customer</span>
                        </CommandItem>
                        <Separator className="my-1" />
                        {activeCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            onSelect={() => handleCustomerSelect(customer.id)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div className="flex flex-col">
                              <span className="flex items-center gap-2">
                                <Building2 className="h-3 w-3" />
                                {customer.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {customer.contactPerson} {customer.email && `- ${customer.email}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedCustomerId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Task will be linked to: {activeCustomers.find(c => c.id === selectedCustomerId)?.name}
                </p>
              )}
            </div>

            {/* New Customer Form Fields */}
            {isNewCustomer && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Customer Details
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsNewCustomer(false);
                      setNewCustomerData({ name: "", contactPerson: "", email: "", phone: "" });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FormLabel className="text-xs">Company Name *</FormLabel>
                    <Input
                      placeholder="Company name"
                      value={newCustomerData.name}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                      data-testid="input-new-customer-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-xs">Contact Person</FormLabel>
                    <Input
                      placeholder="Contact person name"
                      value={newCustomerData.contactPerson}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, contactPerson: e.target.value })}
                      data-testid="input-new-customer-contact"
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-xs">Email</FormLabel>
                    <Input
                      type="email"
                      placeholder="email@company.com"
                      value={newCustomerData.email}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                      data-testid="input-new-customer-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-xs">Phone</FormLabel>
                    <Input
                      placeholder="Phone number"
                      value={newCustomerData.phone}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                      data-testid="input-new-customer-phone"
                    />
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!newCustomerData.name.trim()) {
                      toast({ title: "Company name is required", variant: "destructive" });
                      return;
                    }
                    createCustomerMutation.mutate(newCustomerData);
                  }}
                  disabled={createCustomerMutation.isPending || !newCustomerData.name.trim()}
                  data-testid="button-create-customer"
                >
                  {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                </Button>
              </div>
            )}
            
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
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Contact person name" 
                        {...field} 
                        data-testid="input-task-contact-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Contact phone number" 
                        {...field} 
                        data-testid="input-task-contact-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
                  <FormLabel>Assign To <span className="text-destructive">*</span></FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-task-assignee">
                        <SelectValue placeholder="Select team member (required)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                    <FormLabel>Reminder Date & Time</FormLabel>
                    <div className="flex gap-2">
                      <Popover open={reminderCalendarOpen} onOpenChange={setReminderCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`flex-1 justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              data-testid="button-reminder-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MMM d, yyyy") : "Date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={(date) => {
                              if (date) {
                                const currentValue = field.value || new Date();
                                date.setHours(currentValue.getHours(), currentValue.getMinutes());
                                field.onChange(date);
                              } else {
                                field.onChange(null);
                              }
                              setReminderCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="w-[110px]"
                          value={field.value ? format(field.value, "HH:mm") : ""}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            const newDate = field.value ? new Date(field.value) : new Date();
                            newDate.setHours(hours || 0, minutes || 0, 0, 0);
                            field.onChange(newDate);
                          }}
                          data-testid="input-reminder-time"
                        />
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date & Time</FormLabel>
                    <div className="flex gap-2">
                      <Popover open={dueCalendarOpen} onOpenChange={setDueCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`flex-1 justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              data-testid="button-due-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MMM d, yyyy") : "Date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={(date) => {
                              if (date) {
                                const currentValue = field.value || new Date();
                                date.setHours(currentValue.getHours(), currentValue.getMinutes());
                                field.onChange(date);
                              } else {
                                field.onChange(null);
                              }
                              setDueCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="w-[110px]"
                          value={field.value ? format(field.value, "HH:mm") : ""}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            const newDate = field.value ? new Date(field.value) : new Date();
                            newDate.setHours(hours || 0, minutes || 0, 0, 0);
                            field.onChange(newDate);
                          }}
                          data-testid="input-due-time"
                        />
                      </div>
                    </div>
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
            
            {/* Video Recording Section */}
            <div className="space-y-2">
              <FormLabel>Video Recording</FormLabel>
              <div className="border rounded-lg bg-muted/30 p-3">
                {showVideoPreview && !videoUrl ? (
                  <div className="space-y-3">
                    <video 
                      ref={videoPreviewRef} 
                      className="w-full rounded-lg aspect-video bg-black"
                      muted
                      playsInline
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        <span className="text-sm text-muted-foreground">
                          Recording... {formatDuration(videoDuration)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={stopVideoRecording}
                        data-testid="button-stop-video"
                      >
                        <StopCircle className="h-4 w-4 mr-2" />
                        Stop Recording
                      </Button>
                    </div>
                  </div>
                ) : videoUrl ? (
                  <div className="space-y-3">
                    <video 
                      src={videoUrl} 
                      className="w-full rounded-lg aspect-video bg-black"
                      controls
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Video Recording ({formatDuration(videoDuration)})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={deleteVideoRecording}
                        data-testid="button-delete-video"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={startVideoRecording}
                      data-testid="button-record-video"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Click to record a video
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Photo Capture Section */}
            <div className="space-y-2">
              <FormLabel>Photo</FormLabel>
              <div className="border rounded-lg bg-muted/30 p-3">
                {showCamera ? (
                  <div className="space-y-3">
                    <video 
                      ref={cameraVideoRef} 
                      className="w-full rounded-lg aspect-video bg-black"
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={closeCamera}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={capturePhoto}
                        data-testid="button-capture-photo"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Capture
                      </Button>
                    </div>
                  </div>
                ) : capturedPhoto ? (
                  <div className="space-y-3">
                    <img 
                      src={capturedPhoto} 
                      alt="Captured" 
                      className="w-full rounded-lg object-cover max-h-48"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Captured Photo</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={deletePhoto}
                        data-testid="button-delete-photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={openCamera}
                      data-testid="button-open-camera"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Take a photo
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                        data-testid="button-upload-photo"
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* File Attachments Section */}
            <div className="space-y-2">
              <FormLabel>Attachments</FormLabel>
              <div className="border rounded-lg bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    {isUploading ? "Uploading..." : "Attach Files"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Documents, images, or other files
                  </span>
                </div>
                
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div 
                        key={attachment.id} 
                        className="flex items-center gap-3 p-2 bg-background rounded border"
                      >
                        {attachment.type === "photo" ? (
                          <Image className="h-4 w-4 text-blue-500" />
                        ) : attachment.type === "video" ? (
                          <Video className="h-4 w-4 text-purple-500" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.size && formatFileSize(attachment.size)}
                            {attachment.duration && ` - ${formatDuration(attachment.duration)}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => removeAttachment(attachment.id)}
                          data-testid={`button-remove-attachment-${attachment.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTaskMutation.isPending || isUploading} 
                data-testid="button-save-task"
              >
                {createTaskMutation.isPending ? "Saving..." : task ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
