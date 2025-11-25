import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertTicketSchema, type InsertTicket, type Project, type Customer, type Module } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Building2, Plus, Camera, Upload, X, Image, Loader2 } from "lucide-react";
import { useState, useRef } from "react";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

interface TicketFormProps {
  onSuccess?: () => void;
}

interface UploadedImage {
  url: string;
  name: string;
  uploading?: boolean;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { toast } = useToast();
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: modules } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const form = useForm<InsertTicket>({
    resolver: zodResolver(insertTicketSchema),
    defaultValues: {
      customerId: undefined,
      projectId: undefined,
      moduleId: undefined,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      issueSummary: "",
      issueDescription: "",
      priority: "medium",
      status: "open",
      assignedEngineerId: undefined,
      escalationLevel: 1,
      attachments: [],
    },
  });

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === "new") {
      setIsNewCustomer(true);
      form.setValue("customerId", undefined);
      form.setValue("customerName", "");
      form.setValue("customerEmail", "");
      form.setValue("customerPhone", "");
    } else {
      setIsNewCustomer(false);
      const selectedCustomer = customers?.find(c => c.id === customerId);
      if (selectedCustomer) {
        form.setValue("customerId", customerId);
        form.setValue("customerName", selectedCustomer.name);
        form.setValue("customerEmail", selectedCustomer.email || "");
        form.setValue("customerPhone", selectedCustomer.phone || "");
      }
    }
  };

  const handleProjectSelect = (projectId: string) => {
    form.setValue("projectId", projectId);
    const selectedProject = projects?.find(p => p.id === projectId);
    if (selectedProject) {
      form.setValue("customerName", selectedProject.clientName);
      if (selectedProject.customerId) {
        form.setValue("customerId", selectedProject.customerId);
        const customer = customers?.find(c => c.id === selectedProject.customerId);
        if (customer) {
          form.setValue("customerEmail", customer.email || "");
          form.setValue("customerPhone", customer.phone || "");
        }
        setIsNewCustomer(false);
      }
    }
  };

  const uploadImage = async (file: File) => {
    const tempId = Date.now().toString();
    setUploadedImages(prev => [...prev, { url: tempId, name: file.name, uploading: true }]);
    setIsUploading(true);

    try {
      const uploadUrlResponse = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: file.name }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      setUploadedImages(prev => 
        prev.map(img => 
          img.url === tempId 
            ? { url: objectPath, name: file.name, uploading: false }
            : img
        )
      );

      toast({
        title: "Image uploaded",
        description: file.name,
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadedImages(prev => prev.filter(img => img.url !== tempId));
      toast({
        title: "Upload failed",
        description: `Failed to upload ${file.name}`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFileSize = 10 * 1024 * 1024;

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Only images are allowed",
          variant: "destructive",
        });
        continue;
      }

      if (file.size > maxFileSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit`,
          variant: "destructive",
        });
        continue;
      }

      await uploadImage(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setUploadedImages(prev => prev.filter(img => img.url !== url));
  };

  const createTicketMutation = useMutation({
    mutationFn: async (data: InsertTicket) => {
      const attachmentUrls = uploadedImages.filter(img => !img.uploading).map(img => img.url);
      await apiRequest("POST", "/api/tickets", {
        ...data,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      toast({
        title: "Success",
        description: "Support ticket created successfully",
      });
      onSuccess?.();
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
        description: "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTicket) => {
    createTicketMutation.mutate(data);
  };

  const activeCustomers = customers?.filter(c => c.status === "active") || [];
  const activeModules = modules?.filter(m => m.isActive) || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Select Customer</span>
            </div>
            
            <Select onValueChange={handleCustomerSelect} value={form.watch("customerId") || (isNewCustomer ? "new" : undefined)}>
              <SelectTrigger data-testid="select-customer">
                <SelectValue placeholder="Select from Customer Master" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Add New Customer</span>
                  </div>
                </SelectItem>
                {activeCustomers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      {customer.contactPerson && (
                        <span className="text-xs text-muted-foreground">{customer.contactPerson}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isNewCustomer && form.watch("customerId") && (
              <FormDescription className="mt-2">
                Contact details loaded from Customer Master
              </FormDescription>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Customer name" 
                      {...field} 
                      disabled={!isNewCustomer && !!form.watch("customerId")}
                      data-testid="input-customer-name" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="customer@example.com" {...field} data-testid="input-customer-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 XXXXX XXXXX" {...field} value={field.value || ""} data-testid="input-customer-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Project (Optional)</FormLabel>
                  <Select onValueChange={handleProjectSelect} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.clientName}
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
              name="moduleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Module</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-module">
                        <SelectValue placeholder="Select module for the issue" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeModules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the module related to this support query
                  </FormDescription>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="issueSummary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Summary</FormLabel>
                <FormControl>
                  <Input placeholder="Brief description of the issue" {...field} data-testid="input-issue-summary" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="issueDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Detailed description of the issue..." 
                    {...field} 
                    rows={4}
                    data-testid="input-issue-description" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <FormLabel>Attachments</FormLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-attach-image"
              >
                <Upload className="h-4 w-4 mr-2" />
                Attach Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-take-photo"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file-attach"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-camera-capture"
              />
            </div>
            <FormDescription>
              Upload screenshots or photos to help describe the issue (max 10MB per image)
            </FormDescription>

            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {uploadedImages.map((img, index) => (
                  <div
                    key={img.url}
                    className="relative group border rounded-lg overflow-hidden w-20 h-20 bg-muted"
                    data-testid={`attachment-preview-${index}`}
                  >
                    {img.uploading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                            onClick={() => removeImage(img.url)}
                            data-testid={`button-remove-attachment-${index}`}
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                          {img.name}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createTicketMutation.isPending || isUploading}
            data-testid="button-submit-ticket"
          >
            {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
