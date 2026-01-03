import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Phone, PhoneCall, Users, Building2 } from "lucide-react";

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
  customers: CustomerData[];
}

interface CallAnalyticsData {
  userAnalytics: UserAnalytics[];
  totals: {
    coldCalls: number;
    followupCalls: number;
    totalCalls: number;
    totalUsers: number;
  };
  isAdmin: boolean;
}

const COLORS = ['#1a2b6d', '#f5a623', '#4ade80', '#f87171', '#60a5fa', '#a78bfa', '#fb923c', '#22d3ee'];

export function CallAnalytics({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, error } = useQuery<CallAnalyticsData>({
    queryKey: ["/api/analytics/calls"],
  });

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

  const { userAnalytics, totals, isAdmin } = data;

  const chartData = userAnalytics.map(user => ({
    name: user.userName.split(' ')[0],
    fullName: user.userName,
    coldCalls: user.coldCalls,
    followupCalls: user.followupCalls,
    total: user.totalCalls
  }));

  const pieData = [
    { name: 'Cold Calls', value: totals.coldCalls, color: '#1a2b6d' },
    { name: 'Follow-ups', value: totals.followupCalls, color: '#f5a623' }
  ];

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
        </CardTitle>
        <CardDescription>
          User-wise breakdown of cold calls vs follow-up calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <PhoneCall className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{totals.coldCalls}</div>
            <div className="text-sm text-muted-foreground">Cold Calls</div>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <Phone className="h-6 w-6 mx-auto mb-2 text-amber-600" />
            <div className="text-2xl font-bold text-amber-600">{totals.followupCalls}</div>
            <div className="text-sm text-muted-foreground">Follow-up Calls</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <Phone className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{totals.totalCalls}</div>
            <div className="text-sm text-muted-foreground">Total Calls</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <Users className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600">{totals.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
        </div>

        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chart" data-testid="tab-call-chart">Bar Chart</TabsTrigger>
            <TabsTrigger value="pie" data-testid="tab-call-pie">Distribution</TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-call-table">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any, name: any) => [value, String(name) === 'coldCalls' ? 'Cold Calls' : 'Follow-ups']}
                  labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend />
                <Bar dataKey="coldCalls" name="Cold Calls" fill="#1a2b6d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="followupCalls" name="Follow-ups" fill="#f5a623" radius={[4, 4, 0, 0]} />
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
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="hidden md:table-cell">Top Customers</TableHead>
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
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                          {user.coldCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                          {user.followupCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-500">
                          {user.totalCalls}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
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
    </Card>
  );
}
