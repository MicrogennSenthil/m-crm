import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { Phone, PhoneCall, Users, Building2, Calendar, TrendingUp, ArrowRightLeft, Presentation, X, MapPin, Mail, Clock, Loader2 } from "lucide-react";

interface DrilldownRecord {
  id: string | number;
  type: string;
  time: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  stage: string;
  source: string;
  city: string;
  area: string;
  isExistingCustomer: boolean;
  salesExecutiveId: string;
  salesExecutiveName: string;
  notes?: string;
  completed?: boolean;
}

interface DrilldownData {
  date: string;
  stageType: string;
  count: number;
  records: DrilldownRecord[];
}

interface CustomerData {
  customerId: string;
  customerName: string;
  coldCalls: number;
  followups: number;
  total: number;
}

interface UserAnalytics {
  userId: string;
  userName: string;
  email: string;
  role: string;
  coldCalls: number;
  followupCalls: number;
  totalCalls: number;
  leadConversions: number;
  demoCount: number;
  customers: CustomerData[];
}

interface DailyUserData {
  userId: string;
  userName: string;
  coldCalls: number;
  followupCalls: number;
  leadConversions: number;
  demoCount: number;
}

interface DailyAnalytics {
  date: string;
  dateLabel: string;
  totalColdCalls: number;
  totalFollowupCalls: number;
  totalLeadConversions: number;
  totalDemoCount: number;
  users: DailyUserData[];
}

interface CallAnalyticsData {
  userAnalytics: UserAnalytics[];
  dailyAnalytics: DailyAnalytics[];
  totals: {
    coldCalls: number;
    followupCalls: number;
    totalCalls: number;
    leadConversions: number;
    demoCount: number;
    totalUsers: number;
  };
  isAdmin: boolean;
  isDepartmentHead?: boolean;
  viewScope?: 'self' | 'team' | 'all';
}

const COLORS = ['#1a2b6d', '#f5a623', '#4ade80', '#f87171', '#60a5fa', '#a78bfa', '#fb923c', '#22d3ee'];

const STAGE_TYPE_LABELS: Record<string, string> = {
  cold_call: 'Cold Calls',
  followup: 'Follow-ups',
  conversion: 'Conversions',
  demo: 'Demos'
};

