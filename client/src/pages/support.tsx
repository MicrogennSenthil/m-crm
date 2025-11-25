import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, ArrowUpDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TicketForm } from "@/components/ticket-form";
import { TicketDetailModal } from "@/components/ticket-detail-modal";
import type { Ticket } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const PRIORITY_CONFIG: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  critical: { variant: "destructive", label: "Critical" },
  high: { variant: "default", label: "High", className: "bg-orange-600" },
  medium: { variant: "secondary", label: "Medium" },
  low: { variant: "outline", label: "Low" },
};

const STATUS_CONFIG: Record<string, { variant: "secondary" | "default" | "outline" | "destructive"; label: string; className?: string }> = {
  open: { variant: "default", label: "Open" },
  in_progress: { variant: "secondary", label: "In Progress" },
  pending_customer: { variant: "outline", label: "Pending Customer" },
  escalated: { variant: "destructive", label: "Escalated" },
  closed: { variant: "outline", label: "Closed", className: "bg-green-600/10 text-green-700" },
};

export default function Support() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const filteredTickets = tickets?.filter((ticket) =>
    searchQuery
      ? ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.issueSummary.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const calculateAge = (createdAt: Date | string) => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: false });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track customer support requests
          </p>
        </div>
        <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-ticket" className="min-h-[44px] w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Log a new customer support request
              </DialogDescription>
            </DialogHeader>
            <TicketForm onSuccess={() => setNewTicketOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 min-h-[44px]"
          data-testid="input-search-tickets"
        />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array(5)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))
        ) : filteredTickets && filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => {
            const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
            const statusConfig = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
            return (
              <Card
                key={ticket.id}
                className="hover-elevate active-elevate-2 cursor-pointer touch-manipulation"
                onClick={() => setSelectedTicket(ticket)}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-sm text-muted-foreground">{ticket.ticketNumber}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <h3 className="font-medium text-sm mb-1 leading-tight">{ticket.customerName}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{ticket.issueSummary}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                      {priorityConfig.label}
                    </Badge>
                    <Badge variant={statusConfig.variant} className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                    <Badge variant="outline">L{ticket.escalationLevel}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {ticket.createdAt && calculateAge(ticket.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No tickets found</p>
              <Button onClick={() => setNewTicketOpen(true)} className="min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Create First Ticket
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  Ticket ID
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Summary</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Escalation Level</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
            ) : filteredTickets && filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                const statusConfig = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`row-ticket-${ticket.id}`}
                  >
                    <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                    <TableCell>{ticket.customerName}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.issueSummary}</TableCell>
                    <TableCell>
                      <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                        {priorityConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">L{ticket.escalationLevel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ticket.createdAt && calculateAge(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(ticket);
                        }}
                        data-testid={`button-view-ticket-${ticket.id}`}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <p className="text-muted-foreground mb-4">No tickets found</p>
                  <Button onClick={() => setNewTicketOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Ticket
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
