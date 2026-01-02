import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Sprout,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  User,
  Building2,
  MapPin,
  Clock,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LeadDetailModal } from "@/components/lead-detail-modal";
import type { Lead, User as UserType } from "@shared/schema";

type SeedWithDetails = Lead & {
  salesExecutive?: UserType | null;
  interestStatus?: string | null;
  notInterestedReason?: string | null;
  nextFollowupDate?: Date | null;
  interestUpdatedAt?: Date | null;
};

export default function SeedsReportPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeed, setSelectedSeed] = useState<Lead | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getInterestStatusParam = (tab: string) => {
    switch (tab) {
      case "interested":
        return "interested";
      case "not_interested":
        return "not_interested";
      case "undecided":
        return "undecided";
      default:
        return undefined;
    }
  };

  const { data: seeds = [], isLoading, refetch } = useQuery<SeedWithDetails[]>({
    queryKey: [
      "/api/seeds/report",
      {
        interestStatus: getInterestStatusParam(activeTab),
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
      },
    ],
  });

  const { data: followupReminders = [] } = useQuery<SeedWithDetails[]>({
    queryKey: ["/api/seeds/followup-reminders", { days: "30" }],
  });

  const filteredSeeds = seeds.filter((seed) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      seed.companyName.toLowerCase().includes(query) ||
      seed.contactPerson?.toLowerCase().includes(query) ||
      seed.contactPhone?.toLowerCase().includes(query) ||
      seed.contactEmail?.toLowerCase().includes(query) ||
      seed.city?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: seeds.length,
    interested: seeds.filter((s) => s.interestStatus === "interested").length,
    notInterested: seeds.filter((s) => s.interestStatus === "not_interested").length,
    undecided: seeds.filter((s) => !s.interestStatus).length,
    upcomingFollowups: followupReminders.length,
  };

  const exportToExcel = async (type: "all" | "not_interested" | "interested" | "followups") => {
    setIsExporting(true);
    try {
      let dataToExport: SeedWithDetails[] = [];
      let filename = "";

      switch (type) {
        case "not_interested":
          dataToExport = seeds.filter((s) => s.interestStatus === "not_interested");
          filename = `not_interested_seeds_${format(new Date(), "yyyy-MM-dd")}.csv`;
          break;
        case "interested":
          dataToExport = seeds.filter((s) => s.interestStatus === "interested");
          filename = `interested_seeds_${format(new Date(), "yyyy-MM-dd")}.csv`;
          break;
        case "followups":
          dataToExport = followupReminders;
          filename = `seed_followups_${format(new Date(), "yyyy-MM-dd")}.csv`;
          break;
        default:
          dataToExport = filteredSeeds;
          filename = `all_seeds_${format(new Date(), "yyyy-MM-dd")}.csv`;
      }

      const headers = [
        "Company Name",
        "Contact Person",
        "Email",
        "Phone",
        "City",
        "Area",
        "Interest Status",
        "Reason (Not Interested)",
        "Next Followup Date",
        "Assigned To",
        "Created Date",
        "Lead Source",
      ];

      const rows = dataToExport.map((seed) => [
        seed.companyName || "",
        seed.contactPerson || "",
        seed.contactEmail || "",
        seed.contactPhone || "",
        seed.city || "",
        seed.area || "",
        seed.interestStatus || "Undecided",
        seed.notInterestedReason || "",
        seed.nextFollowupDate ? format(new Date(seed.nextFollowupDate), "yyyy-MM-dd HH:mm") : "",
        seed.salesExecutive ? `${seed.salesExecutive.firstName} ${seed.salesExecutive.lastName}` : "Unassigned",
        seed.createdAt ? format(new Date(seed.createdAt), "yyyy-MM-dd") : "",
        seed.leadSource || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const getInterestBadge = (status: string | null | undefined) => {
    switch (status) {
      case "interested":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Interested
          </Badge>
        );
      case "not_interested":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Not Interested
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <HelpCircle className="h-3 w-3 mr-1" />
            Undecided
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-seeds-report">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sprout className="h-6 w-6" />
            Seeds Report
          </h1>
          <p className="text-muted-foreground">
            Track seed interest status, followups, and export data for marketing campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-refresh-report"
          >
            <Filter className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Seeds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Interested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              Not Interested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.notInterested}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <HelpCircle className="h-4 w-4 text-gray-500" />
              Undecided
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.undecided}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-600" />
              Upcoming Followups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.upcomingFollowups}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label>From Date</Label>
          <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !fromDate && "text-muted-foreground"
                )}
                data-testid="button-from-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fromDate ? format(fromDate, "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => {
                  setFromDate(date);
                  setFromCalendarOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>To Date</Label>
          <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !toDate && "text-muted-foreground"
                )}
                data-testid="button-to-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {toDate ? format(toDate, "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => {
                  setToDate(date);
                  setToCalendarOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label>Search</Label>
          <Input
            placeholder="Search by company, contact, phone, email, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-seeds"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-seeds">
              All Seeds ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="interested" data-testid="tab-interested">
              Interested ({stats.interested})
            </TabsTrigger>
            <TabsTrigger value="not_interested" data-testid="tab-not-interested">
              Not Interested ({stats.notInterested})
            </TabsTrigger>
            <TabsTrigger value="undecided" data-testid="tab-undecided">
              Undecided ({stats.undecided})
            </TabsTrigger>
            <TabsTrigger value="followups" data-testid="tab-followups">
              Followups ({stats.upcomingFollowups})
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {activeTab === "not_interested" && (
              <Button
                variant="outline"
                onClick={() => exportToExcel("not_interested")}
                disabled={isExporting}
                data-testid="button-export-not-interested"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Export Not Interested (Email Blasting)
              </Button>
            )}
            {activeTab === "interested" && (
              <Button
                variant="outline"
                onClick={() => exportToExcel("interested")}
                disabled={isExporting}
                data-testid="button-export-interested"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Export Interested
              </Button>
            )}
            {activeTab === "followups" && (
              <Button
                variant="outline"
                onClick={() => exportToExcel("followups")}
                disabled={isExporting}
                data-testid="button-export-followups"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Export Followups
              </Button>
            )}
            {activeTab === "all" && (
              <Button
                variant="outline"
                onClick={() => exportToExcel("all")}
                disabled={isExporting}
                data-testid="button-export-all"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export All
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="all" className="mt-0">
          <SeedsTable
            seeds={filteredSeeds}
            isLoading={isLoading}
            getInterestBadge={getInterestBadge}
            onSeedClick={setSelectedSeed}
          />
        </TabsContent>

        <TabsContent value="interested" className="mt-0">
          <SeedsTable
            seeds={filteredSeeds.filter((s) => s.interestStatus === "interested")}
            isLoading={isLoading}
            getInterestBadge={getInterestBadge}
            onSeedClick={setSelectedSeed}
            showFollowupDate
          />
        </TabsContent>

        <TabsContent value="not_interested" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Not Interested Seeds - For Email/Marketing Campaigns
              </CardTitle>
              <CardDescription>
                Export this list with contact details for future marketing campaigns and email blasting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeedsTable
                seeds={filteredSeeds.filter((s) => s.interestStatus === "not_interested")}
                isLoading={isLoading}
                getInterestBadge={getInterestBadge}
                onSeedClick={setSelectedSeed}
                showReason
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="undecided" className="mt-0">
          <SeedsTable
            seeds={filteredSeeds.filter((s) => !s.interestStatus)}
            isLoading={isLoading}
            getInterestBadge={getInterestBadge}
            onSeedClick={setSelectedSeed}
          />
        </TabsContent>

        <TabsContent value="followups" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Upcoming Seed Followups (Next 30 Days)
              </CardTitle>
              <CardDescription>
                Seeds marked as interested with scheduled followup dates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeedsTable
                seeds={followupReminders}
                isLoading={isLoading}
                getInterestBadge={getInterestBadge}
                onSeedClick={setSelectedSeed}
                showFollowupDate
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedSeed && (
        <LeadDetailModal
          lead={selectedSeed}
          open={!!selectedSeed}
          onClose={() => setSelectedSeed(null)}
        />
      )}
    </div>
  );
}

