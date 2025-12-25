import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Megaphone,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Globe,
  Share2,
  Target,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardData {
  statusCounts: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  metrics: {
    today: MetricsData;
    week: MetricsData;
    month: MetricsData;
    total: MetricsData;
  };
  teamSummary: TeamMember[];
  recentReports: MarketingReport[];
  pendingApproval: MarketingReport[];
}

interface MetricsData {
  totalReports: number;
  websiteSessions: number;
  websiteConversions: number;
  socialLikes: number;
  socialShares: number;
  socialComments: number;
  emailConversions: number;
  adBudgetUsed: number;
  leadsGenerated: number;
  costPerLead: number;
}

interface TeamMember {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  totalReports: number;
  approved: number;
  pending: number;
  draft: number;
  totalLeads: number;
}

interface MarketingReport {
  id: string;
  userId: string;
  reportDate: string;
  status: string;
  websiteSessions: number | null;
  leadsGenerated: number | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const COLORS = ['#1a2b6d', '#f5a623', '#4ade80', '#f87171'];
const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export default function MarketingDashboard() {
  const { user } = useAuth();
  
  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/marketing/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  if (error || !dashboard) {
    const isAccessDenied = (error as any)?.message?.includes("403") || (error as any)?.message?.includes("Access denied");
    
    if (isAccessDenied) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500" />
          <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-md">
            You don't have permission to access the Marketing Dashboard.
          </p>
          <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
            Go Back
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    );
  }

  const statusData = [
    { name: 'Draft', value: dashboard.statusCounts.draft, color: '#94a3b8' },
    { name: 'Submitted', value: dashboard.statusCounts.submitted, color: '#60a5fa' },
    { name: 'Approved', value: dashboard.statusCounts.approved, color: '#4ade80' },
    { name: 'Rejected', value: dashboard.statusCounts.rejected, color: '#f87171' },
  ];

  const metricsComparisonData = [
    { 
      name: 'Today', 
      leads: dashboard.metrics.today.leadsGenerated,
      sessions: dashboard.metrics.today.websiteSessions,
    },
    { 
      name: 'This Week', 
      leads: dashboard.metrics.week.leadsGenerated,
      sessions: dashboard.metrics.week.websiteSessions,
    },
    { 
      name: 'This Month', 
      leads: dashboard.metrics.month.leadsGenerated,
      sessions: dashboard.metrics.month.websiteSessions,
    },
  ];

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

  const totalReports = dashboard.statusCounts.draft + dashboard.statusCounts.submitted + 
                       dashboard.statusCounts.approved + dashboard.statusCounts.rejected;
  const approvalRate = totalReports > 0 
    ? Math.round((dashboard.statusCounts.approved / totalReports) * 100) 
    : 0;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="marketing-dashboard-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Megaphone className="h-7 w-7 text-purple-600" />
            Digital Marketing Dashboard
          </h1>
          <p className="text-muted-foreground">Overview of marketing team performance and activities</p>
        </div>
        <Link href="/marketing/daily-report">
          <Button data-testid="button-view-reports">
            <FileText className="h-4 w-4 mr-2" />
            Daily Reports
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate" data-testid="card-total-reports">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.statusCounts.approved} approved
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-pending-approval">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{dashboard.statusCounts.submitted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-leads-generated">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Generated</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboard.metrics.month.leadsGenerated}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-ad-budget">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ad Budget Used</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{dashboard.metrics.month.adBudgetUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="month" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              {['today', 'week', 'month'].map((period) => (
                <TabsContent key={period} value={period} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        Website Sessions
                      </div>
                      <div className="text-xl font-bold">
                        {dashboard.metrics[period as keyof typeof dashboard.metrics].websiteSessions.toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Target className="h-4 w-4" />
                        Leads Generated
                      </div>
                      <div className="text-xl font-bold">
                        {dashboard.metrics[period as keyof typeof dashboard.metrics].leadsGenerated}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Share2 className="h-4 w-4" />
                        Social Engagement
                      </div>
                      <div className="text-xl font-bold">
                        {(dashboard.metrics[period as keyof typeof dashboard.metrics].socialLikes + 
                          dashboard.metrics[period as keyof typeof dashboard.metrics].socialShares + 
                          dashboard.metrics[period as keyof typeof dashboard.metrics].socialComments).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        Cost Per Lead
                      </div>
                      <div className="text-xl font-bold">
                        ₹{dashboard.metrics[period as keyof typeof dashboard.metrics].costPerLead}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Approval Rate:</span>
              <span className="font-bold text-green-600">{approvalRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {dashboard.pendingApproval.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-muted-foreground">No reports pending approval</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.pendingApproval.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {report.user?.firstName?.[0]}{report.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {report.user?.firstName} {report.user?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(report.reportDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Link href="/marketing/daily-report">
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {dashboard.teamSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No team data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-center">Reports</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.teamSummary.map((member) => (
                      <TableRow key={member.user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">
                                {member.user.firstName[0]}{member.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {member.user.firstName} {member.user.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-medium">{member.totalReports}</span>
                            <span className="text-xs text-muted-foreground">
                              {member.approved} approved
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium text-green-600">
                          {member.totalLeads}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.recentReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No reports yet
                  </TableCell>
                </TableRow>
              ) : (
                dashboard.recentReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {format(new Date(report.reportDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {report.user?.firstName} {report.user?.lastName}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-right">{report.websiteSessions ?? "-"}</TableCell>
                    <TableCell className="text-right">{report.leadsGenerated ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
