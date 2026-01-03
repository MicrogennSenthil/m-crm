import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Phone, PhoneCall, FileSpreadsheet, ChevronDown, ChevronRight, 
  Calendar, Building2, User, MapPin, MessageSquare, Download
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface CallDetail {
  id: string;
  type: 'cold_call' | 'followup';
  date: string;
  salesExecutiveId: string;
  salesExecutiveName: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  stage: string;
  source: string;
  city: string;
  area: string;
  isExistingCustomer: boolean;
  notes: string | null;
  completed?: boolean;
}

interface DailyBreakdown {
  date: string;
  dateLabel: string;
  coldCallCount: number;
  followupCount: number;
  totalCount: number;
  calls: CallDetail[];
}

interface ExecutiveBreakdown {
  salesExecutiveId: string;
  salesExecutiveName: string;
  email: string;
  coldCallCount: number;
  followupCount: number;
  totalCount: number;
}

interface CallDetailsData {
  dateRange: {
    from: string;
    to: string;
    period: string;
  };
  summary: {
    totalColdCalls: number;
    totalFollowups: number;
    totalCalls: number;
    uniqueCompanies: number;
    uniqueExecutives: number;
  };
  dailyBreakdown: DailyBreakdown[];
  executiveBreakdown: ExecutiveBreakdown[];
  callDetails: CallDetail[];
  viewScope: string;
}

