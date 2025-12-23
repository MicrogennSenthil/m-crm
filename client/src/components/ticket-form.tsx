import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertTicketSchema, type InsertTicket, type Project, type Customer, type Module, type CustomerWithLifecycle } from "@shared/schema";
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Plus, Camera, Upload, X, Image, Loader2, CheckCircle, Cog, Users, UserPlus, ChevronsUpDown, Search, UserCheck } from "lucide-react";
import { useState, useRef, useMemo } from "react";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

interface TicketFormProps {
  onSuccess?: () => void;
}

interface PendingUpload {
  id: string;
  file: File;
  objectPath?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  error?: string;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selfAssign, setSelfAssign] = useState(true); // Default to self-assign enabled
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Use customers with lifecycle status for better grouping
  const { data: customersWithLifecycle } = useQuery<CustomerWithLifecycle[]>({
    queryKey: ["/api/customers/with-lifecycle"],
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
    },
  });

  // Group customers by lifecycle status
  const groupedCustomers = useMemo(() => {
    if (!customersWithLifecycle) return { handedOff: [], inImplementation: [], existing: [], prospect: [] };
    
    return {
      handedOff: customersWithLifecycle.filter(c => c.lifecycleStatus === "handed_off"),
      inImplementation: customersWithLifecycle.filter(c => c.lifecycleStatus === "in_implementation"),
      existing: customersWithLifecycle.filter(c => c.lifecycleStatus === "existing"),
      prospect: customersWithLifecycle.filter(c => c.lifecycleStatus === "prospect"),
    };
  }, [customersWithLifecycle]);

  // Filter projects based on selected customer
  const filteredProjects = useMemo(() => {
    if (!projects || !selectedCustomerId) return projects || [];
    return projects.filter(p => p.customerId === selectedCustomerId);
  }, [projects, selectedCustomerId]);

  // Get selected customer's projects for display
  const selectedCustomerProjects = useMemo(() => {
    if (!selectedCustomerId || !customersWithLifecycle) return [];
    const customer = customersWithLifecycle.find(c => c.id === selectedCustomerId);
    return customer?.projects || [];
  }, [selectedCustomerId, customersWithLifecycle]);

  // Filter modules based on selected customer's purchased modules
  const { filteredModules, hasPurchasedModules } = useMemo(() => {
    if (!modules) return { filteredModules: [], hasPurchasedModules: false };
    if (!selectedCustomerId || !customersWithLifecycle || isNewCustomer) {
      return { filteredModules: modules, hasPurchasedModules: false }; // Show all if no customer selected or new customer
    }
    
    const selectedCustomer = customersWithLifecycle.find(c => c.id === selectedCustomerId);
    const purchasedModuleNames = selectedCustomer?.selectedModules || [];
    
    // If customer has no specific modules (existing customer not from sales), show all
    if (purchasedModuleNames.length === 0) {
      return { filteredModules: modules, hasPurchasedModules: false };
    }
    
    // Filter to only show purchased modules
    return { 
      filteredModules: modules.filter(m => purchasedModuleNames.includes(m.name)),
      hasPurchasedModules: true
    };
  }, [modules, selectedCustomerId, customersWithLifecycle, isNewCustomer]);

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === "new") {
      setIsNewCustomer(true);
      setSelectedCustomerId(null);
      form.setValue("customerId", undefined);
      form.setValue("projectId", undefined);
      form.setValue("moduleId", undefined);
      form.setValue("customerName", "");
      form.setValue("customerEmail", "");
      form.setValue("customerPhone", "");
    } else {
      setIsNewCustomer(false);
      setSelectedCustomerId(customerId);
      const selectedCustomer = customersWithLifecycle?.find(c => c.id === customerId);
      if (selectedCustomer) {
        form.setValue("customerId", customerId);
        form.setValue("customerName", selectedCustomer.name);
        form.setValue("customerEmail", selectedCustomer.email || "");
        form.setValue("customerPhone", selectedCustomer.phone || "");
        // Clear project and module selection when customer changes
        form.setValue("projectId", undefined);
        form.setValue("moduleId", undefined);
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
        setSelectedCustomerId(selectedProject.customerId);
        const customer = customersWithLifecycle?.find(c => c.id === selectedProject.customerId);
        if (customer) {
          form.setValue("customerEmail", customer.email || "");
          form.setValue("customerPhone", customer.phone || "");
        }
        setIsNewCustomer(false);
      }
    }
  };

  // Lifecycle status badge helper
  const getLifecycleBadge = (status: string) => {
    switch (status) {
      case "handed_off":
        return (
          <Badge variant="default" className="bg-green-600 text-white text-[10px] px-1.5 py-0 ml-2">
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
            Handed Off
          </Badge>
        );
      case "in_implementation":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0 ml-2">
            <Cog className="h-2.5 w-2.5 mr-0.5" />
            In Progress
          </Badge>
        );
      case "existing":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2">
            <Users className="h-2.5 w-2.5 mr-0.5" />
            Existing
          </Badge>
        );
      default:
        return null;
    }
  };

  const uploadFile = async (upload: PendingUpload): Promise<PendingUpload> => {
    try {
      const uploadUrlResponse = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: upload.file.name }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: upload.file,
        headers: {
          "Content-Type": upload.file.type || "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      return { ...upload, objectPath, status: "uploaded" };
    } catch (error) {
      console.error("Upload error:", error);
      return { ...upload, status: "error", error: "Upload failed" };
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFileSize = 10 * 1024 * 1024;

    const newUploads: PendingUpload[] = [];

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

      newUploads.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "pending",
      });
    }

    if (newUploads.length > 0) {
      setPendingUploads(prev => [...prev, ...newUploads]);
      setIsUploading(true);

      for (const upload of newUploads) {
        setPendingUploads(prev =>
          prev.map(u => u.id === upload.id ? { ...u, status: "uploading" } : u)
        );

        const result = await uploadFile(upload);

        setPendingUploads(prev =>
          prev.map(u => u.id === upload.id ? result : u)
        );
      }

      setIsUploading(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(u => u.id !== id));
  };

  const registerAttachments = async (ticketId: string) => {
    const uploadedFiles = pendingUploads.filter(u => u.status === "uploaded" && u.objectPath);
    
    for (const upload of uploadedFiles) {
      try {
        await apiRequest("POST", "/api/attachments", {
          entityType: "ticket",
          entityId: ticketId,
          fileName: upload.file.name,
          fileType: upload.file.type || "application/octet-stream",
          fileSize: upload.file.size,
          objectPath: upload.objectPath,
        });
      } catch (error) {
        console.error("Failed to register attachment:", error);
      }
    }
  };

  const createTicketMutation = useMutation({
    mutationFn: async (data: InsertTicket) => {
      const response = await apiRequest("POST", "/api/tickets", data);
      return response.json();
    },
    onSuccess: async (ticket) => {
      if (pendingUploads.some(u => u.status === "uploaded")) {
        await registerAttachments(ticket.id);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      queryClient.invalidateQueries({ queryKey: [`/api/attachments/ticket/${ticket.id}`] });
      
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
    // If self-assign is enabled and user is logged in, assign ticket to current user
    if (selfAssign && user?.id) {
      data.assignedEngineerId = user.id;
    }
    createTicketMutation.mutate(data);
  };

  const hasUploadingFiles = pendingUploads.some(u => u.status === "uploading");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Select Customer</span>
            </div>
            
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between font-normal"
                  data-testid="select-customer"
                >
                  {isNewCustomer ? (
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add New Customer
                    </span>
                  ) : selectedCustomerId ? (
                    <span className="flex items-center gap-2">
                      {customersWithLifecycle?.find(c => c.id === selectedCustomerId)?.name}
                      {getLifecycleBadge(customersWithLifecycle?.find(c => c.id === selectedCustomerId)?.lifecycleStatus || "prospect")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Search or select customer...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type to search customers..." data-testid="input-customer-search" />
                  <CommandList>
                    <CommandEmpty>No customer found.</CommandEmpty>
                    
                    {/* Add New Customer option */}
                    <CommandGroup>
                      <CommandItem
                        value="add-new-customer"
                        onSelect={() => {
                          handleCustomerSelect("new");
                          setCustomerSearchOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>Add New Customer</span>
                      </CommandItem>
                    </CommandGroup>
                    
                    <CommandSeparator />
                    
                    {/* Handed Off Customers - Priority section */}
                    {groupedCustomers.handedOff.length > 0 && (
                      <CommandGroup heading={
                        <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Handed Over to Support
                        </span>
                      }>
                        {groupedCustomers.handedOff.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              handleCustomerSelect(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"}`} />
                            <span>{customer.name}</span>
                            {getLifecycleBadge(customer.lifecycleStatus)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* In Implementation Customers */}
                    {groupedCustomers.inImplementation.length > 0 && (
                      <CommandGroup heading={
                        <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <Cog className="h-3.5 w-3.5" />
                          In Implementation
                        </span>
                      }>
                        {groupedCustomers.inImplementation.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              handleCustomerSelect(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"}`} />
                            <span>{customer.name}</span>
                            {getLifecycleBadge(customer.lifecycleStatus)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* Existing Customers */}
                    {groupedCustomers.existing.length > 0 && (
                      <CommandGroup heading={
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Existing Customers
                        </span>
                      }>
                        {groupedCustomers.existing.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              handleCustomerSelect(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"}`} />
                            <span>{customer.name}</span>
                            {getLifecycleBadge(customer.lifecycleStatus)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* Prospects */}
                    {groupedCustomers.prospect.length > 0 && (
                      <CommandGroup heading={
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Prospects
                        </span>
                      }>
                        {groupedCustomers.prospect.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              handleCustomerSelect(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle className={`mr-2 h-4 w-4 ${selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"}`} />
                            <span>{customer.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Show selected customer's lifecycle info */}
            {!isNewCustomer && form.watch("customerId") && (
              <div className="mt-3 space-y-2">
                <FormDescription>
                  Contact details loaded from Customer Master
                </FormDescription>
                {selectedCustomerProjects.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Projects: </span>
                    {selectedCustomerProjects.map((p, idx) => (
                      <span key={p.id}>
                        {p.clientName}
                        {p.handoffStatus === "handed_off" && (
                          <CheckCircle className="inline h-3 w-3 text-green-600 ml-0.5" />
                        )}
                        {idx < selectedCustomerProjects.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
                  <FormLabel>Related Project {selectedCustomerId ? "" : "(Optional)"}</FormLabel>
                  <Select onValueChange={handleProjectSelect} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-project">
                        <SelectValue placeholder={selectedCustomerId && filteredProjects.length === 0 ? "No projects found" : "Select project"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => {
                          const handoff = selectedCustomerProjects.find(p => p.id === project.id);
                          return (
                            <SelectItem key={project.id} value={project.id}>
                              <div className="flex items-center gap-2">
                                <span>{project.clientName}</span>
                                {handoff?.handoffStatus === "handed_off" && (
                                  <Badge variant="default" className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                    Handed Off
                                  </Badge>
                                )}
                                {project.status === "in_progress" && !handoff?.handoffStatus && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    In Progress
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : !selectedCustomerId && projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCustomerId && filteredProjects.length > 0 && (
                    <FormDescription>
                      Showing projects for selected customer
                    </FormDescription>
                  )}
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
                      {filteredModules.length > 0 ? (
                        filteredModules.map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                          No modules purchased by this customer
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {hasPurchasedModules 
                      ? `Showing ${filteredModules.length} purchased module${filteredModules.length !== 1 ? 's' : ''} for this customer`
                      : "Select the module related to this support query"
                    }
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

          {/* Self-Assignment Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Assign to Me</p>
                <p className="text-xs text-muted-foreground">
                  Automatically assign this ticket to yourself
                </p>
              </div>
            </div>
            <Switch
              checked={selfAssign}
              onCheckedChange={setSelfAssign}
              data-testid="switch-self-assign"
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
                disabled={hasUploadingFiles}
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
                disabled={hasUploadingFiles}
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

            {pendingUploads.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {pendingUploads.map((upload, index) => (
                  <div
                    key={upload.id}
                    className="relative group border rounded-lg overflow-hidden w-20 h-20 bg-muted"
                    data-testid={`attachment-preview-${index}`}
                  >
                    {upload.status === "uploading" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : upload.status === "error" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-1">
                        <X className="h-5 w-5 text-destructive" />
                        <span className="text-xs text-destructive text-center">Failed</span>
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
                            onClick={() => removeUpload(upload.id)}
                            data-testid={`button-remove-attachment-${index}`}
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                          {upload.file.name}
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
            disabled={createTicketMutation.isPending || hasUploadingFiles}
            data-testid="button-submit-ticket"
          >
            {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
