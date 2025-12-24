import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CalendarDays,
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Globe,
  Share2,
  Mail,
  DollarSign,
  TrendingUp,
  Target,
  Lightbulb,
  AlertTriangle,
  Calendar,
  Loader2,
  FileText,
  Eye,
  Edit,
  LayoutList,
} from "lucide-react";

interface MarketingTaskEntry {
  id?: string;
  startTime: string;
  endTime: string;
  taskDescription: string;
  platform: string;
  toolUsed: string;
  status: string;
  remarks: string;
  sortOrder: number;
}

interface MarketingDailyReport {
  id: string;
  userId: string;
  reportDate: string;
  status: string;
  websiteSessions: number | null;
  bounceRate: string | null;
  websiteConversions: number | null;
  socialLikes: number | null;
  socialShares: number | null;
  socialComments: number | null;
  socialCtr: string | null;
  emailOpenRate: string | null;
  emailClickRate: string | null;
  emailConversions: number | null;
  adBudgetUsed: number | null;
  leadsGenerated: number | null;
  costPerLead: number | null;
  achievements: string[] | null;
  issues: string[] | null;
  tomorrowPlan: string[] | null;
  additionalNotes: string | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  taskEntries?: MarketingTaskEntry[];
}

const PLATFORMS = [
  "Website",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Twitter/X",
  "YouTube",
  "Google Ads",
  "Meta Ads",
  "Email",
  "WhatsApp",
  "Other",
];

const TOOLS = [
  "Canva",
  "Photoshop",
  "Figma",
  "Google Analytics",
  "Facebook Business Suite",
  "Mailchimp",
  "HubSpot",
  "SEMrush",
  "Hootsuite",
  "Buffer",
  "WordPress",
  "Other",
];

