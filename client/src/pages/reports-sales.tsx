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
  TrendingUp,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  Users,
  History,
} from "lucide-react";
import type { Lead, Customer } from "@shared/schema";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

type ReportType = "fresh" | "pending" | "completed" | "all";

const LEAD_STAGES = ["new", "contacted", "demo_scheduled", "proposal_sent", "closed_won", "closed_lost"];

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

export default function SalesReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);
  const [emailSubject, setEmailSubject] = useState("Sales Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

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

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    return leads.filter(lead => {
      // Exclude "not interested" leads from reports
      if ((lead as any).interestStatus === "not_interested") {
        return false;
      }
      
      if (fromDate && toDate && lead.createdAt) {
        // Parse the date string and normalize to local date for comparison
        const createdAtStr = String(lead.createdAt);
        const datePart = createdAtStr.includes('T') ? createdAtStr.split('T')[0] : createdAtStr.split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        const leadDate = new Date(year, month - 1, day);
        
        if (!isWithinInterval(leadDate, { start: startOfDay(fromDate), end: endOfDay(toDate) })) {
          return false;
        }
      }
      
      if (selectedCustomer !== "all" && lead.customerId !== selectedCustomer) {
        return false;
      }
      
      if (selectedStage !== "all" && lead.stage !== selectedStage) {
        return false;
      }
      
      if (selectedSource !== "all" && lead.leadSource !== selectedSource) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          lead.companyName?.toLowerCase().includes(query) ||
          lead.contactPerson?.toLowerCase().includes(query) ||
          lead.contactEmail?.toLowerCase().includes(query) ||
          lead.contactPhone?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [leads, fromDate, toDate, selectedCustomer, selectedStage, selectedSource, searchQuery]);

  const reportData = useMemo(() => {
    const freshCalls = filteredLeads.filter(l => l.stage === "new" || l.stage === "contacted");
    const pendingCalls = filteredLeads.filter(l => 
      l.stage === "demo_scheduled" || l.stage === "proposal_sent"
    );
    const completedCalls = filteredLeads.filter(l => 
      l.stage === "closed_won" || l.stage === "closed_lost"
    );
    
    switch (activeTab) {
      case "fresh": return freshCalls;
      case "pending": return pendingCalls;
      case "completed": return completedCalls;
      default: return filteredLeads;
    }
  }, [filteredLeads, activeTab]);

  const uniqueSources = useMemo(() => {
    if (!leads) return [];
    return Array.from(new Set(leads.map(l => l.leadSource).filter(Boolean)));
  }, [leads]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const pendingUptoYesterday = leads?.filter(l => {
      // Not closed
      if (l.stage === "closed_won" || l.stage === "closed_lost") return false;
      // Created before today (up to yesterday)
      if (l.createdAt && new Date(l.createdAt) < today) return true;
      return false;
    }).length || 0;
    
    return {
      fresh: filteredLeads.filter(l => l.stage === "new" || l.stage === "contacted").length,
      pending: filteredLeads.filter(l => l.stage === "demo_scheduled" || l.stage === "proposal_sent").length,
      completed: filteredLeads.filter(l => l.stage === "closed_won" || l.stage === "closed_lost").length,
      all: filteredLeads.length,
      won: filteredLeads.filter(l => l.stage === "closed_won").length,
      lost: filteredLeads.filter(l => l.stage === "closed_lost").length,
      pendingUptoYesterday,
    };
  }, [filteredLeads, leads]);

  const prepareExportData = () => {
    return reportData.map(lead => ({
      "Company Name": lead.companyName,
      "Contact Name": lead.contactPerson,
      "Email": lead.contactEmail,
      "Phone": lead.contactPhone,
      "Location": lead.city || "",
      "Stage": lead.stage?.replace("_", " ").toUpperCase(),
      "Source": lead.leadSource,
      "Expected Value": lead.estimatedValue,
      "Created Date": lead.createdAt ? format(new Date(lead.createdAt), "yyyy-MM-dd") : "",
      "Demo Date": lead.demoDate ? format(new Date(lead.demoDate), "yyyy-MM-dd") : "",
      "Notes": lead.specialInstructions || "",
    }));
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportToCSV(data, `sales_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as CSV" });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data, `sales_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as Excel" });
  };

  const handleSendEmail = () => {
    const data = prepareExportData();
    let htmlContent = `
      <h2>Sales Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Calls</h2>
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
    setEmailSubject(`Sales Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Calls - ${format(new Date(), "MMM dd, yyyy")}`);
    setEmailDialogOpen(true);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "new": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "contacted": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "demo_scheduled": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "proposal_sent": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "closed_won": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "closed_lost": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sales Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Fresh calls, pending follow-ups, and completed deals
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
              <Label className="text-xs">Stage</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger data-testid="filter-stage">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {LEAD_STAGES.map(s => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ").toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Source</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger data-testid="filter-source">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map(s => (
                    <SelectItem key={s} value={s || "unknown"}>{s || "Unknown"}</SelectItem>
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("fresh")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Fresh Calls</p>
                <p className="text-2xl font-bold">{stats.fresh}</p>
              </div>
              <Phone className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setActiveTab("pending")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
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
                <p className="text-xs text-muted-foreground">Completed</p>
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
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{stats.all}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending (Upto Yesterday)</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingUptoYesterday}</p>
              </div>
              <History className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fresh" data-testid="tab-fresh">
            <Phone className="h-4 w-4 mr-2" />
            Fresh ({stats.fresh})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({stats.all})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {leadsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reportData.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No leads found for the selected criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginateData(reportData).map(lead => (
                        <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                          <TableCell className="font-medium">{lead.companyName}</TableCell>
                          <TableCell>{lead.contactPerson}</TableCell>
                          <TableCell>{lead.contactEmail}</TableCell>
                          <TableCell>{lead.contactPhone}</TableCell>
                          <TableCell>{lead.city || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStageColor(lead.stage || "")}>
                              {lead.stage?.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{lead.leadSource || "-"}</TableCell>
                          <TableCell className="text-right">
                            {lead.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>
                            {lead.createdAt ? format(new Date(lead.createdAt), "MMM dd, yyyy") : "-"}
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
