import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertTicketSchema, type InsertTicket, type Project, type Customer } from "@shared/schema";
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
import { Building2, Plus } from "lucide-react";
import { useState } from "react";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

interface TicketFormProps {
  onSuccess?: () => void;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { toast } = useToast();
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<InsertTicket>({
    resolver: zodResolver(insertTicketSchema),
    defaultValues: {
      customerId: undefined,
      projectId: undefined,
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

  const createTicketMutation = useMutation({
    mutationFn: async (data: InsertTicket) => {
      await apiRequest("POST", "/api/tickets", data);
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
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createTicketMutation.isPending}
            data-testid="button-submit-ticket"
          >
            {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
