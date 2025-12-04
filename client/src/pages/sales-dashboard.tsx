import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  TrendingUp, Users, Calendar, Clock, CheckCircle2, 
  Target, Search, MessageSquare, Send, ArrowLeft, 
  Phone, Mail, Building2, DollarSign, Plus, XCircle,
  PlayCircle, Image, Video, Mic, FileText, LayoutGrid, List,
  CalendarDays, ArrowUpRight, ArrowDownRight, UserCheck, Timer
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, FollowUp, LeadComment, Task, User } from "@shared/schema";

interface LeadWithSalesExec extends Lead {
  salesExecutiveName: string | null;
}

interface FollowUpWithLead extends FollowUp {
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  leadStage: string | null;
}

interface SalesDashboardStats {
  totalSalesCount: number;
  totalSalesValue: number;
  lastMonthSalesValue: number;
  lastWeekSalesValue: number;
  totalLeadsCount: number;
  todayNewCount: number;
  totalFollowupCount: number;
  todayFollowupCount: number;
  todayPendingFollowupCount: number;
  todayCompletedFollowupCount: number;
  totalExpClosingCount: number;
  thisMonthExpClosingCount: number;
  todayWonCount: number;
  todayLossCount: number;
}

interface SalesDashboardData {
  stats: SalesDashboardStats;
  leads: LeadWithSalesExec[];
  followUps: FollowUpWithLead[];
}

interface LeadHistoryData {
  lead: LeadWithSalesExec;
  followUps: FollowUp[];
  demoHistory: any[];
  negotiationHistory: any[];
  quotes: any[];
  comments: (LeadComment & { userName: string; userRole: string | null })[];
  tasks: Task[];
}

type FilterType = 'all' | 'total_sales' | 'today_new' | 'total_followup' | 'today_followup' | 
                  'today_pending' | 'today_completed' | 'exp_closing' | 'today_won' | 'today_loss' |
                  'this_month_exp';

type ViewMode = 'grid' | 'tabs';

const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  new_lead: { color: "bg-blue-500 text-white", label: "New Lead" },
  demo_scheduled: { color: "bg-purple-500 text-white", label: "Demo Scheduled" },
  quote_sent: { color: "bg-orange-500 text-white", label: "Quote Sent" },
  negotiation: { color: "bg-yellow-500 text-white", label: "Negotiation" },
  closed_won: { color: "bg-green-500 text-white", label: "Won" },
  closed_lost: { color: "bg-red-500 text-white", label: "Lost" },
};

const SOURCE_CONFIG: Record<string, { color: string }> = {
  facebook: { color: "bg-blue-600" },
  linkedin: { color: "bg-blue-700" },
  instagram: { color: "bg-pink-500" },
  referral: { color: "bg-green-600" },
  website: { color: "bg-purple-600" },
  direct: { color: "bg-gray-600" },
};

