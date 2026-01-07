import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerCompact } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Download,
  Mail,
  Search,
  Filter,
  Wallet,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { CustomerContract, Customer, ContractType, User } from "@shared/schema";
import { format, subDays, isWithinInterval, differenceInDays, addDays } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type ReportType = "all" | "active" | "expiring" | "expired";

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
}

function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  let tableHtml = '<table border="1"><thead><tr>';
  headers.forEach(h => { tableHtml += `<th>${h}</th>`; });
  tableHtml += '</tr></thead><tbody>';
  
  data.forEach(row => {
    tableHtml += '<tr>';
    headers.forEach(h => {
      tableHtml += `<td>${row[h] ?? ''}</td>`;
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody></table>';
  
  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.xls`;
  link.click();
}

type ContractWithDetails = CustomerContract & {
  customer?: Customer;
  contractType?: ContractType;
  createdByUser?: User;
};

const STATUS_COLORS = {
  active: "#22c55e",
  expiring: "#f59e0b",
  expired: "#ef4444",
  pending: "#6b7280",
};

export default function AccountsReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 90));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedContractType, setSelectedContractType] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Accounts Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const { data: contracts, isLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/reports/accounts"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: contractTypes } = useQuery<ContractType[]>({
    queryKey: ["/api/contract-types"],
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; html: string }) => {
      return apiRequest("POST", "/api/send-email", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email sent successfully" });
      setEmailDialogOpen(false);
      setEmailTo("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getContractStatus = (contract: ContractWithDetails) => {
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const daysUntilExpiry = differenceInDays(endDate, now);
    
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring";
    return "active";
  };

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    
    return contracts.filter(contract => {
      if (fromDate && toDate && contract.startDate) {
        const contractDate = new Date(contract.startDate);
        if (!isWithinInterval(contractDate, { start: fromDate, end: toDate })) {
          return false;
        }
      }
      
      if (selectedCustomer !== "all" && contract.customerId !== selectedCustomer) {
        return false;
      }

      if (selectedContractType !== "all" && contract.contractTypeId !== selectedContractType) {
        return false;
      }

      const status = getContractStatus(contract);
      if (selectedStatus !== "all" && status !== selectedStatus) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          contract.contractNumber?.toLowerCase().includes(query) ||
          contract.customer?.name?.toLowerCase().includes(query) ||
          contract.contactPerson?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [contracts, fromDate, toDate, selectedCustomer, selectedContractType, selectedStatus, searchQuery]);

  const tabFilteredContracts = useMemo(() => {
    if (activeTab === "all") return filteredContracts;
    return filteredContracts.filter(c => getContractStatus(c) === activeTab);
  }, [filteredContracts, activeTab]);

  const stats = useMemo(() => {
    if (!filteredContracts.length) {
      return {
        total: 0,
        active: 0,
        expiring: 0,
        expired: 0,
        totalValue: 0,
        avgValue: 0,
      };
    }

    const active = filteredContracts.filter(c => getContractStatus(c) === "active").length;
    const expiring = filteredContracts.filter(c => getContractStatus(c) === "expiring").length;
    const expired = filteredContracts.filter(c => getContractStatus(c) === "expired").length;
    const totalValue = filteredContracts.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      total: filteredContracts.length,
      active,
      expiring,
      expired,
      totalValue,
      avgValue: filteredContracts.length > 0 ? Math.round(totalValue / filteredContracts.length) : 0,
    };
  }, [filteredContracts]);

  const pieChartData = useMemo(() => [
    { name: "Active", value: stats.active, color: STATUS_COLORS.active },
    { name: "Expiring Soon", value: stats.expiring, color: STATUS_COLORS.expiring },
    { name: "Expired", value: stats.expired, color: STATUS_COLORS.expired },
  ], [stats]);

  const barChartData = useMemo(() => {
    if (!contracts) return [];
    
    const monthlyData: Record<string, { month: string; value: number; count: number }> = {};
    
    contracts.forEach(contract => {
      const monthKey = format(new Date(contract.startDate), "MMM yyyy");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, value: 0, count: 0 };
      }
      monthlyData[monthKey].value += contract.amount || 0;
      monthlyData[monthKey].count += 1;
    });
    
    return Object.values(monthlyData).slice(-6);
  }, [contracts]);

  const paginatedData = paginateData(tabFilteredContracts);
  const totalPages = getTotalPages(tabFilteredContracts.length);

  const prepareExportData = () => {
    return tabFilteredContracts.map(contract => ({
      "Contract No": contract.contractNumber,
      "Customer": contract.customer?.name || "N/A",
      "Contract Type": contract.contractType?.name || "N/A",
      "Amount": contract.amount,
      "Currency": contract.currency,
      "Start Date": format(new Date(contract.startDate), "dd/MM/yyyy"),
      "End Date": format(new Date(contract.endDate), "dd/MM/yyyy"),
      "Status": getContractStatus(contract),
      "Contact Person": contract.contactPerson || "",
      "Contact Email": contract.contactEmail || "",
      "Contact Phone": contract.contactPhone || "",
    }));
  };

  const handleSendEmail = () => {
    const exportData = prepareExportData();
    let tableHtml = `
      <h2>Accounts Report - M-CRM</h2>
      <p>Report generated on ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      <p><strong>Summary:</strong> Total: ${stats.total}, Active: ${stats.active}, Expiring: ${stats.expiring}, Expired: ${stats.expired}</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead><tr style="background-color: #f3f4f6;">
          ${Object.keys(exportData[0] || {}).map(h => `<th>${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${exportData.map(row => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
    
    sendEmailMutation.mutate({
      to: emailTo,
      subject: emailSubject,
      html: emailBody ? `<p>${emailBody}</p>${tableHtml}` : tableHtml,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Wallet className="h-6 w-6 text-emerald-500" />
            Accounts Reports
          </h1>
          <p className="text-muted-foreground">Contract analytics and financial overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(prepareExportData(), "accounts_report")}
            disabled={tabFilteredContracts.length === 0}
            data-testid="button-export-csv"
          >
            <FileText className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(prepareExportData(), "accounts_report")}
            disabled={tabFilteredContracts.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={tabFilteredContracts.length === 0}
            data-testid="button-send-email"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePickerCompact value={fromDate} onChange={setFromDate} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePickerCompact value={toDate} onChange={setToDate} />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select value={selectedContractType} onValueChange={setSelectedContractType}>
                <SelectTrigger data-testid="select-contract-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {contractTypes?.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contracts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contracts</p>
                <p className="text-2xl font-bold" data-testid="text-total-contracts">{stats.total}</p>
              </div>
              <Wallet className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500" data-testid="text-active-count">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-yellow-500" data-testid="text-expiring-count">{stats.expiring}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-500" data-testid="text-expired-count">{stats.expired}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold text-emerald-500" data-testid="text-total-value">{formatCurrency(stats.totalValue)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Value</p>
                <p className="text-xl font-bold text-purple-500" data-testid="text-avg-value">{formatCurrency(stats.avgValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="value" name="Contract Value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all">All ({filteredContracts.length})</TabsTrigger>
              <TabsTrigger value="active" data-testid="tab-active">Active ({stats.active})</TabsTrigger>
              <TabsTrigger value="expiring" data-testid="tab-expiring">Expiring ({stats.expiring})</TabsTrigger>
              <TabsTrigger value="expired" data-testid="tab-expired">Expired ({stats.expired})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No contracts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((contract) => {
                        const status = getContractStatus(contract);
                        return (
                          <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                            <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                            <TableCell>{contract.customer?.name || "N/A"}</TableCell>
                            <TableCell>{contract.contractType?.name || "N/A"}</TableCell>
                            <TableCell>{formatCurrency(contract.amount)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{format(new Date(contract.startDate), "dd/MM/yy")}</div>
                                <div className="text-muted-foreground">to {format(new Date(contract.endDate), "dd/MM/yy")}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={status === "active" ? "default" : status === "expiring" ? "secondary" : "destructive"}
                                className={
                                  status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                  status === "expiring" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                  "bg-red-500/10 text-red-600 border-red-500/20"
                                }
                              >
                                {status === "active" ? "Active" : status === "expiring" ? "Expiring" : "Expired"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{contract.contactPerson || "-"}</div>
                                {contract.contactEmail && (
                                  <div className="text-muted-foreground text-xs">{contract.contactEmail}</div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {tabFilteredContracts.length > 0 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={tabFilteredContracts.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Report via Email</DialogTitle>
            <DialogDescription>Send the accounts report to specified email addresses</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                placeholder="email@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Message (Optional)</Label>
              <Textarea
                placeholder="Add a message..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                data-testid="input-email-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={!emailTo || sendEmailMutation.isPending}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
