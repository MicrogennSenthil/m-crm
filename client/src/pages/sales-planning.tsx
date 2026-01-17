import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Target, TrendingUp, Users, Calendar, BarChart3, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, getDaysInMonth, differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as UserType, SalesPlan, SalesMonthlyTarget } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";

const STAGES = [
  { id: "seed", title: "Seeds", color: "#3B82F6" },
  { id: "lead", title: "Leads", color: "#06B6D4" },
  { id: "demo_scheduled", title: "Demo Scheduled", color: "#8B5CF6" },
  { id: "quote_sent", title: "Quote Sent", color: "#EAB308" },
  { id: "negotiation", title: "Negotiation", color: "#F97316" },
  { id: "closed_won", title: "Closed Won", color: "#22C55E" },
];

const WEEKS = [1, 2, 3, 4];

interface PerformanceData {
  plans: SalesPlan[];
  monthlyTarget: SalesMonthlyTarget | null;
  achievements: Array<{ stage: string; qty: number; value: number; weekNumber: number }>;
  dailyAchievements: Array<{ date: string; stage: string; qty: number; value: number }>;
  prediction: {
    predictedQty: number;
    predictedValue: number;
    daysElapsed: number;
    totalDays: number;
    runRateQty: number;
    runRateValue: number;
  } | null;
}

interface TeamComparison {
  month: string;
  comparison: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    targetQty: number;
    targetValue: number;
    achievedQty: number;
    achievedValue: number;
    achievementPercentQty: number;
    achievementPercentValue: number;
    prediction: PerformanceData["prediction"];
  }>;
}

interface DepartmentHeadInfo {
  isDeptHead: boolean;
  departments: Array<{ id: string; name: string }>;
}

interface MonthlyComparisonData {
  month: string;
  targetQty: number;
  targetValue: number;
  achievedQty: number;
  achievedValue: number;
  achievementPercentQty: number;
  achievementPercentValue: number;
}

interface MonthlyComparisonResponse {
  userId: string;
  comparison: MonthlyComparisonData[];
}

interface TeamMonthlyComparisonResponse {
  months: string[];
  teamComparison: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    monthlyData: MonthlyComparisonData[];
  }>;
  teamTotals: MonthlyComparisonData[];
}

interface PlanningStatus {
  hasPlanned: boolean;
  hasPlanEntries: boolean;
  hasMonthlyTarget: boolean;
  planCount: number;
  month: string;
  message: string;
}

