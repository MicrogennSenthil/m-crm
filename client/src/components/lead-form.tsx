import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertLeadSchema, type InsertLead, type User, type Customer, type Module } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Building2, Plus, Package } from "lucide-react";
import { useState } from "react";

const LEAD_SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const STAGES = [
  { value: "new_lead", label: "New Lead" },
  { value: "demo_scheduled", label: "Demo Scheduled" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

const CURRENCIES = [
  { value: "INR", label: "₹ INR (Indian Rupee)", symbol: "₹" },
  { value: "USD", label: "$ USD (US Dollar)", symbol: "$" },
  { value: "EUR", label: "€ EUR (Euro)", symbol: "€" },
  { value: "GBP", label: "£ GBP (British Pound)", symbol: "£" },
  { value: "AED", label: "د.إ AED (UAE Dirham)", symbol: "د.إ" },
  { value: "SGD", label: "S$ SGD (Singapore Dollar)", symbol: "S$" },
  { value: "AUD", label: "A$ AUD (Australian Dollar)", symbol: "A$" },
  { value: "CAD", label: "C$ CAD (Canadian Dollar)", symbol: "C$" },
  { value: "JPY", label: "¥ JPY (Japanese Yen)", symbol: "¥" },
  { value: "CNY", label: "¥ CNY (Chinese Yuan)", symbol: "¥" },
];

interface LeadFormProps {
  onSuccess?: () => void;
  defaultValues?: InsertLead;
}

export function LeadForm({ onSuccess, defaultValues }: LeadFormProps) {
  const { toast } = useToast();
  const [isNewCompany, setIsNewCompany] = useState(false);

  const { data: salesExecutives } = useQuery<User[]>({
    queryKey: ["/api/users?role=sales_executive"],
  });

  const { data: companies } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: modules } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: defaultValues || {
      customerId: undefined,
      companyName: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      leadSource: "website",
      stage: "new_lead",
      currency: "INR",
      estimatedValue: undefined,
      salesExecutiveId: undefined,
      selectedModules: [],
    },
  });

  const handleCompanySelect = (customerId: string) => {
    if (customerId === "new") {
      setIsNewCompany(true);
      form.setValue("customerId", undefined);
      form.setValue("companyName", "");
      form.setValue("contactPerson", "");
      form.setValue("contactEmail", "");
      form.setValue("contactPhone", "");
    } else {
      setIsNewCompany(false);
      const selectedCompany = companies?.find(c => c.id === customerId);
      if (selectedCompany) {
        form.setValue("customerId", customerId);
        form.setValue("companyName", selectedCompany.name);
        form.setValue("contactPerson", selectedCompany.contactPerson || "");
        form.setValue("contactEmail", selectedCompany.email || "");
        form.setValue("contactPhone", selectedCompany.phone || "");
      }
    }
  };

  const createLeadMutation = useMutation({
    mutationFn: async (data: InsertLead) => {
      await apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      toast({
        title: "Success",
        description: "Lead created successfully",
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
        description: "Failed to create lead",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertLead) => {
    createLeadMutation.mutate(data);
  };

  const activeCompanies = companies?.filter(c => c.status === "active") || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          {/* Company Selection */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Select Customer</span>
            </div>
            
            <Select onValueChange={handleCompanySelect} value={form.watch("customerId") || (isNewCompany ? "new" : undefined)}>
              <SelectTrigger data-testid="select-customer">
                <SelectValue placeholder="Select from Customer Master or add new" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Add New Customer</span>
                  </div>
                </SelectItem>
                {activeCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    <div className="flex flex-col">
                      <span>{company.name}</span>
                      {company.contactPerson && (
                        <span className="text-xs text-muted-foreground">{company.contactPerson}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isNewCompany && form.watch("customerId") && (
              <FormDescription className="mt-2">
                Contact details will be auto-filled from Customer Master
              </FormDescription>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Customer/Company name" 
                      {...field} 
                      disabled={!isNewCompany && !!form.watch("customerId")}
                      data-testid="input-company-name" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} data-testid="input-contact-person" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@acme.com" {...field} data-testid="input-contact-email" />
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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 234 567 8900" {...field} value={field.value || ""} data-testid="input-contact-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Source</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-lead-source">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAD_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
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
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-stage">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "INR"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
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
                name="estimatedValue"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Estimated Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="50000"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-estimated-value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="salesExecutiveId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Executive</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sales-executive">
                        <SelectValue placeholder="Select executive" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesExecutives?.map((exec) => (
                        <SelectItem key={exec.id} value={exec.id}>
                          {exec.firstName} {exec.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Selected Modules - Modules the customer is interested in purchasing */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Selected Modules</span>
            </div>
            <FormDescription className="mb-3">
              Select the modules the customer is interested in purchasing
            </FormDescription>
            <FormField
              control={form.control}
              name="selectedModules"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {modules?.map((module) => (
                      <div
                        key={module.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`module-${module.id}`}
                          data-testid={`checkbox-module-${module.name.toLowerCase().replace(/\s+/g, '-')}`}
                          checked={field.value?.includes(module.name) || false}
                          onCheckedChange={(checked) => {
                            const currentModules = field.value || [];
                            if (checked) {
                              field.onChange([...currentModules, module.name]);
                            } else {
                              field.onChange(currentModules.filter((m) => m !== module.name));
                            }
                          }}
                        />
                        <label
                          htmlFor={`module-${module.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {module.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="submit"
            disabled={createLeadMutation.isPending}
            data-testid="button-submit-lead"
          >
            {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
