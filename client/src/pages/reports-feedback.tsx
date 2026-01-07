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
  MessageCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  RotateCcw,
} from "lucide-react";
import type { Feedback, User, Ticket, Customer } from "@shared/schema";
import { format, subDays, isWithinInterval, parseISO } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type ReportType = "all" | "satisfied" | "unsatisfied" | "reopened";

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

type FeedbackWithDetails = Feedback & {
  ticket?: Ticket & { customer?: Customer };
  submittedBy?: User;
  completedBy?: User;
};

const SATISFACTION_COLORS = {
  satisfied: "#22c55e",
  unsatisfied: "#ef4444",
  pending: "#f59e0b",
};

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export default function FeedbackReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedWorkStatus, setSelectedWorkStatus] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("HR Feedback Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const { data: feedbackList, isLoading } = useQuery<FeedbackWithDetails[]>({
    queryKey: ["/api/feedback/all"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
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

  const filteredFeedback = useMemo(() => {
    if (!feedbackList) return [];
    
    return feedbackList.filter(fb => {
      if (fromDate && toDate && fb.submittedAt) {
        const feedbackDate = new Date(fb.submittedAt);
        if (!isWithinInterval(feedbackDate, { start: fromDate, end: toDate })) {
          return false;
        }
      }
      
      if (selectedCustomer !== "all" && fb.ticket?.customerId !== selectedCustomer) {
        return false;
      }
      
      if (selectedWorkStatus !== "all" && fb.workStatus !== selectedWorkStatus) {
        return false;
      }
      
      if (selectedRating !== "all" && fb.rating?.toString() !== selectedRating) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          fb.ticket?.customer?.name?.toLowerCase().includes(query) ||
          fb.comments?.toLowerCase().includes(query) ||
          fb.clientContactPerson?.toLowerCase().includes(query) ||
          fb.workDescription?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [feedbackList, fromDate, toDate, selectedCustomer, selectedWorkStatus, selectedRating, searchQuery]);

  const reportData = useMemo(() => {
    switch (activeTab) {
      case "satisfied":
        return filteredFeedback.filter(fb => fb.satisfied === true);
      case "unsatisfied":
        return filteredFeedback.filter(fb => fb.satisfied === false);
      case "reopened":
        return filteredFeedback.filter(fb => fb.reopenedByHr === true);
      default:
        return filteredFeedback;
    }
  }, [filteredFeedback, activeTab]);

  const stats = useMemo(() => {
    const satisfied = filteredFeedback.filter(fb => fb.satisfied === true).length;
    const unsatisfied = filteredFeedback.filter(fb => fb.satisfied === false).length;
    const pending = filteredFeedback.filter(fb => fb.satisfied === null).length;
    const reopened = filteredFeedback.filter(fb => fb.reopenedByHr === true).length;
    const total = filteredFeedback.length;
    
    const avgRating = filteredFeedback.filter(fb => fb.rating).reduce((sum, fb) => sum + (fb.rating || 0), 0) / 
      (filteredFeedback.filter(fb => fb.rating).length || 1);
    
    const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
      rating: `${rating} Star`,
      count: filteredFeedback.filter(fb => fb.rating === rating).length,
    }));
    
    return {
      total,
      satisfied,
      unsatisfied,
      pending,
      reopened,
      avgRating: avgRating.toFixed(1),
      satisfactionRate: total > 0 ? ((satisfied / total) * 100).toFixed(1) : "0",
      ratingDistribution,
    };
  }, [filteredFeedback]);

  const satisfactionChartData = useMemo(() => [
    { name: "Satisfied", value: stats.satisfied, color: SATISFACTION_COLORS.satisfied },
    { name: "Unsatisfied", value: stats.unsatisfied, color: SATISFACTION_COLORS.unsatisfied },
    { name: "Pending", value: stats.pending, color: SATISFACTION_COLORS.pending },
  ].filter(item => item.value > 0), [stats]);

  const prepareExportData = () => {
    return reportData.map(fb => ({
      "Customer": fb.ticket?.customer?.name || "N/A",
      "Ticket ID": fb.ticketId,
      "Rating": fb.rating ? `${fb.rating}/5` : "N/A",
      "Satisfied": fb.satisfied === true ? "Yes" : fb.satisfied === false ? "No" : "Pending",
      "Work Status": fb.workStatus || "N/A",
      "Comments": fb.comments || "",
      "Work Description": fb.workDescription || "",
      "Client Contact": fb.clientContactPerson || "",
      "Contact Phone": fb.clientContactPhone || "",
      "Reopened": fb.reopenedByHr ? "Yes" : "No",
      "Reopen Reason": fb.reopenReason || "",
      "Submitted By": fb.submittedBy ? `${fb.submittedBy.firstName} ${fb.submittedBy.lastName}` : "N/A",
      "Completed By": fb.completedBy ? `${fb.completedBy.firstName} ${fb.completedBy.lastName}` : "N/A",
      "Submitted At": fb.submittedAt ? format(new Date(fb.submittedAt), "yyyy-MM-dd HH:mm") : "",
    }));
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportToCSV(data, `feedback_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as CSV" });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data, `feedback_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as Excel" });
  };

  const handleSendEmail = () => {
    const data = prepareExportData();
    let htmlContent = `
      <h2>HR Feedback Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
      <p>Report Period: ${fromDate ? format(fromDate, "MMM dd, yyyy") : "All time"} - ${toDate ? format(toDate, "MMM dd, yyyy") : "Present"}</p>
      <p>Total Records: ${data.length}</p>
      <p>Satisfaction Rate: ${stats.satisfactionRate}%</p>
      <p>Average Rating: ${stats.avgRating}/5</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #10b981; color: white;">
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
    setEmailSubject(`HR Feedback Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - ${format(new Date(), "MMM dd, yyyy")}`);
    setEmailDialogOpen(true);
  };

  const paginatedData = paginateData(reportData);
  const totalPages = getTotalPages(reportData.length);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            HR Feedback Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Client satisfaction, ratings, and feedback analysis
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
              <Label className="text-xs">Work Status</Label>
              <Select value={selectedWorkStatus} onValueChange={setSelectedWorkStatus}>
                <SelectTrigger data-testid="filter-work-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="partial">Partially Completed</SelectItem>
                  <SelectItem value="not_completed">Not Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Rating</Label>
              <Select value={selectedRating} onValueChange={setSelectedRating}>
                <SelectTrigger data-testid="filter-rating">
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("all")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Feedback</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("satisfied")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Satisfied</p>
                <p className="text-2xl font-bold text-green-600">{stats.satisfied}</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("unsatisfied")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Unsatisfied</p>
                <p className="text-2xl font-bold text-red-600">{stats.unsatisfied}</p>
              </div>
              <ThumbsDown className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("reopened")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Reopened</p>
                <p className="text-2xl font-bold text-orange-600">{stats.reopened}</p>
              </div>
              <RotateCcw className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}/5</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Satisfaction Rate</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.satisfactionRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Satisfaction Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {satisfactionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={satisfactionChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {satisfactionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {stats.ratingDistribution.some(r => r.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rating" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Count">
                      {stats.ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={RATING_COLORS[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No rating data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Data Table */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="satisfied" data-testid="tab-satisfied">
                Satisfied ({stats.satisfied})
              </TabsTrigger>
              <TabsTrigger value="unsatisfied" data-testid="tab-unsatisfied">
                Unsatisfied ({stats.unsatisfied})
              </TabsTrigger>
              <TabsTrigger value="reopened" data-testid="tab-reopened">
                Reopened ({stats.reopened})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Customer</TableHead>
                  <TableHead className="min-w-[80px]">Ticket</TableHead>
                  <TableHead className="min-w-[100px]">Rating</TableHead>
                  <TableHead className="min-w-[100px]">Satisfied</TableHead>
                  <TableHead className="min-w-[120px]">Work Status</TableHead>
                  <TableHead className="min-w-[150px]">Client Contact</TableHead>
                  <TableHead className="min-w-[200px]">Comments</TableHead>
                  <TableHead className="min-w-[120px]">Submitted By</TableHead>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((fb) => (
                    <TableRow key={fb.id} data-testid={`row-feedback-${fb.id}`}>
                      <TableCell className="font-medium">
                        {fb.ticket?.customer?.name || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fb.ticket?.ticketNumber || fb.ticketId?.slice(0, 8)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fb.rating ? (
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={`h-3 w-3 ${star <= fb.rating! ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={fb.satisfied === true ? "default" : fb.satisfied === false ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {fb.satisfied === true ? "Yes" : fb.satisfied === false ? "No" : "Pending"}
                        </Badge>
                        {fb.reopenedByHr && (
                          <Badge variant="outline" className="text-xs ml-1 text-orange-600 border-orange-600">
                            Reopened
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fb.workStatus === 'completed' ? 'Completed' : 
                           fb.workStatus === 'partial' ? 'Partial' : 
                           fb.workStatus === 'not_completed' ? 'Not Done' : fb.workStatus || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {fb.clientContactPerson && <div>{fb.clientContactPerson}</div>}
                          {fb.clientContactPhone && <div className="text-muted-foreground">{fb.clientContactPhone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs line-clamp-2 max-w-[200px]">
                          {fb.comments || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {fb.submittedBy ? `${fb.submittedBy.firstName} ${fb.submittedBy.lastName}` : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {fb.submittedAt ? format(new Date(fb.submittedAt), "MMM d, yyyy") : "N/A"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No feedback records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {reportData.length > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={reportData.length}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Feedback Report via Email</DialogTitle>
            <DialogDescription>
              Enter recipient email address to send the report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
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
              <Label>Preview</Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 text-xs bg-muted">
                <div dangerouslySetInnerHTML={{ __html: emailBody }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => sendEmailMutation.mutate({ to: emailTo, subject: emailSubject, html: emailBody })}
              disabled={!emailTo || sendEmailMutation.isPending}
              data-testid="button-send-email-confirm"
            >
              {sendEmailMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" /> Send</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
