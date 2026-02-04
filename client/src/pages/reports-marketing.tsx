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
  Megaphone,
  Globe,
  Share2,
  MousePointer,
  Users,
  TrendingUp,
  Loader2,
  FileSpreadsheet,
  FileText,
  Eye,
  Target,
  Zap,
} from "lucide-react";
import type { MarketingDailyReport, User } from "@shared/schema";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

type ReportType = "all" | "approved" | "pending" | "rejected";

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

type MarketingReportWithUser = MarketingDailyReport & {
  user?: User;
  approvedByUser?: User;
};

const STATUS_COLORS = {
  approved: "#22c55e",
  pending: "#f59e0b",
  rejected: "#ef4444",
};

export default function MarketingReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Digital Marketing Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const { data: reports, isLoading } = useQuery<MarketingReportWithUser[]>({
    queryKey: ["/api/reports/marketing"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
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

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    
    return reports.filter(report => {
      if (fromDate && toDate && report.reportDate) {
        // Parse the date string and normalize to local date for comparison
        const reportDateStr = String(report.reportDate);
        const datePart = reportDateStr.includes('T') ? reportDateStr.split('T')[0] : reportDateStr.split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        const reportDate = new Date(year, month - 1, day);
        
        if (!isWithinInterval(reportDate, { start: startOfDay(fromDate), end: endOfDay(toDate) })) {
          return false;
        }
      }
      
      if (selectedUser !== "all" && report.userId !== selectedUser) {
        return false;
      }

      if (selectedStatus !== "all" && report.status !== selectedStatus) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const userName = report.user ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.toLowerCase() : '';
        const matchesSearch = userName.includes(query);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [reports, fromDate, toDate, selectedUser, selectedStatus, searchQuery]);

  const tabFilteredReports = useMemo(() => {
    if (activeTab === "all") return filteredReports;
    return filteredReports.filter(r => r.status === activeTab);
  }, [filteredReports, activeTab]);

  const stats = useMemo(() => {
    if (!filteredReports.length) {
      return {
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        totalSessions: 0,
        totalConversions: 0,
        avgBounceRate: "0%",
      };
    }

    const approved = filteredReports.filter(r => r.status === "approved").length;
    const pending = filteredReports.filter(r => r.status === "pending").length;
    const rejected = filteredReports.filter(r => r.status === "rejected").length;
    const totalSessions = filteredReports.reduce((sum, r) => sum + (r.websiteSessions || 0), 0);
    const totalConversions = filteredReports.reduce((sum, r) => sum + (r.websiteConversions || 0), 0);
    
    const bounceRates = filteredReports
      .filter(r => r.bounceRate)
      .map(r => parseFloat(r.bounceRate?.replace('%', '') || '0'));
    const avgBounceRate = bounceRates.length > 0 
      ? (bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length).toFixed(1) + '%'
      : '0%';

    return {
      total: filteredReports.length,
      approved,
      pending,
      rejected,
      totalSessions,
      totalConversions,
      avgBounceRate,
    };
  }, [filteredReports]);

  const pieChartData = useMemo(() => [
    { name: "Approved", value: stats.approved, color: STATUS_COLORS.approved },
    { name: "Pending", value: stats.pending, color: STATUS_COLORS.pending },
    { name: "Rejected", value: stats.rejected, color: STATUS_COLORS.rejected },
  ], [stats]);

  const barChartData = useMemo(() => {
    if (!reports) return [];
    
    const dailyData: Record<string, { date: string; sessions: number; conversions: number }> = {};
    
    reports.forEach(report => {
      const dateKey = format(new Date(report.reportDate), "dd MMM");
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, sessions: 0, conversions: 0 };
      }
      dailyData[dateKey].sessions += report.websiteSessions || 0;
      dailyData[dateKey].conversions += report.websiteConversions || 0;
    });
    
    return Object.values(dailyData).slice(-14);
  }, [reports]);

  const socialMediaData = useMemo(() => {
    if (!filteredReports.length) return [];
    
    const totalLikes = filteredReports.reduce((sum, r) => sum + (r.socialLikes || 0), 0);
    const totalShares = filteredReports.reduce((sum, r) => sum + (r.socialShares || 0), 0);
    const totalComments = filteredReports.reduce((sum, r) => sum + (r.socialComments || 0), 0);
    
    return [
      { name: "Likes", value: totalLikes, color: "#3b82f6" },
      { name: "Shares", value: totalShares, color: "#22c55e" },
      { name: "Comments", value: totalComments, color: "#f59e0b" },
    ];
  }, [filteredReports]);

  const paginatedData = paginateData(tabFilteredReports);
  const totalPages = getTotalPages(tabFilteredReports.length);

  const prepareExportData = () => {
    return tabFilteredReports.map(report => ({
      "Report Date": format(new Date(report.reportDate), "dd/MM/yyyy"),
      "Submitted By": report.user ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() : "Unknown",
      "Status": report.status,
      "Website Sessions": report.websiteSessions || 0,
      "Bounce Rate": report.bounceRate || "-",
      "Conversions": report.websiteConversions || 0,
      "Social Likes": report.socialLikes || 0,
      "Social Shares": report.socialShares || 0,
      "Social Comments": report.socialComments || 0,
      "Email Open Rate": report.emailOpenRate || "-",
      "Email Click Rate": report.emailClickRate || "-",
    }));
  };

  const handleSendEmail = () => {
    const exportData = prepareExportData();
    let tableHtml = `
      <h2>Digital Marketing Report - M-CRM</h2>
      <p>Report generated on ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      <p><strong>Summary:</strong> Total Reports: ${stats.total}, Sessions: ${stats.totalSessions}, Conversions: ${stats.totalConversions}, Avg Bounce Rate: ${stats.avgBounceRate}</p>
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
            <Megaphone className="h-6 w-6 text-pink-500" />
            Digital Marketing Reports
          </h1>
          <p className="text-muted-foreground">Marketing analytics and campaign performance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(prepareExportData(), "marketing_report")}
            disabled={tabFilteredReports.length === 0}
            data-testid="button-export-csv"
          >
            <FileText className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(prepareExportData(), "marketing_report")}
            disabled={tabFilteredReports.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={tabFilteredReports.length === 0}
            data-testid="button-send-email"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePickerCompact value={fromDate} onChange={setFromDate} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePickerCompact value={toDate} onChange={setToDate} />
            </div>
            <div className="space-y-2">
              <Label>Submitted By</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                    </SelectItem>
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
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
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
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold" data-testid="text-total-reports">{stats.total}</p>
              </div>
              <Megaphone className="h-8 w-8 text-pink-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-500" data-testid="text-approved-count">{stats.approved}</p>
              </div>
              <Target className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500" data-testid="text-pending-count">{stats.pending}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold text-blue-500" data-testid="text-total-sessions">{stats.totalSessions.toLocaleString()}</p>
              </div>
              <Globe className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversions</p>
                <p className="text-2xl font-bold text-emerald-500" data-testid="text-conversions">{stats.totalConversions}</p>
              </div>
              <MousePointer className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Bounce Rate</p>
                <p className="text-2xl font-bold text-orange-500" data-testid="text-bounce-rate">{stats.avgBounceRate}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Report Status Distribution</CardTitle>
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
            <CardTitle className="text-lg">Social Media Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={socialMediaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="Count">
                  {socialMediaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Website Traffic Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="conversions" name="Conversions" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Marketing Report Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all">All ({filteredReports.length})</TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">Approved ({stats.approved})</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected ({stats.rejected})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Social Engagement</TableHead>
                      <TableHead>Email Stats</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No reports found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((report) => (
                        <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                          <TableCell className="font-medium">
                            {format(new Date(report.reportDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {report.user ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() : "Unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                report.status === "approved" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                report.status === "pending" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                "bg-red-500/10 text-red-600 border-red-500/20"
                              }
                            >
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{report.websiteSessions?.toLocaleString() || 0}</div>
                              <div className="text-muted-foreground text-xs">
                                {report.bounceRate || "-"} bounce
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{report.websiteConversions || 0}</TableCell>
                          <TableCell>
                            <div className="flex gap-2 text-xs">
                              <span title="Likes" className="text-blue-500">{report.socialLikes || 0}</span>
                              <span title="Shares" className="text-green-500">{report.socialShares || 0}</span>
                              <span title="Comments" className="text-yellow-500">{report.socialComments || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div>Open: {report.emailOpenRate || "-"}</div>
                              <div>Click: {report.emailClickRate || "-"}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {tabFilteredReports.length > 0 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={tabFilteredReports.length}
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
            <DialogDescription>Send the marketing report to specified email addresses</DialogDescription>
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
