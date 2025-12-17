import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, differenceInDays, addMonths } from "date-fns";
import { Plus, Pencil, Trash2, Search, FileText, Mail, Calendar, DollarSign, Clock, AlertTriangle, CheckCircle, History, User } from "lucide-react";
import type { Customer, ContractType, CustomerContract } from "@shared/schema";

interface ContractWithDetails {
  contract: CustomerContract;
  customerName: string;
  contractTypeName: string;
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
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractWithDetails | null>(null);
  const [deletingContract, setDeletingContract] = useState<ContractWithDetails | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractWithDetails | null>(null);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: (data: Partial<CustomerContract>) =>
      apiRequest("POST", "/api/customer-contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/expiring"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/expiring"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/expiring"] });
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

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = 
      c.contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contractTypeName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "expiring") {
      const daysUntilExpiry = differenceInDays(new Date(c.contract.endDate), new Date());
      return matchesSearch && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }
    return matchesSearch && c.contract.status === activeTab;
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
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-contracts"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Customer</TableHead>
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
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                              onClick={() => setEditingContract(item)}
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
  onSubmit,
  isPending,
  onCancel,
}: {
  customers: Customer[];
  contractTypes: ContractType[];
  contract?: CustomerContract;
  onSubmit: (data: Partial<CustomerContract>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
    } as any);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Customer *</Label>
            <Select
              value={formData.customerId}
              onValueChange={(value) => setFormData({ ...formData, customerId: value })}
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

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              required
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
