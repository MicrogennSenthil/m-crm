import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, addMonths } from "date-fns";
import { Plus, Pencil, Trash2, Search, FileText, Mail, Calendar, DollarSign, Clock, AlertTriangle, CheckCircle, History, User, Users, Filter, X, ChevronDown, CalendarDays, BarChart3, Package, Percent } from "lucide-react";
import type { Customer, ContractType, CustomerContract } from "@shared/schema";

interface ContractWithDetails {
  contract: CustomerContract;
  customerName: string;
  customerCity?: string;
  customerModules?: string[];
  contractTypeName: string;
}

interface ModuleEntry {
  moduleName: string;
  orderValue: number;
  amcAmount: number;
  contractPeriodMonths: number;
}

interface MonthlyRenewal {
  month: string;
  monthDisplay: string;
  contractCount: number;
  totalValue: number;
  contracts: ContractWithDetails[];
}

interface TypeSummary {
  contractTypeId: string;
  contractTypeName: string;
  clientCount: number;
  contractCount: number;
  totalValue: number;
  activeCount: number;
  expiringCount: number;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "default" },
  { value: "expired", label: "Expired", color: "destructive" },
  { value: "cancelled", label: "Cancelled", color: "secondary" },
  { value: "pending_renewal", label: "Pending Renewal", color: "outline" },
];

const FOLLOWUP_TYPES = [
  { value: "reminder", label: "Reminder" },
  { value: "payment", label: "Payment" },
  { value: "renewal", label: "Renewal" },
];

const PAYMENT_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

