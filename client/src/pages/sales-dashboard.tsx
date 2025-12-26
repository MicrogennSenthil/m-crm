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
  CalendarDays, Handshake, UserPlus, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead, FollowUp, LeadComment, Task, User } from "@shared/schema";

interface LeadWithSalesExec extends Lead {
  salesExecutiveName: string | null;
  hasOverdueFollowup?: boolean;
  overdueFollowupCount?: number;
  oldestOverdueDays?: number;
}

interface FollowUpWithLead extends FollowUp {
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  leadStage: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
}

interface PeriodStats {
  qty: number;
  amount: number;
}

interface FollowupPeriodStats {
  qty: number;
  pending: number;
  completed: number;
  overdue?: number;
}

interface GroupedStats {
  newLead: {
    today: PeriodStats;
    month: PeriodStats;
    year: PeriodStats;
  };
  followup: {
    today: FollowupPeriodStats;
    month: FollowupPeriodStats;
    year: FollowupPeriodStats;
  };
  deal: {
    today: PeriodStats;
    month: PeriodStats;
    year: PeriodStats;
  };
  negotiation: {
    today: PeriodStats;
    month: PeriodStats;
    year: PeriodStats;
  };
}

interface SalesDashboardStats {
  totalSalesCount: number;
  totalSalesValue: number;
  totalLeadsCount: number;
  totalFollowupCount: number;
  totalExpClosingCount: number;
  todayLossCount: number;
}