export function CallDetails() {
  const [period, setPeriod] = useState<string>('week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const queryParams = new URLSearchParams();
  if (startDate && endDate) {
    queryParams.set('startDate', startDate);
    queryParams.set('endDate', endDate);
  } else {
    queryParams.set('period', period);
  }

  const { data, isLoading, error } = useQuery<CallDetailsData>({
    queryKey: ["/api/analytics/call-details", period, startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/call-details?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch call details');
      return response.json();
    },
  });

  const toggleDateExpanded = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = [
      'Date', 'Time', 'Type', 'Sales Executive', 'Company', 'Contact Person', 
      'Phone', 'Email', 'Stage', 'Source', 'City', 'Area', 'Existing Customer', 'Notes'
    ];
    
    const rows = data.callDetails.map(call => [
      call.date ? format(parseISO(call.date), 'yyyy-MM-dd') : '',
      call.date ? format(parseISO(call.date), 'HH:mm') : '',
      call.type === 'cold_call' ? 'Cold Call' : 'Follow-up',
      call.salesExecutiveName,
      call.companyName,
      call.contactPerson,
      call.contactPhone || '',
      call.contactEmail || '',
      call.stage || '',
      call.source || '',
      call.city || '',
      call.area || '',
      call.isExistingCustomer ? 'Yes' : 'No',
      call.notes || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call-report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Detailed Call Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
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
            <FileSpreadsheet className="h-5 w-5" />
            Detailed Call Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Unable to load call details
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, dailyBreakdown, executiveBreakdown, viewScope, dateRange } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Detailed Call Report
            </CardTitle>
            <CardDescription className="mt-1">
              {viewScope === 'all' && 'Organization-wide call details'}
              {viewScope === 'team' && 'Team call details'}
              {viewScope === 'self' && 'Your call details'}
              {' • '}
              {dateRange.from && format(parseISO(dateRange.from), 'MMM d')} - {dateRange.to && format(parseISO(dateRange.to), 'MMM d, yyyy')}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={setPeriod} data-testid="select-period">
              <SelectTrigger className="w-[130px]" data-testid="trigger-period">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day" data-testid="option-today">Today</SelectItem>
                <SelectItem value="week" data-testid="option-week">Last 7 Days</SelectItem>
                <SelectItem value="month" data-testid="option-month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportToCSV}
              className="flex items-center gap-1"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center" data-testid="stat-cold-calls">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.totalColdCalls}</div>
            <div className="text-xs text-muted-foreground">Cold Calls</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center" data-testid="stat-followups">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.totalFollowups}</div>
            <div className="text-xs text-muted-foreground">Follow-ups</div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-center" data-testid="stat-total-calls">
            <div className="text-2xl font-bold">{summary.totalCalls}</div>
            <div className="text-xs text-muted-foreground">Total Calls</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center" data-testid="stat-companies">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.uniqueCompanies}</div>
            <div className="text-xs text-muted-foreground">Companies</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center" data-testid="stat-executives">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.uniqueExecutives}</div>
            <div className="text-xs text-muted-foreground">Executives</div>
          </div>
        </div>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily" className="flex items-center gap-1" data-testid="tab-daily">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Day-wise</span>
            </TabsTrigger>
            <TabsTrigger value="executive" className="flex items-center gap-1" data-testid="tab-executive">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">By Executive</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-1" data-testid="tab-all-calls">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">All Calls</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {dailyBreakdown.map((day) => (
                  <Collapsible 
                    key={day.date} 
                    open={expandedDates.has(day.date)}
                    onOpenChange={() => toggleDateExpanded(day.date)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate" data-testid={`row-daily-detail-${day.date}`}>
                        <div className="flex items-center gap-3">
                          {expandedDates.has(day.date) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{day.dateLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400">
                            {day.coldCallCount} cold
                          </Badge>
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                            {day.followupCount} f/u
                          </Badge>
                          <Badge className="bg-slate-500">
                            {day.totalCount}
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-6 pr-2 py-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Type</TableHead>
                              <TableHead>Company</TableHead>
                              <TableHead className="hidden md:table-cell">Contact</TableHead>
                              <TableHead className="hidden lg:table-cell">Location</TableHead>
                              <TableHead className="hidden md:table-cell">Executive</TableHead>
                              <TableHead className="hidden xl:table-cell">Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {day.calls.map((call) => (
                              <TableRow key={call.id} data-testid={`row-call-${call.id}`}>
                                <TableCell>
                                  {call.type === 'cold_call' ? (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 text-xs">
                                      <Phone className="h-3 w-3 mr-1" />
                                      Cold
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 text-xs">
                                      <PhoneCall className="h-3 w-3 mr-1" />
                                      F/U
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium truncate max-w-[150px]">{call.companyName}</span>
                                    {call.isExistingCustomer && (
                                      <Badge variant="secondary" className="text-xs ml-1">Existing</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{call.stage}</div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <div className="text-sm">{call.contactPerson}</div>
                                  <div className="text-xs text-muted-foreground">{call.contactPhone}</div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {(call.city || call.area) && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      {[call.area, call.city].filter(Boolean).join(', ')}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="text-sm">{call.salesExecutiveName}</span>
                                </TableCell>
                                <TableCell className="hidden xl:table-cell">
                                  {call.notes && (
                                    <div className="flex items-start gap-1 text-xs text-muted-foreground max-w-[200px]">
                                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      <span className="truncate">{call.notes}</span>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                {dailyBreakdown.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No calls found for this period</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="executive" className="mt-4">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executive</TableHead>
                    <TableHead className="text-center">Cold Calls</TableHead>
                    <TableHead className="text-center">Follow-ups</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executiveBreakdown.map((exec) => (
                    <TableRow key={exec.salesExecutiveId} data-testid={`row-exec-${exec.salesExecutiveId}`}>
                      <TableCell>
                        <div className="font-medium">{exec.salesExecutiveName}</div>
                        <div className="text-xs text-muted-foreground">{exec.email}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400">
                          {exec.coldCallCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                          {exec.followupCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-500">{exec.totalCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {executiveBreakdown.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No data found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Executive</TableHead>
                    <TableHead className="hidden xl:table-cell">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.callDetails.slice(0, 100).map((call) => (
                    <TableRow key={call.id} data-testid={`row-all-call-${call.id}`}>
                      <TableCell>
                        <div className="text-sm">{call.date ? format(parseISO(call.date), 'MMM d') : '-'}</div>
                        <div className="text-xs text-muted-foreground">{call.date ? format(parseISO(call.date), 'h:mm a') : ''}</div>
                      </TableCell>
                      <TableCell>
                        {call.type === 'cold_call' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 text-xs">
                            Cold
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 text-xs">
                            F/U
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[150px]">{call.companyName}</div>
                        <div className="text-xs text-muted-foreground">{call.stage}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">{call.contactPerson}</div>
                        <div className="text-xs text-muted-foreground">{call.contactPhone}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{call.salesExecutiveName}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {call.notes && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{call.notes}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.callDetails.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        Showing first 100 of {data.callDetails.length} calls. Export to see all.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.callDetails.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No calls found for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
