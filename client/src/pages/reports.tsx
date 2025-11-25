import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Area,
  AreaChart,
} from "recharts";
import {
  Download,
  TrendingUp,
  Users,
  Ticket,
  FolderKanban,
  Target,
  Clock,
  Star,
  BarChart3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface SalesAnalytics {
  pipelineData: { stage: string; count: number }[];
  sourceData: { name: string; value: number }[];
  conversionRate: number;
  avgDealSize: number;
  avgSalesCycle: number;
}

interface TicketAnalytics {
  priorityData: { priority: string; count: number }[];
  statusData: { name: string; value: number }[];
  avgResolutionTime: number;
  avgFirstResponseTime: number;
  customerSatisfaction: number;
}

interface ProjectAnalytics {
  statusData: { name: string; value: number }[];
}

interface TimeSeriesAnalytics {
  timeSeriesData: { date: string; leads: number; tickets: number; deals: number }[];
}

interface ProductivityMember {
  id: string;
  name: string;
  role: string;
  ticketsResolved: number;
  activeTickets: number;
  projectsCompleted: number;
  activeProjects: number;
  trainingHours: number;
}

interface ProductivityAnalytics {
  productivityData: ProductivityMember[];
}

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
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesAnalytics>({
    queryKey: ["/api/reports/sales"],
  });

  const { data: ticketData, isLoading: ticketLoading } = useQuery<TicketAnalytics>({
    queryKey: ["/api/reports/tickets"],
  });

  const { data: projectData, isLoading: projectLoading } = useQuery<ProjectAnalytics>({
    queryKey: ["/api/reports/projects"],
  });

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery<TimeSeriesAnalytics>({
    queryKey: ["/api/reports/timeseries"],
  });

  const { data: productivityData, isLoading: productivityLoading } = useQuery<ProductivityAnalytics>({
    queryKey: ["/api/reports/productivity"],
  });

  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`/api/reports/export/${type}`);
      const data = await response.json();
      exportToCSV(data, type);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("leads")}
            data-testid="button-export-leads"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Leads
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("projects")}
            data-testid="button-export-projects"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Projects
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("tickets")}
            data-testid="button-export-tickets"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Tickets
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="productivity" data-testid="tab-productivity">
            <Users className="w-4 h-4 mr-2" />
            Team Productivity
          </TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales-reports">
            <Target className="w-4 h-4 mr-2" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-project-reports">
            <FolderKanban className="w-4 h-4 mr-2" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support-reports">
            <Ticket className="w-4 h-4 mr-2" />
            Support
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Time Series Analytics */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Activity Trends (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeSeriesLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : timeSeriesData?.timeSeriesData ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={timeSeriesData.timeSeriesData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                      name="New Leads"
                    />
                    <Area
                      type="monotone"
                      dataKey="tickets"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorTickets)"
                      name="New Tickets"
                    />
                    <Area
                      type="monotone"
                      dataKey="deals"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorDeals)"
                      name="Deals Won"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">No data available</p>
              )}
            </CardContent>
          </Card>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Target className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-conversion-rate">
                  {salesLoading ? <Skeleton className="h-8 w-16" /> : `${salesData?.conversionRate || 0}%`}
                </div>
                <p className="text-xs text-muted-foreground">Leads to closed won</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-resolution">
                  {ticketLoading ? <Skeleton className="h-8 w-16" /> : `${ticketData?.avgResolutionTime || 0}h`}
                </div>
                <p className="text-xs text-muted-foreground">Average time to close tickets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
                <Star className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-satisfaction">
                  {ticketLoading ? <Skeleton className="h-8 w-16" /> : `${ticketData?.customerSatisfaction || 0}%`}
                </div>
                <p className="text-xs text-muted-foreground">Based on feedback</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Deal Size</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-deal">
                  {salesLoading ? <Skeleton className="h-8 w-16" /> : `$${(salesData?.avgDealSize || 0).toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground">Average value per deal</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Productivity Tab */}
        <TabsContent value="productivity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Engineer & Support Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productivityLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (productivityData?.productivityData?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-center">Tickets Resolved</TableHead>
                        <TableHead className="text-center">Active Tickets</TableHead>
                        <TableHead className="text-center">Projects Completed</TableHead>
                        <TableHead className="text-center">Active Projects</TableHead>
                        <TableHead className="text-center">Training Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productivityData?.productivityData?.map((member: ProductivityMember) => (
                        <TableRow key={member.id} data-testid={`row-productivity-${member.id}`}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {member.role === "engineer" ? "Engineer" : "Support"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {member.ticketsResolved}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{member.activeTickets}</TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {member.projectsCompleted}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{member.activeProjects}</TableCell>
                          <TableCell className="text-center">{member.trainingHours}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  No engineer or support team members found
                </p>
              )}
            </CardContent>
          </Card>

          {/* Productivity Chart */}
          {(productivityData?.productivityData?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tickets Resolved by Team Member</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productivityData?.productivityData?.slice(0, 10) || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ticketsResolved" fill="#10b981" name="Tickets Resolved" />
                    <Bar dataKey="projectsCompleted" fill="#3b82f6" name="Projects Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sales Pipeline Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : salesData?.pipelineData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesData.pipelineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : salesData?.sourceData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={salesData.sourceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {salesData.sourceData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {salesData?.conversionRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads to closed won
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Deal Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${(salesData?.avgDealSize || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average value per deal
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales Cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {salesData?.avgSalesCycle || 0}d
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average days to close
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {projectLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : projectData?.statusData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={projectData.statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {projectData.statusData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Status Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : projectData?.statusData ? (
                  projectData.statusData.map((status: any, index: number) => (
                    <div key={status.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{status.name}</span>
                      </div>
                      <span className="font-semibold">{status.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tickets by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                {ticketLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : ticketData?.priorityData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={ticketData.priorityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="#ef4444" name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tickets by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {ticketLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : ticketData?.statusData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={ticketData.statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {ticketData.statusData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Resolution Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {ticketData?.avgResolutionTime || 0}h
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average time to close
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">First Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {ticketData?.avgFirstResponseTime || 0}h
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average first response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Satisfaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {ticketData?.customerSatisfaction || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on feedback
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