interface SalesDashboardData {
  stats: SalesDashboardStats;
  grouped: GroupedStats;
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

type CategoryType = 'newLead' | 'followup' | 'deal' | 'negotiation';
type PeriodType = 'today' | 'month' | 'year';
type ViewMode = 'grid' | 'tabs';

const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  seed: { color: "bg-blue-500 text-white", label: "Seed" },
  lead: { color: "bg-cyan-500 text-white", label: "Lead" },
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

const CATEGORY_CONFIG: Record<CategoryType, { 
  label: string; 
  icon: any; 
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  newLead: { 
    label: "New Leads", 
    icon: UserPlus, 
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800"
  },
  followup: { 
    label: "Follow-ups", 
    icon: Calendar, 
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800"
  },
  deal: { 
    label: "Deals Won", 
    icon: DollarSign, 
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800"
  },
  negotiation: { 
    label: "Negotiation", 
    icon: Handshake, 
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
};

const PERIOD_LABELS: Record<PeriodType, string> = {
  today: "Today",
  month: "Month",
  year: "Year",
};

interface GroupedStatCardProps {
  category: CategoryType;
  stats: GroupedStats[CategoryType];
  isActive: boolean;
  onClick: () => void;
}

function GroupedStatCard({ 
  category, 
  stats, 
  isActive,
  onClick 
}: GroupedStatCardProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  const isFollowup = category === 'followup';
  
  const periods: PeriodType[] = ['today', 'month', 'year'];
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover-elevate ${
        isActive ? 'ring-2 ring-primary ring-offset-2' : ''
      } ${config.bgColor} ${config.borderColor} border`}
      onClick={onClick}
      data-testid={`card-${category}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${config.color} bg-white/80 dark:bg-gray-900/50`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={`text-sm font-semibold ${config.color}`}>
            {config.label}
          </h3>
        </div>
        
        {/* Table header */}
        <div className="grid grid-cols-3 gap-2 mb-2 px-1">
          <div className="text-xs font-medium text-muted-foreground"></div>
          <div className="text-xs font-medium text-center text-muted-foreground">Qty</div>
          <div className="text-xs font-medium text-center text-muted-foreground">
            {isFollowup ? 'Status' : 'Amount'}
          </div>
        </div>
        
        {/* Period rows */}
        <div className="space-y-1">
          {periods.map((period) => {
            const periodStats = stats[period];
            return (
              <div 
                key={period}
                className="grid grid-cols-3 gap-2 py-1.5 px-2 rounded-md bg-white/50 dark:bg-gray-900/30"
                data-testid={`row-${category}-${period}`}
              >
                <div className="flex items-center">
                  <span className="text-xs font-medium">{PERIOD_LABELS[period]}</span>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-base font-bold">{periodStats.qty}</span>
                </div>
                <div className="flex items-center justify-center">
                  {isFollowup ? (
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] px-1 h-5 text-yellow-600 border-yellow-300">
                        {(periodStats as FollowupPeriodStats).pending}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1 h-5 text-green-600 border-green-300">
                        {(periodStats as FollowupPeriodStats).completed}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {formatCurrency((periodStats as PeriodStats).amount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadsTable({ leads, onSelectLead }: { leads: LeadWithSalesExec[]; onSelectLead: (lead: LeadWithSalesExec) => void }) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No leads found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden sm:table-cell">Value</TableHead>
            <TableHead className="hidden lg:table-cell">Sales Exec</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const stageConfig = STAGE_CONFIG[lead.stage || 'seed'];
            return (
              <TableRow 
                key={lead.id} 
                className={`cursor-pointer hover:bg-muted/50 ${lead.hasOverdueFollowup ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                onClick={() => onSelectLead(lead)}
                data-testid={`row-lead-${lead.id}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {lead.hasOverdueFollowup ? (
                      <AlertTriangle className="h-4 w-4 text-red-500 hidden sm:block" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    )}
                    <div>
                      <div className="font-medium">{lead.companyName}</div>
                      <div className="text-xs text-muted-foreground md:hidden">
                        {lead.contactPerson}
                      </div>
                      {lead.hasOverdueFollowup && (
                        <div className="text-xs text-red-500 font-medium">
                          {lead.overdueFollowupCount} overdue followup{(lead.overdueFollowupCount || 0) > 1 ? 's' : ''}
                          {lead.oldestOverdueDays && lead.oldestOverdueDays > 0 && (
                            <span> ({lead.oldestOverdueDays} day{lead.oldestOverdueDays > 1 ? 's' : ''})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div>
                    <div>{lead.contactPerson}</div>
                    <div className="text-xs text-muted-foreground">{lead.contactEmail}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge className={stageConfig.color} data-testid={`badge-stage-${lead.id}`}>
                      {stageConfig.label}
                    </Badge>
                    {lead.hasOverdueFollowup && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        Attention
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatCurrency(lead.confirmedOrderValue || lead.estimatedValue || 0)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {lead.salesExecutiveName || '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

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
      <div className="text-center py-8 text-muted-foreground">
        No follow-ups found
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
            <TableHead className="hidden md:table-cell">Notes</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {followUps.map((followUp) => (
            <TableRow 
              key={followUp.id}
              className={`cursor-pointer hover:bg-muted/50 ${followUp.isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
              onClick={() => onSelectLead(followUp.leadId)}
              data-testid={`row-followup-${followUp.id}`}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {followUp.isOverdue ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className={followUp.isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                      {format(new Date(followUp.followUpDate), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(followUp.followUpDate), 'HH:mm')}
                    </div>
                    {followUp.isOverdue && followUp.daysOverdue && (
                      <div className="text-xs text-red-500 font-medium">
                        {followUp.daysOverdue} day{followUp.daysOverdue > 1 ? 's' : ''} overdue
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{followUp.leadCompanyName}</div>
                  <div className="text-xs text-muted-foreground">{followUp.leadContactPerson}</div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                {followUp.notes || '-'}
              </TableCell>
              <TableCell>
                {followUp.completed ? (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Done
                  </Badge>
                ) : followUp.isOverdue ? (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
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

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

const ALLOWED_ROLES = ["saleshead", "sales_head", "admin"];

function hasAccess(user: any): boolean {
  if (!user) return false;
  if (user.email === SUPER_ADMIN_EMAIL) return true;
  if (user.role === "admin") return true;
  const userRole = user.role?.toLowerCase() || "";
  return ALLOWED_ROLES.includes(userRole) || 
         userRole.includes("sales") && userRole.includes("head");
}

export default function SalesDashboard() {
  const { user, isLoading: userLoading } = useAuth();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<CategoryType | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadWithSalesExec | null>(null);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<'leads' | 'followups'>('leads');

  // All hooks must be called before any conditional returns (React rules of hooks)
  const { data: dashboardData, isLoading, error } = useQuery<SalesDashboardData>({
    queryKey: ["/api/dashboard/sales"],
    enabled: !userLoading && hasAccess(user),
  });

  const { data: leadHistory, isLoading: historyLoading } = useQuery<LeadHistoryData>({
    queryKey: ["/api/leads", selectedLead?.id, "history"],
    enabled: !!selectedLead && !userLoading && hasAccess(user),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
    enabled: !userLoading && hasAccess(user),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/departments"],
    enabled: !userLoading && hasAccess(user),
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

  // Show loading state while user is being loaded
  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Access check after all hooks are called and user is loaded
  if (!hasAccess(user)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <XCircle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access the Sales Dashboard. 
          This page is only available to Sales Heads, Admins, and Super Admins.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h2 className="text-xl font-semibold">Error Loading Dashboard</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {(error as any)?.message || "Failed to load sales dashboard data. Please try again."}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const stats = dashboardData?.stats;
  const grouped = dashboardData?.grouped;
  const allLeads = dashboardData?.leads || [];
  const allFollowUps = dashboardData?.followUps || [];

  const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const isDeptHead = departments.some((d: any) => d.managerId === user?.id);
  const canComment = isSuperAdmin || isDeptHead;

  const filterLeadsByCategory = (): LeadWithSalesExec[] => {
    if (!activeCategory) return allLeads;
    
    switch (activeCategory) {
      case 'newLead':
        // Show all leads (new leads are all leads in the system)
        return allLeads;
      case 'deal':
        return allLeads.filter(l => l.stage === 'closed_won');
      case 'negotiation':
        return allLeads.filter(l => l.stage === 'negotiation');
      default:
        return allLeads;
    }
  };

  const filterFollowUpsByCategory = (): FollowUpWithLead[] => {
    if (activeCategory !== 'followup') return allFollowUps;
    return allFollowUps;
  };

  const isFollowUpView = activeCategory === 'followup';
  const filteredLeads = isFollowUpView ? [] : filterLeadsByCategory().filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.companyName?.toLowerCase().includes(search) ||
      lead.contactPerson?.toLowerCase().includes(search) ||
      lead.contactEmail?.toLowerCase().includes(search) ||
      lead.salesExecutiveName?.toLowerCase().includes(search)
    );
  });

  const filteredFollowUps = isFollowUpView ? filterFollowUpsByCategory().filter(f => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      f.leadCompanyName?.toLowerCase().includes(search) ||
      f.leadContactPerson?.toLowerCase().includes(search) ||
      f.notes?.toLowerCase().includes(search)
    );
  }) : [];

  const getFilterLabel = (): string => {
    if (!activeCategory) return 'All Leads';
    const config = CATEGORY_CONFIG[activeCategory];
    return config.label;
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedLead) return;
    addCommentMutation.mutate({ leadId: selectedLead.id, comment: newComment.trim() });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
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

      {/* Grouped Stats Cards */}
      {grouped && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GroupedStatCard
            category="newLead"
            stats={grouped.newLead}
            isActive={activeCategory === 'newLead'}
            onClick={() => setActiveCategory(activeCategory === 'newLead' ? null : 'newLead')}
          />
          <GroupedStatCard
            category="followup"
            stats={grouped.followup}
            isActive={activeCategory === 'followup'}
            onClick={() => setActiveCategory(activeCategory === 'followup' ? null : 'followup')}
          />
          <GroupedStatCard
            category="deal"
            stats={grouped.deal}
            isActive={activeCategory === 'deal'}
            onClick={() => setActiveCategory(activeCategory === 'deal' ? null : 'deal')}
          />
          <GroupedStatCard
            category="negotiation"
            stats={grouped.negotiation}
            isActive={activeCategory === 'negotiation'}
            onClick={() => setActiveCategory(activeCategory === 'negotiation' ? null : 'negotiation')}
          />
        </div>
      )}

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-slate-50 dark:bg-slate-900/30">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{stats?.totalLeadsCount || 0}</div>
            <div className="text-xs text-muted-foreground">Total Leads</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/30">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{stats?.totalSalesCount || 0}</div>
            <div className="text-xs text-muted-foreground">Total Deals</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/30">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{stats?.totalFollowupCount || 0}</div>
            <div className="text-xs text-muted-foreground">Total Follow-ups</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-900/30">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalSalesValue || 0)}</div>
            <div className="text-xs text-muted-foreground">Total Value</div>
          </CardContent>
        </Card>
      </div>

      {/* Content Area */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">{getFilterLabel()}</CardTitle>
              <CardDescription>
                {isFollowUpView 
                  ? `${filteredFollowUps.length} follow-up${filteredFollowUps.length !== 1 ? 's' : ''} found`
                  : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''} found`
                }
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isFollowUpView ? "Search follow-ups..." : "Search leads..."}
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
                  leads={isFollowUpView ? allLeads : filteredLeads} 
                  onSelectLead={setSelectedLead} 
                />
              </TabsContent>
              <TabsContent value="followups">
                <FollowUpsTable 
                  followUps={isFollowUpView ? filteredFollowUps : allFollowUps}
                  allLeads={allLeads}
                  onSelectLead={(leadId) => {
                    const lead = allLeads.find(l => l.id === leadId);
                    if (lead) setSelectedLead(lead);
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            isFollowUpView ? (
              <FollowUpsTable 
                followUps={filteredFollowUps}
                allLeads={allLeads}
                onSelectLead={(leadId) => {
                  const lead = allLeads.find(l => l.id === leadId);
                  if (lead) setSelectedLead(lead);
                }}
              />
            ) : (
              <LeadsTable 
                leads={filteredLeads} 
                onSelectLead={setSelectedLead} 
              />
            )
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedLead?.companyName}
            </DialogTitle>
            <DialogDescription>
              Lead details and history
            </DialogDescription>
          </DialogHeader>
          
          {historyLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
            </div>
          ) : leadHistory ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Lead Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    <p className="font-medium">{leadHistory.lead.contactPerson}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Stage</Label>
                    <div>
                      <Badge className={STAGE_CONFIG[leadHistory.lead.stage || 'seed'].color}>
                        {STAGE_CONFIG[leadHistory.lead.stage || 'seed'].label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {leadHistory.lead.contactEmail || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {leadHistory.lead.contactPhone || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Estimated Value</Label>
                    <p className="font-medium">{formatCurrency(leadHistory.lead.estimatedValue || 0)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sales Executive</Label>
                    <p className="text-sm">{leadHistory.lead.salesExecutiveName || '-'}</p>
                  </div>
                </div>

                <Separator />

                {/* Follow-ups */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Follow-ups ({leadHistory.followUps.length})
                  </h4>
                  {leadHistory.followUps.length > 0 ? (
                    <div className="space-y-2">
                      {leadHistory.followUps.map((fu) => (
                        <div key={fu.id} className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                          <div className={`p-1 rounded ${fu.completed ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                            {fu.completed ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">
                                {format(new Date(fu.followUpDate), 'MMM dd, yyyy HH:mm')}
                              </span>
                            </div>
                            {fu.notes && <p className="text-sm text-muted-foreground mt-1">{fu.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No follow-ups recorded</p>
                  )}
                </div>

                {/* Tasks */}
                {leadHistory.tasks.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Related Tasks ({leadHistory.tasks.length})
                      </h4>
                      <div className="space-y-2">
                        {leadHistory.tasks.map((task) => (
                          <div key={task.id} className="p-2 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{task.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {task.status}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                            )}
                            {/* Media attachments */}
                            <div className="flex gap-2 mt-2">
                              {task.voiceNoteUrl && (
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <Mic className="h-3 w-3 mr-1" />
                                  Voice
                                </Button>
                              )}
                              {task.attachments && (task.attachments as any[]).filter((a: any) => a.type === 'video').length > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <Video className="h-3 w-3 mr-1" />
                                  Video
                                </Button>
                              )}
                              {task.attachments && (task.attachments as any[]).filter((a: any) => a.type === 'photo').length > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <Image className="h-3 w-3 mr-1" />
                                  Photo
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Comments */}
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({leadHistory.comments.length})
                  </h4>
                  
                  {leadHistory.comments.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {leadHistory.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {comment.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{comment.userName}</span>
                              {comment.userRole && (
                                <Badge variant="outline" className="text-xs">{comment.userRole}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {comment.createdAt ? format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm') : '-'}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{comment.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {canComment && (
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[60px]"
                        data-testid="textarea-comment"
                      />
                      <Button 
                        size="icon"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                        data-testid="button-add-comment"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
