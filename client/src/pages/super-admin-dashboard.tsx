import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Target, Briefcase, HeadphonesIcon,
  AlertTriangle, Calendar, ChevronRight, ChevronLeft, Trophy, Award,
  DollarSign, CheckCircle, XCircle, Clock, ArrowUp, ArrowDown
} from "lucide-react";

const COLORS = ['#1a2b6d', '#f5a623', '#4ade80', '#f87171', '#60a5fa', '#a78bfa'];

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

function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-6">
      {/* Sales Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Sales</h3>
          <Badge variant="outline" className="ml-auto">{data.sales.total.activeLeads} Active Leads</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="New Leads" icon={TrendingUp} iconColor="text-blue-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg">{data.sales.today.newLeads}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.week.newLeads}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.month.newLeads}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.year.newLeads}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
          <StatCard title="Deals Won" icon={CheckCircle} iconColor="text-green-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.sales.today.dealsWon}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.sales.week.dealsWon}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.sales.month.dealsWon}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.sales.year.dealsWon}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              Value: {formatCurrency(data.sales.month.dealsWonValue)} this month
            </div>
          </StatCard>
          <StatCard title="Deals Lost" icon={XCircle} iconColor="text-red-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg text-red-600">{data.sales.today.dealsLost}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg text-red-600">{data.sales.week.dealsLost}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg text-red-600">{data.sales.month.dealsLost}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg text-red-600">{data.sales.year.dealsLost}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              Lost Value: {formatCurrency(data.sales.month.dealsLostValue)} this month
            </div>
          </StatCard>
          <StatCard title="Follow-ups" icon={Calendar} iconColor="text-purple-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg">{data.sales.today.followups}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.week.followups}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.month.followups}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.sales.year.followups}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
        </div>
      </div>

      <Separator />

      {/* Implementation Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Implementation</h3>
          <Badge variant="outline" className="ml-auto">{data.implementation.total.inProgress} In Progress</Badge>
          {data.implementation.total.overdue > 0 && (
            <Badge variant="destructive">{data.implementation.total.overdue} Overdue</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Projects Started" icon={ArrowUp} iconColor="text-blue-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg">{data.implementation.today.started}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.implementation.week.started}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.implementation.month.started}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.implementation.year.started}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
          <StatCard title="Projects Completed" icon={CheckCircle} iconColor="text-green-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.implementation.today.completed}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.implementation.week.completed}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.implementation.month.completed}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.implementation.year.completed}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
          <StatCard title="Training Phase" icon={Users} iconColor="text-amber-500">
            <div className="text-2xl font-bold text-amber-600">{data.implementation.total.training}</div>
            <div className="text-xs text-muted-foreground mt-1">Projects in training phase</div>
          </StatCard>
          <StatCard title="Overdue Projects" icon={AlertTriangle} iconColor="text-red-500">
            <div className="text-2xl font-bold text-red-600">{data.implementation.total.overdue}</div>
            <div className="text-xs text-muted-foreground mt-1">Past target go-live date</div>
          </StatCard>
        </div>
      </div>

      <Separator />

      {/* Support Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Support</h3>
          <Badge variant="outline" className="ml-auto">{data.support.total.open} Open</Badge>
          {data.support.total.critical > 0 && (
            <Badge variant="destructive">{data.support.total.critical} Critical</Badge>
          )}
          {data.support.total.overdue > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">{data.support.total.overdue} Overdue</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Tickets Opened" icon={TrendingUp} iconColor="text-blue-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg">{data.support.today.opened}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.support.week.opened}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.support.month.opened}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg">{data.support.year.opened}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
          <StatCard title="Tickets Closed" icon={CheckCircle} iconColor="text-green-500">
            <div className="grid grid-cols-4 gap-1 text-sm">
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.support.today.closed}</div><div className="text-muted-foreground text-xs">Today</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.support.week.closed}</div><div className="text-muted-foreground text-xs">Week</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.support.month.closed}</div><div className="text-muted-foreground text-xs">Month</div></div>
              <div className="text-center"><div className="font-bold text-lg text-green-600">{data.support.year.closed}</div><div className="text-muted-foreground text-xs">Year</div></div>
            </div>
          </StatCard>
          <StatCard title="Escalated" icon={ArrowUp} iconColor="text-amber-500">
            <div className="text-2xl font-bold text-amber-600">{data.support.total.escalated}</div>
            <div className="text-xs text-muted-foreground mt-1">Requiring escalation</div>
          </StatCard>
          <StatCard title="Overdue Tickets" icon={Clock} iconColor="text-red-500">
            <div className="text-2xl font-bold text-red-600">{data.support.total.overdue}</div>
            <div className="text-xs text-muted-foreground mt-1">Past due date</div>
          </StatCard>
        </div>
      </div>
    </div>
  );
}

function SalesDrilldown() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  
  const bucket = week ? 'week' : month ? 'month' : 'year';
  
  const { data, isLoading } = useQuery<{ buckets: SalesBucket[]; items: any[]; lostLeads: any[]; summary: any }>({
    queryKey: ['/api/admin/dashboard/sales', { bucket, year, month, week }],
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
      
      {/* Chart */}
      {data?.buckets && data.buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="newLeads" name="New Leads" fill="#60a5fa" />
                <Bar dataKey="dealsWon" name="Won" fill="#4ade80" />
                <Bar dataKey="dealsLost" name="Lost" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      
      {/* Data Table */}
      {data?.buckets && data.buckets.length > 0 && !week && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Period</th>
                    <th className="text-right py-2">New Leads</th>
                    <th className="text-right py-2">Won</th>
                    <th className="text-right py-2">Won Value</th>
                    <th className="text-right py-2">Lost</th>
                    <th className="text-right py-2">Lost Value</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.buckets.map((bucket) => (
                    <tr key={bucket.period} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => handleDrillDown(bucket.period, bucket.weekNumber)}>
                      <td className="py-2 font-medium">{bucket.label}</td>
                      <td className="text-right py-2">{bucket.newLeads}</td>
                      <td className="text-right py-2 text-green-600">{bucket.dealsWon}</td>
                      <td className="text-right py-2 text-green-600">{formatCurrency(bucket.dealsWonValue)}</td>
                      <td className="text-right py-2 text-red-600">{bucket.dealsLost}</td>
                      <td className="text-right py-2 text-red-600">{formatCurrency(bucket.dealsLostValue)}</td>
                      <td className="text-right py-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

function ImplementationDrilldown() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  
  const bucket = month ? 'month' : 'year';
  
  const { data, isLoading } = useQuery<{ buckets: ImplementationBucket[]; items: any[]; overdueProjects: any[]; summary: any }>({
    queryKey: ['/api/admin/dashboard/implementation', { bucket, year, month }],
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
      
      {/* Chart */}
      {data?.buckets && data.buckets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Implementation Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="started" name="Started" fill="#60a5fa" />
                <Bar dataKey="completed" name="Completed" fill="#4ade80" />
                <Bar dataKey="overdue" name="Overdue" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
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

function SupportDrilldown() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  
  const bucket = month ? 'month' : 'year';
  
  const { data, isLoading } = useQuery<{ buckets: SupportBucket[]; items: any[]; overdueTickets: any[]; summary: any }>({
    queryKey: ['/api/admin/dashboard/support', { bucket, year, month }],
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
      
      {/* Chart */}
      {data?.buckets && data.buckets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Support Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="opened" name="Opened" fill="#60a5fa" />
                <Bar dataKey="closed" name="Closed" fill="#4ade80" />
                <Bar dataKey="critical" name="Critical" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
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
    </div>
  );
}

function PerformanceTab() {
  const [period, setPeriod] = useState('month');
  
  const { data, isLoading } = useQuery<{ topPerformers: PerformanceUser[]; byDepartment: any; allUsers: PerformanceUser[] }>({
    queryKey: ['/api/admin/dashboard/performance', { period }],
  });
  
  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-amber-500';
    if (index === 1) return 'text-gray-400';
    if (index === 2) return 'text-amber-700';
    return 'text-muted-foreground';
  };
  
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
      
      {/* Top Performers */}
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

export default function SuperAdminDashboard() {
  const { data: overviewData, isLoading } = useQuery<OverviewData>({
    queryKey: ['/api/admin/dashboard/overview'],
  });
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Complete overview of Sales, Implementation & Support</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          <Calendar className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Badge>
      </div>
      
      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-[600px] grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales</TabsTrigger>
          <TabsTrigger value="implementation" data-testid="tab-implementation">Implementation</TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support">Support</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : overviewData ? (
            <OverviewTab data={overviewData} />
          ) : (
            <div className="text-center text-muted-foreground py-8">No data available</div>
          )}
        </TabsContent>
        
        <TabsContent value="sales">
          <SalesDrilldown />
        </TabsContent>
        
        <TabsContent value="implementation">
          <ImplementationDrilldown />
        </TabsContent>
        
        <TabsContent value="support">
          <SupportDrilldown />
        </TabsContent>
        
        <TabsContent value="performance">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
