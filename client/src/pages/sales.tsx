import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, Upload, Clock, Phone, AlertTriangle, Calendar, RefreshCw, LayoutGrid, List, Columns, FileSpreadsheet, Shield, MapPin, Camera, X, Volume2, User, Target, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { useFollowupVoiceAlerts } from "@/hooks/use-speech";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm } from "@/components/lead-form";
import { LeadDetailModal } from "@/components/lead-detail-modal";
import { ErrorBoundary } from "@/components/error-boundary";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { GoogleSheetsImportDialog } from "@/components/google-sheets-import-dialog";
import { WebhookAuthSettingsDialog } from "@/components/webhook-auth-settings";
import { RescheduleDemoDialog } from "@/components/reschedule-demo-dialog";
import type { Lead, FollowUp, User as UserType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination";

interface FollowUpWithLead extends FollowUp {
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
}

// Type for the processed followup data from the dashboard API
interface ProcessedFollowUp {
  id: string;
  leadId: string;
  notes: string | null;
  followUpDate: string;
  completed: boolean;
  leadCompanyName: string | null;
  leadContactPerson: string | null;
  leadStage: string | null;
  salesExecutiveId: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}

// Type for department head check response
interface DepartmentHeadInfo {
  isDeptHead: boolean;
  departments: Array<{ id: string; name: string }>;
}

const STAGES = [
  { id: "seed", title: "Seeds", color: "bg-blue-600" },
  { id: "lead", title: "Leads", color: "bg-cyan-600" },
  { id: "demo_scheduled", title: "Demo Scheduled", color: "bg-purple-600" },
  { id: "quote_sent", title: "Quote Sent", color: "bg-yellow-600" },
  { id: "negotiation", title: "Negotiation", color: "bg-orange-600" },
  { id: "closed_won", title: "Closed Won", color: "bg-green-600" },
];

type LayoutType = "kanban" | "list" | "compact";

type KanbanStageData = { leads: Lead[]; total: number };
type KanbanData = { stages: Record<string, KanbanStageData> };

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [googleSheetsImportOpen, setGoogleSheetsImportOpen] = useState(false);
  const [webhookSettingsOpen, setWebhookSettingsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>(() => {
    const saved = localStorage.getItem("sales-layout");
    return (saved as LayoutType) || "kanban";
  });
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedLeadSource, setSelectedLeadSource] = useState<string>("all");
  const [stageExtraLeads, setStageExtraLeads] = useState<Record<string, Lead[]>>({});
  const [stageLoadingMore, setStageLoadingMore] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Debounce search to avoid firing a query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset extra leads whenever filters change
  useEffect(() => {
    setStageExtraLeads({});
  }, [debouncedSearch, selectedCity, selectedArea, selectedUser, selectedLeadSource]);

  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayout(newLayout);
    localStorage.setItem("sales-layout", newLayout);
  };

  // Pagination state for list/compact view
  const { currentPage, pageSize, setCurrentPage, handlePageChange, handlePageSizeChange, getTotalPages } = usePagination(50);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCity, selectedArea, selectedUser, selectedLeadSource, selectedStage]);

  // Kanban filters — sent server-side so only relevant leads are returned
  const kanbanFilters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
    ...(selectedArea !== "all" ? { area: selectedArea } : {}),
    ...(selectedUser !== "all" ? { salesExecutiveId: selectedUser } : {}),
    ...(selectedLeadSource !== "all" ? { leadSource: selectedLeadSource } : {}),
  };

  // List/compact filters — all filters pushed to server
  const listFilters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(selectedCity !== "all" ? { city: selectedCity } : {}),
    ...(selectedArea !== "all" ? { area: selectedArea } : {}),
    ...(selectedUser !== "all" ? { salesExecutiveId: selectedUser } : {}),
    ...(selectedLeadSource !== "all" ? { leadSource: selectedLeadSource } : {}),
    ...(selectedStage ? { stage: selectedStage } : {}),
    page: currentPage,
    pageSize,
  };

  // Kanban view: paginated server-side (50 per stage max + real totals)
  const { data: kanbanData, isLoading: kanbanLoading } = useQuery<KanbanData>({
    queryKey: ["/api/leads/kanban", kanbanFilters],
    enabled: layout === "kanban",
  });

  // List/compact view: server-side paginated with all filters
  const { data: leadsData, isLoading: leadsLoading } = useQuery<{ leads: Lead[]; total: number }>({
    queryKey: ["/api/leads", listFilters],
    enabled: layout !== "kanban",
  });
  const leads = leadsData?.leads || [];
  const leadsTotal = leadsData?.total || 0;

  const isLoading = layout === "kanban" ? kanbanLoading : leadsLoading;

  // Flat list of leads for lookups (works in all layouts)
  const allLeadsForLookup = useMemo(() => {
    if (layout === "kanban" && kanbanData) {
      const kanbanLeads = Object.values(kanbanData.stages).flatMap(s => s.leads);
      const extraLeads = Object.values(stageExtraLeads).flat();
      const seen = new Set<string>();
      return [...kanbanLeads, ...extraLeads].filter(l => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
    }
    return leads;
  }, [layout, kanbanData, leads, stageExtraLeads]);

  // Opens a lead detail modal — looks up in current data first, falls back to API fetch
  const openLeadModal = useCallback(async (leadId: string) => {
    const found = allLeadsForLookup.find(l => l.id === leadId);
    if (found) {
      setSelectedLead(found);
      return;
    }
    try {
      const res = await fetch(`/api/leads/${leadId}`, { credentials: "include" });
      if (res.ok) {
        const lead = await res.json();
        setSelectedLead(lead);
      }
    } catch {
      // silently ignore — lead could not be loaded
    }
  }, [allLeadsForLookup]);

  // Fetch users for filter dropdown
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Check if current user is a department head (sales head)
  const { data: deptHeadInfo } = useQuery<DepartmentHeadInfo>({
    queryKey: ["/api/auth/is-department-head"],
  });
  const isDepartmentHead = deptHeadInfo?.isDeptHead || false;

  // Current user
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  // Check planning status for current month
  const { data: planningStatus } = useQuery<{
    hasPlanned: boolean;
    message: string;
  }>({
    queryKey: ["/api/sales-planning/status"],
    enabled: currentUser?.role === "sales_executive" || currentUser?.role === "sales_head",
  });

  // Fetch 25th-to-25th cycle progress for motivational dashboard
  const { data: cycleProgress } = useQuery<{
    cycleStart: string;
    cycleEnd: string;
    totalAdvance: number;
    totalOrderValue: number;
    dealsWon: number;
    targetValue: number;
    progressPercent: number;
    daysRemaining: number;
    daysElapsed: number;
    totalDaysInCycle: number;
    dailyRate: number;
    predictedTotal: number;
    predictedPercent: number;
    status: "on_track" | "ahead" | "behind" | "no_target";
    motivationalMessage: string;
    cycleMonth: string;
  }>({
    queryKey: ["/api/sales-performance/cycle-progress"],
    enabled: currentUser?.role === "sales_executive" || currentUser?.role === "sales_head",
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const showPlanningWarning = 
    (currentUser?.role === "sales_executive" || currentUser?.role === "sales_head") && 
    planningStatus && 
    !planningStatus.hasPlanned;

  // Helper function to get sales executive name from user ID
  const getSalesExecutiveName = useCallback((salesExecutiveId: string | null | undefined): string | null => {
    if (!salesExecutiveId || !users.length) return null;
    const user = users.find(u => u.id === salesExecutiveId);
    if (!user) return null;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || null;
  }, [users]);

  // Helper function to get sales executive initials and color
  const getSalesExecutiveInfo = useCallback((salesExecutiveId: string | null | undefined): { name: string; initials: string; color: string } | null => {
    if (!salesExecutiveId || !users.length) return null;
    const user = users.find(u => u.id === salesExecutiveId);
    if (!user) return null;
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const name = fullName || user.email || 'Unknown';
    
    // Generate initials with fallback
    let initials = '';
    if (fullName) {
      initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    } else if (user.email) {
      initials = user.email.substring(0, 2).toUpperCase();
    } else {
      initials = '??';
    }
    
    // Generate consistent color based on user ID - using theme-aware classes
    const colors = [
      'bg-blue-600 dark:bg-blue-500 text-white',
      'bg-green-600 dark:bg-green-500 text-white',
      'bg-purple-600 dark:bg-purple-500 text-white',
      'bg-orange-600 dark:bg-orange-500 text-white',
      'bg-pink-600 dark:bg-pink-500 text-white',
      'bg-teal-600 dark:bg-teal-500 text-white',
      'bg-indigo-600 dark:bg-indigo-500 text-white',
      'bg-cyan-600 dark:bg-cyan-500 text-white',
    ];
    const colorIndex = salesExecutiveId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    return { name, initials, color: colors[colorIndex] };
  }, [users]);

  // Fetch today's followups (pending followups with date <= today)
  const { data: todayFollowups = [], isLoading: followupsLoading } = useQuery<ProcessedFollowUp[]>({
    queryKey: ["/api/sales-dashboard/stats"],
    select: (data: any) => {
      // Extract followups from the dashboard stats and filter for today/overdue
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (!data?.followUps) return [];
      
      return data.followUps.filter((f: any) => {
        if (f.completed === true) return false;
        if (!f.followUpDate) return false;
        const followUpDate = new Date(f.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate <= today;
      }).map((f: any) => {
        const followUpDate = new Date(f.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        const daysOverdue = followUpDate < today 
          ? Math.floor((today.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          ...f,
          isOverdue: daysOverdue > 0,
          daysOverdue
        };
      }).sort((a: ProcessedFollowUp, b: ProcessedFollowUp) => {
        // Sort overdue first, then by days overdue
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return (b.daysOverdue || 0) - (a.daysOverdue || 0);
      });
    }
  });

  // Update selectedLead when leads data changes to ensure modal shows fresh data
  useEffect(() => {
    if (selectedLead && leads) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead && JSON.stringify(updatedLead) !== JSON.stringify(selectedLead)) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads, selectedLead]);

  // Fetch voice alerts data with automatic refetch every 2 minutes
  const { data: voiceAlertData } = useQuery<{
    followups: Array<{
      id: string;
      companyName: string;
      contactPerson: string;
      followUpDate: string;
      notes: string | null;
      stage: string;
      isOverdue: boolean;
    }>;
    voicePreference: "male" | "female";
    voiceAlertsEnabled: boolean;
  }>({
    queryKey: ["/api/followups/alerts"],
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not visible
  });

  // Voice alert system for pending followups
  const voicePreference = voiceAlertData?.voicePreference || "female";
  const voiceAlertsEnabled = voiceAlertData?.voiceAlertsEnabled !== false;
  const voiceAlertFollowups = voiceAlertData?.followups || [];
  const { announceFollowup, resetAnnouncements, isSupported: voiceSupported } = useFollowupVoiceAlerts(
    voicePreference,
    voiceAlertsEnabled
  );
  const lastAlertTimeRef = useRef<number>(0);
  // Track announced followups with date to allow re-announcement for new dates
  const announcedKeysRef = useRef<Set<string>>(new Set());

  // Voice alert polling effect - announce followups when page is focused
  useEffect(() => {
    if (!voiceAlertsEnabled || !voiceSupported || !voiceAlertFollowups.length) return;

    const checkAndAnnounce = () => {
      // Only announce if page is visible and focused
      if (document.hidden) return;
      
      // Rate limit: at least 30 seconds between announcements
      const now = Date.now();
      if (now - lastAlertTimeRef.current < 30000) return;

      // Find unannounced followups (use id+date as key to allow re-announcement for new dates)
      const unannouncedFollowups = voiceAlertFollowups.filter((f) => {
        const key = `${f.id}-${f.followUpDate}`;
        return !announcedKeysRef.current.has(key);
      });

      if (unannouncedFollowups.length > 0) {
        // Announce the first unannounced followup
        const followup = unannouncedFollowups[0];
        const key = `${followup.id}-${followup.followUpDate}`;
        announceFollowup({
          id: key,
          companyName: followup.companyName || "Unknown Company",
          isOverdue: followup.isOverdue,
        });
        announcedKeysRef.current.add(key);
        lastAlertTimeRef.current = now;
      }
    };

    // Check on mount and when followups change
    const timer = setTimeout(checkAndAnnounce, 2000);

    // Set up periodic check (every 5 minutes)
    const interval = setInterval(checkAndAnnounce, 5 * 60 * 1000);

    // Also check when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(checkAndAnnounce, 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [voiceAlertsEnabled, voiceSupported, voiceAlertFollowups, announceFollowup]);

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await apiRequest("PATCH", `/api/leads/${id}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/kanban"] });
      toast({
        title: "Success",
        description: "Lead stage updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update lead stage",
        variant: "destructive",
      });
    },
  });

  // Fetch distinct filter options (cities, areas, lead sources) from server
  const { data: filterOptions } = useQuery<{ cities: string[]; areas: string[]; leadSources: string[] }>({
    queryKey: ["/api/leads/filter-options"],
    staleTime: 2 * 60 * 1000,
  });
  const uniqueCities = filterOptions?.cities || [];
  const uniqueAreas = filterOptions?.areas || [];
  const uniqueLeadSources = filterOptions?.leadSources || [];

  // Clear filters function
  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCity("all");
    setSelectedArea("all");
    setSelectedUser("all");
    setSelectedLeadSource("all");
    setSelectedStage(null);
  };

  // Count active filters
  const activeFilterCount = [
    selectedCity !== "all",
    selectedArea !== "all",
    selectedUser !== "all",
    selectedLeadSource !== "all",
    searchQuery !== "",
  ].filter(Boolean).length;

  // Leads are already filtered server-side — use directly
  const filteredLeads = leads;

  // In kanban mode: use server-paginated data (50 per stage) + any extra loaded via "Load More"
  // In list/compact mode: use client-filtered data
  const getLeadsByStage = (stageId: string): Lead[] => {
    const applyVisibilityFilter = (lead: Lead) => {
      const leadAny = lead as any;
      if (leadAny.interestStatus === "not_interested") return false;
      if (stageId === "seed" && leadAny.isExistingCustomer === true) return false;
      return true;
    };

    if (layout === "kanban") {
      const base = kanbanData?.stages[stageId]?.leads || [];
      const extra = stageExtraLeads[stageId] || [];
      return [...base, ...extra].filter(applyVisibilityFilter);
    }

    return filteredLeads?.filter((lead) => {
      if (lead.stage !== stageId) return false;
      return applyVisibilityFilter(lead);
    }) || [];
  };

  // Real total count from server (for kanban); client count for other layouts
  const getStageTotal = (stageId: string): number => {
    if (layout === "kanban") return kanbanData?.stages[stageId]?.total || 0;
    return getLeadsByStage(stageId).length;
  };

  // Returns true if there are more leads on the server than currently shown
  const stageHasMore = (stageId: string): boolean => {
    if (layout !== "kanban") return false;
    const shown = getLeadsByStage(stageId).length;
    const total = kanbanData?.stages[stageId]?.total || 0;
    return shown < total;
  };

  const handleLoadMore = async (stageId: string) => {
    setStageLoadingMore(prev => ({ ...prev, [stageId]: true }));
    try {
      const currentShown = (kanbanData?.stages[stageId]?.leads.length || 0) + (stageExtraLeads[stageId]?.length || 0);
      const params = new URLSearchParams({
        stage: stageId,
        limit: "50",
        offset: String(currentShown),
        ...Object.fromEntries(Object.entries(kanbanFilters).map(([k, v]) => [k, String(v)])),
      });
      const resp = await fetch(`/api/leads/stage?${params}`, { credentials: "include" });
      const newLeads: Lead[] = await resp.json();
      setStageExtraLeads(prev => ({ ...prev, [stageId]: [...(prev[stageId] || []), ...newLeads] }));
    } catch {
      toast({ title: "Error", description: "Failed to load more leads", variant: "destructive" });
    } finally {
      setStageLoadingMore(prev => ({ ...prev, [stageId]: false }));
    }
  };

  // Calculate total value for a stage
  const getStageTotalValue = (stageId: string): number => {
    const stageLeads = getLeadsByStage(stageId);
    return stageLeads.reduce((total, lead) => {
      return total + (lead.confirmedOrderValue || lead.estimatedValue || 0);
    }, 0);
  };

  // Currency symbol mapping
  const getCurrencySymbol = (currency: string | null | undefined): string => {
    const symbols: Record<string, string> = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      AED: "د.إ",
      SGD: "S$",
      AUD: "A$",
      CAD: "C$",
      JPY: "¥",
      CNY: "¥",
    };
    return symbols[currency || "INR"] || "₹";
  };

  // Format currency compactly (e.g., 1.2L, 50K)
  const formatCompactCurrency = (value: number): string => {
    if (value >= 10000000) {
      return `${(value / 10000000).toFixed(1)}Cr`;
    } else if (value >= 100000) {
      return `${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads?.find((l) => l.id === leadId);
    if (lead && lead.stage !== stageId) {
      updateLeadMutation.mutate({ id: leadId, stage: stageId });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {showPlanningWarning && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/20">
                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Monthly Planning Required</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">{planningStatus?.message}</p>
              </div>
            </div>
            <Link href="/sales-planning">
              <Button variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900" data-testid="button-complete-planning">
                Complete Planning
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Motivational Progress Widget - 25th to 25th Cycle */}
      {cycleProgress && (currentUser?.role === "sales_executive" || currentUser?.role === "sales_head") && (
        <Card className={`border-2 ${
          cycleProgress.status === 'ahead' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
          cycleProgress.status === 'on_track' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' :
          cycleProgress.status === 'behind' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' :
          'border-gray-300 bg-gray-50 dark:bg-gray-900/20'
        }`} data-testid="card-cycle-progress">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Progress Circle */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="35"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${cycleProgress.progressPercent * 2.2} 220`}
                      strokeLinecap="round"
                      className={
                        cycleProgress.status === 'ahead' ? 'text-green-500' :
                        cycleProgress.status === 'on_track' ? 'text-blue-500' :
                        cycleProgress.status === 'behind' ? 'text-orange-500' :
                        'text-gray-400'
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold" data-testid="text-progress-percent">{cycleProgress.progressPercent}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Billing Cycle</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-cycle-dates">
                    {format(new Date(cycleProgress.cycleStart), "MMM d")} - {format(new Date(cycleProgress.cycleEnd), "MMM d")}
                  </p>
                  <p className="text-xs mt-1" data-testid="text-days-remaining">
                    <span className="font-medium">{cycleProgress.daysRemaining}</span> days remaining
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-md bg-white/50 dark:bg-black/20">
                  <p className="text-xs text-muted-foreground">Advance Collected</p>
                  <p className="text-lg font-bold text-green-600" data-testid="text-advance-collected">₹{cycleProgress.totalAdvance.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/50 dark:bg-black/20">
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-lg font-bold" data-testid="text-cycle-target">₹{cycleProgress.targetValue.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/50 dark:bg-black/20">
                  <p className="text-xs text-muted-foreground">Deals Won</p>
                  <p className="text-lg font-bold text-blue-600" data-testid="text-deals-won">{cycleProgress.dealsWon}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/50 dark:bg-black/20">
                  <p className="text-xs text-muted-foreground">Daily Rate</p>
                  <p className="text-lg font-bold text-purple-600" data-testid="text-daily-rate">₹{cycleProgress.dailyRate.toLocaleString()}</p>
                </div>
              </div>

              {/* Motivational Message */}
              <div className="lg:max-w-xs">
                <p className={`text-sm font-medium ${
                  cycleProgress.status === 'ahead' ? 'text-green-700 dark:text-green-400' :
                  cycleProgress.status === 'on_track' ? 'text-blue-700 dark:text-blue-400' :
                  cycleProgress.status === 'behind' ? 'text-orange-700 dark:text-orange-400' :
                  'text-gray-600 dark:text-gray-400'
                }`} data-testid="text-motivational-message">
                  {cycleProgress.motivationalMessage}
                </p>
                {cycleProgress.targetValue > 0 && cycleProgress.predictedPercent > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Predicted: ₹{cycleProgress.predictedTotal.toLocaleString()} ({cycleProgress.predictedPercent}% of target)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage leads through your sales process
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            data-testid="button-import-leads"
            className="min-h-[44px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setGoogleSheetsImportOpen(true)}
            data-testid="button-import-google-sheets"
            className="min-h-[44px]"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
            <span className="hidden sm:inline">Google Sheets</span>
            <span className="sm:hidden">Sheets</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setWebhookSettingsOpen(true)}
            data-testid="button-webhook-settings"
            className="min-h-[44px]"
          >
            <Shield className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Webhook Auth</span>
            <span className="sm:hidden">Webhook</span>
          </Button>
          <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-seed" className="min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Add Seed
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Seed</DialogTitle>
                <DialogDescription>
                  Create a new seed in your sales pipeline
                </DialogDescription>
              </DialogHeader>
              <LeadForm onSuccess={() => setNewLeadOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <GoogleSheetsImportDialog open={googleSheetsImportOpen} onOpenChange={setGoogleSheetsImportOpen} />
      <WebhookAuthSettingsDialog open={webhookSettingsOpen} onOpenChange={setWebhookSettingsOpen} />

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
            data-testid="input-search-leads"
          />
        </div>
        <div className="flex items-center border rounded-md">
          <Button 
            variant={layout === "kanban" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-r-none"
            onClick={() => handleLayoutChange("kanban")}
            title="Kanban View"
            data-testid="button-layout-kanban"
          >
            <Columns className="h-4 w-4" />
          </Button>
          <Button 
            variant={layout === "compact" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-none border-x"
            onClick={() => handleLayoutChange("compact")}
            title="Compact View"
            data-testid="button-layout-compact"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={layout === "list" ? "secondary" : "ghost"} 
            size="icon" 
            className="min-h-[44px] min-w-[44px] rounded-l-none"
            onClick={() => handleLayoutChange("list")}
            title="List View"
            data-testid="button-layout-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="min-h-[44px] min-w-[44px]"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-toggle-filters"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter Options
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* City Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">City</Label>
                  <Select value={selectedCity} onValueChange={(val) => {
                    setSelectedCity(val);
                    setSelectedArea("all");
                  }}>
                    <SelectTrigger className="min-h-[40px]" data-testid="select-city">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Area</Label>
                  <Select value={selectedArea} onValueChange={setSelectedArea}>
                    <SelectTrigger className="min-h-[40px]" data-testid="select-area">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {uniqueAreas.map((area) => (
                        <SelectItem key={area} value={area}>{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned User Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Assigned To</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="min-h-[40px]" data-testid="select-user">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.filter(u => u.isActive).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lead Source Filter */}
                <div className="space-y-2">
                  <Label className="text-xs">Lead Source</Label>
                  <Select value={selectedLeadSource} onValueChange={setSelectedLeadSource}>
                    <SelectTrigger className="min-h-[40px]" data-testid="select-lead-source">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {uniqueLeadSources.map((source) => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Results Count */}
                <div className="space-y-2 flex items-end">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{leads.length}</span> of <span className="font-medium text-foreground">{leadsTotal}</span> leads
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Stage Filter Buttons - shown in compact and list views */}
      {(layout === "compact" || layout === "list") && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedStage === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStage(null)}
            className="min-h-[40px]"
            data-testid="button-stage-all"
          >
            <span>All</span>
            <Badge variant="secondary" className="ml-2">
              {leadsTotal}
            </Badge>
            <Badge variant="outline" className="ml-1 text-green-600 border-green-300">
              ₹{formatCompactCurrency(leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0) || 0)}
            </Badge>
          </Button>
          {STAGES.map((stage) => {
            const stageValue = getStageTotalValue(stage.id);
            return (
              <Button
                key={stage.id}
                variant={selectedStage === stage.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                className="min-h-[40px]"
                data-testid={`button-stage-${stage.id}`}
              >
                <div className={`h-2.5 w-2.5 rounded-full mr-2 ${stage.color}`} />
                <span className="hidden sm:inline">{stage.title}</span>
                <span className="sm:hidden">{stage.title.split(' ')[0]}</span>
                <Badge variant="secondary" className="ml-2">
                  {getStageTotal(stage.id)}
                </Badge>
                {stageValue > 0 && (
                  <Badge variant="outline" className="ml-1 text-green-600 border-green-300">
                    ₹{formatCompactCurrency(stageValue)}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Kanban Board - Original horizontal layout */}
      {layout === "kanban" && (
        <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 pb-4 min-w-[1000px]">
          {/* Today's Followups Column */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full flex-shrink-0 bg-red-500" />
              <h3 className="font-semibold text-xs sm:text-sm truncate">Today's Calls</h3>
              <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">
                  {todayFollowups.length}
                </Badge>
                {todayFollowups.filter(f => f.isOverdue).length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {todayFollowups.filter(f => f.isOverdue).length} overdue
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
              {followupsLoading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : todayFollowups.length > 0 ? (
                todayFollowups.map((followup) => {
                  const lead = allLeadsForLookup.find(l => l.id === followup.leadId);
                  return (
                    <Card
                      key={followup.id}
                      className={`cursor-pointer hover-elevate ${followup.isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
                      onClick={() => openLeadModal(followup.leadId)}
                      data-testid={`card-followup-${followup.id}`}
                    >
                      <CardContent className="p-2 sm:p-3 space-y-1.5">
                        <div className="flex items-start gap-1.5">
                          {followup.isOverdue ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold truncate">
                              {followup.leadCompanyName || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {followup.leadContactPerson}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {followup.followUpDate && format(new Date(followup.followUpDate), "MMM d")}
                          </div>
                          {followup.isOverdue && followup.daysOverdue > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1 h-4">
                              {followup.daysOverdue}d overdue
                            </Badge>
                          )}
                        </div>
                        {/* Stage indicator */}
                        {followup.leadStage && (
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 h-4 ${
                              followup.leadStage === 'seed' ? 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                              followup.leadStage === 'lead' ? 'border-cyan-400 text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' :
                              followup.leadStage === 'demo_scheduled' ? 'border-purple-400 text-purple-600 bg-purple-50 dark:bg-purple-900/20' :
                              followup.leadStage === 'quote_sent' ? 'border-yellow-400 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
                              followup.leadStage === 'negotiation' ? 'border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-900/20' :
                              'border-gray-400 text-gray-600'
                            }`}
                          >
                            {followup.leadStage === 'seed' ? 'Seed' :
                             followup.leadStage === 'lead' ? 'Lead' :
                             followup.leadStage === 'demo_scheduled' ? 'Demo' :
                             followup.leadStage === 'quote_sent' ? 'Quote' :
                             followup.leadStage === 'negotiation' ? 'Negotiation' :
                             followup.leadStage}
                          </Badge>
                        )}
                        {/* Sales Executive Badge */}
                        {followup.salesExecutiveId && (() => {
                          const execInfo = getSalesExecutiveInfo(followup.salesExecutiveId);
                          return execInfo ? (
                            <Badge 
                              className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                              data-testid={`badge-sales-exec-followup-${followup.id}`}
                            >
                              {execInfo.name}
                            </Badge>
                          ) : null;
                        })()}
                        {followup.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{followup.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-3 sm:p-4 text-center text-xs text-muted-foreground">
                    No calls due
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Lead Stage Columns */}
          {STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="min-w-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`} />
                  <h3 className="font-semibold text-xs sm:text-sm truncate">{stage.title}</h3>
                  <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {getStageTotal(stage.id)}
                    </Badge>
                    {getStageTotalValue(stage.id) > 0 && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        ₹{formatCompactCurrency(getStageTotalValue(stage.id))}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {isLoading ? (
                    Array(3)
                      .fill(0)
                      .map((_, i) => <Skeleton key={i} className="h-28 sm:h-32 w-full" />)
                  ) : stageLeads.length > 0 ? (
                    stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => setSelectedLead(lead)}
                        data-testid={`card-lead-${lead.id}`}
                      >
                        <CardHeader className="p-2 sm:p-3 space-y-0.5">
                          <div className="flex items-start gap-2">
                            {/* Drag handle — only this element triggers drag */}
                            <div
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, lead.id); }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
                              title="Drag to move stage"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            {lead.photoUrl ? (
                              <img
                                src={lead.photoUrl}
                                alt={lead.companyName}
                                className="w-10 h-10 rounded-md object-cover flex-shrink-0 border"
                                data-testid={`img-lead-photo-${lead.id}`}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-xs sm:text-sm font-semibold leading-tight truncate">
                                {lead.companyName}
                              </CardTitle>
                              <div className="text-xs text-muted-foreground truncate">
                                {lead.contactPerson}
                              </div>
                            </div>
                          </div>
                          {(lead.city || lead.area) && (
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {[lead.area, lead.city].filter(Boolean).join(", ")}
                              {lead.locationCapturedAt && (
                                <span className="text-xs opacity-75">
                                  ({format(new Date(lead.locationCapturedAt), "MMM d, h:mm a")})
                                </span>
                              )}
                            </div>
                          )}
                          {/* Sales Executive Name - Prominent Display */}
                          {lead.salesExecutiveId && (() => {
                            const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                            return execInfo ? (
                              <div className="flex items-center gap-1 text-xs mt-0.5" data-testid={`row-sales-exec-${lead.id}`}>
                                <User className="h-3 w-3 text-primary flex-shrink-0" />
                                <span className="text-primary font-medium truncate">{execInfo.name}</span>
                              </div>
                            ) : null;
                          })()}
                        </CardHeader>
                        <CardContent className="p-2 sm:p-3 pt-0 space-y-1.5">
                          {lead.estimatedValue && (
                            <div className="text-xs sm:text-sm font-medium">
                              {getCurrencySymbol(lead.currency)}{lead.estimatedValue.toLocaleString()}
                            </div>
                          )}
                          {lead.demoDate && (
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate flex-1">{format(new Date(lead.demoDate), "MMM d, h:mm a")}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0 hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRescheduleLeadId(lead.id);
                                }}
                                title="Reschedule Demo"
                                data-testid={`button-reschedule-demo-${lead.id}`}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 text-xs flex-wrap">
                            <Badge variant="outline" className="capitalize text-xs px-1.5 py-0">
                              {lead.leadSource === "other" && (lead as any).customLeadSource ? (lead as any).customLeadSource : lead.leadSource}
                            </Badge>
                            {lead.salesExecutiveId && (() => {
                              const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                              return execInfo ? (
                                <Badge 
                                  className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                                  data-testid={`badge-sales-exec-${lead.id}`}
                                >
                                  {execInfo.name}
                                </Badge>
                              ) : null;
                            })()}
                            <span className="text-muted-foreground whitespace-nowrap text-xs">
                              {lead.daysInStage}d
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="p-3 sm:p-4 text-center text-xs text-muted-foreground">
                        No leads
                      </CardContent>
                    </Card>
                  )}
                  {stageHasMore(stage.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleLoadMore(stage.id)}
                      disabled={stageLoadingMore[stage.id]}
                      data-testid={`button-load-more-${stage.id}`}
                    >
                      {stageLoadingMore[stage.id] ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Load more ({getStageTotal(stage.id) - getLeadsByStage(stage.id).length} remaining)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Compact View - Responsive grid cards */}
      {layout === "compact" && (
        <div className="space-y-6 pb-4">
          {/* Today's Followups Section */}
          {todayFollowups.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <h3 className="font-semibold text-base">Today's Calls</h3>
                <Badge variant="secondary">{todayFollowups.length}</Badge>
                {todayFollowups.filter(f => f.isOverdue).length > 0 && (
                  <Badge variant="destructive">
                    {todayFollowups.filter(f => f.isOverdue).length} overdue
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {todayFollowups.map((followup) => {
                  const lead = allLeadsForLookup.find(l => l.id === followup.leadId);
                  return (
                    <Card
                      key={followup.id}
                      className={`cursor-pointer hover-elevate ${followup.isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
                      onClick={() => openLeadModal(followup.leadId)}
                      data-testid={`card-followup-compact-${followup.id}`}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          {followup.isOverdue ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Phone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{followup.leadCompanyName || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{followup.leadContactPerson}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {followup.followUpDate && format(new Date(followup.followUpDate), "MMM d")}
                          </div>
                          {followup.salesExecutiveId && (() => {
                            const execInfo = getSalesExecutiveInfo(followup.salesExecutiveId);
                            return execInfo ? (
                              <Badge 
                                className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                                data-testid={`badge-sales-exec-followup-compact-${followup.id}`}
                              >
                                {execInfo.name}
                              </Badge>
                            ) : null;
                          })()}
                          {followup.isOverdue && followup.daysOverdue > 0 && (
                            <Badge variant="destructive">{followup.daysOverdue}d overdue</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lead Stages - filtered by selectedStage */}
          {STAGES.filter(stage => selectedStage === null || selectedStage === stage.id).map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            if (stageLeads.length === 0) return null;
            return (
              <div key={stage.id}>
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                  <h3 className="font-semibold text-base">{stage.title}</h3>
                  <Badge variant="secondary">{stageLeads.length}</Badge>
                  {getStageTotalValue(stage.id) > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      ₹{formatCompactCurrency(getStageTotalValue(stage.id))}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer hover-elevate active-elevate-2"
                      onClick={() => setSelectedLead(lead)}
                      data-testid={`card-lead-compact-${lead.id}`}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start gap-3">
                          {lead.photoUrl ? (
                            <img
                              src={lead.photoUrl}
                              alt={lead.companyName}
                              className="w-12 h-12 rounded-md object-cover flex-shrink-0 border"
                              data-testid={`img-lead-photo-compact-${lead.id}`}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border">
                              <Camera className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-semibold">{lead.companyName}</CardTitle>
                            <div className="text-sm text-muted-foreground">{lead.contactPerson}</div>
                            {(lead.city || lead.area) && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                {[lead.area, lead.city].filter(Boolean).join(", ")}
                                {lead.locationCapturedAt && (
                                  <span className="text-xs opacity-75">
                                    ({format(new Date(lead.locationCapturedAt), "MMM d, h:mm a")})
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Sales Executive Name - Prominent Display */}
                            {lead.salesExecutiveId && (() => {
                              const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                              return execInfo ? (
                                <div className="flex items-center gap-1 text-xs mt-1" data-testid={`row-sales-exec-compact-${lead.id}`}>
                                  <User className="h-3 w-3 text-primary flex-shrink-0" />
                                  <span className="text-primary font-medium truncate">{execInfo.name}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                        {lead.estimatedValue && (
                          <div className="text-base font-medium">
                            {getCurrencySymbol(lead.currency)}{lead.estimatedValue.toLocaleString()}
                          </div>
                        )}
                        {lead.demoDate && (
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>{format(new Date(lead.demoDate), "MMM d, h:mm a")}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">{lead.leadSource === "other" && (lead as any).customLeadSource ? (lead as any).customLeadSource : lead.leadSource}</Badge>
                          {lead.salesExecutiveId && (() => {
                            const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                            return execInfo ? (
                              <Badge 
                                className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                                data-testid={`badge-sales-exec-compact-${lead.id}`}
                              >
                                {execInfo.name}
                              </Badge>
                            ) : null;
                          })()}
                          <span className="text-sm text-muted-foreground">{lead.daysInStage}d in stage</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Compact view pagination */}
          {leadsTotal > pageSize && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={getTotalPages(leadsTotal)}
              pageSize={pageSize}
              totalItems={leadsTotal}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[25, 50, 100]}
            />
          )}
        </div>
      )}

      {/* List View - Full-width rows */}
      {layout === "list" && (
        <div className="space-y-4 pb-4">
          {/* Today's Followups */}
          {todayFollowups.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <CardTitle className="text-base">Today's Calls</CardTitle>
                  <Badge variant="secondary">{todayFollowups.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {todayFollowups.map((followup) => {
                  const lead = allLeadsForLookup.find(l => l.id === followup.leadId);
                  return (
                    <div
                      key={followup.id}
                      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer hover-elevate ${followup.isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50'}`}
                      onClick={() => openLeadModal(followup.leadId)}
                      data-testid={`row-followup-${followup.id}`}
                    >
                      {followup.isOverdue ? (
                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      ) : (
                        <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{followup.leadCompanyName || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{followup.leadContactPerson}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        {followup.salesExecutiveId && (() => {
                          const execInfo = getSalesExecutiveInfo(followup.salesExecutiveId);
                          return execInfo ? (
                            <Badge 
                              className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                              data-testid={`badge-sales-exec-list-followup-${followup.id}`}
                            >
                              {execInfo.name}
                            </Badge>
                          ) : null;
                        })()}
                        <div className="text-sm text-muted-foreground">
                          {followup.followUpDate && format(new Date(followup.followUpDate), "MMM d")}
                        </div>
                        {followup.isOverdue && followup.daysOverdue > 0 && (
                          <Badge variant="destructive">{followup.daysOverdue}d overdue</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Lead Stages as Sections - filtered by selectedStage */}
          {STAGES.filter(stage => selectedStage === null || selectedStage === stage.id).map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            if (stageLeads.length === 0) return null;
            return (
              <Card key={stage.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <CardTitle className="text-base">{stage.title}</CardTitle>
                    <Badge variant="secondary">{stageLeads.length}</Badge>
                    {getStageTotalValue(stage.id) > 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        ₹{formatCompactCurrency(getStageTotalValue(stage.id))}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover-elevate bg-muted/50"
                      onClick={() => setSelectedLead(lead)}
                      data-testid={`row-lead-${lead.id}`}
                    >
                      {lead.photoUrl ? (
                        <img
                          src={lead.photoUrl}
                          alt={lead.companyName}
                          className="w-12 h-12 rounded-md object-cover flex-shrink-0 border"
                          data-testid={`img-lead-photo-list-${lead.id}`}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{lead.companyName}</p>
                        <p className="text-sm text-muted-foreground">{lead.contactPerson}</p>
                        {(lead.city || lead.area) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {[lead.area, lead.city].filter(Boolean).join(", ")}
                            {lead.locationCapturedAt && (
                              <span className="text-xs opacity-75">
                                ({format(new Date(lead.locationCapturedAt), "MMM d, h:mm a")})
                              </span>
                            )}
                          </p>
                        )}
                        {/* Sales Executive Name - Prominent Display */}
                        {lead.salesExecutiveId && (() => {
                          const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                          return execInfo ? (
                            <p className="flex items-center gap-1 text-xs mt-1" data-testid={`row-sales-exec-list-${lead.id}`}>
                              <User className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="text-primary font-medium">{execInfo.name}</span>
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                        {lead.estimatedValue && (
                          <span className="font-medium text-green-600">
                            {getCurrencySymbol(lead.currency)}{lead.estimatedValue.toLocaleString()}
                          </span>
                        )}
                        {lead.demoDate && (
                          <div className="flex items-center gap-1 text-sm text-primary">
                            <Clock className="h-4 w-4" />
                            {format(new Date(lead.demoDate), "MMM d")}
                          </div>
                        )}
                        <Badge variant="outline" className="capitalize">{lead.leadSource === "other" && (lead as any).customLeadSource ? (lead as any).customLeadSource : lead.leadSource}</Badge>
                        {lead.salesExecutiveId && (() => {
                          const execInfo = getSalesExecutiveInfo(lead.salesExecutiveId);
                          return execInfo ? (
                            <Badge 
                              className={`${execInfo.color} no-default-hover-elevate text-[10px] px-1.5`}
                              data-testid={`badge-sales-exec-list-${lead.id}`}
                            >
                              {execInfo.name}
                            </Badge>
                          ) : null;
                        })()}
                        <span className="text-sm text-muted-foreground">{lead.daysInStage}d</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {/* List view pagination */}
          {leadsTotal > pageSize && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={getTotalPages(leadsTotal)}
              pageSize={pageSize}
              totalItems={leadsTotal}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[25, 50, 100]}
            />
          )}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <ErrorBoundary key={selectedLead.id} onReset={() => setSelectedLead(null)}>
          <LeadDetailModal
            lead={selectedLead}
            open={!!selectedLead}
            onClose={() => setSelectedLead(null)}
          />
        </ErrorBoundary>
      )}

      {/* Reschedule Demo Dialog */}
      {rescheduleLeadId && leads && (
        <RescheduleDemoDialog
          lead={leads.find(l => l.id === rescheduleLeadId)!}
          open={!!rescheduleLeadId}
          onClose={() => setRescheduleLeadId(null)}
        />
      )}
    </div>
  );
}
