import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Target, Briefcase, HeadphonesIcon,
  AlertTriangle, Calendar, ChevronRight, ChevronLeft, Trophy, Award,
  DollarSign, CheckCircle, XCircle, Clock, ArrowUp, ArrowDown,
  BarChart3, TableIcon, Percent, Activity, Eye, MessageSquare, User, Phone, Mail, Star, Layers
} from "lucide-react";

const COLORS = ['#1a2b6d', '#f5a623', '#4ade80', '#f87171', '#60a5fa', '#a78bfa'];
const CHART_COLORS = {
  primary: '#1a2b6d',
  accent: '#f5a623',
  success: '#4ade80',
  danger: '#f87171',
  info: '#60a5fa',
  purple: '#a78bfa'
};

type ViewMode = 'graphical' | 'statistics';

interface OverviewData {
  sales: {
    today: { newLeads: number; followups: number; dealsWon: number; dealsWonValue: number; dealsLost: number; dealsLostValue: number };
    week: { newLeads: number; followups: number; dealsWon: number; dealsWonValue: number; dealsLost: number; dealsLostValue: number };
    month: { newLeads: number; followups: number; dealsWon: number; dealsWonValue: number; dealsLost: number; dealsLostValue: number };
    year: { newLeads: number; followups: number; dealsWon: number; dealsWonValue: number; dealsLost: number; dealsLostValue: number };
    total: { leads: number; activeLeads: number; negotiation: number };
  };
  implementation: {
    today: { started: number; completed: number };
    week: { started: number; completed: number };
    month: { started: number; completed: number };
    year: { started: number; completed: number };
    total: { projects: number; inProgress: number; training: number; completed: number; overdue: number };
  };
  support: {
    today: { opened: number; closed: number };
    week: { opened: number; closed: number };
    month: { opened: number; closed: number };
    year: { opened: number; closed: number };
    total: { tickets: number; open: number; inProgress: number; escalated: number; critical: number; overdue: number };
  };
}

interface SalesBucket {
  period: string;
  label: string;
  newLeads: number;
  newLeadsValue: number;
  dealsWon: number;
  dealsWonValue: number;
  dealsLost: number;
  dealsLostValue: number;
  weekNumber?: number;
}

interface ImplementationBucket {
  period: string;
  label: string;
  started: number;
  completed: number;
  overdue: number;
  weekNumber?: number;
}

interface SupportBucket {
  period: string;
  label: string;
  opened: number;
  closed: number;
  critical: number;
  overdue: number;
  weekNumber?: number;
}

interface DevelopmentBucket {
  period: string;
  label: string;
  created: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  fromSupport: number;
  fromImplementation: number;
  fromTasks: number;
  manual: number;
  week?: number;
}

