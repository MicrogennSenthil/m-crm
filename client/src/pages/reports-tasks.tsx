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
  ListTodo,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  Calendar,
  Target,
  TrendingUp,
} from "lucide-react";
import type { Task, User, Department } from "@shared/schema";
import { format, subDays, isWithinInterval, isPast, isToday, startOfDay, endOfDay } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type ReportType = "all" | "pending" | "completed" | "overdue";

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

type TaskWithDetails = Task & {
  createdByUser?: User;
  assignedToUser?: User;
};

const STATUS_COLORS = {
  pending: "#f59e0b",
  followup: "#3b82f6",
  completed: "#22c55e",
  get_information: "#8b5cf6",
  overdue: "#ef4444",
};

const PRIORITY_COLORS = {
  low: "#6b7280",
  medium: "#f59e0b",
  high: "#f97316",
  urgent: "#ef4444",
};

export default function TasksReports() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Tasks Report - M-CRM");
  const [emailBody, setEmailBody] = useState("");
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, paginateData, getTotalPages } = usePagination(10);

  const { data: tasks, isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/reports/tasks"],
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

  const isOverdue = (task: TaskWithDetails) => {
    if (task.status === "completed") return false;
    if (!task.dueDate) return false;
    return isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
  };

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
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [tasks, fromDate, toDate, selectedAssignee, selectedStatus, selectedPriority, searchQuery]);

  const tabFilteredTasks = useMemo(() => {
    if (activeTab === "all") return filteredTasks;
    if (activeTab === "overdue") return filteredTasks.filter(t => isOverdue(t));
    if (activeTab === "completed") return filteredTasks.filter(t => t.status === "completed");
    if (activeTab === "pending") return filteredTasks.filter(t => t.status === "pending" || t.status === "followup");
    return filteredTasks;
  }, [filteredTasks, activeTab]);

  const stats = useMemo(() => {
    if (!filteredTasks.length) {
      return {
        total: 0,
        pending: 0,
        completed: 0,
        overdue: 0,
        highPriority: 0,
        completionRate: 0,
      };
    }

    const pending = filteredTasks.filter(t => t.status === "pending" || t.status === "followup").length;
    const completed = filteredTasks.filter(t => t.status === "completed").length;
    const overdue = filteredTasks.filter(t => isOverdue(t)).length;
    const highPriority = filteredTasks.filter(t => t.priority === "high" || t.priority === "urgent").length;

    return {
      total: filteredTasks.length,
      pending,
      completed,
      overdue,
      highPriority,
      completionRate: filteredTasks.length > 0 ? Math.round((completed / filteredTasks.length) * 100) : 0,
    };
  }, [filteredTasks]);

  const pieChartData = useMemo(() => [
    { name: "Pending", value: stats.pending, color: STATUS_COLORS.pending },
    { name: "Completed", value: stats.completed, color: STATUS_COLORS.completed },
    { name: "Overdue", value: stats.overdue, color: STATUS_COLORS.overdue },
  ], [stats]);

  const barChartData = useMemo(() => {
    if (!tasks || !users) return [];
    
    const userTaskData: Record<string, { name: string; completed: number; pending: number; overdue: number }> = {};
    
    tasks.forEach(task => {
      const assignedTo = task.assignedTo || 'unassigned';
      const user = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
      const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unassigned';
      
      if (!userTaskData[assignedTo]) {
        userTaskData[assignedTo] = { name: userName, completed: 0, pending: 0, overdue: 0 };
      }
      
      if (task.status === "completed") {
        userTaskData[assignedTo].completed++;
      } else if (isOverdue(task)) {
        userTaskData[assignedTo].overdue++;
      } else {
        userTaskData[assignedTo].pending++;
      }
    });
    
    return Object.values(userTaskData).slice(0, 10);
  }, [tasks, users]);

  const paginatedData = paginateData(tabFilteredTasks);
  const totalPages = getTotalPages(tabFilteredTasks.length);

  const prepareExportData = () => {
    return tabFilteredTasks.map(task => ({
      "Title": task.title,
      "Description": task.description || "",
      "Status": task.status,
      "Priority": task.priority || "medium",
      "Assigned To": task.assignedToUser ? `${task.assignedToUser.firstName || ''} ${task.assignedToUser.lastName || ''}`.trim() : "Unassigned",
      "Created By": task.createdByUser ? `${task.createdByUser.firstName || ''} ${task.createdByUser.lastName || ''}`.trim() : "Unknown",
      "Due Date": task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-",
      "Created At": task.createdAt ? format(new Date(task.createdAt), "dd/MM/yyyy") : "-",
      "Overdue": isOverdue(task) ? "Yes" : "No",
    }));
  };

  const handleSendEmail = () => {
    const exportData = prepareExportData();
    let tableHtml = `
      <h2>Tasks Report - M-CRM</h2>
      <p>Report generated on ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      <p><strong>Summary:</strong> Total: ${stats.total}, Pending: ${stats.pending}, Completed: ${stats.completed}, Overdue: ${stats.overdue}</p>
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
            <ListTodo className="h-6 w-6 text-blue-500" />
            Tasks Reports
          </h1>
          <p className="text-muted-foreground">Task analytics and performance overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(prepareExportData(), "tasks_report")}
            disabled={tabFilteredTasks.length === 0}
            data-testid="button-export-csv"
          >
            <FileText className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(prepareExportData(), "tasks_report")}
            disabled={tabFilteredTasks.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={tabFilteredTasks.length === 0}
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
              <Label>Assigned To</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="select-assignee">
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="followup">Follow Up</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="get_information">Get Information</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
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
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold" data-testid="text-total-tasks">{stats.total}</p>
              </div>
              <ListTodo className="h-8 w-8 text-blue-500 opacity-80" />
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
              <Clock className="h-8 w-8 text-yellow-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500" data-testid="text-completed-count">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500" data-testid="text-overdue-count">{stats.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-500" data-testid="text-high-priority">{stats.highPriority}</p>
              </div>
              <Target className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-500" data-testid="text-completion-rate">{stats.completionRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Status Distribution</CardTitle>
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
            <CardTitle className="text-lg">Tasks by Assignee</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" />
                <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all">All ({filteredTasks.length})</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed ({stats.completed})</TabsTrigger>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Overdue ({stats.overdue})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No tasks found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((task) => (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">{task.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                task.status === "completed" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                task.status === "pending" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                task.status === "followup" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                "bg-purple-500/10 text-purple-600 border-purple-500/20"
                              }
                            >
                              {task.status}
                            </Badge>
                            {isOverdue(task) && (
                              <Badge variant="destructive" className="ml-1">Overdue</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                task.priority === "urgent" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                task.priority === "high" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                                task.priority === "medium" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                "bg-gray-500/10 text-gray-600 border-gray-500/20"
                              }
                            >
                              {task.priority || "medium"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {task.assignedToUser ? 
                              `${task.assignedToUser.firstName || ''} ${task.assignedToUser.lastName || ''}`.trim() || task.assignedToUser.email 
                              : "Unassigned"}
                          </TableCell>
                          <TableCell>
                            {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            {task.createdAt ? format(new Date(task.createdAt), "dd/MM/yyyy") : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {tabFilteredTasks.length > 0 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={tabFilteredTasks.length}
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
            <DialogDescription>Send the tasks report to specified email addresses</DialogDescription>
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
