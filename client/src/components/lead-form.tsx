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
import { Building2, Plus, Package, MapPin, Loader2, Camera, X } from "lucide-react";
import { useState } from "react";
import { CameraCapture } from "@/components/camera-capture";

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
  { value: "seed", label: "Seed" },
  { value: "lead", label: "Lead" },
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
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(defaultValues?.photoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Fetch both sales executives and sales heads for the dropdown
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });
  
  // Filter to include both sales_executive and sales_head roles
  const salesExecutives = allUsers?.filter(
    user => user.role === 'sales_executive' || user.role === 'sales_head'
  );

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
      stage: "seed",
      currency: "INR",
      estimatedValue: undefined,
      salesExecutiveId: undefined,
      selectedModules: [],
      city: "",
      area: "",
      latitude: undefined,
      longitude: undefined,
    },
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue("latitude", latitude.toString());
        form.setValue("longitude", longitude.toString());
        form.setValue("locationCapturedAt", new Date());
        
        // Try to get city/area using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || "";
            const area = data.address.suburb || data.address.neighbourhood || data.address.road || "";
            form.setValue("city", city);
            form.setValue("area", area);
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
        }
        
        setIsGettingLocation(false);
        toast({
          title: "Location captured",
          description: "Your current location has been added.",
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Location error",
          description: error.message || "Failed to get your location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoCapture = async (photoDataUrl: string) => {
    try {
      setIsUploadingPhoto(true);
      
      // Get upload URL from server
      const uploadUrlResponse = await apiRequest("POST", "/api/leads/photo-upload", { leadId: null });
      const { uploadURL, photoUrl } = await uploadUrlResponse.json();
      
      // Convert base64 data URL to blob
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      // Upload to object storage
      await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "image/jpeg",
        },
      });
      
      // Store the photo URL
      setCapturedPhoto(photoUrl);
      form.setValue("photoUrl", photoUrl);
      form.setValue("photoCapturedAt", new Date());
      
      toast({
        title: "Photo captured",
        description: "Photo has been saved successfully.",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload the photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setCapturedPhoto(null);
    form.setValue("photoUrl", undefined);
    form.setValue("photoCapturedAt", undefined);
  };

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

          {/* Location Section */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Location</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={isGettingLocation}
                data-testid="button-get-location"
              >
                {isGettingLocation ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Use Current Location
                  </>
                )}
              </Button>
            </div>
            <FormDescription className="mb-3">
              Capture location using GPS or enter city and area manually
            </FormDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter city name"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-city"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area / Locality</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter area or locality"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-area"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {(form.watch("latitude") || form.watch("longitude")) && (
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span>
                  GPS: {form.watch("latitude")}, {form.watch("longitude")}
                </span>
              </div>
            )}
          </div>

          {/* Photo Capture Section */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Photo Capture</span>
              </div>
              {!capturedPhoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={isUploadingPhoto}
                  data-testid="button-open-camera"
                >
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </>
                  )}
                </Button>
              )}
            </div>
            <FormDescription className="mb-3">
              Capture a photo using front or back camera
            </FormDescription>
            
            {capturedPhoto ? (
              <div className="relative inline-block">
                <img
                  src={capturedPhoto}
                  alt="Captured photo"
                  className="w-32 h-32 object-cover rounded-lg border"
                  data-testid="img-captured-lead-photo"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemovePhoto}
                  data-testid="button-remove-photo"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg bg-muted/50">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <CameraCapture
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onCapture={handlePhotoCapture}
          />

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