interface PerformanceUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  metrics: {
    sales: { leadsGenerated: number; dealsWon: number; dealsWonValue: number; dealsLost: number; followUpsCompleted: number; winRate: number };
    implementation: { projectsAssigned: number; projectsCompleted: number };
    support: { ticketsAssigned: number; ticketsClosed: number; overdueTickets: number };
  };
  scores: { sales: number; implementation: number; support: number; total: number };
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `₹${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function ViewModeToggle({ viewMode, onViewModeChange }: { viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      <Button
        variant={viewMode === 'graphical' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('graphical')}
        className="gap-2"
        data-testid="btn-view-graphical"
      >
        <BarChart3 className="h-4 w-4" />
        Graphical
      </Button>
      <Button
        variant={viewMode === 'statistics' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('statistics')}
        className="gap-2"
        data-testid="btn-view-statistics"
      >
        <TableIcon className="h-4 w-4" />
        Statistics
      </Button>
    </div>
  );
}

function StatCard({ 
  title, 
  icon: Icon, 
  iconColor = "text-primary",
  children 
}: { 
  title: string; 
  icon: any;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverviewTabGraphical({ data }: { data: OverviewData }) {
  const salesChartData = [
    { name: 'Today', newLeads: data.sales.today.newLeads, won: data.sales.today.dealsWon, lost: data.sales.today.dealsLost },
    { name: 'Week', newLeads: data.sales.week.newLeads, won: data.sales.week.dealsWon, lost: data.sales.week.dealsLost },
    { name: 'Month', newLeads: data.sales.month.newLeads, won: data.sales.month.dealsWon, lost: data.sales.month.dealsLost },
    { name: 'Year', newLeads: data.sales.year.newLeads, won: data.sales.year.dealsWon, lost: data.sales.year.dealsLost },
  ];

  const implementationChartData = [
    { name: 'Today', started: data.implementation.today.started, completed: data.implementation.today.completed },
    { name: 'Week', started: data.implementation.week.started, completed: data.implementation.week.completed },
    { name: 'Month', started: data.implementation.month.started, completed: data.implementation.month.completed },
    { name: 'Year', started: data.implementation.year.started, completed: data.implementation.year.completed },
  ];

  const supportChartData = [
    { name: 'Today', opened: data.support.today.opened, closed: data.support.today.closed },
    { name: 'Week', opened: data.support.week.opened, closed: data.support.week.closed },
    { name: 'Month', opened: data.support.month.opened, closed: data.support.month.closed },
    { name: 'Year', opened: data.support.year.opened, closed: data.support.year.closed },
  ];

  const salesPieData = [
    { name: 'Active', value: data.sales.total.activeLeads, color: CHART_COLORS.info },
    { name: 'Negotiation', value: data.sales.total.negotiation, color: CHART_COLORS.accent },
    { name: 'Won (Month)', value: data.sales.month.dealsWon, color: CHART_COLORS.success },
    { name: 'Lost (Month)', value: data.sales.month.dealsLost, color: CHART_COLORS.danger },
  ];

  const implPieData = [
    { name: 'In Progress', value: data.implementation.total.inProgress, color: CHART_COLORS.info },
    { name: 'Training', value: data.implementation.total.training, color: CHART_COLORS.accent },
    { name: 'Completed', value: data.implementation.total.completed, color: CHART_COLORS.success },
    { name: 'Overdue', value: data.implementation.total.overdue, color: CHART_COLORS.danger },
  ];

  const supportPieData = [
    { name: 'Open', value: data.support.total.open, color: CHART_COLORS.info },
    { name: 'In Progress', value: data.support.total.inProgress, color: CHART_COLORS.accent },
    { name: 'Escalated', value: data.support.total.escalated, color: CHART_COLORS.purple },
    { name: 'Critical', value: data.support.total.critical, color: CHART_COLORS.danger },
  ];

  return (
    <div className="space-y-6">
      {/* Sales Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Sales</h3>
          <Badge variant="outline" className="ml-auto">{data.sales.total.activeLeads} Active Leads</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="newLeads" name="New Leads" fill={CHART_COLORS.info} />
                  <Bar dataKey="won" name="Won" fill={CHART_COLORS.success} />
                  <Bar dataKey="lost" name="Lost" fill={CHART_COLORS.danger} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lead Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {salesPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Implementation Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Implementation</h3>
          <Badge variant="outline" className="ml-auto">{data.implementation.total.inProgress} In Progress</Badge>
          {data.implementation.total.overdue > 0 && (
            <Badge variant="destructive">{data.implementation.total.overdue} Overdue</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Implementation Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={implementationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="started" name="Started" stroke={CHART_COLORS.info} fill={CHART_COLORS.info} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Project Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={implPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {implPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Support Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Support</h3>
          <Badge variant="outline" className="ml-auto">{data.support.total.open} Open</Badge>
          {data.support.total.critical > 0 && (
            <Badge variant="destructive">{data.support.total.critical} Critical</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ticket Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={supportChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="opened" name="Opened" stroke={CHART_COLORS.info} strokeWidth={2} />
                  <Line type="monotone" dataKey="closed" name="Closed" stroke={CHART_COLORS.success} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ticket Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={supportPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {supportPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewTabStatistics({ data }: { data: OverviewData }) {
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Sales Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Sales Statistics</h3>
          <Badge variant="outline" className="ml-auto">Total: {data.sales.total.leads} Leads</Badge>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">This Week</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                  <TableHead className="text-right">This Year</TableHead>
                  <TableHead className="text-right">W/W Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">New Leads</TableCell>
                  <TableCell className="text-right">{data.sales.today.newLeads}</TableCell>
                  <TableCell className="text-right">{data.sales.week.newLeads}</TableCell>
                  <TableCell className="text-right">{data.sales.month.newLeads}</TableCell>
                  <TableCell className="text-right">{data.sales.year.newLeads}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(calculateChange(data.sales.week.newLeads, data.sales.today.newLeads * 7)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {calculateChange(data.sales.week.newLeads, data.sales.today.newLeads * 7)}%
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Follow-ups</TableCell>
                  <TableCell className="text-right">{data.sales.today.followups}</TableCell>
                  <TableCell className="text-right">{data.sales.week.followups}</TableCell>
                  <TableCell className="text-right">{data.sales.month.followups}</TableCell>
                  <TableCell className="text-right">{data.sales.year.followups}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-green-600">Deals Won</TableCell>
                  <TableCell className="text-right text-green-600">{data.sales.today.dealsWon}</TableCell>
                  <TableCell className="text-right text-green-600">{data.sales.week.dealsWon}</TableCell>
                  <TableCell className="text-right text-green-600">{data.sales.month.dealsWon}</TableCell>
                  <TableCell className="text-right text-green-600">{data.sales.year.dealsWon}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(data.sales.month.dealsWonValue)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-red-600">Deals Lost</TableCell>
                  <TableCell className="text-right text-red-600">{data.sales.today.dealsLost}</TableCell>
                  <TableCell className="text-right text-red-600">{data.sales.week.dealsLost}</TableCell>
                  <TableCell className="text-right text-red-600">{data.sales.month.dealsLost}</TableCell>
                  <TableCell className="text-right text-red-600">{data.sales.year.dealsLost}</TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(data.sales.month.dealsLostValue)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Sales KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{data.sales.total.activeLeads}</div>
              <div className="text-sm text-muted-foreground">Active Pipeline</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{data.sales.total.negotiation}</div>
              <div className="text-sm text-muted-foreground">In Negotiation</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {data.sales.year.dealsWon > 0 ? 
                  ((data.sales.year.dealsWon / (data.sales.year.dealsWon + data.sales.year.dealsLost)) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Win Rate (YTD)</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{formatCurrency(data.sales.year.dealsWonValue)}</div>
              <div className="text-sm text-muted-foreground">Revenue (YTD)</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Implementation Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Implementation Statistics</h3>
          <Badge variant="outline" className="ml-auto">Total: {data.implementation.total.projects} Projects</Badge>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">This Week</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                  <TableHead className="text-right">This Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Projects Started</TableCell>
                  <TableCell className="text-right">{data.implementation.today.started}</TableCell>
                  <TableCell className="text-right">{data.implementation.week.started}</TableCell>
                  <TableCell className="text-right">{data.implementation.month.started}</TableCell>
                  <TableCell className="text-right">{data.implementation.year.started}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-green-600">Projects Completed</TableCell>
                  <TableCell className="text-right text-green-600">{data.implementation.today.completed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.implementation.week.completed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.implementation.month.completed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.implementation.year.completed}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Implementation KPIs */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{data.implementation.total.inProgress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{data.implementation.total.training}</div>
              <div className="text-sm text-muted-foreground">Training Phase</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">{data.implementation.total.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-red-600">{data.implementation.total.overdue}</div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {data.implementation.total.projects > 0 ? 
                  ((data.implementation.total.completed / data.implementation.total.projects) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Completion Rate</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Support Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Support Statistics</h3>
          <Badge variant="outline" className="ml-auto">Total: {data.support.total.tickets} Tickets</Badge>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">This Week</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                  <TableHead className="text-right">This Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Tickets Opened</TableCell>
                  <TableCell className="text-right">{data.support.today.opened}</TableCell>
                  <TableCell className="text-right">{data.support.week.opened}</TableCell>
                  <TableCell className="text-right">{data.support.month.opened}</TableCell>
                  <TableCell className="text-right">{data.support.year.opened}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-green-600">Tickets Closed</TableCell>
                  <TableCell className="text-right text-green-600">{data.support.today.closed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.support.week.closed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.support.month.closed}</TableCell>
                  <TableCell className="text-right text-green-600">{data.support.year.closed}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Support KPIs */}
        <div className="grid grid-cols-6 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{data.support.total.open}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{data.support.total.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{data.support.total.escalated}</div>
              <div className="text-xs text-muted-foreground">Escalated</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600">{data.support.total.critical}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 dark:bg-rose-950/20 border-rose-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-rose-600">{data.support.total.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.support.year.opened > 0 ? 
                  ((data.support.year.closed / data.support.year.opened) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Resolution Rate</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SalesDrilldown({ viewMode }: { viewMode: ViewMode }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  
  const bucket = week ? 'week' : month ? 'month' : 'year';
  
  const salesQueryParams = new URLSearchParams({ bucket, year: year.toString() });
  if (month) salesQueryParams.set('month', month.toString());
  if (week) salesQueryParams.set('week', week.toString());
  
  const { data, isLoading } = useQuery<{ buckets: SalesBucket[]; items: any[]; lostLeads: any[]; summary: any }>({
    queryKey: [`/api/admin/dashboard/sales?${salesQueryParams.toString()}`],
  });
  
  const handleDrillDown = (period: string, weekNum?: number) => {
    if (!month) {
      const m = parseInt(period.split('-')[1]);
      setMonth(m);
    } else if (!week && weekNum) {
      setWeek(weekNum);
    }
  };
  
  const handleBack = () => {
    if (week) setWeek(null);
    else if (month) setMonth(null);
  };
  
  const getBreadcrumb = () => {
    let parts = [year.toString()];
    if (month) parts.push(new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }));
    if (week) parts.push(`Week ${week}`);
    return parts;
  };
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2">
        {(month || week) && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {getBreadcrumb().map((part, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
              <span className={i === getBreadcrumb().length - 1 ? "text-foreground font-medium" : ""}>{part}</span>
            </span>
          ))}
        </div>
        <div className="ml-auto">
          <Select value={year.toString()} onValueChange={(v) => { setYear(parseInt(v)); setMonth(null); setWeek(null); }}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{data.summary.totalLeads}</div>
              <div className="text-xs text-muted-foreground">Total Leads</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{data.summary.totalWon}</div>
              <div className="text-xs text-muted-foreground">Deals Won</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{data.summary.totalLost}</div>
              <div className="text-xs text-muted-foreground">Deals Lost</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(data.summary.totalLostValue)}</div>
              <div className="text-xs text-muted-foreground">Lost Value</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Graphical View */}
      {viewMode === 'graphical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newLeads" name="New Leads" fill={CHART_COLORS.info} />
                    <Bar dataKey="dealsWon" name="Won" fill={CHART_COLORS.success} />
                    <Bar dataKey="dealsLost" name="Lost" fill={CHART_COLORS.danger} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No sales data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="dealsWonValue" name="Won Value" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="dealsLostValue" name="Lost Value" stroke={CHART_COLORS.danger} fill={CHART_COLORS.danger} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No revenue data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Statistics View - Data Table */}
      {viewMode === 'statistics' && data?.buckets && data.buckets.length > 0 && !week && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">New Leads</TableHead>
                  <TableHead className="text-right">Lead Value</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Won Value</TableHead>
                  <TableHead className="text-right">Lost</TableHead>
                  <TableHead className="text-right">Lost Value</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.buckets.map((bucket) => {
                  const total = bucket.dealsWon + bucket.dealsLost;
                  const winRate = total > 0 ? ((bucket.dealsWon / total) * 100).toFixed(0) : '-';
                  return (
                    <TableRow key={bucket.period} className="cursor-pointer hover:bg-muted/50" onClick={() => handleDrillDown(bucket.period, bucket.weekNumber)}>
                      <TableCell className="font-medium">{bucket.label}</TableCell>
                      <TableCell className="text-right">{bucket.newLeads}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(bucket.newLeadsValue)}</TableCell>
                      <TableCell className="text-right text-green-600">{bucket.dealsWon}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(bucket.dealsWonValue)}</TableCell>
                      <TableCell className="text-right text-red-600">{bucket.dealsLost}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(bucket.dealsLostValue)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(winRate) >= 50 ? 'default' : 'outline'}>
                          {winRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{data.buckets.reduce((sum, b) => sum + b.newLeads, 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.buckets.reduce((sum, b) => sum + b.newLeadsValue, 0))}</TableCell>
                  <TableCell className="text-right text-green-600">{data.buckets.reduce((sum, b) => sum + b.dealsWon, 0)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(data.buckets.reduce((sum, b) => sum + b.dealsWonValue, 0))}</TableCell>
                  <TableCell className="text-right text-red-600">{data.buckets.reduce((sum, b) => sum + b.dealsLost, 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(data.buckets.reduce((sum, b) => sum + b.dealsLostValue, 0))}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Items List (Day view) */}
      {data?.items && data.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {data.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{item.companyName}</div>
                      <div className="text-sm text-muted-foreground">{item.contactPerson} - {item.salesExecutiveName}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.stage === 'closed_won' ? 'default' : item.stage === 'closed_lost' ? 'destructive' : 'outline'}>
                        {item.stage.replace('_', ' ')}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">{formatCurrency(item.estimatedValue || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImplementationDrilldown({ viewMode }: { viewMode: ViewMode }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  
  const bucket = month ? 'month' : 'year';
  
  const implQueryParams = new URLSearchParams({ bucket, year: year.toString() });
  if (month) implQueryParams.set('month', month.toString());
  
  const { data, isLoading } = useQuery<{ buckets: ImplementationBucket[]; items: any[]; overdueProjects: any[]; summary: any }>({
    queryKey: [`/api/admin/dashboard/implementation?${implQueryParams.toString()}`],
  });
  
  const handleDrillDown = (period: string) => {
    if (!month) {
      const m = parseInt(period.split('-')[1]);
      setMonth(m);
    }
  };
  
  const handleBack = () => {
    if (month) setMonth(null);
  };
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {month && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {year} {month ? `/ ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })}` : ''}
        </span>
        <div className="ml-auto">
          <Select value={year.toString()} onValueChange={(v) => { setYear(parseInt(v)); setMonth(null); }}>
            <SelectTrigger className="w-[100px]" data-testid="select-impl-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-5 gap-4">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{data.summary.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{data.summary.inProgress}</div><div className="text-xs text-muted-foreground">In Progress</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-600">{data.summary.training}</div><div className="text-xs text-muted-foreground">Training</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{data.summary.completed}</div><div className="text-xs text-muted-foreground">Completed</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{data.summary.overdue}</div><div className="text-xs text-muted-foreground">Overdue</div></CardContent></Card>
        </div>
      )}
      
      {/* Graphical View */}
      {viewMode === 'graphical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Implementation Trend</CardTitle></CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="started" name="Started" fill={CHART_COLORS.info} />
                    <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.success} />
                    <Bar dataKey="overdue" name="Overdue" fill={CHART_COLORS.danger} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No implementation data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Completion Rate</CardTitle></CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number, name: string) => name === 'Rate' ? `${value}%` : value} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={(d: ImplementationBucket) => d.started > 0 ? ((d.completed / d.started) * 100).toFixed(0) : 0} 
                      name="Rate" 
                      stroke={CHART_COLORS.accent} 
                      strokeWidth={2} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Percent className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No completion data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Statistics View - Data Table */}
      {viewMode === 'statistics' && data?.buckets && data.buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Completion Rate</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.buckets.map((bucket) => {
                  const rate = bucket.started > 0 ? ((bucket.completed / bucket.started) * 100).toFixed(0) : '-';
                  return (
                    <TableRow key={bucket.period} className="cursor-pointer hover:bg-muted/50" onClick={() => handleDrillDown(bucket.period)}>
                      <TableCell className="font-medium">{bucket.label}</TableCell>
                      <TableCell className="text-right text-blue-600">{bucket.started}</TableCell>
                      <TableCell className="text-right text-green-600">{bucket.completed}</TableCell>
                      <TableCell className="text-right text-red-600">{bucket.overdue}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(rate) >= 80 ? 'default' : Number(rate) >= 50 ? 'outline' : 'destructive'}>
                          {rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-blue-600">{data.buckets.reduce((sum, b) => sum + b.started, 0)}</TableCell>
                  <TableCell className="text-right text-green-600">{data.buckets.reduce((sum, b) => sum + b.completed, 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{data.buckets.reduce((sum, b) => sum + b.overdue, 0)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Overdue Projects */}
      {data?.overdueProjects && data.overdueProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue Projects ({data.overdueProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {data.overdueProjects.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                    <div>
                      <div className="font-medium">{p.clientName}</div>
                      <div className="text-sm text-muted-foreground">{p.engineers?.join(', ') || 'Unassigned'}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">{p.daysOverdue} days overdue</Badge>
                      <div className="text-sm text-muted-foreground mt-1">{p.completionPercentage || 0}% complete</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SupportDrilldown({ viewMode }: { viewMode: ViewMode }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<{ period: string; label: string } | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  
  const bucket = month ? 'month' : 'year';
  
  const queryParams = new URLSearchParams({ bucket, year: year.toString() });
  if (month) queryParams.set('month', month.toString());
  
  const { data, isLoading } = useQuery<{ buckets: SupportBucket[]; items: any[]; overdueTickets: any[]; summary: any }>({
    queryKey: [`/api/admin/dashboard/support?${queryParams.toString()}`],
  });

  // Fetch tickets for selected period
  const { data: periodTickets, isLoading: isLoadingPeriodTickets } = useQuery<{ tickets: any[]; summary: any }>({
    queryKey: ['/api/analytics/support-period-tickets', year, month, selectedPeriod?.period],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        period: selectedPeriod?.period || '',
      });
      if (month) params.set('month', month.toString());
      const res = await fetch(`/api/analytics/support-period-tickets?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch period tickets');
      return res.json();
    },
    enabled: !!selectedPeriod,
  });

  // Fetch ticket details for the second level drill-down
  const { data: ticketDetail, isLoading: isLoadingTicketDetail } = useQuery<any>({
    queryKey: ['/api/analytics/ticket-detail', selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ticket-detail/${selectedTicketId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch ticket detail');
      return res.json();
    },
    enabled: !!selectedTicketId,
  });
  
  const handleDrillDown = (period: string, label: string) => {
    if (!month) {
      // First level: Year → Month (weeks)
      const m = parseInt(period.split('-')[1]);
      setMonth(m);
    } else {
      // Second level: Show tickets for this week
      setSelectedPeriod({ period, label });
    }
  };
  
  const handleBack = () => {
    if (month) setMonth(null);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved': case 'closed': return 'bg-green-100 text-green-700 border-green-200';
      case 'in_progress': case 'in progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'open': case 'new': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'escalated': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {month && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {year} {month ? `/ ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })}` : ''}
        </span>
        <div className="ml-auto">
          <Select value={year.toString()} onValueChange={(v) => { setYear(parseInt(v)); setMonth(null); }}>
            <SelectTrigger className="w-[100px]" data-testid="select-support-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-6 gap-4">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{data.summary.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{data.summary.open}</div><div className="text-xs text-muted-foreground">Open</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-600">{data.summary.inProgress}</div><div className="text-xs text-muted-foreground">In Progress</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-orange-600">{data.summary.escalated}</div><div className="text-xs text-muted-foreground">Escalated</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{data.summary.critical}</div><div className="text-xs text-muted-foreground">Critical</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{data.summary.overdue}</div><div className="text-xs text-muted-foreground">Overdue</div></CardContent></Card>
        </div>
      )}
      
      {/* Graphical View */}
      {viewMode === 'graphical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Support Trend</CardTitle></CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="opened" name="Opened" fill={CHART_COLORS.info} />
                    <Bar dataKey="closed" name="Closed" fill={CHART_COLORS.success} />
                    <Bar dataKey="critical" name="Critical" fill={CHART_COLORS.danger} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <HeadphonesIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No support data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Resolution Rate</CardTitle></CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="opened" name="Opened" stroke={CHART_COLORS.info} fill={CHART_COLORS.info} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="closed" name="Closed" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No resolution data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Statistics View - Data Table */}
      {viewMode === 'statistics' && data?.buckets && data.buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">Critical</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Resolution Rate</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.buckets.map((bucket) => {
                  const rate = bucket.opened > 0 ? ((bucket.closed / bucket.opened) * 100).toFixed(0) : '-';
                  return (
                    <TableRow key={bucket.period} className="cursor-pointer hover:bg-muted/50" onClick={() => handleDrillDown(bucket.period, bucket.label)}>
                      <TableCell className="font-medium">{bucket.label}</TableCell>
                      <TableCell className="text-right text-blue-600">{bucket.opened}</TableCell>
                      <TableCell className="text-right text-green-600">{bucket.closed}</TableCell>
                      <TableCell className="text-right text-red-600">{bucket.critical}</TableCell>
                      <TableCell className="text-right text-amber-600">{bucket.overdue}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(rate) >= 80 ? 'default' : Number(rate) >= 50 ? 'outline' : 'destructive'}>
                          {rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-blue-600">{data.buckets.reduce((sum, b) => sum + b.opened, 0)}</TableCell>
                  <TableCell className="text-right text-green-600">{data.buckets.reduce((sum, b) => sum + b.closed, 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{data.buckets.reduce((sum, b) => sum + b.critical, 0)}</TableCell>
                  <TableCell className="text-right text-amber-600">{data.buckets.reduce((sum, b) => sum + b.overdue, 0)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Overdue Tickets */}
      {data?.overdueTickets && data.overdueTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Overdue Tickets ({data.overdueTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {data.overdueTickets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <div>
                      <div className="font-medium">{t.ticketNumber}</div>
                      <div className="text-sm text-muted-foreground">{t.customerName} - {t.assigneeName || 'Unassigned'}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={t.priority === 'critical' ? 'destructive' : 'outline'}>{t.priority}</Badge>
                      <div className="text-sm text-red-600 mt-1">{t.daysOverdue} days overdue</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Period Tickets Dialog - Level 2 */}
      <Dialog open={!!selectedPeriod} onOpenChange={(open) => !open && setSelectedPeriod(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
              Support Tickets - {selectedPeriod?.label} ({year}{month ? ` / ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })}` : ''})
            </DialogTitle>
            <DialogDescription>
              {periodTickets?.summary && (
                <div className="flex gap-4 mt-2 flex-wrap">
                  <Badge variant="outline">Total: {periodTickets.summary.total}</Badge>
                  <Badge variant="outline" className="text-green-600">Closed: {periodTickets.summary.closed}</Badge>
                  <Badge variant="outline" className="text-blue-600">Open: {periodTickets.summary.open}</Badge>
                  {periodTickets.summary.critical > 0 && (
                    <Badge variant="outline" className="text-red-600">Critical: {periodTickets.summary.critical}</Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingPeriodTickets ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issue Summary</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(periodTickets?.tickets || []).map((ticket: any) => (
                    <TableRow key={ticket.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                      <TableCell className="text-sm">{ticket.customerName}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={ticket.issueSummary}>{ticket.issueSummary}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityBadge(ticket.priority)}>{ticket.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(ticket.status)}>{ticket.status?.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ticket.assignedEngineerName || 'Unassigned'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedTicketId(ticket.id)}
                          data-testid={`btn-view-ticket-${ticket.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!periodTickets?.tickets || periodTickets.tickets.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No tickets found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog - Level 3 */}
      <Dialog open={!!selectedTicketId} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Ticket Details - {ticketDetail?.ticket?.ticketNumber}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingTicketDetail ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : ticketDetail?.ticket && (
            <div className="space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{ticketDetail.ticket.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>{ticketDetail.ticket.customerEmail}</span>
                    </div>
                    {ticketDetail.ticket.customerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{ticketDetail.ticket.customerPhone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assigned Engineer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{ticketDetail.ticket.assignedEngineerName || 'Unassigned'}</span>
                    </div>
                    {ticketDetail.ticket.assignedEngineerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{ticketDetail.ticket.assignedEngineerEmail}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Issue Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Issue Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getPriorityBadge(ticketDetail.ticket.priority)}>
                      {ticketDetail.ticket.priority?.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusBadge(ticketDetail.ticket.status)}>
                      {ticketDetail.ticket.status?.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                    {ticketDetail.ticket.moduleName && (
                      <Badge variant="outline">{ticketDetail.ticket.moduleName}</Badge>
                    )}
                    {ticketDetail.ticket.escalationLevel > 1 && (
                      <Badge className="bg-purple-100 text-purple-700">Level {ticketDetail.ticket.escalationLevel} Escalation</Badge>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Summary:</div>
                    <p className="text-sm text-muted-foreground">{ticketDetail.ticket.issueSummary}</p>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Description:</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticketDetail.ticket.issueDescription}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Created: {new Date(ticketDetail.ticket.createdAt).toLocaleString()}</span>
                    {ticketDetail.ticket.assignedAt && (
                      <span>Assigned: {new Date(ticketDetail.ticket.assignedAt).toLocaleString()}</span>
                    )}
                    {ticketDetail.ticket.resolvedAt && (
                      <span className="text-green-600">Resolved: {new Date(ticketDetail.ticket.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                  {ticketDetail.resolutionTime && (
                    <div className="text-sm">
                      <span className="font-medium">Resolution Time: </span>
                      <Badge variant="outline" className="text-green-600">
                        {ticketDetail.resolutionTime.days > 0 && `${ticketDetail.resolutionTime.days}d `}
                        {ticketDetail.resolutionTime.hours > 0 && `${ticketDetail.resolutionTime.hours}h `}
                        {ticketDetail.resolutionTime.minutes}m
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Solution & Engineer Reports (Comments) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Solution & Engineer Reports ({ticketDetail.comments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketDetail.comments && ticketDetail.comments.length > 0 ? (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-4">
                        {ticketDetail.comments.map((comment: any) => (
                          <div key={comment.id} className={`p-3 rounded-lg border ${comment.isInternal ? 'bg-yellow-50 border-yellow-200' : 'bg-muted/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">{comment.userName || 'System'}</span>
                                {comment.isInternal && (
                                  <Badge variant="outline" className="text-xs">Internal</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      No solution or engineer reports available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Escalation History */}
              {ticketDetail.escalations && ticketDetail.escalations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Escalation History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ticketDetail.escalations.map((esc: any) => (
                        <div key={esc.id} className="flex items-center justify-between p-2 rounded border bg-orange-50">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">Level {esc.fromLevel}</Badge>
                            <ChevronRight className="h-4 w-4" />
                            <Badge className="bg-orange-100 text-orange-700">Level {esc.toLevel}</Badge>
                            {esc.reason && <span className="text-muted-foreground">- {esc.reason}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {esc.escalatedByName && <span>by {esc.escalatedByName} | </span>}
                            {new Date(esc.escalatedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Feedback */}
              {ticketDetail.feedback && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Customer Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-5 w-5 ${star <= ticketDetail.feedback!.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      <Badge variant={ticketDetail.feedback.satisfied ? 'default' : 'outline'}>
                        {ticketDetail.feedback.satisfied ? 'Satisfied' : 'Not Satisfied'}
                      </Badge>
                    </div>
                    {ticketDetail.feedback.comments && (
                      <p className="text-sm text-muted-foreground">{ticketDetail.feedback.comments}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Handlers - Who Worked on This Ticket */}
              {ticketDetail.handlers && ticketDetail.handlers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      People Who Handled This Ticket ({ticketDetail.handlers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ticketDetail.handlers.map((handler: any) => (
                        <div key={handler.userId} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{handler.userName || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{handler.userEmail}</div>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <Badge variant="outline" className="mb-1">{handler.actionCount} action{handler.actionCount > 1 ? 's' : ''}</Badge>
                            <div className="text-muted-foreground">
                              Last: {new Date(handler.lastAction).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Similar Issues from Same Customer */}
              {ticketDetail.similarTickets && ticketDetail.similarTickets.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      Similar Issues from This Customer ({ticketDetail.similarTickets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket #</TableHead>
                            <TableHead>Issue Summary</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Handler</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ticketDetail.similarTickets.map((t: any) => (
                            <TableRow key={t.id} className="hover:bg-muted/50">
                              <TableCell className="font-mono text-xs">{t.ticketNumber}</TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm" title={t.issueSummary}>
                                {t.issueSummary}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadge(t.status)}>{t.status?.replace(/_/g, ' ')}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{t.assignedEngineerName || 'Unassigned'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(t.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DevelopmentDrilldown({ viewMode }: { viewMode: ViewMode }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  
  const bucket = month ? 'month' : 'year';
  
  const devQueryParams = new URLSearchParams({ bucket, year: year.toString() });
  if (month) devQueryParams.set('month', month.toString());
  
  const { data, isLoading } = useQuery<{ buckets: DevelopmentBucket[]; items: any[]; overdueTasks: any[]; summary: any }>({
    queryKey: ['/api/admin/dashboard/development', { bucket, year, month }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/dashboard/development?${devQueryParams.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch development dashboard');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });
  
  const handleDrillDown = (period: string) => {
    if (!month) {
      const m = parseInt(period.split('-')[1]);
      setMonth(m);
    }
  };
  
  const handleBack = () => {
    if (month) setMonth(null);
  };
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {month && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {year} {month ? `/ ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })}` : ''}
        </span>
        <div className="ml-auto">
          <Select value={year.toString()} onValueChange={(v) => { setYear(parseInt(v)); setMonth(null); }}>
            <SelectTrigger className="w-[100px]" data-testid="select-dev-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-5 gap-4">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{data.summary.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-yellow-600">{data.summary.pending}</div><div className="text-xs text-muted-foreground">Pending</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{data.summary.inProgress}</div><div className="text-xs text-muted-foreground">In Progress</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{data.summary.completed}</div><div className="text-xs text-muted-foreground">Completed</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{data.summary.overdue}</div><div className="text-xs text-muted-foreground">Overdue</div></CardContent></Card>
        </div>
      )}
      
      {/* Source Breakdown */}
      {data?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-purple-50 dark:bg-purple-950/20">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold text-purple-600">{data.summary.fromSupport}</div>
              <div className="text-xs text-muted-foreground">From Support</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold text-blue-600">{data.summary.fromImplementation}</div>
              <div className="text-xs text-muted-foreground">From Implementation</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold text-green-600">{data.summary.fromTasks}</div>
              <div className="text-xs text-muted-foreground">From Tasks</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold text-amber-600">{data.summary.manual}</div>
              <div className="text-xs text-muted-foreground">Manual</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      
      {/* Charts */}
      {viewMode === 'graphical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Development Trend</CardTitle></CardHeader>
            <CardContent>
              {data?.buckets && data.buckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill={CHART_COLORS.info} />
                    <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.success} />
                    <Bar dataKey="overdue" name="Overdue" fill={CHART_COLORS.danger} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No development data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Source Breakdown</CardTitle></CardHeader>
            <CardContent>
              {data?.summary ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'From Support', value: data.summary.fromSupport, color: CHART_COLORS.purple },
                        { name: 'From Implementation', value: data.summary.fromImplementation, color: CHART_COLORS.info },
                        { name: 'From Tasks', value: data.summary.fromTasks, color: CHART_COLORS.success },
                        { name: 'Manual', value: data.summary.manual, color: CHART_COLORS.accent },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'From Support', value: data.summary.fromSupport, color: CHART_COLORS.purple },
                        { name: 'From Implementation', value: data.summary.fromImplementation, color: CHART_COLORS.info },
                        { name: 'From Tasks', value: data.summary.fromTasks, color: CHART_COLORS.success },
                        { name: 'Manual', value: data.summary.manual, color: CHART_COLORS.accent },
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Statistics Table */}
      {viewMode === 'statistics' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Development Statistics</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">In Progress</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.buckets?.map((bucket) => (
                  <TableRow key={bucket.period} className="cursor-pointer hover:bg-muted/50" onClick={() => handleDrillDown(bucket.period)}>
                    <TableCell className="font-medium">{bucket.label}</TableCell>
                    <TableCell className="text-right text-blue-600">{bucket.created}</TableCell>
                    <TableCell className="text-right text-green-600">{bucket.completed}</TableCell>
                    <TableCell className="text-right text-yellow-600">{bucket.pending}</TableCell>
                    <TableCell className="text-right text-purple-600">{bucket.inProgress}</TableCell>
                    <TableCell className="text-right text-red-600">{bucket.overdue}</TableCell>
                    <TableCell className="text-right">
                      {!month && <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-blue-600">{data?.buckets?.reduce((sum, b) => sum + b.created, 0) || 0}</TableCell>
                  <TableCell className="text-right text-green-600">{data?.buckets?.reduce((sum, b) => sum + b.completed, 0) || 0}</TableCell>
                  <TableCell className="text-right text-yellow-600">{data?.buckets?.reduce((sum, b) => sum + b.pending, 0) || 0}</TableCell>
                  <TableCell className="text-right text-purple-600">{data?.buckets?.reduce((sum, b) => sum + b.inProgress, 0) || 0}</TableCell>
                  <TableCell className="text-right text-red-600">{data?.buckets?.reduce((sum, b) => sum + b.overdue, 0) || 0}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Overdue Tasks */}
      {data?.overdueTasks && data.overdueTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Overdue Tasks ({data.overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {data.overdueTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                    <div>
                      <div className="font-medium">{t.taskNumber}</div>
                      <div className="text-sm text-muted-foreground">{t.title} - {t.assigneeName || 'Unassigned'}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={t.priority === 'critical' ? 'destructive' : 'outline'}>{t.priority}</Badge>
                      <div className="text-sm text-red-600 mt-1">{t.daysOverdue} days overdue</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Items List when drilling down */}
      {month && data?.items && data.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tasks in {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {data.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{item.taskNumber}</div>
                      <div className="text-sm text-muted-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">Assigned to: {item.assigneeName || 'Unassigned'}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        item.status === 'completed' ? 'default' : 
                        item.status === 'in_progress' ? 'secondary' : 
                        item.isOverdue ? 'destructive' : 'outline'
                      }>
                        {item.status.replace('_', ' ')}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">{item.sourceType}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PerformanceTab({ viewMode }: { viewMode: ViewMode }) {
  const [period, setPeriod] = useState('month');
  
  const { data, isLoading } = useQuery<{ topPerformers: PerformanceUser[]; byDepartment: any; allUsers: PerformanceUser[] }>({
    queryKey: [`/api/admin/dashboard/performance?period=${period}`],
  });
  
  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-amber-500';
    if (index === 1) return 'text-gray-400';
    if (index === 2) return 'text-amber-700';
    return 'text-muted-foreground';
  };

  const radarData = data?.topPerformers?.slice(0, 5).map(user => ({
    name: user.name.split(' ')[0],
    sales: user.scores.sales,
    implementation: user.scores.implementation,
    support: user.scores.support,
  })) || [];
  
  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Period:</span>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]" data-testid="select-performance-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Graphical View */}
      {viewMode === 'graphical' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Performers Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Performers Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.topPerformers && data.topPerformers.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.topPerformers.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="scores.sales" name="Sales" fill={CHART_COLORS.accent} stackId="a" />
                    <Bar dataKey="scores.implementation" name="Implementation" fill={CHART_COLORS.info} stackId="a" />
                    <Bar dataKey="scores.support" name="Support" fill={CHART_COLORS.success} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No performance data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Contribution</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.topPerformers && data.topPerformers.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Sales', value: data.topPerformers.reduce((sum, u) => sum + u.scores.sales, 0), color: CHART_COLORS.accent },
                        { name: 'Implementation', value: data.topPerformers.reduce((sum, u) => sum + u.scores.implementation, 0), color: CHART_COLORS.info },
                        { name: 'Support', value: data.topPerformers.reduce((sum, u) => sum + u.scores.support, 0), color: CHART_COLORS.success },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill={CHART_COLORS.accent} />
                      <Cell fill={CHART_COLORS.info} />
                      <Cell fill={CHART_COLORS.success} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No department data available for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Statistics View */}
      {viewMode === 'statistics' && data?.allUsers && data.allUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Total Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.allUsers.map((user, i) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className={`font-bold ${getMedalColor(i)}`}>#{i + 1}</span>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.department}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.metrics.sales.leadsGenerated}</TableCell>
                    <TableCell className="text-right text-green-600">{user.metrics.sales.dealsWon}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={user.metrics.sales.winRate >= 50 ? 'default' : 'outline'}>
                        {user.metrics.sales.winRate.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-blue-600">{user.metrics.implementation.projectsCompleted}</TableCell>
                    <TableCell className="text-right text-purple-600">{user.metrics.support.ticketsClosed}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-primary">{user.scores.total}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Top Performers Card (Always shown) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.topPerformers?.slice(0, 5).map((user, i) => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
                <div className={`text-xl font-bold ${getMedalColor(i)}`}>#{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.department} - {user.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{user.scores.total}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
            {(!data?.topPerformers || data.topPerformers.length === 0) && (
              <div className="text-center text-muted-foreground py-4">No performance data available</div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* By Department */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              Sales Leaders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.byDepartment?.sales?.map((user: PerformanceUser, i: number) => (
                <div key={user.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className={`h-4 w-4 ${getMedalColor(i)}`} />
                    <span>{user.name}</span>
                  </div>
                  <div className="text-green-600 font-medium">{user.metrics.sales.dealsWon} won</div>
                </div>
              ))}
              {(!data?.byDepartment?.sales || data.byDepartment.sales.length === 0) && (
                <div className="text-center text-muted-foreground text-sm">No data</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Implementation Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              Implementation Leaders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.byDepartment?.implementation?.map((user: PerformanceUser, i: number) => (
                <div key={user.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className={`h-4 w-4 ${getMedalColor(i)}`} />
                    <span>{user.name}</span>
                  </div>
                  <div className="text-blue-600 font-medium">{user.metrics.implementation.projectsCompleted} projects</div>
                </div>
              ))}
              {(!data?.byDepartment?.implementation || data.byDepartment.implementation.length === 0) && (
                <div className="text-center text-muted-foreground text-sm">No data</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Support Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HeadphonesIcon className="h-4 w-4 text-green-500" />
              Support Leaders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.byDepartment?.support?.map((user: PerformanceUser, i: number) => (
                <div key={user.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className={`h-4 w-4 ${getMedalColor(i)}`} />
                    <span>{user.name}</span>
                  </div>
                  <div className="text-green-600 font-medium">{user.metrics.support.ticketsClosed} tickets</div>
                </div>
              ))}
              {(!data?.byDepartment?.support || data.byDepartment.support.length === 0) && (
                <div className="text-center text-muted-foreground text-sm">No data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Frequent Callers Analysis Types
interface FrequentCaller {
  customerId: string | null;
  customerName: string;
  callCount: number;
  criticalCount: number;
  highCount: number;
  resolvedCount: number;
  openCount: number;
  avgResolutionDays: number | null;
  lastCallDate: string;
}

interface EmployeeStat {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  callsHandled: number;
  resolvedCount: number;
  criticalHandled: number;
  avgResolutionDays: number | null;
}

interface FrequentCallersData {
  startDate: string;
  endDate: string;
  summary: {
    totalCalls: number;
    uniqueCustomers: number;
    criticalCalls: number;
    resolvedCalls: number;
  };
  frequentCallers: FrequentCaller[];
  employeeStats: EmployeeStat[];
  dailyTrend: { date: string; callCount: number; resolvedCount: number }[];
  priorityDistribution: { priority: string; count: number }[];
}

interface CustomerCallsData {
  customerId: string;
  customerSummary: { customerName: string; totalCalls: number; resolvedCalls: number; avgResolutionDays: number };
  calls: {
    id: string;
    ticketNumber: string;
    issueSummary: string;
    priority: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
    assignedEngineerName: string;
    moduleName: string;
  }[];
}

interface TicketDetailData {
  ticket: {
    id: string;
    ticketNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    issueSummary: string;
    issueDescription: string;
    priority: string;
    status: string;
    escalationLevel: number;
    createdAt: string;
    assignedAt: string;
    resolvedAt: string | null;
    closedAt: string | null;
    dueDate: string | null;
    assignedEngineerName: string;
    assignedEngineerEmail: string;
    moduleName: string;
  };
  comments: {
    id: string;
    comment: string;
    isInternal: boolean;
    createdAt: string;
    userName: string;
    userEmail: string;
  }[];
  escalations: {
    id: string;
    fromLevel: number;
    toLevel: number;
    reason: string;
    escalatedAt: string;
    escalatedByName: string;
  }[];
  feedback: {
    rating: number;
    comments: string;
    satisfied: boolean;
    submittedAt: string;
  } | null;
  resolutionTime: { days: number; hours: number; minutes: number } | null;
}

function FrequentCallersTab({ viewMode }: { viewMode: ViewMode }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number | null>(currentMonth);
  const [fromDay, setFromDay] = useState<number | null>(null);
  const [toDay, setToDay] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  
  // Calculate days in the selected month
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const daysInMonth = month ? getDaysInMonth(year, month) : 31;
  
  // Build date strings from day selections
  const fromDate = fromDay && month ? `${year}-${String(month).padStart(2, '0')}-${String(fromDay).padStart(2, '0')}` : '';
  const toDate = toDay && month ? `${year}-${String(month).padStart(2, '0')}-${String(toDay).padStart(2, '0')}` : '';

  // Build query parameters with validation
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('year', year.toString());
    
    // Only use date range if both dates are set and valid
    const hasValidDateRange = fromDate && toDate && fromDate <= toDate;
    
    if (hasValidDateRange) {
      params.set('fromDate', fromDate);
      params.set('toDate', toDate);
    } else if (month) {
      params.set('month', month.toString());
    }
    return params.toString();
  };

  const queryParams = buildQueryParams();
  
  const { data, isLoading } = useQuery<FrequentCallersData>({
    queryKey: ['/api/analytics/frequent-callers', year, month, fromDay, toDay],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/frequent-callers?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: customerCalls, isLoading: isLoadingCalls } = useQuery<CustomerCallsData>({
    queryKey: ['/api/analytics/customer-calls', selectedCustomer?.id, year, month, fromDay, toDay],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/customer-calls/${selectedCustomer?.id}?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedCustomer?.id,
  });

  const { data: ticketDetail, isLoading: isLoadingTicket } = useQuery<TicketDetailData>({
    queryKey: ['/api/analytics/ticket-detail', selectedTicket],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/ticket-detail/${selectedTicket}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedTicket,
  });

  const priorityColors: Record<string, string> = {
    critical: CHART_COLORS.danger,
    high: CHART_COLORS.accent,
    medium: CHART_COLORS.info,
    low: CHART_COLORS.success,
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      pending_customer: 'bg-orange-100 text-orange-700 border-orange-200',
      escalated: 'bg-purple-100 text-purple-700 border-purple-200',
      resolved: 'bg-green-100 text-green-700 border-green-200',
      closed: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Month names for selector
  const monthNames = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  // Get period label for display
  const getPeriodLabel = () => {
    if (fromDate && toDate) {
      return `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`;
    }
    if (month) {
      return `${monthNames[month - 1]?.label} ${year}`;
    }
    return `Year ${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {/* Row 1: Year */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <HeadphonesIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Frequent Caller Analysis</h2>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-2">Year:</span>
                {[2023, 2024, 2025, 2026].map(y => (
                  <Button
                    key={y}
                    size="sm"
                    variant={year === y ? 'default' : 'outline'}
                    onClick={() => { setYear(y); setFromDay(null); setToDay(null); }}
                    data-testid={`btn-year-${y}`}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Row 2: Month */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Month:</span>
              <div className="flex gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant={month === null ? 'default' : 'outline'}
                  onClick={() => { setMonth(null); setFromDay(null); setToDay(null); }}
                  data-testid="btn-month-all"
                >
                  All
                </Button>
                {monthNames.map(m => (
                  <Button
                    key={m.value}
                    size="sm"
                    variant={month === m.value ? 'default' : 'outline'}
                    onClick={() => { setMonth(m.value); setFromDay(null); setToDay(null); }}
                    data-testid={`btn-month-${m.value}`}
                  >
                    {m.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Row 3: Day Selection (only show when month is selected) */}
            {month && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-muted-foreground w-16">From:</span>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                      <Button
                        key={`from-${day}`}
                        size="sm"
                        variant={fromDay === day ? 'default' : 'outline'}
                        onClick={() => setFromDay(day)}
                        className="w-8 h-8 p-0 text-xs"
                        data-testid={`btn-from-day-${day}`}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-muted-foreground w-16">To:</span>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                      <Button
                        key={`to-${day}`}
                        size="sm"
                        variant={toDay === day ? 'default' : 'outline'}
                        onClick={() => setToDay(day)}
                        className="w-8 h-8 p-0 text-xs"
                        disabled={fromDay !== null && day < fromDay}
                        data-testid={`btn-to-day-${day}`}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
                {(fromDay || toDay) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Selected: {fromDay ? `${fromDay}` : '--'} to {toDay ? `${toDay}` : '--'} {monthNames[month - 1]?.label} {year}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setFromDay(null); setToDay(null); }}
                      data-testid="btn-clear-days"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {fromDay && toDay && fromDay > toDay && (
                  <span className="text-xs text-red-500">From date must be before To date</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Calls" icon={HeadphonesIcon} iconColor="text-primary">
          <div className="text-2xl font-bold">{data?.summary?.totalCalls || 0}</div>
        </StatCard>
        <StatCard title="Unique Customers" icon={Users} iconColor="text-blue-500">
          <div className="text-2xl font-bold">{data?.summary?.uniqueCustomers || 0}</div>
        </StatCard>
        <StatCard title="Critical Calls" icon={AlertTriangle} iconColor="text-red-500">
          <div className="text-2xl font-bold text-red-600">{data?.summary?.criticalCalls || 0}</div>
        </StatCard>
        <StatCard title="Resolved Calls" icon={CheckCircle} iconColor="text-green-500">
          <div className="text-2xl font-bold text-green-600">{data?.summary?.resolvedCalls || 0}</div>
          {data?.summary?.totalCalls ? (
            <div className="text-xs text-muted-foreground">
              {((data.summary.resolvedCalls / data.summary.totalCalls) * 100).toFixed(0)}% resolution rate
            </div>
          ) : null}
        </StatCard>
      </div>

      {viewMode === 'graphical' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Call Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data?.dailyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="callCount" name="Total Calls" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="resolvedCount" name="Resolved" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data?.priorityDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="priority"
                    label={({ priority, count }) => `${priority}: ${count}`}
                  >
                    {(data?.priorityDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={priorityColors[entry.priority] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Frequent Callers Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Top 10 Frequent Callers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={(data?.frequentCallers || []).slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="customerName" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="resolvedCount" name="Resolved" stackId="a" fill={CHART_COLORS.success} />
                  <Bar dataKey="openCount" name="Open" stackId="a" fill={CHART_COLORS.info} />
                  <Bar dataKey="criticalCount" name="Critical" fill={CHART_COLORS.danger} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Frequent Callers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Frequent Callers ({getPeriodLabel()})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead className="text-center">Total Calls</TableHead>
                    <TableHead className="text-center">Critical</TableHead>
                    <TableHead className="text-center">High</TableHead>
                    <TableHead className="text-center">Resolved</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">Avg Resolution (Days)</TableHead>
                    <TableHead>Last Call</TableHead>
                    <TableHead className="w-24 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.frequentCallers || []).map((caller, index) => (
                    <TableRow key={`caller-${caller.customerId || 'null'}-${index}`} className="hover:bg-muted/50">
                      <TableCell className="font-bold text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{caller.customerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-bold">{caller.callCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {caller.criticalCount > 0 && (
                          <Badge className="bg-red-100 text-red-700 border-red-200">{caller.criticalCount}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {caller.highCount > 0 && (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">{caller.highCount}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{caller.resolvedCount}</TableCell>
                      <TableCell className="text-center text-blue-600 font-medium">{caller.openCount}</TableCell>
                      <TableCell className="text-center">
                        {caller.avgResolutionDays !== null ? `${caller.avgResolutionDays} days` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {caller.lastCallDate ? new Date(caller.lastCallDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => caller.customerId && setSelectedCustomer({ id: caller.customerId, name: caller.customerName })}
                          disabled={!caller.customerId}
                          data-testid={`btn-view-calls-${index}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.frequentCallers || data.frequentCallers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No call data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee Call Handling Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Employee Call Handling Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === 'graphical' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.employeeStats || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="employeeName" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="callsHandled" name="Calls Handled" fill={CHART_COLORS.primary} />
                <Bar dataKey="resolvedCount" name="Resolved" fill={CHART_COLORS.success} />
                <Bar dataKey="criticalHandled" name="Critical Handled" fill={CHART_COLORS.danger} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Calls Handled</TableHead>
                  <TableHead className="text-center">Resolved</TableHead>
                  <TableHead className="text-center">Critical Handled</TableHead>
                  <TableHead className="text-center">Avg Resolution (Days)</TableHead>
                  <TableHead className="text-center">Resolution Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.employeeStats || []).map((emp, index) => (
                  <TableRow key={`emp-${emp.employeeId || 'null'}-${index}`}>
                    <TableCell className="font-bold text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{emp.employeeName || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.employeeEmail || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-bold">{emp.callsHandled}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-green-600 font-medium">{emp.resolvedCount}</TableCell>
                    <TableCell className="text-center">
                      {emp.criticalHandled > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-red-200">{emp.criticalHandled}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.avgResolutionDays !== null ? `${emp.avgResolutionDays} days` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={emp.callsHandled > 0 && (emp.resolvedCount / emp.callsHandled) >= 0.8 ? 'default' : 'outline'}>
                        {emp.callsHandled > 0 ? ((emp.resolvedCount / emp.callsHandled) * 100).toFixed(0) : 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.employeeStats || data.employeeStats.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No employee data available for the selected period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Calls Drill-down Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
              Call History - {selectedCustomer?.name}
            </DialogTitle>
            <DialogDescription>
              {customerCalls?.customerSummary && (
                <div className="flex gap-4 mt-2">
                  <Badge variant="outline">Total: {customerCalls.customerSummary.totalCalls} calls</Badge>
                  <Badge variant="outline" className="text-green-600">Resolved: {customerCalls.customerSummary.resolvedCalls}</Badge>
                  {customerCalls.customerSummary.avgResolutionDays && (
                    <Badge variant="outline">Avg Resolution: {customerCalls.customerSummary.avgResolutionDays} days</Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingCalls ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Issue Summary</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Engineer</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(customerCalls?.calls || []).map((call) => (
                    <TableRow key={call.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{call.ticketNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={call.issueSummary}>{call.issueSummary}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityBadge(call.priority)}>{call.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(call.status)}>{call.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{call.moduleName || '-'}</TableCell>
                      <TableCell className="text-sm">{call.assignedEngineerName || 'Unassigned'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(call.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedTicket(call.id)}
                          data-testid={`btn-view-ticket-${call.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!customerCalls?.calls || customerCalls.calls.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No calls found for this customer in the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Ticket Details - {ticketDetail?.ticket?.ticketNumber}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingTicket ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : ticketDetail?.ticket && (
            <div className="space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{ticketDetail.ticket.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>{ticketDetail.ticket.customerEmail}</span>
                    </div>
                    {ticketDetail.ticket.customerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{ticketDetail.ticket.customerPhone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assigned Engineer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{ticketDetail.ticket.assignedEngineerName || 'Unassigned'}</span>
                    </div>
                    {ticketDetail.ticket.assignedEngineerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{ticketDetail.ticket.assignedEngineerEmail}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Issue Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Issue Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getPriorityBadge(ticketDetail.ticket.priority)}>
                      {ticketDetail.ticket.priority.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusBadge(ticketDetail.ticket.status)}>
                      {ticketDetail.ticket.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                    {ticketDetail.ticket.moduleName && (
                      <Badge variant="outline">{ticketDetail.ticket.moduleName}</Badge>
                    )}
                    {ticketDetail.ticket.escalationLevel > 1 && (
                      <Badge className="bg-purple-100 text-purple-700">Level {ticketDetail.ticket.escalationLevel} Escalation</Badge>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Summary:</div>
                    <p className="text-sm text-muted-foreground">{ticketDetail.ticket.issueSummary}</p>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">Description:</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticketDetail.ticket.issueDescription}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Created: {new Date(ticketDetail.ticket.createdAt).toLocaleString()}</span>
                    {ticketDetail.ticket.assignedAt && (
                      <span>Assigned: {new Date(ticketDetail.ticket.assignedAt).toLocaleString()}</span>
                    )}
                    {ticketDetail.ticket.resolvedAt && (
                      <span className="text-green-600">Resolved: {new Date(ticketDetail.ticket.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                  {ticketDetail.resolutionTime && (
                    <div className="text-sm">
                      <span className="font-medium">Resolution Time: </span>
                      <Badge variant="outline" className="text-green-600">
                        {ticketDetail.resolutionTime.days > 0 && `${ticketDetail.resolutionTime.days}d `}
                        {ticketDetail.resolutionTime.hours > 0 && `${ticketDetail.resolutionTime.hours}h `}
                        {ticketDetail.resolutionTime.minutes}m
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Solution & Engineer Reports (Comments) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Solution & Engineer Reports ({ticketDetail.comments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketDetail.comments && ticketDetail.comments.length > 0 ? (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-4">
                        {ticketDetail.comments.map((comment) => (
                          <div key={comment.id} className={`p-3 rounded-lg border ${comment.isInternal ? 'bg-yellow-50 border-yellow-200' : 'bg-muted/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">{comment.userName || 'System'}</span>
                                {comment.isInternal && (
                                  <Badge variant="outline" className="text-xs">Internal</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      No solution or engineer reports available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Escalation History */}
              {ticketDetail.escalations && ticketDetail.escalations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Escalation History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ticketDetail.escalations.map((esc) => (
                        <div key={esc.id} className="flex items-center justify-between p-2 rounded border bg-orange-50">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">Level {esc.fromLevel}</Badge>
                            <ChevronRight className="h-4 w-4" />
                            <Badge className="bg-orange-100 text-orange-700">Level {esc.toLevel}</Badge>
                            {esc.reason && <span className="text-muted-foreground">- {esc.reason}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {esc.escalatedByName && <span>by {esc.escalatedByName} | </span>}
                            {new Date(esc.escalatedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Feedback */}
              {ticketDetail.feedback && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Customer Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-5 w-5 ${star <= ticketDetail.feedback!.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      <Badge variant={ticketDetail.feedback.satisfied ? 'default' : 'outline'}>
                        {ticketDetail.feedback.satisfied ? 'Satisfied' : 'Not Satisfied'}
                      </Badge>
                    </div>
                    {ticketDetail.feedback.comments && (
                      <p className="text-sm text-muted-foreground">{ticketDetail.feedback.comments}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('graphical');
  
  const { data: overviewData, isLoading } = useQuery<OverviewData>({
    queryKey: ['/api/admin/dashboard/overview'],
  });
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Complete overview of Sales, Implementation & Support</p>
        </div>
        <div className="flex items-center gap-4">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <Badge variant="outline" className="text-primary border-primary">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Badge>
        </div>
      </div>
      
      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-[840px] grid-cols-7">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales</TabsTrigger>
          <TabsTrigger value="implementation" data-testid="tab-implementation">Implementation</TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support">Support</TabsTrigger>
          <TabsTrigger value="calls" data-testid="tab-calls">Calls</TabsTrigger>
          <TabsTrigger value="development" data-testid="tab-development">Development</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : overviewData ? (
            viewMode === 'graphical' ? (
              <OverviewTabGraphical data={overviewData} />
            ) : (
              <OverviewTabStatistics data={overviewData} />
            )
          ) : (
            <div className="text-center text-muted-foreground py-8">No data available</div>
          )}
        </TabsContent>
        
        <TabsContent value="sales">
          <SalesDrilldown viewMode={viewMode} />
        </TabsContent>
        
        <TabsContent value="implementation">
          <ImplementationDrilldown viewMode={viewMode} />
        </TabsContent>
        
        <TabsContent value="support">
          <SupportDrilldown viewMode={viewMode} />
        </TabsContent>
        
        <TabsContent value="calls">
          <FrequentCallersTab viewMode={viewMode} />
        </TabsContent>
        
        <TabsContent value="development">
          <DevelopmentDrilldown viewMode={viewMode} />
        </TabsContent>
        
        <TabsContent value="performance">
          <PerformanceTab viewMode={viewMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
