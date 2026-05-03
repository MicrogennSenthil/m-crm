import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Mail, MessageCircle, Printer, Pencil, Trash2, Search, Settings as SettingsIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Quotation } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
};

const fmtINR = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function QuotationsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [type, setType] = useState<"all" | "quotation" | "amc">("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [emailDialog, setEmailDialog] = useState<{ open: boolean; q?: Quotation; to: string }>({ open: false, to: "" });
  const [whatsappDialog, setWhatsappDialog] = useState<{ open: boolean; q?: Quotation; to: string }>({ open: false, to: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();

  const { data: quotations = [], isLoading, error } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations", type, status],
    queryFn: async () => {
      const r = await fetch(`/api/quotations${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to load quotations (${r.status})`);
      }
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const safeQuotations: Quotation[] = Array.isArray(quotations) ? quotations : [];
  const filtered = safeQuotations.filter((q) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quotationNumber.toLowerCase().includes(s) ||
      q.propertyName.toLowerCase().includes(s) ||
      (q.kindAttentionName || "").toLowerCase().includes(s) ||
      (q.email || "").toLowerCase().includes(s) ||
      (q.bdmName || "").toLowerCase().includes(s)
    );
  });

  const sendEmailMut = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) =>
      apiRequest("POST", `/api/quotations/${id}/send-email`, { to }),
    onSuccess: () => {
      toast({ title: "Email sent", description: "Quotation has been emailed." });
      setEmailDialog({ open: false, to: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    },
    onError: (e: any) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
  });

  const sendWaMut = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) =>
      apiRequest("POST", `/api/quotations/${id}/send-whatsapp`, { to }),
    onSuccess: () => {
      toast({ title: "WhatsApp sent", description: "Message dispatched via M-WhatsApp." });
      setWhatsappDialog({ open: false, to: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    },
    onError: (e: any) => toast({ title: "WhatsApp failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/quotations/${id}`),
    onSuccess: () => {
      toast({ title: "Deleted" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Quotations</h1>
          <p className="text-sm text-muted-foreground">Create, send and track customer quotations & AMC contracts.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/quotations/settings">
            <Button variant="outline" data-testid="link-settings">
              <SettingsIcon className="h-4 w-4 mr-2" />Settings
            </Button>
          </Link>
          <Link href="/quotations/new">
            <Button data-testid="button-new-quotation">
              <Plus className="h-4 w-4 mr-2" />New Quotation
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between flex-wrap">
            <Tabs value={type} onValueChange={(v) => setType(v as any)}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="quotation" data-testid="tab-quotation">Quotations</TabsTrigger>
                <TabsTrigger value="amc" data-testid="tab-amc">AMC</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search number / customer / BDM..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive font-medium">Failed to load quotations</p>
              <p className="text-xs text-muted-foreground mt-2">{(error as Error).message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                If this is a fresh deploy, the database tables may need to be created.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No quotations yet.</p>
              <Link href="/quotations/new">
                <Button className="mt-3" data-testid="button-new-empty">Create your first quotation</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left p-2">Number</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2 hidden md:table-cell">Attention</th>
                    <th className="text-left p-2 hidden lg:table-cell">BDM</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => (
                    <tr key={q.id} className="border-b hover-elevate" data-testid={`row-quotation-${q.id}`}>
                      <td className="p-2">
                        <Link href={`/quotations/${q.id}`}>
                          <span className="font-medium text-primary cursor-pointer" data-testid={`link-number-${q.id}`}>
                            {q.quotationNumber}
                          </span>
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {q.type === "amc" ? "AMC" : "Quotation"} · {new Date(q.createdAt as any).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium" data-testid={`text-customer-${q.id}`}>{q.propertyName}</div>
                        <div className="text-xs text-muted-foreground">{q.city}</div>
                      </td>
                      <td className="p-2 hidden md:table-cell">
                        <div>{q.kindAttentionName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{q.designation}</div>
                      </td>
                      <td className="p-2 hidden lg:table-cell">{q.bdmName || "-"}</td>
                      <td className="p-2 text-right font-semibold" data-testid={`text-total-${q.id}`}>
                        {fmtINR(q.total || 0)}
                      </td>
                      <td className="p-2 text-center">
                        <Badge className={STATUS_COLORS[q.status] || ""}>{q.status}</Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="icon" variant="ghost" title="View / Print"
                            onClick={() => window.open(`/api/quotations/${q.id}/print`, "_blank")}
                            data-testid={`button-print-${q.id}`}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Send Email"
                            onClick={() => setEmailDialog({ open: true, q, to: q.email || "" })}
                            data-testid={`button-email-${q.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Send WhatsApp"
                            onClick={() => setWhatsappDialog({ open: true, q, to: q.phone || "" })}
                            data-testid={`button-whatsapp-${q.id}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Edit"
                            onClick={() => navigate(`/quotations/${q.id}/edit`)}
                            data-testid={`button-edit-${q.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Delete"
                            onClick={() => setDeleteId(q.id)}
                            data-testid={`button-delete-${q.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email dialog */}
      <Dialog open={emailDialog.open} onOpenChange={(o) => setEmailDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation by Email</DialogTitle>
            <DialogDescription>
              Quotation: <b>{emailDialog.q?.quotationNumber}</b>
              {emailDialog.q?.emailSentAt && (
                <div className="text-xs mt-2 text-muted-foreground">
                  Last sent: {new Date(emailDialog.q.emailSentAt).toLocaleString("en-IN")} → {emailDialog.q.emailSentTo}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Recipient Email</label>
            <Input
              value={emailDialog.to}
              onChange={(e) => setEmailDialog((d) => ({ ...d, to: e.target.value }))}
              placeholder="customer@example.com"
              data-testid="input-email-to"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialog({ open: false, to: "" })}>Cancel</Button>
            <Button
              onClick={() => emailDialog.q && sendEmailMut.mutate({ id: emailDialog.q.id, to: emailDialog.to })}
              disabled={!emailDialog.to || sendEmailMut.isPending}
              data-testid="button-send-email"
            >
              {sendEmailMut.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp dialog */}
      <Dialog open={whatsappDialog.open} onOpenChange={(o) => setWhatsappDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation via WhatsApp</DialogTitle>
            <DialogDescription>
              Quotation: <b>{whatsappDialog.q?.quotationNumber}</b>
              <div className="text-xs mt-2 text-muted-foreground">
                Sent through M-WhatsApp (configurable in Settings).
              </div>
              {whatsappDialog.q?.whatsappSentAt && (
                <div className="text-xs mt-2 text-muted-foreground">
                  Last sent: {new Date(whatsappDialog.q.whatsappSentAt).toLocaleString("en-IN")} → {whatsappDialog.q.whatsappSentTo}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Phone Number (with country code)</label>
            <Input
              value={whatsappDialog.to}
              onChange={(e) => setWhatsappDialog((d) => ({ ...d, to: e.target.value }))}
              placeholder="919876543210"
              data-testid="input-wa-to"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappDialog({ open: false, to: "" })}>Cancel</Button>
            <Button
              onClick={() => whatsappDialog.q && sendWaMut.mutate({ id: whatsappDialog.q.id, to: whatsappDialog.to })}
              disabled={!whatsappDialog.to || sendWaMut.isPending}
              data-testid="button-send-wa"
            >
              {sendWaMut.isPending ? "Sending..." : "Send WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quotation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