export default function AccountsContracts() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("contracts");
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "monthly">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractWithDetails | null>(null);
  const [editingModules, setEditingModules] = useState<ModuleEntry[]>([]);
  const [deletingContract, setDeletingContract] = useState<ContractWithDetails | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractWithDetails | null>(null);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  
  // Advanced filter state
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/customer-contracts"],
  });

  const { data: expiringContracts = [] } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts/expiring"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: contractTypes = [] } = useQuery<ContractType[]>({
    queryKey: ["/api/contract-types"],
  });

  // New queries for summary and monthly data
  const { data: typeSummary = [] } = useQuery<TypeSummary[]>({
    queryKey: ["/api/contracts/type-summary"],
  });

  const { data: renewalsByMonth = [] } = useQuery<MonthlyRenewal[]>({
    queryKey: ["/api/contracts/renewals-by-month"],
  });

  // Extract unique cities from contracts for filter
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    contracts.forEach(c => {
      if (c.customerCity) cities.add(c.customerCity);
    });
    return Array.from(cities).sort();
  }, [contracts]);

  // Helper to invalidate all contract-related queries
  const invalidateContractQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/expiring"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/type-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/renewals-by-month"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<CustomerContract>) =>
      apiRequest("POST", "/api/customer-contracts", data),
    onSuccess: () => {
      invalidateContractQueries();
      toast({ title: "Contract created successfully" });
      setIsAddOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<CustomerContract> }) =>
      apiRequest("PATCH", `/api/customer-contracts/${data.id}`, data.updates),
    onSuccess: () => {
      invalidateContractQueries();
      toast({ title: "Contract updated successfully" });
      setEditingContract(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/customer-contracts/${id}`),
    onSuccess: () => {
      invalidateContractQueries();
      toast({ title: "Contract deleted successfully" });
      setDeletingContract(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendRenewalMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/customer-contracts/${id}/send-renewal`, {}),
    onSuccess: () => {
      toast({ title: "Renewal reminder sent successfully" });
      setViewingContract(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Function to open edit dialog and fetch modules
  const openEditContract = async (item: ContractWithDetails) => {
    setEditingContract(item);
    setEditingModules([]); // Reset while loading
    try {
      const response = await fetch(`/api/customer-contracts/${item.contract.id}/modules`);
      if (response.ok) {
        const modulesData = await response.json();
        const mappedModules: ModuleEntry[] = modulesData.map((m: any) => ({
          moduleName: m.moduleName,
          orderValue: m.orderValue || 0,
          amcAmount: m.amcAmount || 0,
          contractPeriodMonths: m.contractPeriodMonths || 12,
        }));
        setEditingModules(mappedModules);
      }
    } catch (error) {
      console.error("Failed to load contract modules:", error);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = (filterCity && filterCity !== "all") || (filterType && filterType !== "all") || filterDateFrom || filterDateTo;
  
  // Clear all filters helper
  const clearFilters = () => {
    setSearchTerm("");
    setFilterCity("all");
    setFilterType("all");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  const filteredContracts = contracts.filter(c => {
    // Text search across multiple fields
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      c.contract.contractNumber.toLowerCase().includes(searchLower) ||
      c.customerName?.toLowerCase().includes(searchLower) ||
      c.contractTypeName?.toLowerCase().includes(searchLower) ||
      c.customerCity?.toLowerCase().includes(searchLower) ||
      c.customerModules?.some(m => m.toLowerCase().includes(searchLower));
    
    // City filter
    const matchesCity = !filterCity || filterCity === "all" || c.customerCity?.toLowerCase() === filterCity.toLowerCase();
    
    // Contract type filter
    const matchesType = !filterType || filterType === "all" || c.contract.contractTypeId === filterType;
    
    // Date range filter (by end date / renewal date)
    const contractEndDate = new Date(c.contract.endDate);
    const matchesDateFrom = !filterDateFrom || contractEndDate >= filterDateFrom;
    const matchesDateTo = !filterDateTo || contractEndDate <= filterDateTo;
    
    // Tab filter
    let matchesTab = true;
    if (activeTab === "expiring") {
      const daysUntilExpiry = differenceInDays(contractEndDate, new Date());
      matchesTab = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    } else if (activeTab !== "all") {
      matchesTab = c.contract.status === activeTab;
    }
    
    return matchesSearch && matchesCity && matchesType && matchesDateFrom && matchesDateTo && matchesTab;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge variant={statusConfig?.color as any || "secondary"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getDaysUntilExpiry = (endDate: Date | string) => {
    const days = differenceInDays(new Date(endDate), new Date());
    if (days < 0) return <span className="text-destructive font-medium">Expired</span>;
    if (days <= 7) return <span className="text-destructive font-medium">{days} days</span>;
    if (days <= 30) return <span className="text-yellow-600 dark:text-yellow-400 font-medium">{days} days</span>;
    return <span className="text-muted-foreground">{days} days</span>;
  };

  if (contractsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Contract Management</h1>
          <p className="text-sm text-muted-foreground">
            Track customer contracts, renewals, and payment follow-ups
          </p>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="w-full sm:w-auto flex-wrap mb-4">
          <TabsTrigger value="contracts" data-testid="tab-main-contracts">Contracts</TabsTrigger>
          <TabsTrigger value="customer-master" data-testid="tab-main-customer-master">Customer Master</TabsTrigger>
          <TabsTrigger value="unallocated" data-testid="tab-main-unallocated">Unallocated Customers</TabsTrigger>
          <TabsTrigger value="monthly-reminders" data-testid="tab-main-monthly-reminders">Monthly Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4 sm:space-y-6">
          <div className="flex justify-end">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contract">
              <Plus className="w-4 h-4 mr-2" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Contract</DialogTitle>
              <DialogDescription>Add a new customer contract</DialogDescription>
            </DialogHeader>
            <ContractForm
              customers={customers}
              contractTypes={contractTypes}
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Contract Type Summary Cards */}
      {typeSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {typeSummary.map((summary) => (
            <Card 
              key={summary.contractTypeId} 
              className={`cursor-pointer hover-elevate transition-all ${
                filterType === summary.contractTypeId ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setFilterType(filterType === summary.contractTypeId ? "" : summary.contractTypeId)}
              data-testid={`card-summary-${summary.contractTypeId}`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium truncate">{summary.contractTypeName}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl sm:text-2xl font-bold">{summary.clientCount}</span>
                  <span className="text-xs text-muted-foreground">clients</span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{summary.activeCount} active</span>
                  {summary.expiringCount > 0 && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500 px-1.5 py-0">
                      {summary.expiringCount} expiring
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {expiringContracts.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <CardTitle className="text-base">Contracts Expiring Soon</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expiringContracts.slice(0, 5).map(c => (
                <Badge 
                  key={c.contract.id} 
                  variant="outline" 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setViewingContract(c)}
                >
                  {c.customerName} - {getDaysUntilExpiry(c.contract.endDate)}
                </Badge>
              ))}
              {expiringContracts.length > 5 && (
                <Badge variant="secondary">+{expiringContracts.length - 5} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified Search and Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by contract#, customer, city, type, modules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-contracts"
                />
              </div>
              
              {/* Filter Controls */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant={showFilters ? "secondary" : "outline"} 
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="default" className="ml-1 px-1.5 py-0 text-xs">
                      {[filterCity, filterType, filterDateFrom, filterDateTo].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
                
                {/* View Mode Toggle */}
                <div className="flex rounded-md border">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                  >
                    List
                  </Button>
                  <Button
                    variant={viewMode === "monthly" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewMode("monthly")}
                    data-testid="button-view-monthly"
                  >
                    <CalendarDays className="w-4 h-4 mr-1" />
                    Monthly
                  </Button>
                </div>
                
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            
            {/* Advanced Filters Row */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                {/* City Filter */}
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="w-40" data-testid="select-filter-city">
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {uniqueCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Contract Type Filter */}
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-44" data-testid="select-filter-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {contractTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Date From */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-36" data-testid="button-filter-date-from">
                      <Calendar className="w-4 h-4 mr-1" />
                      {filterDateFrom ? format(filterDateFrom, "MMM d, yyyy") : "From Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={setFilterDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Date To */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-36" data-testid="button-filter-date-to">
                      <Calendar className="w-4 h-4 mr-1" />
                      {filterDateTo ? format(filterDateTo, "MMM d, yyyy") : "To Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filterDateTo}
                      onSelect={setFilterDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <TabsList className="w-full sm:w-auto flex-wrap">
            <TabsTrigger value="all" data-testid="tab-contracts-all">All</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-contracts-active">Active</TabsTrigger>
            <TabsTrigger value="expiring" data-testid="tab-contracts-expiring">
              Expiring ({expiringContracts.length})
            </TabsTrigger>
            <TabsTrigger value="pending_renewal" data-testid="tab-contracts-pending">Pending Renewal</TabsTrigger>
            <TabsTrigger value="expired" data-testid="tab-contracts-expired">Expired</TabsTrigger>
          </TabsList>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Expires In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No contracts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContracts.map((item) => (
                        <TableRow 
                          key={item.contract.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setViewingContract(item)}
                          data-testid={`row-contract-${item.contract.id}`}
                        >
                          <TableCell className="font-mono text-sm">{item.contract.contractNumber}</TableCell>
                          <TableCell className="font-medium">{item.customerName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.customerCity || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.contractTypeName}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.contract.currency} {item.contract.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(item.contract.startDate), "MMM d, yyyy")} - {format(new Date(item.contract.endDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{getDaysUntilExpiry(item.contract.endDate)}</TableCell>
                          <TableCell>{getStatusBadge(item.contract.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditContract(item)}
                                data-testid={`button-edit-contract-${item.contract.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingContract(item)}
                                data-testid={`button-delete-contract-${item.contract.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Month-wise Renewal View */}
        {viewMode === "monthly" && (
          <div className="space-y-4">
            {renewalsByMonth.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming renewals found in the next 12 months</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" defaultValue={renewalsByMonth.slice(0, 3).map(m => m.month)} className="space-y-2">
                {renewalsByMonth.map((monthData) => (
                  <AccordionItem key={monthData.month} value={monthData.month} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid={`accordion-month-${monthData.month}`}>
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                            <CalendarDays className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <span className="font-semibold">{monthData.monthDisplay}</span>
                            <p className="text-sm text-muted-foreground">
                              {monthData.contractCount} contract{monthData.contractCount !== 1 ? 's' : ''} due for renewal
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary" className="font-mono">
                            {monthData.contracts[0]?.contract.currency || 'INR'} {monthData.totalValue.toLocaleString()}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 pb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>City</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Renewal Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthData.contracts.map((item) => (
                              <TableRow 
                                key={item.contract.id}
                                className="cursor-pointer hover-elevate"
                                onClick={() => setViewingContract(item)}
                                data-testid={`row-monthly-contract-${item.contract.id}`}
                              >
                                <TableCell className="font-medium">{item.customerName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.customerCity || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.contractTypeName}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.contract.currency} {item.contract.amount.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(item.contract.endDate), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{getStatusBadge(item.contract.status)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditContract(item)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeletingContract(item)}
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </Tabs>

      {/* View Contract Details Dialog */}
      <Dialog open={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingContract && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Contract {viewingContract.contract.contractNumber}
                </DialogTitle>
                <DialogDescription>
                  {viewingContract.customerName} - {viewingContract.contractTypeName}
                </DialogDescription>
              </DialogHeader>
              <ContractDetails 
                contract={viewingContract} 
                onSendRenewal={() => sendRenewalMutation.mutate(viewingContract.contract.id)}
                isSendingRenewal={sendRenewalMutation.isPending}
                onAddFollowup={() => setShowFollowupDialog(true)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Followup Dialog */}
      <Dialog open={showFollowupDialog} onOpenChange={setShowFollowupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Follow-up</DialogTitle>
            <DialogDescription>Record a payment, reminder, or renewal follow-up</DialogDescription>
          </DialogHeader>
          {viewingContract && (
            <FollowupForm
              contractId={viewingContract.contract.id}
              onSuccess={() => {
                setShowFollowupDialog(false);
                queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts", viewingContract.contract.id, "followups"] });
              }}
              onCancel={() => setShowFollowupDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingContract} onOpenChange={(open) => !open && setEditingContract(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>Update contract details</DialogDescription>
          </DialogHeader>
          {editingContract && (
            <ContractForm
              customers={customers}
              contractTypes={contractTypes}
              contract={editingContract.contract}
              existingModules={editingModules}
              onSubmit={(data) => updateMutation.mutate({ id: editingContract.contract.id, updates: data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingContract(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingContract} onOpenChange={(open) => !open && setDeletingContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contract "{deletingContract?.contract.contractNumber}" for {deletingContract?.customerName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContract && deleteMutation.mutate(deletingContract.contract.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-contract"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        <TabsContent value="customer-master" className="space-y-4">
          <CustomerMasterTab 
            customers={customers} 
            contractTypes={contractTypes}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="unallocated" className="space-y-4">
          <UnallocatedCustomersTab 
            toast={toast}
            onCreateContract={(customerId) => {
              setMainTab("contracts");
              setIsAddOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="monthly-reminders" className="space-y-4">
          <MonthlyRemindersTab 
            toast={toast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContractDetails({ 
  contract, 
  onSendRenewal,
  isSendingRenewal,
  onAddFollowup,
}: { 
  contract: ContractWithDetails;
  onSendRenewal: () => void;
  isSendingRenewal: boolean;
  onAddFollowup: () => void;
}) {
  const { data: followups = [] } = useQuery<any[]>({
    queryKey: ["/api/customer-contracts", contract.contract.id, "followups"],
  });

  const daysUntilExpiry = differenceInDays(new Date(contract.contract.endDate), new Date());
  const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry < 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Contract Value</p>
            <p className="text-lg font-bold">{contract.contract.currency} {contract.contract.amount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">End Date</p>
            <p className="text-lg font-bold">{format(new Date(contract.contract.endDate), "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
        <Card className={isExpired ? "border-destructive" : isExpiringSoon ? "border-yellow-500" : ""}>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Days Remaining</p>
            <p className={`text-lg font-bold ${isExpired ? "text-destructive" : isExpiringSoon ? "text-yellow-600" : ""}`}>
              {isExpired ? "Expired" : `${daysUntilExpiry} days`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              {STATUS_OPTIONS.find(s => s.value === contract.contract.status) && (
                <Badge variant={STATUS_OPTIONS.find(s => s.value === contract.contract.status)?.color as any}>
                  {STATUS_OPTIONS.find(s => s.value === contract.contract.status)?.label}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Contact Information</h3>
          <div className="space-y-2 text-sm">
            {contract.contract.contactPerson && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{contract.contract.contactPerson}</span>
              </div>
            )}
            {contract.contract.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{contract.contract.contactEmail}</span>
              </div>
            )}
            {contract.contract.contactPhone && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Phone:</span>
                <span>{contract.contract.contactPhone}</span>
              </div>
            )}
          </div>
          {contract.contract.notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{contract.contract.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Follow-up History</h3>
            <Button variant="outline" size="sm" onClick={onAddFollowup}>
              <Plus className="w-4 h-4 mr-1" />
              Log Follow-up
            </Button>
          </div>
          <ScrollArea className="h-48">
            {followups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups recorded</p>
            ) : (
              <div className="space-y-2">
                {followups.map((f: any) => (
                  <div key={f.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                    <History className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{f.followupType}</Badge>
                        {f.paymentAmount && (
                          <span className="text-xs font-medium">{contract.contract.currency} {f.paymentAmount.toLocaleString()}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">{f.notes}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(f.followupDate), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <DialogFooter className="flex gap-2">
        {contract.contract.contactEmail && (isExpiringSoon || isExpired) && (
          <Button 
            onClick={onSendRenewal}
            disabled={isSendingRenewal}
            data-testid="button-send-renewal"
          >
            <Mail className="w-4 h-4 mr-2" />
            {isSendingRenewal ? "Sending..." : "Send Renewal Reminder"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

function ContractForm({
  customers,
  contractTypes,
  contract,
  existingModules,
  onSubmit,
  isPending,
  onCancel,
}: {
  customers: Customer[];
  contractTypes: ContractType[];
  contract?: CustomerContract;
  existingModules?: ModuleEntry[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  // Fetch modules master for dropdown selection
  const { data: modulesMaster = [] } = useQuery<{ id: string; name: string; description?: string }[]>({
    queryKey: ['/api/modules'],
  });

  const selectedType = contractTypes.find(t => t.id === contract?.contractTypeId);
  const defaultDuration = selectedType?.defaultDurationMonths || 12;
  const defaultEndDate = addMonths(new Date(), defaultDuration);

  const [formData, setFormData] = useState({
    customerId: contract?.customerId || "",
    contractTypeId: contract?.contractTypeId || "",
    amount: contract?.amount || 0,
    currency: contract?.currency || "INR",
    startDate: contract?.startDate ? format(new Date(contract.startDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    endDate: contract?.endDate ? format(new Date(contract.endDate), "yyyy-MM-dd") : format(defaultEndDate, "yyyy-MM-dd"),
    contactPerson: contract?.contactPerson || "",
    contactEmail: contract?.contactEmail || "",
    contactPhone: contract?.contactPhone || "",
    status: contract?.status || "active",
    autoRenew: contract?.autoRenew || false,
    notes: contract?.notes || "",
    suggestionRequest: contract?.suggestionRequest || "",
  });

  const [modules, setModules] = useState<ModuleEntry[]>(existingModules || []);
  const [newModuleName, setNewModuleName] = useState("");
  const [selectedModulesToAdd, setSelectedModulesToAdd] = useState<string[]>([]);
  const [bulkOrderValue, setBulkOrderValue] = useState<number>(0);
  const [bulkAmcAmount, setBulkAmcAmount] = useState<number>(0);
  const [bulkContractPeriod, setBulkContractPeriod] = useState<number>(12);

  // Update modules when existingModules prop changes (after async fetch)
  useEffect(() => {
    if (existingModules && existingModules.length > 0) {
      setModules(existingModules);
    }
  }, [existingModules]);

  // Get current customer's available modules from sales
  const currentCustomer = customers.find(c => c.id === formData.customerId);
  const customerSalesModules = currentCustomer?.selectedModules || [];
  const hasModulesFromSales = customerSalesModules.length > 0;
  
  // Get modules that haven't been added yet (for dropdown)
  const availableModulesToAdd = customerSalesModules.filter(
    mod => !modules.some(m => m.moduleName.toLowerCase() === mod.toLowerCase())
  );

  // When customer changes, clear modules and reset selection
  const handleCustomerChange = (customerId: string) => {
    setFormData({ ...formData, customerId });
    setModules([]); // Clear modules when customer changes
    setSelectedModulesToAdd([]);
    setNewModuleName("");
    setBulkOrderValue(0);
    setBulkAmcAmount(0);
    setBulkContractPeriod(12);
  };

  // Toggle module selection for multi-select
  const toggleModuleSelection = (moduleName: string) => {
    setSelectedModulesToAdd(prev => 
      prev.includes(moduleName) 
        ? prev.filter(m => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleContractTypeChange = (typeId: string) => {
    const type = contractTypes.find(t => t.id === typeId);
    if (type && !contract) {
      const newEndDate = addMonths(new Date(formData.startDate), type.defaultDurationMonths || 12);
      setFormData({ 
        ...formData, 
        contractTypeId: typeId,
        endDate: format(newEndDate, "yyyy-MM-dd"),
      });
    } else {
      setFormData({ ...formData, contractTypeId: typeId });
    }
  };

  // Add multiple modules from selection (with same financial details)
  const addSelectedModules = () => {
    if (selectedModulesToAdd.length > 0) {
      const newModules = selectedModulesToAdd
        .filter(mod => !modules.some(m => m.moduleName.toLowerCase() === mod.toLowerCase()))
        .map(mod => ({
          moduleName: mod,
          orderValue: bulkOrderValue,
          amcAmount: bulkAmcAmount,
          contractPeriodMonths: bulkContractPeriod,
        }));
      setModules([...modules, ...newModules]);
      setSelectedModulesToAdd([]);
      setBulkOrderValue(0);
      setBulkAmcAmount(0);
      setBulkContractPeriod(12);
    }
  };

  // Add module from manual entry (when no sales modules available)
  const addModuleManual = () => {
    if (newModuleName.trim() && !modules.some(m => m.moduleName.toLowerCase() === newModuleName.trim().toLowerCase())) {
      setModules([...modules, {
        moduleName: newModuleName.trim(),
        orderValue: 0,
        amcAmount: 0,
        contractPeriodMonths: 12,
      }]);
      setNewModuleName("");
    }
  };

  const removeModule = (index: number) => {
    setModules(modules.filter((_, i) => i !== index));
  };

  const updateModule = (index: number, field: keyof ModuleEntry, value: string | number) => {
    const updated = [...modules];
    if (field === 'moduleName') {
      updated[index][field] = value as string;
    } else if (field === 'contractPeriodMonths') {
      updated[index][field] = parseInt(value as string) || 12;
    } else {
      // Use parseFloat for financial fields (orderValue, amcAmount)
      updated[index][field] = parseFloat(value as string) || 0;
    }
    setModules(updated);
  };

  // Calculate totals
  const totalOrderValue = modules.reduce((sum, m) => sum + (m.orderValue || 0), 0);
  const totalAmcAmount = modules.reduce((sum, m) => sum + (m.amcAmount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: totalAmcAmount || formData.amount, // Use total AMC if modules exist
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      modules: modules.length > 0 ? modules : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Customer *</Label>
            <Select
              value={formData.customerId}
              onValueChange={handleCustomerChange}
            >
              <SelectTrigger data-testid="select-contract-customer">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Contract Type *</Label>
            <Select
              value={formData.contractTypeId}
              onValueChange={handleContractTypeChange}
            >
              <SelectTrigger data-testid="select-contract-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {contractTypes.filter(t => t.isActive).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Module-wise AMC, Order Value, Contract Period */}
        <div className="border rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Modules</Label>
            <span className="text-xs text-muted-foreground">
              {modules.length > 0 ? `${modules.length} module(s) added` : "Add modules with individual financials"}
            </span>
          </div>
          
          {/* Add modules from sales (if customer has purchased modules) */}
          {hasModulesFromSales && availableModulesToAdd.length > 0 && (
            <div className="space-y-3">
              <div className="border rounded-md p-2 space-y-2 max-h-32 overflow-y-auto">
                <div className="text-xs text-muted-foreground mb-1">Add from purchased modules:</div>
                <div className="flex flex-wrap gap-2">
                  {availableModulesToAdd.map((mod) => (
                    <label 
                      key={mod} 
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer text-sm transition-colors ${
                        selectedModulesToAdd.includes(mod) 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModulesToAdd.includes(mod)}
                        onChange={() => toggleModuleSelection(mod)}
                        className="w-3.5 h-3.5"
                        data-testid={`checkbox-module-${mod}`}
                      />
                      {mod}
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Bulk financial inputs - shown when modules are selected */}
              {selectedModulesToAdd.length > 0 && (
                <div className="bg-muted/50 rounded-md p-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Set values for {selectedModulesToAdd.length} selected module{selectedModulesToAdd.length > 1 ? 's' : ''}:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Order Value (each)</Label>
                      <Input
                        type="number"
                        value={bulkOrderValue}
                        onChange={(e) => setBulkOrderValue(parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="0"
                        data-testid="input-bulk-order-value"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">AMC Amount (each)</Label>
                      <Input
                        type="number"
                        value={bulkAmcAmount}
                        onChange={(e) => setBulkAmcAmount(parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="0"
                        data-testid="input-bulk-amc-amount"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Period (months)</Label>
                      <Input
                        type="number"
                        value={bulkContractPeriod}
                        onChange={(e) => setBulkContractPeriod(parseInt(e.target.value) || 12)}
                        className="h-8 text-sm"
                        placeholder="12"
                        data-testid="input-bulk-contract-period"
                      />
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={addSelectedModules}
                    className="w-full mt-2"
                    data-testid="button-add-selected-modules"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add {selectedModulesToAdd.length} Module{selectedModulesToAdd.length > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Module selection from master - always available */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {hasModulesFromSales ? "Or add from modules master:" : "Select module from master:"}
            </div>
            <div className="flex gap-2">
              <Select
                value={newModuleName}
                onValueChange={setNewModuleName}
              >
                <SelectTrigger className="flex-1" data-testid="select-new-module">
                  <SelectValue placeholder="Select a module" />
                </SelectTrigger>
                <SelectContent>
                  {modulesMaster
                    .filter(m => !modules.some(mod => mod.moduleName.toLowerCase() === m.name.toLowerCase()))
                    .map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                size="sm" 
                variant="outline" 
                onClick={addModuleManual} 
                disabled={!newModuleName || modules.some(m => m.moduleName.toLowerCase() === newModuleName.toLowerCase())}
                data-testid="button-add-module"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {/* Duplicate warning */}
            {newModuleName && modules.some(m => m.moduleName.toLowerCase() === newModuleName.toLowerCase()) && (
              <p className="text-xs text-destructive">This module has already been added</p>
            )}
          </div>

          {/* Module list */}
          {modules.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-3">Module</div>
                <div className="col-span-3">Order Value</div>
                <div className="col-span-3">AMC Amount</div>
                <div className="col-span-2">Period (Months)</div>
                <div className="col-span-1"></div>
              </div>
              {modules.map((mod, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Select
                      value={mod.moduleName}
                      onValueChange={(value) => updateModule(index, 'moduleName', value)}
                    >
                      <SelectTrigger className="text-sm h-8" data-testid={`select-module-name-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Show current module plus available ones */}
                        <SelectItem value={mod.moduleName}>{mod.moduleName}</SelectItem>
                        {modulesMaster
                          .filter(m => m.name !== mod.moduleName && !modules.some(existing => existing.moduleName === m.name))
                          .map((m) => (
                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={mod.orderValue}
                      onChange={(e) => updateModule(index, 'orderValue', e.target.value)}
                      className="text-sm h-8"
                      placeholder="0"
                      data-testid={`input-module-order-value-${index}`}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={mod.amcAmount}
                      onChange={(e) => updateModule(index, 'amcAmount', e.target.value)}
                      className="text-sm h-8"
                      placeholder="0"
                      data-testid={`input-module-amc-amount-${index}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={mod.contractPeriodMonths}
                      onChange={(e) => updateModule(index, 'contractPeriodMonths', e.target.value)}
                      className="text-sm h-8"
                      placeholder="12"
                      data-testid={`input-module-period-${index}`}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => removeModule(index)}
                      data-testid={`button-remove-module-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Totals row */}
              <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t text-sm font-medium">
                <div className="col-span-3 text-right pr-2">Totals:</div>
                <div className="col-span-3">
                  <span className="text-primary">{formData.currency} {totalOrderValue.toLocaleString()}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-primary">{formData.currency} {totalAmcAmount.toLocaleString()}</span>
                </div>
                <div className="col-span-3"></div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Total AMC Amount {modules.length > 0 ? "(Auto-calculated)" : "*"}</Label>
            <Input
              type="number"
              value={modules.length > 0 ? totalAmcAmount : formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              disabled={modules.length > 0}
              required={modules.length === 0}
              data-testid="input-contract-amount"
            />
          </div>
          <div className="grid gap-2">
            <Label>Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger data-testid="select-contract-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
              data-testid="input-contract-start-date"
            />
          </div>
          <div className="grid gap-2">
            <Label>End Date *</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
              data-testid="input-contract-end-date"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Contact Person</Label>
            <Input
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              data-testid="input-contract-contact-person"
            />
          </div>
          <div className="grid gap-2">
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              data-testid="input-contract-contact-email"
            />
          </div>
          <div className="grid gap-2">
            <Label>Contact Phone</Label>
            <Input
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              data-testid="input-contract-contact-phone"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            data-testid="input-contract-notes"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="autoRenew"
            checked={formData.autoRenew}
            onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked === true })}
          />
          <Label htmlFor="autoRenew">Auto-renew contract</Label>
        </div>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          type="submit" 
          disabled={isPending || !formData.customerId || !formData.contractTypeId || !formData.amount}
          data-testid="button-save-contract"
        >
          {isPending ? "Saving..." : contract ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FollowupForm({
  contractId,
  onSuccess,
  onCancel,
}: {
  contractId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    followupType: "reminder",
    followupDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: "",
    paymentStatus: "",
    paymentAmount: 0,
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    nextFollowupDate: "",
  });

  const createFollowupMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/customer-contracts/${contractId}/followups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts", contractId, "followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
      toast({ title: "Follow-up logged successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      followupDate: new Date(formData.followupDate),
      paymentDate: formData.paymentStatus === "paid" ? new Date(formData.paymentDate) : null,
      paymentAmount: formData.paymentStatus ? formData.paymentAmount : null,
      nextFollowupDate: formData.nextFollowupDate ? new Date(formData.nextFollowupDate) : null,
    };
    createFollowupMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Follow-up Type *</Label>
          <Select
            value={formData.followupType}
            onValueChange={(value) => setFormData({ ...formData, followupType: value })}
          >
            <SelectTrigger data-testid="select-followup-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOWUP_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.followupType === "payment" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Payment Status</Label>
                <Select
                  value={formData.paymentStatus}
                  onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Payment Amount</Label>
                <Input
                  type="number"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add notes about this follow-up..."
            data-testid="input-followup-notes"
          />
        </div>

        <div className="grid gap-2">
          <Label>Next Follow-up Date</Label>
          <Input
            type="date"
            value={formData.nextFollowupDate}
            onChange={(e) => setFormData({ ...formData, nextFollowupDate: e.target.value })}
          />
        </div>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={createFollowupMutation.isPending} data-testid="button-save-followup">
          {createFollowupMutation.isPending ? "Saving..." : "Log Follow-up"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ================== CUSTOMER MASTER TAB ==================

interface CustomerMasterItem {
  id: string;
  name: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  status: string;
  customerType: string;
  contractTypeId: string | null;
  contractTypeName: string | null;
  selectedModules: string[] | null;
  activeContractsCount: number;
  totalContractValue: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ContractTypeChangeLog {
  id: string;
  customerId: string;
  previousContractTypeId: string | null;
  newContractTypeId: string | null;
  previousContractTypeName: string | null;
  newContractTypeName: string | null;
  reason: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedByEmail: string | null;
  changedAt: Date;
}

interface ModuleContract {
  contract: {
    id: string;
    customerId: string;
    moduleId: string | null;
    moduleName: string;
    orderDate: Date;
    orderValue: number;
    currency: string;
    amcCalculationType: string;
    amcPercentage: number | null;
    amcAmount: number;
    gstPercentage: number;
    gstAmount: number;
    totalAmcWithGst: number;
    contractStartDate: Date;
    contractEndDate: Date;
    status: string;
    renewalReminderDays: number;
    notes: string | null;
  };
  moduleName: string;
}

function CustomerMasterTab({ 
  customers: _, 
  contractTypes,
  toast,
}: { 
  customers: Customer[];
  contractTypes: ContractType[];
  toast: any;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterContractType, setFilterContractType] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<CustomerMasterItem | null>(null);
  const [viewingHistory, setViewingHistory] = useState<CustomerMasterItem | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [newContractTypeId, setNewContractTypeId] = useState("");
  
  // Module contracts state
  const [viewingModules, setViewingModules] = useState<CustomerMasterItem | null>(null);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [editingModuleContract, setEditingModuleContract] = useState<ModuleContract | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    moduleId: "",
    moduleName: "",
    orderDate: new Date().toISOString().split("T")[0],
    orderValue: 0,
    currency: "INR",
    amcCalculationType: "percentage" as "percentage" | "fixed",
    amcPercentage: 18,
    amcAmount: 0,
    gstPercentage: 18,
    contractStartDate: new Date().toISOString().split("T")[0],
    contractEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    renewalReminderDays: 30,
    notes: "",
  });

  const { data: customerMaster = [], isLoading } = useQuery<CustomerMasterItem[]>({
    queryKey: ["/api/accounts/customer-master", { search: searchTerm, city: filterCity, contractTypeId: filterContractType }],
    staleTime: 0,
  });

  const { data: cities = [] } = useQuery<string[]>({
    queryKey: ["/api/accounts/customer-master/cities"],
  });

  const { data: changeHistory = [] } = useQuery<ContractTypeChangeLog[]>({
    queryKey: ["/api/accounts/customer-master", viewingHistory?.id, "contract-type-history"],
    enabled: !!viewingHistory,
  });

  // Module contracts queries and mutations
  const { data: moduleContracts = [], isLoading: modulesLoading } = useQuery<ModuleContract[]>({
    queryKey: ["/api/accounts/customer-master", viewingModules?.id, "module-contracts"],
    enabled: !!viewingModules,
    staleTime: 0,
  });

  const { data: availableModules = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/accounts/available-modules"],
    enabled: isAddModuleOpen || !!editingModuleContract,
  });

  const createModuleContractMutation = useMutation({
    mutationFn: async (data: typeof moduleFormData & { customerId: string }) => {
      const res = await apiRequest("POST", `/api/accounts/customer-master/${data.customerId}/module-contracts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/customer-master", viewingModules?.id, "module-contracts"] });
      toast({ title: "Module contract created successfully" });
      setIsAddModuleOpen(false);
      resetModuleForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateModuleContractMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/module-contracts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/customer-master", viewingModules?.id, "module-contracts"] });
      toast({ title: "Module contract updated successfully" });
      setEditingModuleContract(null);
      resetModuleForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteModuleContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/accounts/module-contracts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/customer-master", viewingModules?.id, "module-contracts"] });
      toast({ title: "Module contract deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetModuleForm = () => {
    setModuleFormData({
      moduleId: "",
      moduleName: "",
      orderDate: new Date().toISOString().split("T")[0],
      orderValue: 0,
      currency: "INR",
      amcCalculationType: "percentage",
      amcPercentage: 18,
      amcAmount: 0,
      gstPercentage: 18,
      contractStartDate: new Date().toISOString().split("T")[0],
      contractEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
      renewalReminderDays: 30,
      notes: "",
    });
  };

  const calculateAmcAmount = () => {
    if (moduleFormData.amcCalculationType === "percentage") {
      return Math.round((moduleFormData.orderValue * (moduleFormData.amcPercentage || 0)) / 100);
    }
    return moduleFormData.amcAmount;
  };

  const handleModuleSelect = (moduleId: string) => {
    const module = availableModules.find(m => m.id === moduleId);
    setModuleFormData(prev => ({
      ...prev,
      moduleId,
      moduleName: module?.name || prev.moduleName,
    }));
  };

  const handleSaveModuleContract = () => {
    const amcAmount = calculateAmcAmount();
    const data = {
      ...moduleFormData,
      amcAmount,
      customerId: viewingModules?.id || "",
    };
    
    if (editingModuleContract) {
      updateModuleContractMutation.mutate({ id: editingModuleContract.contract.id, data });
    } else {
      createModuleContractMutation.mutate(data);
    }
  };

  const handleEditModuleContract = (contract: ModuleContract) => {
    setEditingModuleContract(contract);
    setModuleFormData({
      moduleId: contract.contract.moduleId || "",
      moduleName: contract.contract.moduleName,
      orderDate: new Date(contract.contract.orderDate).toISOString().split("T")[0],
      orderValue: contract.contract.orderValue,
      currency: contract.contract.currency,
      amcCalculationType: contract.contract.amcCalculationType as "percentage" | "fixed",
      amcPercentage: contract.contract.amcPercentage || 18,
      amcAmount: contract.contract.amcAmount,
      gstPercentage: contract.contract.gstPercentage,
      contractStartDate: new Date(contract.contract.contractStartDate).toISOString().split("T")[0],
      contractEndDate: new Date(contract.contract.contractEndDate).toISOString().split("T")[0],
      renewalReminderDays: contract.contract.renewalReminderDays,
      notes: contract.contract.notes || "",
    });
  };

  const updateContractTypeMutation = useMutation({
    mutationFn: async ({ customerId, contractTypeId, reason }: { customerId: string; contractTypeId: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/accounts/customer-master/${customerId}/contract-type`, { contractTypeId, reason });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/customer-master"] });
      toast({
        title: "Contract type updated",
        description: `Changed from "${data.previousType || 'None'}" to "${data.newType || 'None'}"`,
      });
      setEditingCustomer(null);
      setChangeReason("");
      setNewContractTypeId("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateContractType = () => {
    if (!editingCustomer || !newContractTypeId) return;
    updateContractTypeMutation.mutate({
      customerId: editingCustomer.id,
      contractTypeId: newContractTypeId,
      reason: changeReason,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customer Master
          </CardTitle>
          <CardDescription>View and manage customer contract types with full audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-customer-master"
              />
            </div>
            <Select value={filterCity || "all"} onValueChange={(v) => setFilterCity(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-city">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterContractType || "all"} onValueChange={(v) => setFilterContractType(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-contract-type">
                <SelectValue placeholder="All Contract Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contract Types</SelectItem>
                {contractTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Active Contracts</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerMaster.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customerMaster.map((customer) => (
                    <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.contactPerson}</p>
                        </div>
                      </TableCell>
                      <TableCell>{customer.city || "-"}</TableCell>
                      <TableCell>
                        {customer.contractTypeName ? (
                          <Badge variant="outline">{customer.contractTypeName}</Badge>
                        ) : (
                          <Badge variant="secondary">Not Set</Badge>
                        )}
                      </TableCell>
                      <TableCell>{customer.activeContractsCount}</TableCell>
                      <TableCell className="text-right">
                        INR {customer.totalContractValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingModules(customer)}
                            title="View Module Contracts"
                            data-testid={`button-view-modules-${customer.id}`}
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingCustomer(customer);
                              setNewContractTypeId(customer.contractTypeId || "");
                            }}
                            data-testid={`button-edit-contract-type-${customer.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingHistory(customer)}
                            data-testid={`button-view-history-${customer.id}`}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Contract Type Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Contract Type</DialogTitle>
            <DialogDescription>
              Update contract type for {editingCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Current Contract Type</Label>
              <Badge variant="outline" className="w-fit">
                {editingCustomer?.contractTypeName || "Not Set"}
              </Badge>
            </div>
            <div className="grid gap-2">
              <Label>New Contract Type *</Label>
              <Select value={newContractTypeId} onValueChange={setNewContractTypeId}>
                <SelectTrigger data-testid="select-new-contract-type">
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reason for Change</Label>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Enter reason for contract type change..."
                data-testid="input-change-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
            <Button 
              onClick={handleUpdateContractType}
              disabled={!newContractTypeId || updateContractTypeMutation.isPending}
              data-testid="button-save-contract-type"
            >
              {updateContractTypeMutation.isPending ? "Saving..." : "Update Contract Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View History Dialog */}
      <Dialog open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract Type Change History</DialogTitle>
            <DialogDescription>
              Audit trail for {viewingHistory?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {changeHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No change history found</p>
            ) : (
              <div className="space-y-4">
                {changeHistory.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{log.previousContractTypeName || "None"}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge>{log.newContractTypeName || "None"}</Badge>
                          </div>
                          {log.reason && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Reason: {log.reason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Changed by {log.changedByName || log.changedByEmail} on {format(new Date(log.changedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingHistory(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Module Contracts Dialog */}
      <Dialog open={!!viewingModules} onOpenChange={(open) => {
        if (!open) {
          setViewingModules(null);
          setIsAddModuleOpen(false);
          setEditingModuleContract(null);
          resetModuleForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Module Contracts - {viewingModules?.name}
            </DialogTitle>
            <DialogDescription>
              Manage individual module purchases, AMC calculations, and contract periods
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add Module Contract Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  resetModuleForm();
                  setIsAddModuleOpen(true);
                }}
                data-testid="button-add-module-contract"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Module Contract
              </Button>
            </div>

            {/* Module Contracts List */}
            <ScrollArea className="max-h-[400px]">
              {modulesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : moduleContracts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No module contracts found. Click "Add Module Contract" to create one.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {moduleContracts.map((mc) => {
                    const daysUntilExpiry = differenceInDays(new Date(mc.contract.contractEndDate), new Date());
                    const isExpiring = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                    const isExpired = daysUntilExpiry < 0;
                    
                    return (
                      <Card key={mc.contract.id} className={isExpired ? "border-destructive" : isExpiring ? "border-yellow-500" : ""}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{mc.moduleName}</h4>
                                <Badge variant={mc.contract.status === "active" ? "default" : "secondary"}>
                                  {mc.contract.status}
                                </Badge>
                                {isExpired && <Badge variant="destructive">Expired</Badge>}
                                {isExpiring && <Badge variant="outline" className="border-yellow-500 text-yellow-600">Expiring Soon</Badge>}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Order Value</p>
                                  <p className="font-medium">{mc.contract.currency} {mc.contract.orderValue.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">AMC ({mc.contract.amcCalculationType === "percentage" ? `${mc.contract.amcPercentage}%` : "Fixed"})</p>
                                  <p className="font-medium">{mc.contract.currency} {mc.contract.amcAmount.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">AMC + GST ({mc.contract.gstPercentage}%)</p>
                                  <p className="font-medium">{mc.contract.currency} {mc.contract.totalAmcWithGst.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Contract Period</p>
                                  <p className="font-medium">
                                    {format(new Date(mc.contract.contractStartDate), "MMM d, yyyy")} - {format(new Date(mc.contract.contractEndDate), "MMM d, yyyy")}
                                  </p>
                                </div>
                              </div>
                              {mc.contract.notes && (
                                <p className="text-sm text-muted-foreground mt-2">Notes: {mc.contract.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditModuleContract(mc)}
                                data-testid={`button-edit-module-${mc.contract.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteModuleContractMutation.mutate(mc.contract.id)}
                                data-testid={`button-delete-module-${mc.contract.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingModules(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Module Contract Dialog */}
      <Dialog open={isAddModuleOpen || !!editingModuleContract} onOpenChange={(open) => {
        if (!open) {
          setIsAddModuleOpen(false);
          setEditingModuleContract(null);
          resetModuleForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModuleContract ? "Edit Module Contract" : "Add Module Contract"}
            </DialogTitle>
            <DialogDescription>
              {editingModuleContract ? "Update module contract details" : "Create a new module contract for this customer"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Module *</Label>
                <Select 
                  value={moduleFormData.moduleId || "custom"} 
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setModuleFormData(prev => ({ ...prev, moduleId: "", moduleName: "" }));
                    } else {
                      handleModuleSelect(v);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-module">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Module</SelectItem>
                    {availableModules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Module Name *</Label>
                <Input
                  value={moduleFormData.moduleName}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, moduleName: e.target.value }))}
                  placeholder="Enter module name"
                  data-testid="input-module-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Order Date *</Label>
                <Input
                  type="date"
                  value={moduleFormData.orderDate}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                  data-testid="input-order-date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Order Value *</Label>
                <Input
                  type="number"
                  value={moduleFormData.orderValue}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, orderValue: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  data-testid="input-order-value"
                />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={moduleFormData.currency} onValueChange={(v) => setModuleFormData(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger data-testid="select-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>AMC Calculation</Label>
                <Select 
                  value={moduleFormData.amcCalculationType} 
                  onValueChange={(v: "percentage" | "fixed") => setModuleFormData(prev => ({ ...prev, amcCalculationType: v }))}
                >
                  <SelectTrigger data-testid="select-amc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage of Order Value</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {moduleFormData.amcCalculationType === "percentage" ? (
                <div className="grid gap-2">
                  <Label>AMC Percentage (%)</Label>
                  <Input
                    type="number"
                    value={moduleFormData.amcPercentage}
                    onChange={(e) => setModuleFormData(prev => ({ ...prev, amcPercentage: parseFloat(e.target.value) || 0 }))}
                    placeholder="18"
                    data-testid="input-amc-percentage"
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>AMC Amount</Label>
                  <Input
                    type="number"
                    value={moduleFormData.amcAmount}
                    onChange={(e) => setModuleFormData(prev => ({ ...prev, amcAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    data-testid="input-amc-amount"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label>GST (%)</Label>
                <Input
                  type="number"
                  value={moduleFormData.gstPercentage}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, gstPercentage: parseFloat(e.target.value) || 0 }))}
                  placeholder="18"
                  data-testid="input-gst-percentage"
                />
              </div>
            </div>

            {/* AMC Preview */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">AMC Calculation Preview</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Base AMC</p>
                    <p className="font-medium">{moduleFormData.currency} {calculateAmcAmount().toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GST ({moduleFormData.gstPercentage}%)</p>
                    <p className="font-medium">{moduleFormData.currency} {Math.round((calculateAmcAmount() * moduleFormData.gstPercentage) / 100).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total AMC with GST</p>
                    <p className="font-bold text-primary">
                      {moduleFormData.currency} {(calculateAmcAmount() + Math.round((calculateAmcAmount() * moduleFormData.gstPercentage) / 100)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contract Start Date *</Label>
                <Input
                  type="date"
                  value={moduleFormData.contractStartDate}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, contractStartDate: e.target.value }))}
                  data-testid="input-contract-start"
                />
              </div>
              <div className="grid gap-2">
                <Label>Contract End Date *</Label>
                <Input
                  type="date"
                  value={moduleFormData.contractEndDate}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, contractEndDate: e.target.value }))}
                  data-testid="input-contract-end"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Renewal Reminder (days before expiry)</Label>
              <Input
                type="number"
                value={moduleFormData.renewalReminderDays}
                onChange={(e) => setModuleFormData(prev => ({ ...prev, renewalReminderDays: parseInt(e.target.value) || 30 }))}
                placeholder="30"
                data-testid="input-reminder-days"
              />
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={moduleFormData.notes}
                onChange={(e) => setModuleFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this module contract..."
                data-testid="input-module-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddModuleOpen(false);
              setEditingModuleContract(null);
              resetModuleForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveModuleContract}
              disabled={
                !moduleFormData.moduleName || 
                !moduleFormData.orderValue ||
                createModuleContractMutation.isPending || 
                updateModuleContractMutation.isPending
              }
              data-testid="button-save-module-contract"
            >
              {(createModuleContractMutation.isPending || updateModuleContractMutation.isPending) 
                ? "Saving..." 
                : editingModuleContract ? "Update Contract" : "Create Contract"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================== UNALLOCATED CUSTOMERS TAB ==================

interface UnallocatedCustomer {
  id: string;
  name: string;
  contactPerson: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string;
  status: string;
  customerType: string;
  contractTypeId: string | null;
  contractTypeName: string | null;
  selectedModules: string[] | null;
  createdAt: Date;
  updatedAt: Date | null;
}

function UnallocatedCustomersTab({ 
  toast,
  onCreateContract,
}: { 
  toast: any;
  onCreateContract: (customerId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  const { data: unallocatedCustomers = [], isLoading } = useQuery<UnallocatedCustomer[]>({
    queryKey: ["/api/accounts/unallocated-customers", { search: searchQuery, city: selectedCity === "all" ? "" : selectedCity }],
    staleTime: 0,
  });

  const { data: cities = [] } = useQuery<string[]>({
    queryKey: ["/api/accounts/customer-master/cities"],
  });

  const debouncedSearch = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setSearchQuery(value), 300);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Unallocated Customers</h2>
          <p className="text-sm text-muted-foreground">
            Customers without any active contracts
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {unallocatedCustomers.length} customers
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, city, email..."
                className="pl-10"
                onChange={(e) => debouncedSearch(e.target.value)}
                data-testid="input-search-unallocated"
              />
            </div>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-city-unallocated">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : unallocatedCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium mb-2">All Customers Allocated</h3>
            <p className="text-muted-foreground">
              All active customers have contracts assigned.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">City</TableHead>
                <TableHead className="hidden lg:table-cell">Phone / Email</TableHead>
                <TableHead className="hidden xl:table-cell">Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unallocatedCustomers.map((customer) => (
                <TableRow key={customer.id} data-testid={`row-unallocated-${customer.id}`}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">
                      {customer.contactPerson}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>{customer.contactPerson || "-"}</div>
                    {customer.designation && (
                      <div className="text-xs text-muted-foreground">{customer.designation}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div>{customer.city || "-"}</div>
                    {customer.state && (
                      <div className="text-xs text-muted-foreground">{customer.state}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm">{customer.phone || "-"}</div>
                    <div className="text-xs text-muted-foreground">{customer.email || "-"}</div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Badge variant="outline">{customer.customerType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => onCreateContract(customer.id)}
                            data-testid={`button-create-contract-${customer.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Create Contract</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ================== MONTHLY REMINDERS TAB ==================

interface MonthlyReminderItem {
  reminder: {
    id: string;
    customerId: string;
    contractId: string | null;
    reminderMonth: number;
    reminderYear: number;
    dueDate: Date;
    amount: number | null;
    status: string;
    emailSent: boolean;
    emailSentAt: Date | null;
    followedUpBy: string | null;
    followedUpAt: Date | null;
    paymentStatus: string | null;
    paymentDate: Date | null;
    paymentAmount: number | null;
    paymentReference: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  customerName: string;
  customerCity: string;
  customerEmail: string;
  customerPhone: string;
  contractNumber: string;
  contractTypeName: string;
}

function MonthlyRemindersTab({ 
  toast,
}: { 
  toast: any;
}) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [filterStatus, setFilterStatus] = useState("");
  const [updatingReminder, setUpdatingReminder] = useState<MonthlyReminderItem | null>(null);
  const [paymentData, setPaymentData] = useState({
    paymentStatus: "paid",
    paymentAmount: 0,
    paymentReference: "",
    notes: "",
  });

  const { data: reminders = [], isLoading } = useQuery<MonthlyReminderItem[]>({
    queryKey: ["/api/accounts/monthly-reminders", { month: selectedMonth, year: selectedYear, status: filterStatus }],
    staleTime: 0,
  });

  const generateRemindersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounts/monthly-reminders/generate", { month: selectedMonth, year: selectedYear });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/monthly-reminders"] });
      toast({
        title: "Reminders Generated",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/accounts/monthly-reminders/${id}/send-email`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/monthly-reminders"] });
      toast({ title: "Payment reminder sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/monthly-reminders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/monthly-reminders"] });
      toast({ title: "Reminder updated successfully" });
      setUpdatingReminder(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 1 + i);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "reminded":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Reminded</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case "pending":
        return <Badge variant="outline">Payment Pending</Badge>;
      case "partial":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Partial Payment</Badge>;
      case "paid":
        return <Badge variant="default" className="bg-green-500">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Monthly Payment Reminders
              </CardTitle>
              <CardDescription>Track and follow up on monthly payments</CardDescription>
            </div>
            <Button 
              onClick={() => generateRemindersMutation.mutate()}
              disabled={generateRemindersMutation.isPending}
              data-testid="button-generate-reminders"
            >
              {generateRemindersMutation.isPending ? "Generating..." : "Generate Reminders"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[150px]" data-testid="select-reminder-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]" data-testid="select-reminder-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reminded">Reminded</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No reminders found for this period. Click "Generate Reminders" to create them.
                    </TableCell>
                  </TableRow>
                ) : (
                  reminders.map((item) => (
                    <TableRow key={item.reminder.id} data-testid={`row-reminder-${item.reminder.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.customerName}</p>
                          <p className="text-sm text-muted-foreground">{item.customerCity}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{item.contractNumber}</p>
                          <p className="text-sm text-muted-foreground">{item.contractTypeName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(item.reminder.dueDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        INR {(item.reminder.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.reminder.status)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(item.reminder.paymentStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendEmailMutation.mutate(item.reminder.id)}
                            disabled={sendEmailMutation.isPending}
                            title="Send Reminder Email"
                            data-testid={`button-send-email-${item.reminder.id}`}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUpdatingReminder(item);
                              setPaymentData({
                                paymentStatus: item.reminder.paymentStatus || "paid",
                                paymentAmount: item.reminder.amount || 0,
                                paymentReference: item.reminder.paymentReference || "",
                                notes: item.reminder.notes || "",
                              });
                            }}
                            title="Update Payment Status"
                            data-testid={`button-update-reminder-${item.reminder.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Update Payment Dialog */}
      <Dialog open={!!updatingReminder} onOpenChange={(open) => !open && setUpdatingReminder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Record payment for {updatingReminder?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Payment Status</Label>
              <Select 
                value={paymentData.paymentStatus} 
                onValueChange={(v) => setPaymentData({ ...paymentData, paymentStatus: v })}
              >
                <SelectTrigger data-testid="select-payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                value={paymentData.paymentAmount}
                onChange={(e) => setPaymentData({ ...paymentData, paymentAmount: parseInt(e.target.value) || 0 })}
                data-testid="input-payment-amount"
              />
            </div>
            <div className="grid gap-2">
              <Label>Payment Reference</Label>
              <Input
                value={paymentData.paymentReference}
                onChange={(e) => setPaymentData({ ...paymentData, paymentReference: e.target.value })}
                placeholder="Transaction ID, cheque number, etc."
                data-testid="input-payment-reference"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="input-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdatingReminder(null)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (!updatingReminder) return;
                updateReminderMutation.mutate({
                  id: updatingReminder.reminder.id,
                  data: {
                    ...paymentData,
                    paymentDate: new Date().toISOString(),
                    status: paymentData.paymentStatus === "paid" ? "completed" : "reminded",
                  },
                });
              }}
              disabled={updateReminderMutation.isPending}
              data-testid="button-save-payment"
            >
              {updateReminderMutation.isPending ? "Saving..." : "Update Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