const TASK_STATUSES = [
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { value: "blocked", label: "Blocked", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
];

export default function MarketingDailyReport() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("my-reports");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<MarketingDailyReport | null>(null);
  const [editingReport, setEditingReport] = useState<MarketingDailyReport | null>(null);

  const [formData, setFormData] = useState({
    reportDate: format(new Date(), "yyyy-MM-dd"),
    websiteSessions: "",
    bounceRate: "",
    websiteConversions: "",
    socialLikes: "",
    socialShares: "",
    socialComments: "",
    socialCtr: "",
    emailOpenRate: "",
    emailClickRate: "",
    emailConversions: "",
    adBudgetUsed: "",
    leadsGenerated: "",
    costPerLead: "",
    achievements: [""],
    issues: [""],
    tomorrowPlan: [""],
    additionalNotes: "",
  });

  const [taskEntries, setTaskEntries] = useState<MarketingTaskEntry[]>([
    { startTime: "09:00", endTime: "10:00", taskDescription: "", platform: "", toolUsed: "", status: "completed", remarks: "", sortOrder: 0 },
  ]);

  const { data: reports = [], isLoading } = useQuery<MarketingDailyReport[]>({
    queryKey: ["/api/marketing-reports"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/marketing-reports", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing-reports"] });
      toast({ title: "Report created successfully" });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating report", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/marketing-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing-reports"] });
      toast({ title: "Report updated successfully" });
      setEditingReport(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating report", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/marketing-reports/${id}/submit`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing-reports"] });
      toast({ title: "Report submitted for approval" });
      setViewingReport(null);
    },
    onError: (error: any) => {
      toast({ title: "Error submitting report", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      reportDate: format(new Date(), "yyyy-MM-dd"),
      websiteSessions: "",
      bounceRate: "",
      websiteConversions: "",
      socialLikes: "",
      socialShares: "",
      socialComments: "",
      socialCtr: "",
      emailOpenRate: "",
      emailClickRate: "",
      emailConversions: "",
      adBudgetUsed: "",
      leadsGenerated: "",
      costPerLead: "",
      achievements: [""],
      issues: [""],
      tomorrowPlan: [""],
      additionalNotes: "",
    });
    setTaskEntries([
      { startTime: "09:00", endTime: "10:00", taskDescription: "", platform: "", toolUsed: "", status: "completed", remarks: "", sortOrder: 0 },
    ]);
  };

  const handleArrayFieldChange = (field: 'achievements' | 'issues' | 'tomorrowPlan', index: number, value: string) => {
    const newArr = [...formData[field]];
    newArr[index] = value;
    setFormData({ ...formData, [field]: newArr });
  };

  const addArrayField = (field: 'achievements' | 'issues' | 'tomorrowPlan') => {
    setFormData({ ...formData, [field]: [...formData[field], ""] });
  };

  const removeArrayField = (field: 'achievements' | 'issues' | 'tomorrowPlan', index: number) => {
    const newArr = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArr.length > 0 ? newArr : [""] });
  };

  const addTaskEntry = () => {
    setTaskEntries([
      ...taskEntries,
      { startTime: "", endTime: "", taskDescription: "", platform: "", toolUsed: "", status: "completed", remarks: "", sortOrder: taskEntries.length },
    ]);
  };

  const removeTaskEntry = (index: number) => {
    if (taskEntries.length > 1) {
      setTaskEntries(taskEntries.filter((_, i) => i !== index));
    }
  };

  const updateTaskEntry = (index: number, field: keyof MarketingTaskEntry, value: string | number) => {
    const newEntries = [...taskEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setTaskEntries(newEntries);
  };

  const handleSubmit = () => {
    const payload = {
      reportDate: new Date(formData.reportDate).toISOString(),
      websiteSessions: formData.websiteSessions ? parseInt(formData.websiteSessions) : null,
      bounceRate: formData.bounceRate || null,
      websiteConversions: formData.websiteConversions ? parseInt(formData.websiteConversions) : null,
      socialLikes: formData.socialLikes ? parseInt(formData.socialLikes) : null,
      socialShares: formData.socialShares ? parseInt(formData.socialShares) : null,
      socialComments: formData.socialComments ? parseInt(formData.socialComments) : null,
      socialCtr: formData.socialCtr || null,
      emailOpenRate: formData.emailOpenRate || null,
      emailClickRate: formData.emailClickRate || null,
      emailConversions: formData.emailConversions ? parseInt(formData.emailConversions) : null,
      adBudgetUsed: formData.adBudgetUsed ? parseInt(formData.adBudgetUsed) : null,
      leadsGenerated: formData.leadsGenerated ? parseInt(formData.leadsGenerated) : null,
      costPerLead: formData.costPerLead ? parseInt(formData.costPerLead) : null,
      achievements: formData.achievements.filter(a => a.trim()),
      issues: formData.issues.filter(i => i.trim()),
      tomorrowPlan: formData.tomorrowPlan.filter(p => p.trim()),
      additionalNotes: formData.additionalNotes || null,
      taskEntries: taskEntries.filter(t => t.taskDescription.trim()),
    };

    if (editingReport) {
      updateMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEditMode = (report: MarketingDailyReport) => {
    setEditingReport(report);
    setFormData({
      reportDate: format(new Date(report.reportDate), "yyyy-MM-dd"),
      websiteSessions: report.websiteSessions?.toString() || "",
      bounceRate: report.bounceRate || "",
      websiteConversions: report.websiteConversions?.toString() || "",
      socialLikes: report.socialLikes?.toString() || "",
      socialShares: report.socialShares?.toString() || "",
      socialComments: report.socialComments?.toString() || "",
      socialCtr: report.socialCtr || "",
      emailOpenRate: report.emailOpenRate || "",
      emailClickRate: report.emailClickRate || "",
      emailConversions: report.emailConversions?.toString() || "",
      adBudgetUsed: report.adBudgetUsed?.toString() || "",
      leadsGenerated: report.leadsGenerated?.toString() || "",
      costPerLead: report.costPerLead?.toString() || "",
      achievements: report.achievements?.length ? report.achievements : [""],
      issues: report.issues?.length ? report.issues : [""],
      tomorrowPlan: report.tomorrowPlan?.length ? report.tomorrowPlan : [""],
      additionalNotes: report.additionalNotes || "",
    });
    setTaskEntries(report.taskEntries?.length ? report.taskEntries : [
      { startTime: "09:00", endTime: "10:00", taskDescription: "", platform: "", toolUsed: "", status: "completed", remarks: "", sortOrder: 0 },
    ]);
    setIsFormOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Draft</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Submitted</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Daily Marketing Report
          </h1>
          <p className="text-muted-foreground">Track your daily marketing activities and performance</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingReport(null); setIsFormOpen(true); }} data-testid="button-new-report">
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-reports" data-testid="tab-my-reports">
            <FileText className="h-4 w-4 mr-2" />
            My Reports
          </TabsTrigger>
          <TabsTrigger value="all-reports" data-testid="tab-all-reports">
            <LayoutList className="h-4 w-4 mr-2" />
            All Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-reports" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No reports yet</p>
                <p className="text-muted-foreground mb-4">Create your first daily marketing report</p>
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover-elevate cursor-pointer" onClick={() => setViewingReport(report)} data-testid={`card-report-${report.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="font-semibold">{format(new Date(report.reportDate), "EEEE, MMMM d, yyyy")}</span>
                          <span className="text-sm text-muted-foreground">
                            Created {format(new Date(report.createdAt), "h:mm a")}
                          </span>
                        </div>
                        {getStatusBadge(report.status)}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        {report.leadsGenerated !== null && (
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-green-500" />
                            <span>{report.leadsGenerated} leads</span>
                          </div>
                        )}
                        {report.websiteSessions !== null && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-4 w-4 text-blue-500" />
                            <span>{report.websiteSessions} sessions</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewingReport(report); }} data-testid={`button-view-${report.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {report.status === "draft" && (
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditMode(report); }} data-testid={`button-edit-${report.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all-reports" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                      <TableCell className="font-medium">{format(new Date(report.reportDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {report.user ? `${report.user.firstName} ${report.user.lastName}` : "Unknown"}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>{report.leadsGenerated ?? "-"}</TableCell>
                      <TableCell>{report.websiteSessions ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setViewingReport(report)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingReport(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {editingReport ? "Edit Daily Report" : "New Daily Report"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6 p-1">
              <div>
                <Label>Report Date</Label>
                <Input
                  type="date"
                  value={formData.reportDate}
                  onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
                  data-testid="input-report-date"
                />
              </div>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Task Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {taskEntries.map((entry, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start border-b pb-4 last:border-0">
                      <div className="col-span-2">
                        <Label className="text-xs">Start</Label>
                        <Input
                          type="time"
                          value={entry.startTime}
                          onChange={(e) => updateTaskEntry(index, "startTime", e.target.value)}
                          data-testid={`input-start-time-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">End</Label>
                        <Input
                          type="time"
                          value={entry.endTime}
                          onChange={(e) => updateTaskEntry(index, "endTime", e.target.value)}
                          data-testid={`input-end-time-${index}`}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Task</Label>
                        <Input
                          placeholder="What did you work on?"
                          value={entry.taskDescription}
                          onChange={(e) => updateTaskEntry(index, "taskDescription", e.target.value)}
                          data-testid={`input-task-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Platform</Label>
                        <Select value={entry.platform} onValueChange={(v) => updateTaskEntry(index, "platform", v)}>
                          <SelectTrigger data-testid={`select-platform-${index}`}>
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Status</Label>
                        <Select value={entry.status} onValueChange={(v) => updateTaskEntry(index, "status", v)}>
                          <SelectTrigger data-testid={`select-status-${index}`}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTaskEntry(index)}
                          disabled={taskEntries.length === 1}
                          data-testid={`button-remove-task-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTaskEntry} data-testid="button-add-task">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4" /> Website
                      </h4>
                      <div>
                        <Label className="text-xs">Sessions</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.websiteSessions}
                          onChange={(e) => setFormData({ ...formData, websiteSessions: e.target.value })}
                          data-testid="input-website-sessions"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bounce Rate</Label>
                        <Input
                          placeholder="e.g., 45.2%"
                          value={formData.bounceRate}
                          onChange={(e) => setFormData({ ...formData, bounceRate: e.target.value })}
                          data-testid="input-bounce-rate"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Conversions</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.websiteConversions}
                          onChange={(e) => setFormData({ ...formData, websiteConversions: e.target.value })}
                          data-testid="input-website-conversions"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2 text-sm">
                        <Share2 className="h-4 w-4" /> Social Media
                      </h4>
                      <div>
                        <Label className="text-xs">Likes</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.socialLikes}
                          onChange={(e) => setFormData({ ...formData, socialLikes: e.target.value })}
                          data-testid="input-social-likes"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Shares</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.socialShares}
                          onChange={(e) => setFormData({ ...formData, socialShares: e.target.value })}
                          data-testid="input-social-shares"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CTR</Label>
                        <Input
                          placeholder="e.g., 2.5%"
                          value={formData.socialCtr}
                          onChange={(e) => setFormData({ ...formData, socialCtr: e.target.value })}
                          data-testid="input-social-ctr"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4" /> Ads & Leads
                      </h4>
                      <div>
                        <Label className="text-xs">Ad Budget Used</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.adBudgetUsed}
                          onChange={(e) => setFormData({ ...formData, adBudgetUsed: e.target.value })}
                          data-testid="input-ad-budget"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Leads Generated</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.leadsGenerated}
                          onChange={(e) => setFormData({ ...formData, leadsGenerated: e.target.value })}
                          data-testid="input-leads-generated"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cost Per Lead</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.costPerLead}
                          onChange={(e) => setFormData({ ...formData, costPerLead: e.target.value })}
                          data-testid="input-cost-per-lead"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Key Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {formData.achievements.map((achievement, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="What did you accomplish today?"
                        value={achievement}
                        onChange={(e) => handleArrayFieldChange("achievements", index, e.target.value)}
                        data-testid={`input-achievement-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayField("achievements", index)}
                        disabled={formData.achievements.length === 1 && !achievement}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addArrayField("achievements")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Achievement
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issues / Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {formData.issues.map((issue, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Any blockers or challenges?"
                        value={issue}
                        onChange={(e) => handleArrayFieldChange("issues", index, e.target.value)}
                        data-testid={`input-issue-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayField("issues", index)}
                        disabled={formData.issues.length === 1 && !issue}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addArrayField("issues")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Issue
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Plan for Tomorrow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {formData.tomorrowPlan.map((plan, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="What will you work on tomorrow?"
                        value={plan}
                        onChange={(e) => handleArrayFieldChange("tomorrowPlan", index, e.target.value)}
                        data-testid={`input-plan-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayField("tomorrowPlan", index)}
                        disabled={formData.tomorrowPlan.length === 1 && !plan}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addArrayField("tomorrowPlan")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Plan
                  </Button>
                </CardContent>
              </Card>

              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any other information to share..."
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  rows={3}
                  data-testid="input-additional-notes"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsFormOpen(false); setEditingReport(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-report">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              {editingReport ? "Update" : "Save"} as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Daily Report - {viewingReport && format(new Date(viewingReport.reportDate), "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          {viewingReport && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  {getStatusBadge(viewingReport.status)}
                  <span className="text-sm text-muted-foreground">
                    Created {format(new Date(viewingReport.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>

                {viewingReport.taskEntries && viewingReport.taskEntries.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-lg">Task Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingReport.taskEntries.map((entry, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{entry.startTime} - {entry.endTime}</TableCell>
                              <TableCell>{entry.taskDescription}</TableCell>
                              <TableCell>{entry.platform}</TableCell>
                              <TableCell>
                                <Badge className={TASK_STATUSES.find(s => s.value === entry.status)?.color || ""}>
                                  {TASK_STATUSES.find(s => s.value === entry.status)?.label || entry.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Website</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Sessions:</span><span>{viewingReport.websiteSessions ?? "-"}</span></div>
                        <div className="flex justify-between"><span>Bounce Rate:</span><span>{viewingReport.bounceRate ?? "-"}</span></div>
                        <div className="flex justify-between"><span>Conversions:</span><span>{viewingReport.websiteConversions ?? "-"}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Share2 className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Social Media</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Likes:</span><span>{viewingReport.socialLikes ?? "-"}</span></div>
                        <div className="flex justify-between"><span>Shares:</span><span>{viewingReport.socialShares ?? "-"}</span></div>
                        <div className="flex justify-between"><span>CTR:</span><span>{viewingReport.socialCtr ?? "-"}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Ads & Leads</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Budget Used:</span><span>{viewingReport.adBudgetUsed ?? "-"}</span></div>
                        <div className="flex justify-between"><span>Leads:</span><span>{viewingReport.leadsGenerated ?? "-"}</span></div>
                        <div className="flex justify-between"><span>Cost/Lead:</span><span>{viewingReport.costPerLead ?? "-"}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {viewingReport.achievements && viewingReport.achievements.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Achievements</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {viewingReport.achievements.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {viewingReport.issues && viewingReport.issues.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-yellow-500" /> Issues</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {viewingReport.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}

                {viewingReport.tomorrowPlan && viewingReport.tomorrowPlan.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" /> Plan for Tomorrow</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {viewingReport.tomorrowPlan.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}

                {viewingReport.additionalNotes && (
                  <div>
                    <h4 className="font-medium mb-2">Additional Notes</h4>
                    <p className="text-sm text-muted-foreground">{viewingReport.additionalNotes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingReport(null)}>
              Close
            </Button>
            {viewingReport?.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => { openEditMode(viewingReport); setViewingReport(null); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button onClick={() => submitMutation.mutate(viewingReport.id)} disabled={submitMutation.isPending} data-testid="button-submit-report">
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Approval
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