export default function SalesPlanning() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedUserId, setSelectedUserId] = useState<string>("self");
  const [editingPlans, setEditingPlans] = useState<Record<string, { targetQty: number; targetValue: number }>>({});
  const [monthlyTargetQty, setMonthlyTargetQty] = useState<number>(0);
  const [monthlyTargetValue, setMonthlyTargetValue] = useState<number>(0);

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: deptHeadInfo } = useQuery<DepartmentHeadInfo>({
    queryKey: ["/api/auth/is-department-head"],
  });

  const hasFullAccess = deptHeadInfo?.isDeptHead || currentUser?.role === "admin";

  const effectiveUserId = selectedUserId === "self" ? currentUser?.id : selectedUserId;

  const { data: plans = [], isLoading: plansLoading } = useQuery<SalesPlan[]>({
    queryKey: ["/api/sales-plans", { month: selectedMonth, userId: effectiveUserId }],
    enabled: !!effectiveUserId,
  });

  const { data: performance, isLoading: performanceLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/sales-performance", { month: selectedMonth, userId: effectiveUserId }],
    enabled: !!effectiveUserId,
  });

  const { data: teamComparison, isLoading: comparisonLoading } = useQuery<TeamComparison>({
    queryKey: ["/api/sales-performance/compare", { month: selectedMonth }],
    enabled: hasFullAccess,
  });

  const { data: planningStatus } = useQuery<PlanningStatus>({
    queryKey: ["/api/sales-planning/status", { month: selectedMonth }],
    enabled: !!currentUser,
  });

  const { data: monthlyComparison, isLoading: monthlyComparisonLoading } = useQuery<MonthlyComparisonResponse>({
    queryKey: ["/api/sales-performance/monthly-comparison", { userId: effectiveUserId, monthCount: 6 }],
    enabled: !!effectiveUserId,
  });

  const { data: teamMonthlyComparison, isLoading: teamMonthlyComparisonLoading } = useQuery<TeamMonthlyComparisonResponse>({
    queryKey: ["/api/sales-performance/team-monthly-comparison", { monthCount: 6 }],
    enabled: hasFullAccess,
  });

  const savePlanMutation = useMutation({
    mutationFn: async (data: { plans: Partial<SalesPlan>[] }) => {
      return apiRequest("POST", "/api/sales-plans/batch", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-performance"] });
      toast({ title: "Plans saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save plans", variant: "destructive" });
    },
  });

  const saveMonthlyTargetMutation = useMutation({
    mutationFn: async (data: Partial<SalesMonthlyTarget>) => {
      return apiRequest("POST", "/api/sales-monthly-targets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-monthly-targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-performance"] });
      toast({ title: "Monthly target saved" });
    },
    onError: () => {
      toast({ title: "Failed to save target", variant: "destructive" });
    },
  });

  const existingPlanMap = useMemo(() => {
    const map: Record<string, SalesPlan> = {};
    plans.forEach((plan) => {
      const key = `${plan.weekNumber}-${plan.stage}`;
      map[key] = plan;
    });
    return map;
  }, [plans]);

  const getPlanValue = (week: number, stage: string, field: "targetQty" | "targetValue"): number => {
    const key = `${week}-${stage}`;
    if (editingPlans[key] !== undefined) {
      return editingPlans[key][field];
    }
    const existing = existingPlanMap[key];
    return existing ? (existing[field] || 0) : 0;
  };

  const setPlanValue = (week: number, stage: string, field: "targetQty" | "targetValue", value: number) => {
    const key = `${week}-${stage}`;
    setEditingPlans((prev) => ({
      ...prev,
      [key]: {
        targetQty: field === "targetQty" ? value : getPlanValue(week, stage, "targetQty"),
        targetValue: field === "targetValue" ? value : getPlanValue(week, stage, "targetValue"),
      },
    }));
  };

  const handleSavePlans = () => {
    const plansToSave: Partial<SalesPlan>[] = [];
    
    WEEKS.forEach((week) => {
      STAGES.forEach((stage) => {
        const key = `${week}-${stage.id}`;
        const qty = getPlanValue(week, stage.id, "targetQty");
        const value = getPlanValue(week, stage.id, "targetValue");
        
        if (qty > 0 || value > 0) {
          plansToSave.push({
            userId: effectiveUserId,
            month: selectedMonth,
            weekNumber: week,
            stage: stage.id,
            targetQty: qty,
            targetValue: value,
          });
        }
      });
    });

    savePlanMutation.mutate({ plans: plansToSave });
  };

  const handleSaveMonthlyTarget = () => {
    saveMonthlyTargetMutation.mutate({
      userId: effectiveUserId,
      month: selectedMonth,
      targetQtyTotal: monthlyTargetQty,
      targetValueTotal: monthlyTargetValue,
    });
  };

  const monthNavigation = (direction: -1 | 1) => {
    const currentDate = parseISO(selectedMonth + "-01");
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedMonth(format(newDate, "yyyy-MM"));
  };

  const stageAchievements = useMemo(() => {
    if (!performance) return {};
    const map: Record<string, { qty: number; value: number }> = {};
    performance.achievements.forEach((a) => {
      if (!map[a.stage]) {
        map[a.stage] = { qty: 0, value: 0 };
      }
      map[a.stage].qty += a.qty;
      map[a.stage].value += a.value;
    });
    return map;
  }, [performance]);

  const stageTargets = useMemo(() => {
    const map: Record<string, { qty: number; value: number }> = {};
    STAGES.forEach((stage) => {
      let totalQty = 0;
      let totalValue = 0;
      WEEKS.forEach((week) => {
        totalQty += getPlanValue(week, stage.id, "targetQty");
        totalValue += getPlanValue(week, stage.id, "targetValue");
      });
      map[stage.id] = { qty: totalQty, value: totalValue };
    });
    return map;
  }, [existingPlanMap, editingPlans]);

  const dailyChartData = useMemo(() => {
    if (!performance?.dailyAchievements) return [];
    
    const dateMap: Record<string, Record<string, number>> = {};
    performance.dailyAchievements.forEach((d) => {
      if (!dateMap[d.date]) {
        dateMap[d.date] = {};
      }
      dateMap[d.date][d.stage] = (dateMap[d.date][d.stage] || 0) + d.qty;
    });

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stages]) => ({
        date: format(parseISO(date), "MMM d"),
        ...stages,
      }));
  }, [performance?.dailyAchievements]);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Planning & Performance</h1>
          <p className="text-muted-foreground">Set weekly targets and track achievements</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => monthNavigation(-1)} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-medium min-w-[120px] text-center">
              {format(parseISO(selectedMonth + "-01"), "MMMM yyyy")}
            </div>
            <Button variant="outline" size="icon" onClick={() => monthNavigation(1)} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {hasFullAccess && (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px]" data-testid="select-user">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">My Performance</SelectItem>
                {users.filter(u => u.role === "sales_executive" || u.role === "sales_head").map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="planning">
        <TabsList>
          <TabsTrigger value="planning" data-testid="tab-planning">
            <Target className="h-4 w-4 mr-2" />
            Planning
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <TrendingUp className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="monthly-trends" data-testid="tab-monthly-trends">
            <BarChart3 className="h-4 w-4 mr-2" />
            Monthly Trends
          </TabsTrigger>
          {hasFullAccess && (
            <TabsTrigger value="comparison" data-testid="tab-comparison">
              <Users className="h-4 w-4 mr-2" />
              Team Comparison
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Weekly Stage Targets</CardTitle>
                  <CardDescription>Set quantity and value targets for each stage per week</CardDescription>
                </div>
                <Button onClick={handleSavePlans} disabled={savePlanMutation.isPending} data-testid="button-save-plans">
                  <Save className="h-4 w-4 mr-2" />
                  Save Plans
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Stage</TableHead>
                        {WEEKS.map((week) => (
                          <TableHead key={week} className="text-center min-w-[100px]">
                            Week {week}
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[80px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {STAGES.map((stage) => (
                        <TableRow key={stage.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                              <span className="font-medium">{stage.title}</span>
                            </div>
                          </TableCell>
                          {WEEKS.map((week) => (
                            <TableCell key={week} className="p-1">
                              <div className="flex flex-col gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Qty"
                                  className="h-8 text-xs"
                                  value={getPlanValue(week, stage.id, "targetQty") || ""}
                                  onChange={(e) => setPlanValue(week, stage.id, "targetQty", parseInt(e.target.value) || 0)}
                                  data-testid={`input-qty-${week}-${stage.id}`}
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Value"
                                  className="h-8 text-xs"
                                  value={getPlanValue(week, stage.id, "targetValue") || ""}
                                  onChange={(e) => setPlanValue(week, stage.id, "targetValue", parseInt(e.target.value) || 0)}
                                  data-testid={`input-value-${week}-${stage.id}`}
                                />
                              </div>
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <div className="font-medium">{stageTargets[stage.id]?.qty || 0}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(stageTargets[stage.id]?.value || 0)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Target</CardTitle>
                <CardDescription>Set overall monthly goals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Total Quantity Target</Label>
                  <Input
                    type="number"
                    min="0"
                    value={monthlyTargetQty || performance?.monthlyTarget?.targetQtyTotal || ""}
                    onChange={(e) => setMonthlyTargetQty(parseInt(e.target.value) || 0)}
                    data-testid="input-monthly-qty"
                  />
                </div>
                <div>
                  <Label>Total Value Target (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={monthlyTargetValue || performance?.monthlyTarget?.targetValueTotal || ""}
                    onChange={(e) => setMonthlyTargetValue(parseInt(e.target.value) || 0)}
                    data-testid="input-monthly-value"
                  />
                </div>
                <Button onClick={handleSaveMonthlyTarget} className="w-full" disabled={saveMonthlyTargetMutation.isPending} data-testid="button-save-monthly">
                  <Save className="h-4 w-4 mr-2" />
                  Save Monthly Target
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(performance?.monthlyTarget?.targetValueTotal || Object.values(stageTargets).reduce((s, t) => s + t.value, 0))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {performance?.monthlyTarget?.targetQtyTotal || Object.values(stageTargets).reduce((s, t) => s + t.qty, 0)} deals
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Achieved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(Object.values(stageAchievements).reduce((s, a) => s + a.value, 0))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Object.values(stageAchievements).reduce((s, a) => s + a.qty, 0)} deals
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Daily Run Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(performance?.prediction?.runRateValue || 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {performance?.prediction?.runRateQty?.toFixed(1) || 0} deals/day
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Month-End Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(performance?.prediction?.predictedValue || 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {performance?.prediction?.predictedQty?.toFixed(0) || 0} deals expected
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Stage-wise Achievement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {STAGES.map((stage) => {
                    const target = stageTargets[stage.id] || { qty: 0, value: 0 };
                    const achieved = stageAchievements[stage.id] || { qty: 0, value: 0 };
                    const percentQty = target.qty > 0 ? Math.round((achieved.qty / target.qty) * 100) : 0;
                    const percentValue = target.value > 0 ? Math.round((achieved.value / target.value) * 100) : 0;

                    return (
                      <div key={stage.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className="font-medium">{stage.title}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>{achieved.qty}/{target.qty} deals</span>
                            <Badge variant={percentQty >= 100 ? "default" : percentQty >= 50 ? "secondary" : "destructive"}>
                              {percentQty}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={Math.min(percentQty, 100)} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(achieved.value)} achieved</span>
                          <span>{formatCurrency(target.value)} target</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Achievement Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                {dailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      {STAGES.map((stage) => (
                        <Bar
                          key={stage.id}
                          dataKey={stage.id}
                          name={stage.title}
                          fill={stage.color}
                          stackId="a"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No daily data available for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly-trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Month-over-Month Performance</CardTitle>
                <CardDescription>Your achievement trends over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                {monthlyComparisonLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : monthlyComparison?.comparison && monthlyComparison.comparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...monthlyComparison.comparison].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        fontSize={12}
                        tickFormatter={(val) => format(parseISO(val + "-01"), "MMM yy")}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        labelFormatter={(val) => format(parseISO(val + "-01"), "MMMM yyyy")}
                        formatter={(value: number, name: string) => {
                          if (name.includes("Value")) return formatCurrency(value);
                          if (name.includes("%")) return `${value}%`;
                          return value;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="targetValue" name="Target Value" fill="#94A3B8" />
                      <Bar dataKey="achievedValue" name="Achieved Value" fill="#22C55E" />
                      <Line 
                        type="monotone" 
                        dataKey="achievementPercentValue" 
                        name="Achievement %" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        yAxisId="right"
                      />
                      <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No monthly data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Statistics</CardTitle>
                <CardDescription>Detailed breakdown by month</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyComparisonLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : monthlyComparison?.comparison && monthlyComparison.comparison.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Target</TableHead>
                          <TableHead className="text-right">Achieved</TableHead>
                          <TableHead className="text-right">Achievement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...monthlyComparison.comparison].reverse().map((data) => (
                          <TableRow key={data.month}>
                            <TableCell className="font-medium">
                              {format(parseISO(data.month + "-01"), "MMMM yyyy")}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(data.targetValue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(data.achievedValue)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={data.achievementPercentValue >= 100 ? "default" : data.achievementPercentValue >= 50 ? "secondary" : "destructive"}>
                                {data.achievementPercentValue}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No monthly data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {hasFullAccess && (
            <Card>
              <CardHeader>
                <CardTitle>Team Month-over-Month Comparison</CardTitle>
                <CardDescription>Compare team performance across months</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {teamMonthlyComparisonLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : teamMonthlyComparison?.teamTotals && teamMonthlyComparison.teamTotals.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...teamMonthlyComparison.teamTotals].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        fontSize={12}
                        tickFormatter={(val) => format(parseISO(val + "-01"), "MMM yy")}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        labelFormatter={(val) => format(parseISO(val + "-01"), "MMMM yyyy")}
                        formatter={(value: number, name: string) => {
                          if (name.includes("Value")) return formatCurrency(value);
                          if (name.includes("%")) return `${value}%`;
                          return value;
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="targetValue" 
                        name="Team Target" 
                        fill="#94A3B8" 
                        fillOpacity={0.3}
                        stroke="#94A3B8"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="achievedValue" 
                        name="Team Achieved" 
                        fill="#22C55E" 
                        fillOpacity={0.3}
                        stroke="#22C55E"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="achievementPercentValue" 
                        name="Achievement %" 
                        stroke="#F97316" 
                        strokeWidth={2}
                        yAxisId="right"
                      />
                      <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No team monthly data available
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {hasFullAccess && (
          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Performance Comparison</CardTitle>
                <CardDescription>Compare achievement across team members</CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : teamComparison?.comparison && teamComparison.comparison.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Sales Executive</TableHead>
                          <TableHead className="text-right">Target (Qty)</TableHead>
                          <TableHead className="text-right">Achieved (Qty)</TableHead>
                          <TableHead className="text-right">Target (Value)</TableHead>
                          <TableHead className="text-right">Achieved (Value)</TableHead>
                          <TableHead className="text-right">Achievement %</TableHead>
                          <TableHead className="text-right">Predicted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamComparison.comparison.map((member, idx) => (
                          <TableRow key={member.userId}>
                            <TableCell>
                              <Badge variant={idx === 0 ? "default" : idx < 3 ? "secondary" : "outline"}>
                                #{idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{member.userName}</div>
                              <div className="text-xs text-muted-foreground">{member.userEmail}</div>
                            </TableCell>
                            <TableCell className="text-right">{member.targetQty}</TableCell>
                            <TableCell className="text-right font-medium">{member.achievedQty}</TableCell>
                            <TableCell className="text-right">{formatCurrency(member.targetValue)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(member.achievedValue)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress
                                  value={Math.min(member.achievementPercentValue, 100)}
                                  className="w-16 h-2"
                                />
                                <Badge variant={member.achievementPercentValue >= 100 ? "default" : member.achievementPercentValue >= 50 ? "secondary" : "destructive"}>
                                  {member.achievementPercentValue}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              {formatCurrency(member.prediction?.predictedValue || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No team data available for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {teamComparison?.comparison && teamComparison.comparison.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Achievement Comparison Chart</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={teamComparison.comparison} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        dataKey="userName"
                        type="category"
                        fontSize={12}
                        width={120}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="targetValue" name="Target" fill="#94A3B8" />
                      <Bar dataKey="achievedValue" name="Achieved" fill="#22C55E" />
                      <Bar dataKey="prediction.predictedValue" name="Predicted" fill="#3B82F6" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
