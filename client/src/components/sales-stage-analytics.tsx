import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Calendar, CalendarDays } from "lucide-react";

interface StageData {
  count: number;
  value: number;
}

interface PeriodData {
  period: string;
  weekNumber?: number;
  monthIndex?: number;
  startDate: string;
  endDate: string;
  stages: Record<string, StageData>;
  totalLeads: number;
  totalValue: number;
}

interface StageChange {
  countChange: number;
  valueChange: number;
}

interface StageDistribution {
  stage: string;
  label: string;
  count: number;
  value: number;
  percentage: number;
}

interface StageAnalyticsData {
  stages: { id: string; label: string }[];
  weekly: {
    data: PeriodData[];
    changes: Record<string, StageChange>;
  };
  monthly: {
    data: PeriodData[];
    changes: Record<string, StageChange>;
  };
  currentDistribution: StageDistribution[];
  summary: {
    totalLeads: number;
    totalValue: number;
    conversionRate: number;
  };
}

const STAGE_COLORS: Record<string, string> = {
  seed: "#3b82f6",
  lead: "#06b6d4",
  demo_scheduled: "#8b5cf6",
  quote_sent: "#f97316",
  negotiation: "#eab308",
  closed_won: "#22c55e",
  closed_lost: "#ef4444",
};

const CHART_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#f97316", "#eab308", "#22c55e", "#ef4444"
];