function formatCurrency(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(2)}K`;
  }
  return `₹${value.toLocaleString()}`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  count: number | string;
  subLabel?: string;
  subValue?: string;
  color: string;
  isActive: boolean;
  onClick: () => void;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ icon, label, count, subLabel, subValue, color, isActive, onClick, trend }: StatCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover-elevate ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-2 rounded-lg ${color} text-white flex-shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <div className="flex items-center gap-1">
              <p className="text-lg sm:text-xl font-bold">{count}</p>
              {trend && (
                <span className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}>
                  {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null}
                </span>
              )}
            </div>
            {subLabel && subValue && (
              <p className="text-xs text-muted-foreground">{subLabel}: {subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadWithSalesExec | null>(null);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<'leads' | 'followups'>('leads');

  const { data: dashboardData, isLoading } = useQuery<SalesDashboardData>({
    queryKey: ["/api/dashboard/sales"],
  });

  const { data: leadHistory, isLoading: historyLoading } = useQuery<LeadHistoryData>({
    queryKey: ["/api/leads", selectedLead?.id, "history"],
    enabled: !!selectedLead,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ leadId, comment }: { leadId: string; comment: string }) => {
      const response = await apiRequest("POST", `/api/leads/${leadId}/comments`, { comment });
      return response.json();
    },
    onSuccess: () => {
      if (selectedLead) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLead.id, "history"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sales"] });
      setNewComment("");
      toast({ title: "Comment added successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to add comment", variant: "destructive" });
    },
  });

  const stats = dashboardData?.stats;
  const allLeads = dashboardData?.leads || [];
  const allFollowUps = dashboardData?.followUps || [];

  const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const isDeptHead = departments.some((d: any) => d.managerId === user?.id);
  const canComment = isSuperAdmin || isDeptHead;

  const filterLeads = (leads: LeadWithSalesExec[], filter: FilterType): LeadWithSalesExec[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    switch (filter) {
      case 'total_sales':
        return leads.filter(l => l.stage === 'closed_won');
      case 'today_new':
        return leads.filter(l => 
          l.createdAt && new Date(l.createdAt) >= today && new Date(l.createdAt) < tomorrow
        );
      case 'exp_closing':
        return leads.filter(l => l.stage === 'negotiation');
      case 'this_month_exp':
        return leads.filter(l => {
          if (l.stage !== 'negotiation' || !l.negotiationDate) return false;
          const negDate = new Date(l.negotiationDate);
          return negDate >= thisMonthStart && negDate <= thisMonthEnd;
        });
      case 'today_won':
        return leads.filter(l => 
          l.stage === 'closed_won' && l.closedDate && 
          new Date(l.closedDate) >= today && new Date(l.closedDate) < tomorrow
        );
      case 'today_loss':
        return leads.filter(l => 
          l.stage === 'closed_lost' && l.closedDate && 
          new Date(l.closedDate) >= today && new Date(l.closedDate) < tomorrow
        );
      default:
        return leads;
    }
  };

  const filterFollowUps = (followUps: FollowUpWithLead[], filter: FilterType): FollowUpWithLead[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    switch (filter) {
      case 'total_followup':
        return followUps;
      case 'today_followup':
        return followUps.filter(f => {
          const fDate = new Date(f.followUpDate);
          return fDate >= today && fDate < tomorrow;
        });
      case 'today_pending':
        return followUps.filter(f => {
          const fDate = new Date(f.followUpDate);
          return fDate >= today && fDate < tomorrow && !f.completed;
        });
      case 'today_completed':
        return followUps.filter(f => {
          const fDate = new Date(f.followUpDate);
          return fDate >= today && fDate < tomorrow && f.completed;
        });
      default:
        return [];
    }
  };

  const isFollowUpFilter = ['total_followup', 'today_followup', 'today_pending', 'today_completed'].includes(activeFilter);
  const filteredLeads = isFollowUpFilter ? [] : filterLeads(allLeads, activeFilter).filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.companyName?.toLowerCase().includes(search) ||
      lead.contactPerson?.toLowerCase().includes(search) ||
      lead.contactEmail?.toLowerCase().includes(search) ||
      lead.salesExecutiveName?.toLowerCase().includes(search)
    );
  });

  const filteredFollowUps = isFollowUpFilter ? filterFollowUps(allFollowUps, activeFilter).filter(f => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      f.leadCompanyName?.toLowerCase().includes(search) ||
      f.leadContactPerson?.toLowerCase().includes(search) ||
      f.notes?.toLowerCase().includes(search)
    );
  }) : [];

  const getFilterLabel = (filter: FilterType): string => {
    const labels: Record<FilterType, string> = {
      all: 'All Leads',
      total_sales: 'Closed Won Deals',
      today_new: "Today's New Leads",
      total_followup: 'All Follow-ups',
      today_followup: "Today's Follow-ups",
      today_pending: 'Today Pending Follow-ups',
      today_completed: 'Today Completed Follow-ups',
      exp_closing: 'Expected Closing',
      this_month_exp: 'This Month Expected',
      today_won: "Today's Won",
      today_loss: "Today's Lost",
    };
    return labels[filter];
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedLead) return;
    addCommentMutation.mutate({ leadId: selectedLead.id, comment: newComment.trim() });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(12).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor sales pipeline and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={viewMode === 'grid' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('grid')}
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button 
            variant={viewMode === 'tabs' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('tabs')}
            data-testid="button-view-tabs"
          >
            <List className="h-4 w-4 mr-1" />
            Tabs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Sales"
          count={stats?.totalSalesCount || 0}
          subLabel="Value"
          subValue={formatCurrency(stats?.totalSalesValue || 0)}
          color="bg-green-500"
          isActive={activeFilter === 'total_sales'}
          onClick={() => { setActiveFilter('total_sales'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<ArrowDownRight className="h-5 w-5" />}
          label="Last Month"
          count={formatCurrency(stats?.lastMonthSalesValue || 0)}
          color="bg-blue-500"
          isActive={false}
          onClick={() => {}}
        />
        <StatCard
          icon={<ArrowUpRight className="h-5 w-5" />}
          label="Last Week"
          count={formatCurrency(stats?.lastWeekSalesValue || 0)}
          color="bg-indigo-500"
          isActive={false}
          onClick={() => {}}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Leads"
          count={stats?.totalLeadsCount || 0}
          color="bg-slate-500"
          isActive={activeFilter === 'all'}
          onClick={() => { setActiveFilter('all'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<Plus className="h-5 w-5" />}
          label="Today's New"
          count={stats?.todayNewCount || 0}
          color="bg-cyan-500"
          isActive={activeFilter === 'today_new'}
          onClick={() => { setActiveFilter('today_new'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Total Follow-ups"
          count={stats?.totalFollowupCount || 0}
          color="bg-purple-500"
          isActive={activeFilter === 'total_followup'}
          onClick={() => { setActiveFilter('total_followup'); setActiveTab('followups'); }}
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Today Follow-ups"
          count={stats?.todayFollowupCount || 0}
          color="bg-orange-500"
          isActive={activeFilter === 'today_followup'}
          onClick={() => { setActiveFilter('today_followup'); setActiveTab('followups'); }}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Today Pending"
          count={stats?.todayPendingFollowupCount || 0}
          color="bg-yellow-500"
          isActive={activeFilter === 'today_pending'}
          onClick={() => { setActiveFilter('today_pending'); setActiveTab('followups'); }}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Today Completed"
          count={stats?.todayCompletedFollowupCount || 0}
          color="bg-emerald-500"
          isActive={activeFilter === 'today_completed'}
          onClick={() => { setActiveFilter('today_completed'); setActiveTab('followups'); }}
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="Exp. Closing"
          count={stats?.totalExpClosingCount || 0}
          color="bg-amber-500"
          isActive={activeFilter === 'exp_closing'}
          onClick={() => { setActiveFilter('exp_closing'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Today's Won"
          count={stats?.todayWonCount || 0}
          color="bg-green-600"
          isActive={activeFilter === 'today_won'}
          onClick={() => { setActiveFilter('today_won'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="Today's Lost"
          count={stats?.todayLossCount || 0}
          color="bg-red-500"
          isActive={activeFilter === 'today_loss'}
          onClick={() => { setActiveFilter('today_loss'); setActiveTab('leads'); }}
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="This Month Exp"
          count={stats?.thisMonthExpClosingCount || 0}
          color="bg-rose-500"
          isActive={activeFilter === 'this_month_exp'}
          onClick={() => { setActiveFilter('this_month_exp'); setActiveTab('leads'); }}
        />
      </div>

      {/* Content Area */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">{getFilterLabel(activeFilter)}</CardTitle>
              <CardDescription>
                {isFollowUpFilter 
                  ? `${filteredFollowUps.length} follow-up${filteredFollowUps.length !== 1 ? 's' : ''} found`
                  : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''} found`
                }
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isFollowUpFilter ? "Search follow-ups..." : "Search leads..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {viewMode === 'tabs' ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'leads' | 'followups')}>
              <TabsList className="mb-4">
                <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
                <TabsTrigger value="followups" data-testid="tab-followups">Follow-ups</TabsTrigger>
              </TabsList>
              <TabsContent value="leads">
                <LeadsTable 
                  leads={isFollowUpFilter ? allLeads : filteredLeads} 
                  onSelectLead={setSelectedLead} 
                />
              </TabsContent>
              <TabsContent value="followups">
                <FollowUpsTable 
                  followUps={isFollowUpFilter ? filteredFollowUps : allFollowUps}
                  allLeads={allLeads}
                  onSelectLead={(leadId) => {
                    const lead = allLeads.find(l => l.id === leadId);
                    if (lead) setSelectedLead(lead);
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            isFollowUpFilter ? (
              <FollowUpsTable 
                followUps={filteredFollowUps}
                allLeads={allLeads}
                onSelectLead={(leadId) => {
                  const lead = allLeads.find(l => l.id === leadId);
                  if (lead) setSelectedLead(lead);
                }}
              />
            ) : (
              <LeadsTable leads={filteredLeads} onSelectLead={setSelectedLead} />
            )
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setSelectedLead(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Lead Details - {selectedLead?.companyName}
            </DialogTitle>
            <DialogDescription>
              Complete history and information about this lead
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            {historyLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
              </div>
            ) : leadHistory ? (
              <div className="space-y-6">
                {/* Lead Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Lead Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{leadHistory.lead.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{leadHistory.lead.contactPerson}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{leadHistory.lead.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{leadHistory.lead.contactPhone || 'N/A'}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Badge className={STAGE_CONFIG[leadHistory.lead.stage]?.color || "bg-gray-500"}>
                        {STAGE_CONFIG[leadHistory.lead.stage]?.label || leadHistory.lead.stage}
                      </Badge>
                      <Badge variant="outline">
                        Source: {leadHistory.lead.leadSource}
                      </Badge>
                      {leadHistory.lead.estimatedValue && (
                        <Badge variant="secondary">
                          Est. Value: {formatCurrency(leadHistory.lead.estimatedValue)}
                        </Badge>
                      )}
                      {leadHistory.lead.salesExecutiveName && (
                        <Badge variant="outline">
                          Assigned: {leadHistory.lead.salesExecutiveName}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Follow-ups with Timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Follow-up History ({leadHistory.followUps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {leadHistory.followUps.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No follow-ups recorded</p>
                    ) : (
                      <div className="space-y-3">
                        {leadHistory.followUps.map((fu) => (
                          <div key={fu.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className={`w-2 h-2 mt-2 rounded-full ${fu.completed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {format(new Date(fu.followUpDate), 'PPP p')}
                                </span>
                                <Badge variant={fu.completed ? "default" : "secondary"}>
                                  {fu.completed ? 'Completed' : 'Pending'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{fu.notes}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tasks with Media */}
                {leadHistory.tasks.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Related Tasks ({leadHistory.tasks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {leadHistory.tasks.map((task: any) => (
                          <div key={task.id} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{task.title}</span>
                              <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                                {task.status}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                            )}
                            
                            {/* Media Attachments */}
                            <div className="flex flex-wrap gap-2">
                              {task.voiceNoteUrl && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={task.voiceNoteUrl} target="_blank" rel="noopener noreferrer">
                                    <Mic className="h-4 w-4 mr-1" />
                                    Voice ({task.voiceNoteDuration}s)
                                  </a>
                                </Button>
                              )}
                              {task.attachments?.map((att: any, idx: number) => (
                                <Button key={idx} variant="outline" size="sm" asChild>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.type === 'video' && <Video className="h-4 w-4 mr-1" />}
                                    {att.type === 'photo' && <Image className="h-4 w-4 mr-1" />}
                                    {att.type === 'file' && <FileText className="h-4 w-4 mr-1" />}
                                    {att.name}
                                  </a>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quotes */}
                {leadHistory.quotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Quotes ({leadHistory.quotes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {leadHistory.quotes.map((quote: any) => (
                          <div key={quote.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <span className="font-medium">{formatCurrency(quote.amount)}</span>
                              <p className="text-sm text-muted-foreground">{quote.description}</p>
                            </div>
                            <Badge variant={quote.status === 'accepted' ? 'default' : quote.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {quote.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Comments Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comments ({leadHistory.comments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {leadHistory.comments.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No comments yet</p>
                    ) : (
                      <div className="space-y-3">
                        {leadHistory.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {comment.userName?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-muted/50 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{comment.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {comment.createdAt && format(new Date(comment.createdAt), 'PPp')}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{comment.comment}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment */}
                    {canComment && (
                      <div className="pt-4 border-t">
                        <Label className="text-sm font-medium mb-2 block">Add Comment</Label>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Write your comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="min-h-[80px]"
                            data-testid="textarea-comment"
                          />
                        </div>
                        <Button 
                          className="mt-2" 
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || addCommentMutation.isPending}
                          data-testid="button-add-comment"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Leads Table Component
function LeadsTable({ leads, onSelectLead }: { leads: LeadWithSalesExec[]; onSelectLead: (lead: LeadWithSalesExec) => void }) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No leads found for this filter</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="hidden md:table-cell">Source</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden sm:table-cell">Est. Value</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow 
              key={lead.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectLead(lead)}
              data-testid={`row-lead-${lead.id}`}
            >
              <TableCell className="font-medium">{lead.companyName}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{lead.contactPerson}</div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {lead.contactEmail}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className={SOURCE_CONFIG[lead.leadSource]?.color}>
                  {lead.leadSource}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={STAGE_CONFIG[lead.stage]?.color || "bg-gray-500"}>
                  {STAGE_CONFIG[lead.stage]?.label || lead.stage}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : '-'}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {lead.salesExecutiveName || '-'}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {lead.createdAt && format(new Date(lead.createdAt), 'PP')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Follow-ups Table Component
function FollowUpsTable({ 
  followUps, 
  allLeads,
  onSelectLead 
}: { 
  followUps: FollowUpWithLead[]; 
  allLeads: LeadWithSalesExec[];
  onSelectLead: (leadId: string) => void;
}) {
  if (followUps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No follow-ups found for this filter</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Stage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {followUps.map((fu) => (
            <TableRow 
              key={fu.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectLead(fu.leadId)}
              data-testid={`row-followup-${fu.id}`}
            >
              <TableCell className="font-medium text-sm">
                {format(new Date(fu.followUpDate), 'PPP')}
                <div className="text-xs text-muted-foreground">
                  {format(new Date(fu.followUpDate), 'p')}
                </div>
              </TableCell>
              <TableCell>{fu.leadCompanyName || '-'}</TableCell>
              <TableCell className="hidden md:table-cell">{fu.leadContactPerson || '-'}</TableCell>
              <TableCell className="hidden lg:table-cell max-w-xs truncate">{fu.notes}</TableCell>
              <TableCell>
                <Badge variant={fu.completed ? "default" : "secondary"}>
                  {fu.completed ? 'Completed' : 'Pending'}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {fu.leadStage && (
                  <Badge className={STAGE_CONFIG[fu.leadStage]?.color || "bg-gray-500"}>
                    {STAGE_CONFIG[fu.leadStage]?.label || fu.leadStage}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
