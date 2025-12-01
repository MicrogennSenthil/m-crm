import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Users, Package, Search, Shield, Key, UserCog, Building2 } from "lucide-react";
import type { Customer, Module, User, UserRole, UserRoleRight, Department } from "@shared/schema";

export default function Masters() {
  const [activeTab, setActiveTab] = useState("customers");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          Manage customers, modules, users, roles, and permissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="w-full flex-wrap gap-1">
          <TabsTrigger value="customers" data-testid="tab-customers" className="flex-1 sm:flex-none">
            <Users className="w-4 h-4 mr-2" />
            Customer Master
          </TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments" className="flex-1 sm:flex-none">
            <Building2 className="w-4 h-4 mr-2" />
            Department
          </TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-modules" className="flex-1 sm:flex-none">
            <Package className="w-4 h-4 mr-2" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users" className="flex-1 sm:flex-none">
            <UserCog className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles" className="flex-1 sm:flex-none">
            <Shield className="w-4 h-4 mr-2" />
            User Roles
          </TabsTrigger>
          <TabsTrigger value="rights" data-testid="tab-rights" className="flex-1 sm:flex-none">
            <Key className="w-4 h-4 mr-2" />
            Role Rights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>

        <TabsContent value="modules">
          <ModulesTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="roles">
          <UserRolesTab />
        </TabsContent>

        <TabsContent value="rights">
          <RoleRightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomersTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      return await apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsAddOpen(false);
      toast({ title: "Customer created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create customer", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Customer> }) => {
      return await apiRequest("PATCH", `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditingCustomer(null);
      toast({ title: "Customer updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update customer", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDeletingCustomer(null);
      toast({ title: "Customer deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete customer", variant: "destructive" });
    },
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Customer Master</CardTitle>
            <CardDescription>Manage customers and their contact information</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-customer" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <CustomerForm
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-customers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No customers found matching your search" : "No customers yet. Add your first customer."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">Industry</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{customer.contactPerson || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{customer.email || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{customer.phone || "-"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{customer.industry || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {customer.customerType || "prospect"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCustomer(customer)}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingCustomer(customer)}
                          data-testid={`button-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingCustomer && (
            <CustomerForm
              customer={editingCustomer}
              onSubmit={(data) => updateMutation.mutate({ id: editingCustomer.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCustomer?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CustomerForm({
  customer,
  onSubmit,
  isPending,
  onCancel,
}: {
  customer?: Customer;
  onSubmit: (data: Partial<Customer>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const { data: modulesList = [] } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    contactPerson: customer?.contactPerson || "",
    designation: customer?.designation || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    alternatePhone: customer?.alternatePhone || "",
    website: customer?.website || "",
    industry: customer?.industry || "",
    company: customer?.company || "",
    gstNumber: customer?.gstNumber || "",
    panNumber: customer?.panNumber || "",
    address: customer?.address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    country: customer?.country || "",
    pincode: customer?.pincode || "",
    status: customer?.status || "active",
    customerType: customer?.customerType || "prospect",
    selectedModules: customer?.selectedModules || [] as string[],
    notes: customer?.notes || "",
  });

  const handleModuleToggle = (moduleName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(moduleName)
        ? prev.selectedModules.filter(m => m !== moduleName)
        : [...prev.selectedModules, moduleName]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{customer ? "Edit Customer" : "Add Customer"}</DialogTitle>
        <DialogDescription>
          {customer ? "Update customer information" : "Add a new customer to the system"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Customer Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter customer/company name"
            data-testid="input-customer-name"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="Primary contact name"
              data-testid="input-customer-contact-person"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="Job title"
              data-testid="input-customer-designation"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="company@example.com"
              data-testid="input-customer-email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
              data-testid="input-customer-phone"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="alternatePhone">Alternate Phone</Label>
            <Input
              id="alternatePhone"
              value={formData.alternatePhone}
              onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
              placeholder="Secondary contact number"
              data-testid="input-customer-alternate-phone"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://www.example.com"
              data-testid="input-customer-website"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="industry">Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            >
              <SelectTrigger data-testid="select-customer-industry">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hospitality">Hospitality</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="finance">Finance & Banking</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
                <SelectItem value="logistics">Logistics</SelectItem>
                <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company">Parent Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="If subsidiary"
              data-testid="input-customer-parent-company"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="gstNumber">GST Number</Label>
            <Input
              id="gstNumber"
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5"
              data-testid="input-customer-gst"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="panNumber">PAN Number</Label>
            <Input
              id="panNumber"
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
              placeholder="AAAAA0000A"
              data-testid="input-customer-pan"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Street address, building, floor"
            rows={2}
            data-testid="input-customer-address"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
              data-testid="input-customer-city"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="State"
              data-testid="input-customer-state"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="Country"
              data-testid="input-customer-country"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              placeholder="PIN"
              data-testid="input-customer-pincode"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="customerType">Customer Type</Label>
            <Select
              value={formData.customerType}
              onValueChange={(value) => setFormData({ ...formData, customerType: value })}
            >
              <SelectTrigger data-testid="select-customer-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger data-testid="select-customer-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Interested Modules</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Select the modules this customer is interested in
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border rounded-md bg-muted/30">
            {modulesList.length > 0 ? (
              modulesList.map((module) => (
                <div key={module.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`module-${module.id}`}
                    checked={formData.selectedModules.includes(module.name)}
                    onCheckedChange={() => handleModuleToggle(module.name)}
                    data-testid={`checkbox-module-${module.id}`}
                  />
                  <Label 
                    htmlFor={`module-${module.id}`} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {module.name}
                  </Label>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground col-span-full">
                No modules available. Add modules in the Modules tab first.
              </p>
            )}
          </div>
          {formData.selectedModules.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.selectedModules.map((moduleName) => (
                <Badge key={moduleName} variant="secondary" className="text-xs">
                  {moduleName}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes about this company..."
            rows={3}
            data-testid="input-customer-notes"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !formData.name} data-testid="button-save-customer">
          {isPending ? "Saving..." : customer ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DepartmentsTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Department>) => {
      return await apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsAddOpen(false);
      toast({ title: "Department created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create department", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      return await apiRequest("PATCH", `/api/departments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditingDepartment(null);
      toast({ title: "Department updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update department", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeletingDepartment(null);
      toast({ title: "Department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete department. It may be assigned to users.", variant: "destructive" });
    },
  });

  const filteredDepartments = departments.filter(
    (dept) =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "-";
    const manager = users.find(u => u.id === managerId);
    return manager ? `${manager.firstName || ""} ${manager.lastName || ""}`.trim() || manager.email : "-";
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Department Master</CardTitle>
            <CardDescription>Manage organizational departments</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-department" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DepartmentForm
                users={users}
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-departments"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No departments found matching your search" : "No departments yet. Add your first department."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="hidden md:table-cell">Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.map((dept) => (
                  <TableRow key={dept.id} data-testid={`row-department-${dept.id}`}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-md truncate">
                      {dept.description || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {getManagerName(dept.managerId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.isActive ? "default" : "secondary"}>
                        {dept.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingDepartment(dept)}
                          data-testid={`button-edit-department-${dept.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingDepartment(dept)}
                          data-testid={`button-delete-department-${dept.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingDepartment} onOpenChange={() => setEditingDepartment(null)}>
        <DialogContent>
          {editingDepartment && (
            <DepartmentForm
              department={editingDepartment}
              users={users}
              onSubmit={(data) => updateMutation.mutate({ id: editingDepartment.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingDepartment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingDepartment} onOpenChange={() => setDeletingDepartment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDepartment?.name}"? This may affect users assigned to this department.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDepartment && deleteMutation.mutate(deletingDepartment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DepartmentForm({
  department,
  users,
  onSubmit,
  isPending,
  onCancel,
}: {
  department?: Department;
  users: User[];
  onSubmit: (data: Partial<Department>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: department?.name || "",
    description: department?.description || "",
    managerId: department?.managerId || "",
    isActive: department?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      managerId: formData.managerId || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle>
        <DialogDescription>
          {department ? "Update department information" : "Add a new department to the system"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Department Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter department name"
            data-testid="input-department-name"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter department description"
            rows={2}
            data-testid="input-department-description"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="managerId">Department Manager</Label>
          <Select
            value={formData.managerId || "_none"}
            onValueChange={(value) => setFormData({ ...formData, managerId: value === "_none" ? "" : value })}
          >
            <SelectTrigger data-testid="select-department-manager">
              <SelectValue placeholder="Select a manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No Manager</SelectItem>
              {users.filter(u => u.isActive).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
            data-testid="checkbox-department-active"
          />
          <Label htmlFor="isActive" className="font-normal">
            Department is active
          </Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !formData.name} data-testid="button-save-department">
          {isPending ? "Saving..." : department ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ModulesTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [deletingModule, setDeletingModule] = useState<Module | null>(null);

  const { data: modulesList = [], isLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Module>) => {
      return await apiRequest("POST", "/api/modules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      setIsAddOpen(false);
      toast({ title: "Module created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create module", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Module> }) => {
      return await apiRequest("PATCH", `/api/modules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      setEditingModule(null);
      toast({ title: "Module updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update module", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/modules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      setDeletingModule(null);
      toast({ title: "Module deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete module. It may be in use by projects.", variant: "destructive" });
    },
  });

  const filteredModules = modulesList.filter(
    (module) =>
      module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Modules</CardTitle>
            <CardDescription>Manage implementation modules</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-module" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <ModuleForm
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-modules"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No modules found matching your search" : "No modules yet. Add your first module."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModules.map((module) => (
                  <TableRow key={module.id} data-testid={`row-module-${module.id}`}>
                    <TableCell className="font-medium">{module.name}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-md truncate">
                      {module.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingModule(module)}
                          data-testid={`button-edit-module-${module.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingModule(module)}
                          data-testid={`button-delete-module-${module.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingModule} onOpenChange={() => setEditingModule(null)}>
        <DialogContent>
          {editingModule && (
            <ModuleForm
              module={editingModule}
              onSubmit={(data) => updateMutation.mutate({ id: editingModule.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingModule(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingModule} onOpenChange={() => setDeletingModule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingModule?.name}"? This may affect existing projects using this module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingModule && deleteMutation.mutate(deletingModule.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ModuleForm({
  module,
  onSubmit,
  isPending,
  onCancel,
}: {
  module?: Module;
  onSubmit: (data: Partial<Module>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: module?.name || "",
    description: module?.description || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{module ? "Edit Module" : "Add Module"}</DialogTitle>
        <DialogDescription>
          {module ? "Update module information" : "Add a new implementation module"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="module-name">Name *</Label>
          <Input
            id="module-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            data-testid="input-module-name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="module-description">Description</Label>
          <Textarea
            id="module-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            data-testid="input-module-description"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !formData.name} data-testid="button-save-module">
          {isPending ? "Saving..." : module ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// =============================================
// USERS TAB
// =============================================

function UsersTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: usersList = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  const { data: rolesList = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setIsAddOpen(false);
      toast({ title: "User created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create user", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setEditingUser(null);
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setDeletingUser(null);
      toast({ title: "User deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  const filteredUsers = usersList.filter(
    (user) =>
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleDisplayName = (roleName: string) => {
    const role = rolesList.find((r) => r.name === roleName);
    return role?.displayName || roleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "-";
    const dept = departmentsList.find(d => d.id === departmentId);
    return dept?.name || "-";
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Users</CardTitle>
            <CardDescription>Manage system users and their roles</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              {isAddOpen && (
                <UserForm
                  roles={rolesList}
                  departments={departmentsList}
                  onSubmit={(data) => createMutation.mutate(data)}
                  isPending={createMutation.isPending}
                  onCancel={() => setIsAddOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No users found matching your search" : "No users registered yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{user.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRoleDisplayName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getDepartmentName(user.departmentId)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingUser(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingUser(user)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          {editingUser && (
            <UserForm
              user={editingUser}
              roles={rolesList}
              departments={departmentsList}
              onSubmit={(data) => updateMutation.mutate({ id: editingUser.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingUser?.firstName} {deletingUser?.lastName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function UserForm({
  user,
  roles,
  departments,
  onSubmit,
  isPending,
  onCancel,
}: {
  user?: User;
  roles: UserRole[];
  departments: Department[];
  onSubmit: (data: Partial<User>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    id: user?.id || crypto.randomUUID(),
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    role: user?.role || "sales_executive",
    departmentId: user?.departmentId || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      departmentId: formData.departmentId || null,
    });
  };

  const isEditing = !!user;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit User" : "Add User"}</DialogTitle>
        <DialogDescription>
          {isEditing ? "Update user information and role assignment" : "Create a new user account"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-firstName">First Name *</Label>
            <Input
              id="user-firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              data-testid="input-user-firstname"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-lastName">Last Name *</Label>
            <Input
              id="user-lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              data-testid="input-user-lastname"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-email">Email *</Label>
          <Input
            id="user-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            data-testid="input-user-email"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger data-testid="select-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sales_executive">Sales Executive</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-department">Department</Label>
            <Select
              value={formData.departmentId || "_none"}
              onValueChange={(value) => setFormData({ ...formData, departmentId: value === "_none" ? "" : value })}
            >
              <SelectTrigger data-testid="select-user-department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No Department</SelectItem>
                {departments.filter(d => d.isActive).map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isPending || !formData.firstName || !formData.lastName || !formData.email} 
          data-testid="button-save-user"
        >
          {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// =============================================
// USER ROLES TAB
// =============================================

function UserRolesTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<UserRole | null>(null);

  const { data: rolesList = [], isLoading } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<UserRole>) => {
      return await apiRequest("POST", "/api/user-roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setIsAddOpen(false);
      toast({ title: "User role created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create user role", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserRole> }) => {
      return await apiRequest("PATCH", `/api/user-roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setEditingRole(null);
      toast({ title: "User role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user role", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/user-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setDeletingRole(null);
      toast({ title: "User role deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete user role. It may be in use.", variant: "destructive" });
    },
  });

  const filteredRoles = rolesList.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">User Roles</CardTitle>
            <CardDescription>Define roles and their access levels</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-role" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <UserRoleForm
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-roles"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No roles found matching your search" : "No roles defined yet. Add your first role."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                    <TableCell className="font-mono text-sm">{role.name}</TableCell>
                    <TableCell className="font-medium">{role.displayName}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-md truncate">
                      {role.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.isActive ? "default" : "secondary"}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRole(role)}
                          data-testid={`button-edit-role-${role.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingRole(role)}
                          data-testid={`button-delete-role-${role.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent>
          {editingRole && (
            <UserRoleForm
              role={editingRole}
              onSubmit={(data) => updateMutation.mutate({ id: editingRole.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingRole(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRole?.displayName}"? Users with this role may lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function UserRoleForm({
  role,
  onSubmit,
  isPending,
  onCancel,
}: {
  role?: UserRole;
  onSubmit: (data: Partial<UserRole>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: role?.name || "",
    displayName: role?.displayName || "",
    description: role?.description || "",
    isActive: role?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{role ? "Edit User Role" : "Add User Role"}</DialogTitle>
        <DialogDescription>
          {role ? "Update role information" : "Define a new user role for the system"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="role-name">Role Name (System ID) *</Label>
          <Input
            id="role-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
            placeholder="e.g., sales_manager"
            required
            data-testid="input-role-name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role-displayName">Display Name *</Label>
          <Input
            id="role-displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., Sales Manager"
            required
            data-testid="input-role-displayname"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role-description">Description</Label>
          <Textarea
            id="role-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the role's responsibilities"
            rows={3}
            data-testid="input-role-description"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="role-isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
            data-testid="checkbox-role-active"
          />
          <Label htmlFor="role-isActive">Active</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !formData.name || !formData.displayName} data-testid="button-save-role">
          {isPending ? "Saving..." : role ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// =============================================
// ROLE RIGHTS TAB
// =============================================

const AVAILABLE_MODULES = [
  "dashboard",
  "sales",
  "implementations",
  "support",
  "reports",
  "masters",
];

function RoleRightsTab() {
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRight, setEditingRight] = useState<UserRoleRight | null>(null);
  const [deletingRight, setDeletingRight] = useState<UserRoleRight | null>(null);

  const { data: rolesList = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
  });

  const { data: rightsList = [], isLoading } = useQuery<UserRoleRight[]>({
    queryKey: ["/api/user-role-rights", selectedRoleId],
    queryFn: async () => {
      const url = selectedRoleId && selectedRoleId !== "all"
        ? `/api/user-role-rights?roleId=${selectedRoleId}` 
        : "/api/user-role-rights";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch role rights");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<UserRoleRight>) => {
      return await apiRequest("POST", "/api/user-role-rights", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-role-rights"] });
      setIsAddOpen(false);
      toast({ title: "Role right created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create role right", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserRoleRight> }) => {
      return await apiRequest("PATCH", `/api/user-role-rights/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-role-rights"] });
      setEditingRight(null);
      toast({ title: "Role right updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role right", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/user-role-rights/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-role-rights"] });
      setDeletingRight(null);
      toast({ title: "Role right deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete role right", variant: "destructive" });
    },
  });

  const getRoleName = (roleId: string) => {
    const role = rolesList.find((r) => r.id === roleId);
    return role?.displayName || roleId;
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Role Rights</CardTitle>
            <CardDescription>Configure module permissions for each role</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-right" className="min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Permission
              </Button>
            </DialogTrigger>
            <DialogContent>
              <RoleRightForm
                roles={rolesList}
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mb-4">
          <Label className="mb-2 block">Filter by Role</Label>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger data-testid="select-filter-role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {rolesList.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rightsList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No permissions configured yet. Add permissions to define role access.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center">View</TableHead>
                  <TableHead className="text-center">Create</TableHead>
                  <TableHead className="text-center">Edit</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rightsList.map((right) => (
                  <TableRow key={right.id} data-testid={`row-right-${right.id}`}>
                    <TableCell className="font-medium">{getRoleName(right.roleId)}</TableCell>
                    <TableCell className="capitalize">{right.module}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={right.canView ? "default" : "secondary"} className="w-12">
                        {right.canView ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={right.canCreate ? "default" : "secondary"} className="w-12">
                        {right.canCreate ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={right.canEdit ? "default" : "secondary"} className="w-12">
                        {right.canEdit ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={right.canDelete ? "default" : "secondary"} className="w-12">
                        {right.canDelete ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRight(right)}
                          data-testid={`button-edit-right-${right.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingRight(right)}
                          data-testid={`button-delete-right-${right.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingRight} onOpenChange={() => setEditingRight(null)}>
        <DialogContent>
          {editingRight && (
            <RoleRightForm
              right={editingRight}
              roles={rolesList}
              onSubmit={(data) => updateMutation.mutate({ id: editingRight.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingRight(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRight} onOpenChange={() => setDeletingRight(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this permission? Users with this role may lose access to the module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRight && deleteMutation.mutate(deletingRight.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function RoleRightForm({
  right,
  roles,
  onSubmit,
  isPending,
  onCancel,
}: {
  right?: UserRoleRight;
  roles: UserRole[];
  onSubmit: (data: Partial<UserRoleRight>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    roleId: right?.roleId || "",
    module: right?.module || "",
    canView: right?.canView ?? true,
    canCreate: right?.canCreate ?? false,
    canEdit: right?.canEdit ?? false,
    canDelete: right?.canDelete ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{right ? "Edit Permission" : "Add Permission"}</DialogTitle>
        <DialogDescription>
          {right ? "Update role permission settings" : "Configure module permissions for a role"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="right-role">Role *</Label>
          <Select
            value={formData.roleId}
            onValueChange={(value) => setFormData({ ...formData, roleId: value })}
            disabled={!!right}
          >
            <SelectTrigger data-testid="select-right-role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="right-module">Module *</Label>
          <Select
            value={formData.module}
            onValueChange={(value) => setFormData({ ...formData, module: value })}
            disabled={!!right}
          >
            <SelectTrigger data-testid="select-right-module">
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODULES.map((mod) => (
                <SelectItem key={mod} value={mod}>
                  {mod.charAt(0).toUpperCase() + mod.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label>Permissions</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="right-canView"
                checked={formData.canView}
                onCheckedChange={(checked) => setFormData({ ...formData, canView: checked === true })}
                data-testid="checkbox-right-view"
              />
              <Label htmlFor="right-canView">Can View</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="right-canCreate"
                checked={formData.canCreate}
                onCheckedChange={(checked) => setFormData({ ...formData, canCreate: checked === true })}
                data-testid="checkbox-right-create"
              />
              <Label htmlFor="right-canCreate">Can Create</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="right-canEdit"
                checked={formData.canEdit}
                onCheckedChange={(checked) => setFormData({ ...formData, canEdit: checked === true })}
                data-testid="checkbox-right-edit"
              />
              <Label htmlFor="right-canEdit">Can Edit</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="right-canDelete"
                checked={formData.canDelete}
                onCheckedChange={(checked) => setFormData({ ...formData, canDelete: checked === true })}
                data-testid="checkbox-right-delete"
              />
              <Label htmlFor="right-canDelete">Can Delete</Label>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !formData.roleId || !formData.module} data-testid="button-save-right">
          {isPending ? "Saving..." : right ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
