import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Wrench,
  Headphones,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Lead, Project, Ticket, ActivityLog } from "@shared/schema";

interface DashboardStats {
  activeLeads: number;
  ongoingProjects: number;
  openTickets: number;
  monthlyClosures: number;
  leadsChange: number;
  projectsChange: number;
  ticketsChange: number;
  closuresChange: number;
}

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/dashboard/activities"],
  });

  const { data: recentLeads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads?limit=5"],
  });

  const { data: activeProjects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects?status=in_progress"],
  });

  const { data: openTickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets?status=open&limit=5"],
  });

  const metricCards = [
    {
      title: "Active Leads",
      value: stats?.activeLeads || 0,
      change: stats?.leadsChange || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      title: "Ongoing Implementations",
      value: stats?.ongoingProjects || 0,
      change: stats?.projectsChange || 0,
      icon: Wrench,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: "Open Tickets",
      value: stats?.openTickets || 0,
      change: stats?.ticketsChange || 0,
      icon: Headphones,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
    },
    {
      title: "This Month's Closures",
      value: stats?.monthlyClosures || 0,
      change: stats?.closuresChange || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
    },
  ];

  const getActivityIcon = (entityType: string) => {
    switch (entityType) {
      case "lead":
        return TrendingUp;
      case "project":
        return Wrench;
      case "ticket":
        return Headphones;
      default:
        return Clock;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your Microgenn CRM dashboard
        </p>
      </div>

      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading
          ? Array(4)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-5" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))
          : metricCards.map((card) => (
              <Card key={card.title} data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <div className={`h-8 w-8 rounded-md ${card.bgColor} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`value-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>{card.value}</div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    {card.change > 0 ? (
                      <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                    ) : card.change < 0 ? (
                      <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
                    ) : null}
                    <span className={card.change > 0 ? "text-green-600" : card.change < 0 ? "text-red-600" : ""}>
                      {card.change > 0 ? "+" : ""}{card.change}%
                    </span>
                    <span className="ml-1">vs last month</span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-4" data-testid="activity-feed">
                {activities.map((activity) => {
                  const Icon = getActivityIcon(activity.entityType);
                  return (
                    <div key={activity.id} className="flex gap-3 items-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.createdAt && formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Panel - 1/3 width */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="space-y-3">
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
              ) : recentLeads && recentLeads.length > 0 ? (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="text-sm space-y-1">
                      <div className="font-medium truncate">{lead.companyName}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {lead.stage.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent leads
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-3">
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
              ) : activeProjects && activeProjects.length > 0 ? (
                <div className="space-y-3">
                  {activeProjects.map((project) => (
                    <div key={project.id} className="text-sm space-y-1">
                      <div className="font-medium truncate">{project.clientName}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {project.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {project.completionPercentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active projects
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="space-y-3">
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
              ) : openTickets && openTickets.length > 0 ? (
                <div className="space-y-3">
                  {openTickets.map((ticket) => (
                    <div key={ticket.id} className="text-sm space-y-1">
                      <div className="font-medium font-mono text-xs">
                        {ticket.ticketNumber}
                      </div>
                      <div className="truncate text-xs">{ticket.issueSummary}</div>
                      <Badge
                        variant={
                          ticket.priority === "critical"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {ticket.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No open tickets
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