function formatCurrency(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString()}`;
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
        <TrendingUp className="h-3 w-3" />
        +{value}{suffix}
      </span>
    );
  } else if (value < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
        <TrendingDown className="h-3 w-3" />
        {value}{suffix}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
      <Minus className="h-3 w-3" />
      0{suffix}
    </span>
  );
}

function StageComparisonTable({ 
  data, 
  stages, 
  changes,
  periodType
}: { 
  data: PeriodData[]; 
  stages: { id: string; label: string }[];
  changes: Record<string, StageChange>;
  periodType: 'weekly' | 'monthly';
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">Period</TableHead>
            {stages.map((stage) => (
              <TableHead key={stage.id} className="text-center min-w-[100px]">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: STAGE_COLORS[stage.id] }}
                    />
                    <span className="font-medium">{stage.label}</span>
                  </div>
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center font-semibold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((period) => (
            <TableRow key={period.period}>
              <TableCell className="sticky left-0 bg-background z-10">
                <div className="flex flex-col">
                  <span className="font-medium">{period.period}</span>
                  <span className="text-xs text-muted-foreground">
                    {period.startDate.split('-').slice(1).join('/')} - {period.endDate.split('-').slice(1).join('/')}
                  </span>
                </div>
              </TableCell>
              {stages.map((stage) => {
                const stageData = period.stages[stage.id] || { count: 0, value: 0 };
                return (
                  <TableCell key={stage.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold text-lg">{stageData.count}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(stageData.value)}
                      </span>
                    </div>
                  </TableCell>
                );
              })}
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold text-lg">{period.totalLeads}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(period.totalValue)}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold bg-muted/50">
            <TableCell className="sticky left-0 bg-muted/50 z-10">Change</TableCell>
            {stages.map((stage) => (
              <TableCell key={stage.id} className="text-center">
                {changes[stage.id] ? (
                  <div className="flex flex-col items-center gap-1">
                    <TrendIndicator value={changes[stage.id].countChange} />
                    <span className="text-xs text-muted-foreground">
                      Value: <TrendIndicator value={changes[stage.id].valueChange} />
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            ))}
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function StageBarChart({ 
  data, 
  stages 
}: { 
  data: PeriodData[]; 
  stages: { id: string; label: string }[];
}) {
  const chartData = data.map(period => {
    const result: any = { name: period.period };
    stages.forEach(stage => {
      result[stage.label] = period.stages[stage.id]?.count || 0;
    });
    return result;
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
          className="fill-foreground"
        />
        <YAxis className="fill-foreground" />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        {stages.map((stage, idx) => (
          <Bar 
            key={stage.id} 
            dataKey={stage.label} 
            fill={STAGE_COLORS[stage.id]}
            stackId="a"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function StageLineChart({ 
  data, 
  stages 
}: { 
  data: PeriodData[]; 
  stages: { id: string; label: string }[];
}) {
  const chartData = data.map(period => {
    const result: any = { name: period.period };
    stages.forEach(stage => {
      result[stage.label] = period.stages[stage.id]?.count || 0;
    });
    return result;
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
          className="fill-foreground"
        />
        <YAxis className="fill-foreground" />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        {stages.map((stage) => (
          <Line 
            key={stage.id} 
            type="monotone"
            dataKey={stage.label} 
            stroke={STAGE_COLORS[stage.id]}
            strokeWidth={2}
            dot={{ fill: STAGE_COLORS[stage.id] }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function StagePieChart({ distribution }: { distribution: StageDistribution[] }) {
  const chartData = distribution.filter(d => d.count > 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ label, percentage }) => percentage > 5 ? `${label}: ${percentage}%` : ''}
          outerRadius={100}
          fill="#8884d8"
          dataKey="count"
          nameKey="label"
        >
          {chartData.map((entry) => (
            <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
          formatter={(value: number, name: string) => [value, name]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SalesStageAnalytics() {
  const { data, isLoading, error } = useQuery<StageAnalyticsData>({
    queryKey: ["/api/admin/dashboard/sales-stage-analytics"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sales Stage Analytics
          </CardTitle>
          <CardDescription>Loading analytics data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[200px] w-full" />
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
            <BarChart3 className="h-5 w-5" />
            Sales Stage Analytics
          </CardTitle>
          <CardDescription className="text-red-500">
            Failed to load analytics data
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="card-sales-stage-analytics">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Sales Stage Analytics
            </CardTitle>
            <CardDescription>
              Weekly and monthly comparison analysis by pipeline stage
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold">{data.summary.totalLeads}</span>
              <span className="text-xs text-muted-foreground">Total Leads</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold">{formatCurrency(data.summary.totalValue)}</span>
              <span className="text-xs text-muted-foreground">Pipeline Value</span>
            </div>
            <div className="flex flex-col items-end">
              <Badge variant="outline" className="text-lg font-bold">
                {data.summary.conversionRate}%
              </Badge>
              <span className="text-xs text-muted-foreground">Conversion</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weekly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekly" className="flex items-center gap-2" data-testid="tab-weekly">
              <Calendar className="h-4 w-4" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-2" data-testid="tab-monthly">
              <CalendarDays className="h-4 w-4" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-2" data-testid="tab-distribution">
              <PieChartIcon className="h-4 w-4" />
              Distribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-6">
            <Tabs defaultValue="chart" className="space-y-4">
              <TabsList>
                <TabsTrigger value="chart" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chart View
                </TabsTrigger>
                <TabsTrigger value="trend" className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4" />
                  Trend View
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-2">
                  Table View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chart">
                <StageBarChart data={data.weekly.data} stages={data.stages} />
              </TabsContent>
              
              <TabsContent value="trend">
                <StageLineChart data={data.weekly.data} stages={data.stages} />
              </TabsContent>
              
              <TabsContent value="table">
                <StageComparisonTable 
                  data={data.weekly.data} 
                  stages={data.stages}
                  changes={data.weekly.changes}
                  periodType="weekly"
                />
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {data.stages.map((stage) => {
                const currentWeek = data.weekly.data[data.weekly.data.length - 1];
                const stageData = currentWeek?.stages[stage.id] || { count: 0, value: 0 };
                const change = data.weekly.changes[stage.id];
                
                return (
                  <Card key={stage.id} className="p-3" data-testid={`card-stage-${stage.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: STAGE_COLORS[stage.id] }}
                      />
                      <span className="text-xs font-medium truncate">{stage.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{stageData.count}</div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {formatCurrency(stageData.value)}
                    </div>
                    {change && <TrendIndicator value={change.countChange} />}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <Tabs defaultValue="chart" className="space-y-4">
              <TabsList>
                <TabsTrigger value="chart" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chart View
                </TabsTrigger>
                <TabsTrigger value="trend" className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4" />
                  Trend View
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-2">
                  Table View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chart">
                <StageBarChart data={data.monthly.data} stages={data.stages} />
              </TabsContent>
              
              <TabsContent value="trend">
                <StageLineChart data={data.monthly.data} stages={data.stages} />
              </TabsContent>
              
              <TabsContent value="table">
                <StageComparisonTable 
                  data={data.monthly.data} 
                  stages={data.stages}
                  changes={data.monthly.changes}
                  periodType="monthly"
                />
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {data.stages.map((stage) => {
                const currentMonth = data.monthly.data[data.monthly.data.length - 1];
                const stageData = currentMonth?.stages[stage.id] || { count: 0, value: 0 };
                const change = data.monthly.changes[stage.id];
                
                return (
                  <Card key={stage.id} className="p-3" data-testid={`card-monthly-stage-${stage.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: STAGE_COLORS[stage.id] }}
                      />
                      <span className="text-xs font-medium truncate">{stage.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{stageData.count}</div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {formatCurrency(stageData.value)}
                    </div>
                    {change && <TrendIndicator value={change.countChange} />}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-4">Current Stage Distribution</h4>
                <StagePieChart distribution={data.currentDistribution} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4">Stage Breakdown</h4>
                <div className="space-y-3">
                  {data.currentDistribution.map((stage) => (
                    <div 
                      key={stage.stage}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`row-distribution-${stage.stage}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: STAGE_COLORS[stage.stage] }}
                        />
                        <div>
                          <div className="font-medium">{stage.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(stage.value)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{stage.count}</div>
                        <Badge variant="outline">{stage.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