const STAGE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  cold_call: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200' },
  followup: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200' },
  conversion: { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-600 dark:text-green-400', border: 'border-green-200' },
  demo: { bg: 'bg-pink-50 dark:bg-pink-950/50', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200' }
};

export function CallAnalytics({ compact = false }: { compact?: boolean }) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownParams, setDrilldownParams] = useState<{ date: string; stageType: string; dateLabel: string } | null>(null);
  
  const { data, isLoading, error } = useQuery<CallAnalyticsData>({
    queryKey: ["/api/analytics/calls"],
  });
  
  // Drilldown query - only runs when dialog is open and params are set
  const drilldownQueryKey = drilldownParams 
    ? `/api/analytics/stage-drilldown?date=${drilldownParams.date}&stageType=${drilldownParams.stageType}`
    : null;
    
  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<DrilldownData>({
    queryKey: [drilldownQueryKey],
    enabled: !!drilldownParams && drilldownOpen && !!drilldownQueryKey
  });
  
  const handleStageClick = (date: string, stageType: string, dateLabel: string) => {
    setDrilldownParams({ date, stageType, dateLabel });
    setDrilldownOpen(true);
  };
  
  const closeDrilldown = () => {
    setDrilldownOpen(false);
    setDrilldownParams(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Unable to load call analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const { userAnalytics, dailyAnalytics, totals, isAdmin, isDepartmentHead, viewScope } = data;
  
  // Get scope description for display
  const getScopeDescription = () => {
    if (viewScope === 'all') return 'Organization-wide call analytics';
    if (viewScope === 'team') return 'Team performance analytics';
    return 'Your personal performance';
  };

  const chartData = userAnalytics.map(user => ({
    name: user.userName.split(' ')[0],
    fullName: user.userName,
    coldCalls: user.coldCalls,
    followupCalls: user.followupCalls,
    leadConversions: user.leadConversions,
    demoCount: user.demoCount,
    total: user.totalCalls
  }));

  const pieData = [
    { name: 'Cold Calls', value: totals.coldCalls, color: '#1a2b6d' },
    { name: 'Follow-ups', value: totals.followupCalls, color: '#f5a623' }
  ];

  // Day-wise chart data - filter to only show days with activity
  const dailyChartData = (dailyAnalytics || [])
    .filter(d => d.totalColdCalls > 0 || d.totalFollowupCalls > 0 || d.totalLeadConversions > 0 || d.totalDemoCount > 0)
    .map(d => ({
      date: d.date,
      dateLabel: d.dateLabel,
      coldCalls: d.totalColdCalls,
      followupCalls: d.totalFollowupCalls,
      leadConversions: d.totalLeadConversions,
      demoCount: d.totalDemoCount,
      total: d.totalColdCalls + d.totalFollowupCalls,
      users: d.users
    }));

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" />
            Call Analytics
          </CardTitle>
          <CardDescription>Cold Calls vs Followups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{totals.coldCalls}</div>
              <div className="text-xs text-muted-foreground">Cold Calls</div>
            </div>
            <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <div className="text-xl font-bold text-amber-600">{totals.followupCalls}</div>
              <div className="text-xs text-muted-foreground">Follow-ups</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-xl font-bold text-green-600">{totals.totalCalls}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ fontSize: 12 }}
                formatter={(value: any, name: any) => [value, String(name) === 'coldCalls' ? 'Cold Calls' : 'Follow-ups']}
                labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar dataKey="coldCalls" name="Cold Calls" fill="#1a2b6d" radius={[4, 4, 0, 0]} />
              <Bar dataKey="followupCalls" name="Follow-ups" fill="#f5a623" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Analytics
          {viewScope === 'team' && (
            <Badge variant="outline" className="ml-2 bg-indigo-50 text-indigo-600 border-indigo-200">
              Team View
            </Badge>
          )}
          {viewScope === 'self' && (
            <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-600 border-emerald-200">
              My Performance
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {getScopeDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <PhoneCall className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-cold-calls">{totals.coldCalls}</div>
            <div className="text-sm text-muted-foreground">Cold Calls</div>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <Phone className="h-6 w-6 mx-auto mb-2 text-amber-600" />
            <div className="text-2xl font-bold text-amber-600" data-testid="text-total-followups">{totals.followupCalls}</div>
            <div className="text-sm text-muted-foreground">Follow-up Calls</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <ArrowRightLeft className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-conversions">{totals.leadConversions}</div>
            <div className="text-sm text-muted-foreground">Lead Conversions</div>
          </div>
          <div className="text-center p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
            <Presentation className="h-6 w-6 mx-auto mb-2 text-pink-600" />
            <div className="text-2xl font-bold text-pink-600" data-testid="text-total-demos">{totals.demoCount}</div>
            <div className="text-sm text-muted-foreground">Demos</div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-800">
            <Phone className="h-6 w-6 mx-auto mb-2 text-slate-600" />
            <div className="text-2xl font-bold text-slate-600" data-testid="text-total-calls">{totals.totalCalls}</div>
            <div className="text-sm text-muted-foreground">Total Calls</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <Users className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600" data-testid="text-total-users">{totals.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
        </div>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="daily" data-testid="tab-call-daily">
              <Calendar className="h-4 w-4 mr-1" />
              Day-wise
            </TabsTrigger>
            <TabsTrigger value="chart" data-testid="tab-call-chart">By User</TabsTrigger>
            <TabsTrigger value="pie" data-testid="tab-call-pie">Distribution</TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-call-table">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Daily call activity (last 30 days with activity)</span>
              </div>
              
              {dailyChartData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No call data available for the selected period
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={dailyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="coldCallsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a2b6d" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#1a2b6d" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="followupGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f5a623" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f5a623" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="conversionsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="demosGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="dateLabel" 
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]?.payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3">
                                <p className="font-medium mb-2">{label}</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#1a2b6d]" />
                                    <span>Cold Calls: {data?.coldCalls || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#f5a623]" />
                                    <span>Follow-ups: {data?.followupCalls || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#4ade80]" />
                                    <span>Conversions: {data?.leadConversions || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#ec4899]" />
                                    <span>Demos: {data?.demoCount || 0}</span>
                                  </div>
                                  {data?.users && data.users.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-xs text-muted-foreground mb-1">By User:</p>
                                      {data.users.slice(0, 5).map((u: DailyUserData) => (
                                        <div key={u.userId} className="text-xs text-muted-foreground">
                                          {u.userName}: {u.coldCalls} cold, {u.followupCalls} f/u, {u.leadConversions} conv, {u.demoCount} demos
                                        </div>
                                      ))}
                                      {data.users.length > 5 && (
                                        <div className="text-xs text-muted-foreground">+{data.users.length - 5} more</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="coldCalls" 
                        name="Cold Calls" 
                        stroke="#1a2b6d" 
                        fillOpacity={1}
                        fill="url(#coldCallsGradient)"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="followupCalls" 
                        name="Follow-ups" 
                        stroke="#f5a623" 
                        fillOpacity={1}
                        fill="url(#followupGradient)"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="leadConversions" 
                        name="Conversions" 
                        stroke="#4ade80" 
                        fillOpacity={1}
                        fill="url(#conversionsGradient)"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="demoCount" 
                        name="Demos" 
                        stroke="#ec4899" 
                        fillOpacity={1}
                        fill="url(#demosGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Daily breakdown table */}
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">Cold Calls</TableHead>
                          <TableHead className="text-center">Follow-ups</TableHead>
                          <TableHead className="text-center">Conversions</TableHead>
                          <TableHead className="text-center">Demos</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="hidden lg:table-cell">Users Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyChartData.slice().reverse().map((day) => (
                          <TableRow key={day.date} data-testid={`row-daily-${day.date}`}>
                            <TableCell className="font-medium">{day.dateLabel}</TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 cursor-pointer hover-elevate"
                                onClick={() => day.coldCalls > 0 && handleStageClick(day.date, 'cold_call', day.dateLabel)}
                                data-testid={`drilldown-cold-${day.date}`}
                                title="Click to see details"
                              >
                                {day.coldCalls}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 cursor-pointer hover-elevate"
                                onClick={() => day.followupCalls > 0 && handleStageClick(day.date, 'followup', day.dateLabel)}
                                data-testid={`drilldown-followup-${day.date}`}
                                title="Click to see details"
                              >
                                {day.followupCalls}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className="bg-green-50 text-green-600 border-green-200 dark:bg-green-950/50 dark:text-green-400 cursor-pointer hover-elevate"
                                onClick={() => day.leadConversions > 0 && handleStageClick(day.date, 'conversion', day.dateLabel)}
                                data-testid={`drilldown-conversion-${day.date}`}
                                title="Click to see details"
                              >
                                {day.leadConversions}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className="bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950/50 dark:text-pink-400 cursor-pointer hover-elevate"
                                onClick={() => day.demoCount > 0 && handleStageClick(day.date, 'demo', day.dateLabel)}
                                data-testid={`drilldown-demo-${day.date}`}
                                title="Click to see details"
                              >
                                {day.demoCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-slate-500">{day.total}</Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {day.users.slice(0, 3).map((u) => (
                                  <Badge 
                                    key={u.userId} 
                                    variant="outline" 
                                    className="text-xs"
                                    title={`${u.userName}: ${u.coldCalls} cold, ${u.followupCalls} f/u, ${u.leadConversions} conv, ${u.demoCount} demos`}
                                  >
                                    {u.userName.split(' ')[0]}
                                  </Badge>
                                ))}
                                {day.users.length > 3 && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    +{day.users.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="chart" className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <p className="font-medium mb-2">{data?.fullName || label}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#1a2b6d]" />
                              <span>Cold Calls: {data?.coldCalls || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#f5a623]" />
                              <span>Follow-ups: {data?.followupCalls || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#4ade80]" />
                              <span>Conversions: {data?.leadConversions || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#ec4899]" />
                              <span>Demos: {data?.demoCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="coldCalls" name="Cold Calls" fill="#1a2b6d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="followupCalls" name="Follow-ups" fill="#f5a623" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leadConversions" name="Conversions" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="demoCount" name="Demos" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="pie" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">Overall Distribution</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">By User (Total Calls)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData.filter(d => d.total > 0).slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {chartData.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [value, props.payload?.fullName || name]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-center">Cold Calls</TableHead>
                    <TableHead className="text-center">Follow-ups</TableHead>
                    <TableHead className="text-center">Conversions</TableHead>
                    <TableHead className="text-center">Demos</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="hidden lg:table-cell">Top Customers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userAnalytics.map((user) => (
                    <TableRow key={user.userId} data-testid={`row-call-user-${user.userId}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.userName}</div>
                          <div className="text-xs text-muted-foreground">{user.role}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400">
                          {user.coldCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                          {user.followupCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 dark:bg-green-950/50 dark:text-green-400">
                          {user.leadConversions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950/50 dark:text-pink-400">
                          {user.demoCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-500">
                          {user.totalCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.customers.slice(0, 3).map((customer, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="text-xs"
                              title={`Cold: ${customer.coldCalls}, Follow-ups: ${customer.followups}`}
                            >
                              <Building2 className="h-3 w-3 mr-1" />
                              {customer.customerName.length > 15 
                                ? customer.customerName.substring(0, 15) + '...' 
                                : customer.customerName}
                              <span className="ml-1 text-muted-foreground">({customer.total})</span>
                            </Badge>
                          ))}
                          {user.customers.length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{user.customers.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drilldownParams?.stageType && (
                <Badge 
                  variant="outline" 
                  className={`${STAGE_TYPE_COLORS[drilldownParams.stageType]?.bg} ${STAGE_TYPE_COLORS[drilldownParams.stageType]?.text} ${STAGE_TYPE_COLORS[drilldownParams.stageType]?.border}`}
                >
                  {STAGE_TYPE_LABELS[drilldownParams.stageType] || drilldownParams.stageType}
                </Badge>
              )}
              <span>{drilldownParams?.dateLabel}</span>
            </DialogTitle>
            <DialogDescription>
              {drilldownData?.count || 0} records found
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4" data-testid="drilldown-content">
            {drilldownLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : drilldownData?.records && drilldownData.records.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                    <TableHead className="hidden md:table-cell">Executive</TableHead>
                    <TableHead className="hidden xl:table-cell">Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownData.records.map((record) => (
                    <TableRow key={record.id} data-testid={`drilldown-row-${record.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {record.time ? new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium truncate max-w-[150px]">{record.companyName}</span>
                          {record.isExistingCustomer && (
                            <Badge variant="secondary" className="text-xs ml-1">Existing</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">{record.contactPerson}</div>
                        <div className="text-xs text-muted-foreground">{record.contactPhone}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {(record.city || record.area) && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[record.area, record.city].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{record.salesExecutiveName}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {record.stage && (
                          <Badge variant="outline" className="text-xs">
                            {record.stage}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No records found for this date and stage
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={closeDrilldown} data-testid="button-close-drilldown">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
