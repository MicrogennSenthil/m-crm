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
import { Progress } from "@/components/ui/progress";
import { DatePickerCompact } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Download,
  Mail,
  Search,
  Filter,
  Package,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  Building,
} from "lucide-react";
import type { Project, Customer } from "@shared/schema";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

type ReportType = "fresh" | "pending" | "completed" | "all";

const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"];

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

export default function ImplementationReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Implementation Report - M-CRM");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);
  const [emailBody, setEmailBody] = useState("");

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
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

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter(project => {
      if (fromDate && toDate && project.createdAt) {
        // Parse the date string and normalize to local date for comparison
        const createdAtStr = String(project.createdAt);
        const datePart = createdAtStr.includes('T') ? createdAtStr.split('T')[0] : createdAtStr.split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        const projectDate = new Date(year, month - 1, day);
        
        if (!isWithinInterval(projectDate, { start: startOfDay(fromDate), end: endOfDay(toDate) })) {
          return false;
        }
      }
      
      if (selectedCustomer !== "all" && project.customerId !== selectedCustomer) {
        return false;
      }
      
      if (selectedStatus !== "all" && project.status !== selectedStatus) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          project.clientName?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [projects, fromDate, toDate, selectedCustomer, selectedStatus, searchQuery]);

  const reportData = useMemo(() => {
    const freshProjects = filteredProjects.filter(p => p.status === "planning");
    const pendingProjects = filteredProjects.filter(p => 
      p.status === "in_progress" || p.status === "on_hold"
    );
    const completedProjects = filteredProjects.filter(p => 
      p.status === "completed" || p.status === "cancelled"
    );
    
    switch (activeTab) {
      case "fresh": return freshProjects;
      case "pending": return pendingProjects;
      case "completed": return completedProjects;
      default: return filteredProjects;
    }
  }, [filteredProjects, activeTab]);

  const stats = useMemo(() => ({
    fresh: filteredProjects.filter(p => p.status === "planning").length,
    pending: filteredProjects.filter(p => p.status === "in_progress" || p.status === "on_hold").length,
    completed: filteredProjects.filter(p => p.status === "completed").length,
    all: filteredProjects.length,
    cancelled: filteredProjects.filter(p => p.status === "cancelled").length,
  }), [filteredProjects]);

  const prepareExportData = () => {
    return reportData.map(project => ({
      "Client Name": project.clientName,
      "Status": project.status?.replace("_", " ").toUpperCase(),
      "Progress": `${project.completionPercentage || 0}%`,
      "Implementation Date": project.implementationDate ? format(new Date(project.implementationDate), "yyyy-MM-dd") : "",
      "Target Go-Live": project.targetGoLiveDate ? format(new Date(project.targetGoLiveDate), "yyyy-MM-dd") : "",
      "Created Date": project.createdAt ? format(new Date(project.createdAt), "yyyy-MM-dd") : "",
    }));
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportToCSV(data, `implementation_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as CSV" });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data, `implementation_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as Excel" });
  };

  const handleSendEmail = () => {
    const data = prepareExportData();
    let htmlContent = `
      <h2>Implementation Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Projects</h2>
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
    setEmailSubject(`Implementation Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - ${format(new Date(), "MMM dd, yyyy")}`);
    setEmailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "in_progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "on_hold": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Implementation Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Project tracking, progress monitoring, and completion status
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <Label className="text-xs">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {PROJECT_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ").toUpperCase()}</SelectItem>
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
                <p className="text-xs text-muted-foreground">Planning</p>
                <p className="text-2xl font-bold">{stats.fresh}</p>
              </div>
              <Play className="h-8 w-8 text-blue-500 opacity-50" />
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
                <p className="text-xs text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold">{stats.all}</p>
              </div>
              <Building className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fresh" data-testid="tab-fresh">
            <Play className="h-4 w-4 mr-2" />
            Planning ({stats.fresh})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            In Progress ({stats.pending})
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
              {projectsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reportData.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects found for the selected criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Contact Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Target End</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginateData(reportData).map(project => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell className="font-medium">{project.clientName}</TableCell>
                          <TableCell>{(project as any).contactEmail || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(project.status || "")}>
                              {project.status?.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={project.completionPercentage || 0} className="w-20 h-2" />
                              <span className="text-xs text-muted-foreground">{project.completionPercentage || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {project.implementationDate ? format(new Date(project.implementationDate), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            {project.targetGoLiveDate ? format(new Date(project.targetGoLiveDate), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            {project.createdAt ? format(new Date(project.createdAt), "MMM dd, yyyy") : "-"}
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