interface SeedsTableProps {
  seeds: SeedWithDetails[];
  isLoading: boolean;
  getInterestBadge: (status: string | null | undefined) => JSX.Element;
  onSeedClick: (seed: Lead) => void;
  showFollowupDate?: boolean;
  showReason?: boolean;
}

function SeedsTable({
  seeds,
  isLoading,
  getInterestBadge,
  onSeedClick,
  showFollowupDate,
  showReason,
}: SeedsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (seeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Sprout className="h-12 w-12 mb-4 opacity-50" />
        <p>No seeds found matching the criteria</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            {showFollowupDate && <TableHead>Next Followup</TableHead>}
            {showReason && <TableHead>Reason</TableHead>}
            <TableHead>Assigned To</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seeds.map((seed) => (
            <TableRow
              key={seed.id}
              className="cursor-pointer hover-elevate"
              onClick={() => onSeedClick(seed)}
              data-testid={`row-seed-${seed.id}`}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{seed.companyName}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{seed.contactPerson || "-"}</span>
                </div>
              </TableCell>
              <TableCell>
                {seed.contactPhone ? (
                  <a
                    href={`tel:${seed.contactPhone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" />
                    {seed.contactPhone}
                  </a>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {seed.contactEmail && !seed.contactEmail.endsWith("@pending.com") ? (
                  <a
                    href={`mailto:${seed.contactEmail}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="h-3 w-3" />
                    {seed.contactEmail}
                  </a>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {seed.city || seed.area ? (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {[seed.area, seed.city].filter(Boolean).join(", ")}
                  </div>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>{getInterestBadge(seed.interestStatus)}</TableCell>
              {showFollowupDate && (
                <TableCell>
                  {seed.nextFollowupDate ? (
                    <div className="flex items-center gap-1 text-sm">
                      <CalendarIcon className="h-3 w-3 text-blue-600" />
                      {format(new Date(seed.nextFollowupDate), "PPP 'at' h:mm a")}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
              )}
              {showReason && (
                <TableCell>
                  <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                    {seed.notInterestedReason || "-"}
                  </span>
                </TableCell>
              )}
              <TableCell>
                {seed.salesExecutive ? (
                  <span className="text-sm">
                    {seed.salesExecutive.firstName} {seed.salesExecutive.lastName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
