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
  Code,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  Package,
  Headphones,
  ListTodo,
} from "lucide-react";
import type { DevelopmentTask, User } from "@shared/schema";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

type ReportType = "pending" | "in_progress" | "completed" | "overdue" | "all";

const TASK_STATUSES = ["pending", "in_progress", "completed"];
const TASK_PRIORITIES = ["low", "medium", "high", "critical"];
const SOURCE_TYPES = ["support", "implementation", "task", "manual"];

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

export default function DevelopmentReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedSourceType, setSelectedSourceType] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Development Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");

  const { data: tasks, isLoading: tasksLoading } = useQuery<DevelopmentTask[]>({
    queryKey: ["/api/development/tasks"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
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

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    return tasks.filter(task => {
      if (fromDate && toDate && task.createdAt) {
        const taskDate = new Date(task.createdAt);
        if (!isWithinInterval(taskDate, { start: startOfDay(fromDate), end: endOfDay(toDate) })) {
          return false;
        }
      }
      
      if (selectedAssignee !== "all" && task.assignedTo !== selectedAssignee) {
        return false;
      }
      
      if (selectedStatus !== "all" && task.status !== selectedStatus) {
        return false;
      }
      
      if (selectedPriority !== "all" && task.priority !== selectedPriority) {
        return false;
      }
      
      if (selectedSourceType !== "all" && task.sourceType !== selectedSourceType) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          task.taskNumber?.toLowerCase().includes(query) ||
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.sourceReference?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [tasks, fromDate, toDate, selectedAssignee, selectedStatus, selectedPriority, selectedSourceType, searchQuery]);

  const reportData = useMemo(() => {
    const now = new Date();
    const pendingTasks = filteredTasks.filter(t => t.status === "pending");
    const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress");
    const completedTasks = filteredTasks.filter(t => t.status === "completed");
    const overdueTasks = filteredTasks.filter(t => 
      t.deadline && new Date(t.deadline) < now && t.status !== "completed"
    );
    
    switch (activeTab) {
      case "pending": return pendingTasks;
      case "in_progress": return inProgressTasks;
      case "completed": return completedTasks;
      case "overdue": return overdueTasks;
      default: return filteredTasks;
    }
  }, [filteredTasks, activeTab]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      pending: filteredTasks.filter(t => t.status === "pending").length,
      in_progress: filteredTasks.filter(t => t.status === "in_progress").length,
      completed: filteredTasks.filter(t => t.status === "completed").length,
      overdue: filteredTasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== "completed").length,
      all: filteredTasks.length,
      fromSupport: filteredTasks.filter(t => t.sourceType === "support").length,
      fromImplementation: filteredTasks.filter(t => t.sourceType === "implementation").length,
      fromTasks: filteredTasks.filter(t => t.sourceType === "task").length,
      manual: filteredTasks.filter(t => t.sourceType === "manual").length,
    };
  }, [filteredTasks]);

  const getAssigneeName = (assigneeId: string | null | undefined) => {
    if (!assigneeId || !users) return "Unassigned";
    const user = users.find(u => u.id === assigneeId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : "Unassigned";
  };

  const prepareExportData = () => {
    return reportData.map(task => ({
      "Task Number": task.taskNumber,
      "Title": task.title,
      "Status": task.status?.replace("_", " ").toUpperCase(),
      "Priority": task.priority?.toUpperCase(),
      "Source Type": task.sourceType?.replace("_", " ").toUpperCase(),
      "Source Reference": task.sourceReference || "-",
      "Assigned To": getAssigneeName(task.assignedTo),
      "Deadline": task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd HH:mm") : "-",
      "Created Date": task.createdAt ? format(new Date(task.createdAt), "yyyy-MM-dd HH:mm") : "",
      "Completed Date": task.completedAt ? format(new Date(task.completedAt), "yyyy-MM-dd HH:mm") : "-",
      "Estimated Hours": task.estimatedHours || "-",
      "Actual Hours": task.actualHours || "-",
      "Penalty Points": task.penaltyPoints || 0,
      "Description": task.description?.substring(0, 100) + (task.description && task.description.length > 100 ? "..." : ""),
    }));
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportToCSV(data, `development_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as CSV" });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data, `development_${activeTab}_report`);
    toast({ title: "Exported", description: "Report exported as Excel" });
  };

  const handleSendEmail = () => {
    const data = prepareExportData();
    let htmlContent = `
      <h2>Development Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace("_", " ")} Tasks</h2>
      <p>Report Period: ${fromDate ? format(fromDate, "MMM dd, yyyy") : "All time"} - ${toDate ? format(toDate, "MMM dd, yyyy") : "Present"}</p>
      <p>Total Records: ${data.length}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #6366f1; color: white;">
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
    setEmailSubject(`Development Report - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace("_", " ")} - ${format(new Date(), "MMM dd, yyyy")}`);
    setEmailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
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

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "support": return <Headphones className="h-3 w-3" />;
      case "implementation": return <Package className="h-3 w-3" />;
      case "task": return <ListTodo className="h-3 w-3" />;
      default: return <Code className="h-3 w-3" />;
    }
  };

  const getSourceColor = (sourceType: string) => {
    switch (sourceType) {
      case "support": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "implementation": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "task": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1 flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Development Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Development task tracking, deadline monitoring, and source analysis
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
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
              <Label className="text-xs">Assignee</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="filter-assignee">
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {users?.filter(u => u.isActive).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
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
                  {TASK_STATUSES.map(s => (
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
                  {TASK_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Source</Label>
              <Select value={selectedSourceType} onValueChange={setSelectedSourceType}>
                <SelectTrigger data-testid="filter-source">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCE_TYPES.map(s => (
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{stats.all}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-purple-50/50 dark:bg-purple-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <Headphones className="h-4 w-4 text-purple-600" />
            <div>
              <div className="text-lg font-semibold text-purple-600">{stats.fromSupport}</div>
              <div className="text-xs text-muted-foreground">From Support</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 dark:bg-blue-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-lg font-semibold text-blue-600">{stats.fromImplementation}</div>
              <div className="text-xs text-muted-foreground">From Implementation</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-lg font-semibold text-green-600">{stats.fromTasks}</div>
              <div className="text-xs text-muted-foreground">From Tasks</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <Code className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-lg font-semibold text-amber-600">{stats.manual}</div>
              <div className="text-xs text-muted-foreground">Manual</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
          <CardHeader className="pb-3">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({stats.all})
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress">
                In Progress ({stats.in_progress})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                Completed ({stats.completed})
              </TabsTrigger>
              <TabsTrigger value="overdue" data-testid="tab-overdue">
                Overdue ({stats.overdue})
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : reportData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No development tasks found matching the criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Hours (Est/Act)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginateData(reportData).map((task) => {
                      const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "completed";
                      return (
                        <TableRow key={task.id} className={isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell className="font-medium">
                            <span className="font-mono text-xs">{task.taskNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate" title={task.title}>
                              {task.title}
                            </div>
                            {task.sourceReference && (
                              <div className="text-xs text-muted-foreground truncate" title={task.sourceReference}>
                                Ref: {task.sourceReference}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getSourceColor(task.sourceType)} gap-1`}>
                              {getSourceIcon(task.sourceType)}
                              {task.sourceType}
                            </Badge>
                          </TableCell>
                          <TableCell>{getAssigneeName(task.assignedTo)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(task.status)}>
                              {task.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className={isOverdue ? "text-red-600 font-medium" : ""}>
                              {task.deadline ? format(new Date(task.deadline), "MMM dd, yyyy") : "-"}
                            </div>
                            {isOverdue && (
                              <div className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {task.estimatedHours || "-"} / {task.actualHours || "-"}
                            {task.penaltyPoints && task.penaltyPoints > 0 && (
                              <div className="text-xs text-red-500">-{task.penaltyPoints} pts</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={getTotalPages(reportData.length)}
                  pageSize={pageSize}
                  totalItems={reportData.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Report via Email</DialogTitle>
            <DialogDescription>
              Enter the recipient email address to send this report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (emailTo) {
                  sendEmailMutation.mutate({
                    to: emailTo,
                    subject: emailSubject,
                    html: emailBody,
                  });
                }
              }}
              disabled={!emailTo || sendEmailMutation.isPending}
              data-testid="button-send-email-confirm"
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
