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
import { DatePickerCompact } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Download,
  Mail,
  Search,
  Filter,
  TicketCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  Headphones,
} from "lucide-react";
import type { Ticket, Customer, User, Department } from "@shared/schema";
import { format, subDays, isWithinInterval, endOfDay, startOfDay } from "date-fns";

type ReportType = "fresh" | "pending" | "completed" | "all";

const TICKET_STATUSES = ["open", "in_progress", "escalated", "resolved", "closed"];
const TICKET_PRIORITIES = ["low", "medium", "high", "critical"];

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

export default function SupportReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedEngineer, setSelectedEngineer] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);
  const [emailSubject, setEmailSubject] = useState("Support Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{ tickets: Ticket[]; total: number; counts: any }>({
    queryKey: ["/api/tickets", {
      fromDate: fromDate ? format(fromDate, "yyyy-MM-dd") : undefined,
      toDate: toDate ? format(toDate, "yyyy-MM-dd") : undefined,
      assignedTo: selectedEngineer !== "all" ? selectedEngineer : undefined,
      search: searchQuery || undefined,
      pageSize: 1000,
    }],
  });
  const tickets = ticketsData?.tickets ?? [];

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch support-assignable users for the engineer filter
  const { data: allSupportEngineers } = useQuery<User[]>({
    queryKey: ["/api/users/support-assignable"],
  });

  // Fetch departments for the department filter
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Filter engineers by selected department
  const supportEngineers = useMemo(() => {
    if (!allSupportEngineers) return [];
    if (selectedDepartment === "all") return allSupportEngineers;
    return allSupportEngineers.filter(u => u.departmentId === selectedDepartment);
  }, [allSupportEngineers, selectedDepartment]);

  const sendEmailMutation = useMutation({
    mutationFn: async (params: { to: string; subject: string; html: string }) => {
      return apiRequest("POST", "/api/reports/send-email", params);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Report sent via email successfully" });
      setEmailDialogOpen(false);
      setEmailTo("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
    },
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    
    return tickets.filter(ticket => {
      // Date, engineer, and search filters are handled server-side via query params

      if (selectedCustomer !== "all" && ticket.customerId !== selectedCustomer) {
        return false;
      }
      
      if (selectedStatus !== "all" && ticket.status !== selectedStatus) {
        return false;
      }
      
      if (selectedPriority !== "all" && ticket.priority !== selectedPriority) {
        return false;
      }
      
      return true;
    });
  }, [tickets, selectedCustomer, selectedStatus, selectedPriority]);

  const reportData = useMemo(() => {
    const freshTickets = filteredTickets.filter(t => t.status === "open");
    const pendingTickets = filteredTickets.filter(t => 
      t.status === "in_progress" || t.status === "escalated"
    );
    const completedTickets = filteredTickets.filter(t => 
      t.status === "resolved" || t.status === "closed"
    );
    
    switch (activeTab) {
      case "fresh": return freshTickets;
      case "pending": return pendingTickets;
      case "completed": return completedTickets;
      default: return filteredTickets;
    }
  }, [filteredTickets, activeTab]);

  const stats = useMemo(() => ({
    fresh: filteredTickets.filter(t => t.status === "open").length,
    pending: filteredTickets.filter(t => t.status === "in_progress" || t.status === "escalated").length,
    completed: filteredTickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    all: filteredTickets.length,
    critical: filteredTickets.filter(t => t.priority === "critical").length,
    escalated: filteredTickets.filter(t => t.status === "escalated").length,
  }), [filteredTickets]);

  const getCustomerName = (customerId: string | null | undefined) => {
    if (!customerId || !customers) return "-";
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || "-";
  };

  const prepareExportData = () => {
    return reportData.map(ticket => ({
      "Ticket Number": ticket.ticketNumber,
      "Issue Summary": ticket.issueSummary,
      "Customer": getCustomerName(ticket.customerId),
      "Status": ticket.status?.replace("_", " ").toUpperCase(),
      "Priority": ticket.priority?.toUpperCase(),
      "Escalation Level": ticket.escalationLevel ? `L${ticket.escalationLevel}` : "L1",
      "Created Date": ticket.createdAt ? format(new Date(ticket.createdAt), "yyyy-MM-dd HH:mm") : "",
      "Last Updated": ticket.updatedAt ? format(new Date(ticket.updatedAt), "yyyy-MM-dd HH:mm") : "",
      "Description": ticket.issueDescription?.substring(0, 100) + (ticket.issueDescription && ticket.issueDescription.length > 100 ? "..." : ""),
    }));
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportToCSV(data, `support_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as CSV" });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data, `support_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as Excel" });
  };

  const handleSendEmail = () => {
    const data = prepareExportData();
    let htmlContent = `
      <h2>Support Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tickets</h2>
      <p>Report Period: ${fromDate ? format(fromDate, "MMM dd, yyyy") : "All time"} - ${toDate ? format(toDate, "MMM dd, yyyy") : "Present"}</p>
      <p>Total Records: ${data.length}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #3b82f6; color: white;">
            ${Object.keys(data[0] || {}).map(h => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, 50).map(row => `
            <tr>
              ${Object.values(row).map(v => `<td>${v ?? ""}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${data.length > 50 ? `<p><em>Showing first 50 records. Full report has ${data.length} records.</em></p>` : ""}
    `;
    
    setEmailBody(htmlContent);
    setEmailSubject(`Support Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - ${format(new Date(), "MMM dd, yyyy")}`);
    setEmailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "in_progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "escalated": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "resolved": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "closed": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      case "medium": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2">
            <TicketCheck className="h-5 w-5 text-primary" />
            Support Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Ticket tracking, resolution status, and escalation monitoring
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <FileText className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail} data-testid="button-send-email">
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">From Date</Label>
              <DatePickerCompact
                value={fromDate}
                onChange={setFromDate}
                placeholder="Start date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To Date</Label>
              <DatePickerCompact
                value={toDate}
                onChange={setToDate}
                placeholder="End date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger data-testid="filter-customer">
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
              <Label className="text-xs">Department</Label>
              <Select value={selectedDepartment} onValueChange={(val) => {
                setSelectedDepartment(val);
                setSelectedEngineer("all"); // Reset engineer when department changes
              }}>
                <SelectTrigger data-testid="filter-department">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Support Engineer</Label>
              <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
                <SelectTrigger data-testid="filter-engineer">
                  <SelectValue placeholder="All Engineers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Engineers</SelectItem>
                  {supportEngineers?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {TICKET_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ").toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Priority</Label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger data-testid="filter-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {TICKET_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("fresh")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-bold">{stats.fresh}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("pending")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("completed")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("all")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold">{stats.all}</p>
              </div>
              <Headphones className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fresh" data-testid="tab-fresh">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Open ({stats.fresh})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            In Progress ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Resolved ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({stats.all})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reportData.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <TicketCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tickets found for the selected criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Issue Summary</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginateData(reportData).map(ticket => (
                        <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                          <TableCell className="font-mono font-medium">{ticket.ticketNumber}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{ticket.issueSummary}</TableCell>
                          <TableCell>{getCustomerName(ticket.customerId)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(ticket.status || "")}>
                              {ticket.status?.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityColor(ticket.priority || "")}>
                              {ticket.priority?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">L{ticket.escalationLevel || 1}</Badge>
                          </TableCell>
                          <TableCell>
                            {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM dd, HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {ticket.updatedAt ? format(new Date(ticket.updatedAt), "MMM dd, HH:mm") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 0 && (
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={getTotalPages(reportData.length)}
                      pageSize={pageSize}
                      totalItems={reportData.length}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Report via Email
            </DialogTitle>
            <DialogDescription>
              Send the current report to an email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">Recipient Email</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="recipient@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">Report Summary:</p>
              <p className="text-muted-foreground">
                {reportData.length} records from {fromDate ? format(fromDate, "MMM dd") : "all time"} to {toDate ? format(toDate, "MMM dd, yyyy") : "present"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendEmailMutation.mutate({ to: emailTo, subject: emailSubject, html: emailBody })}
              disabled={!emailTo || sendEmailMutation.isPending}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
