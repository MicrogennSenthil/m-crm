import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertProjectSchema, type InsertProject, type Lead, type Customer } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Building2, Plus, Package, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

const STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "training", label: "Training" },
  { value: "completed", label: "Completed" },
];

interface ProjectFormProps {
  onSuccess?: () => void;
}

export function ProjectForm({ onSuccess }: ProjectFormProps) {
  const { toast } = useToast();
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/leads?stage=closed_won"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      customerId: undefined,
      clientName: "",
      leadId: undefined,
      implementationDate: undefined,
      status: "not_started",
      completionPercentage: 0,
    },
  });

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === "new") {
      setIsNewCustomer(true);
      form.setValue("customerId", undefined);
      form.setValue("clientName", "");
    } else {
      setIsNewCustomer(false);
      const selectedCustomer = customers?.find(c => c.id === customerId);
      if (selectedCustomer) {
        form.setValue("customerId", customerId);
        form.setValue("clientName", selectedCustomer.name);
      }
    }
  };

  const handleLeadSelect = (leadId: string) => {
    form.setValue("leadId", leadId);
    const selectedLead = leads?.find(l => l.id === leadId);
    if (selectedLead) {
      form.setValue("clientName", selectedLead.companyName);
      if (selectedLead.customerId) {
        form.setValue("customerId", selectedLead.customerId);
        setIsNewCustomer(false);
      }
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject & { selectedModules?: string[] }) => {
      await apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      toast({
        title: "Success",
        description: "Project created successfully",
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
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    // Include selectedModules so the backend only creates project_modules for purchased modules
    createProjectMutation.mutate({
      ...data,
      selectedModules: selectedModules.length > 0 ? selectedModules : undefined,
    });
  };

  const activeCustomers = customers?.filter(c => c.status === "active") || [];
  const closedWonLeads = leads?.filter(l => l.stage === "closed_won") || [];

  // Watch form values for module display
  const watchedLeadId = form.watch("leadId");
  const watchedCustomerId = form.watch("customerId");

  // Get selected modules from customer or lead
  const selectedModules = useMemo(() => {
    // First check if there's a selected lead with modules
    if (watchedLeadId) {
      const selectedLead = leads?.find(l => l.id === watchedLeadId);
      if (selectedLead?.selectedModules?.length) {
        return selectedLead.selectedModules;
      }
    }
    
    // Fall back to customer's selected modules
    if (watchedCustomerId) {
      const selectedCustomer = customers?.find(c => c.id === watchedCustomerId);
      if (selectedCustomer?.selectedModules?.length) {
        return selectedCustomer.selectedModules;
      }
    }
    
    return [];
  }, [watchedLeadId, watchedCustomerId, leads, customers]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          {/* Customer Selection */}
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
                Customer details loaded from Customer Master
              </FormDescription>
            )}
          </div>

          {/* Display selected modules from customer/lead */}
          {selectedModules.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Modules to Implement</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                These modules were selected during the sales process
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedModules.map((moduleName) => (
                  <Badge key={moduleName} variant="secondary">
                    {moduleName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Customer/Company name" 
                      {...field} 
                      disabled={!isNewCustomer && !!form.watch("customerId")}
                      data-testid="input-client-name" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Lead (Optional)</FormLabel>
                  <Select onValueChange={handleLeadSelect} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-lead">
                        <SelectValue placeholder="Select closed won lead" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {closedWonLeads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.companyName}
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
              name="implementationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Implementation Date & Time</FormLabel>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-select-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value), "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const currentValue = field.value ? new Date(field.value) : new Date();
                              date.setHours(currentValue.getHours(), currentValue.getMinutes());
                              field.onChange(date);
                            } else {
                              field.onChange(undefined);
                            }
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
                        value={field.value ? format(new Date(field.value), "HH:mm") : ""}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":").map(Number);
                          const newDate = field.value ? new Date(field.value) : new Date();
                          newDate.setHours(hours || 0, minutes || 0, 0, 0);
                          field.onChange(newDate);
                        }}
                        data-testid="input-implementation-time"
                      />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createProjectMutation.isPending}
            data-testid="button-submit-project"
          >
            {createProjectMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
