import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, safeArrayQueryFn, safeObjectQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save, Printer, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Module, QuotationSettings, Quotation, User, Lead } from "@shared/schema";

const CATEGORIES = [
  { value: "software_onpremise", label: "Software — On-Premises" },
  { value: "software_cloud", label: "Software — Cloud Based" },
  { value: "power_automation", label: "Power Automation" },
  { value: "digital_marketing", label: "Digital Marketing" },
  { value: "door_lock", label: "Door Lock" },
  { value: "computer_system", label: "Computer System" },
  { value: "amc", label: "AMC" },
  { value: "other", label: "Other" },
];

type Item = {
  moduleId?: string | null;
  name: string;
  description: string;
  hsnCode: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotationFormPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const editId = params.id;
  const { toast } = useToast();

  const { data: settings, error: settingsError } = useQuery<QuotationSettings | null>({
    queryKey: ["/api/quotation-settings"],
    queryFn: safeObjectQueryFn<QuotationSettings>("/api/quotation-settings"),
  });
  const { data: modules = [], error: modulesError } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
    queryFn: safeArrayQueryFn<Module>("/api/modules"),
  });
  const { data: users = [], error: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: safeArrayQueryFn<User>("/api/users"),
  });
  const { data: existing, error: existingError } = useQuery<Quotation | null>({
    queryKey: ["/api/quotations", editId],
    queryFn: safeObjectQueryFn<Quotation>(`/api/quotations/${editId}`),
    enabled: !!editId,
  });
  // Pull leads for the picker (largest single page; client-side searchable)
  const { data: leadsResp } = useQuery<{ leads: Lead[] } | Lead[]>({
    queryKey: ["/api/leads", "for-quotation"],
    queryFn: safeObjectQueryFn<{ leads: Lead[] } | Lead[]>("/api/leads?pageSize=500"),
  });

  const safeModules: Module[] = Array.isArray(modules) ? modules : [];
  const safeUsers: User[] = Array.isArray(users) ? users : [];
  const safeLeads: Lead[] = Array.isArray(leadsResp)
    ? leadsResp
    : Array.isArray((leadsResp as any)?.leads)
      ? (leadsResp as any).leads
      : [];
  const loadError = settingsError || modulesError || usersError || existingError;

  // Form state
  const [type, setType] = useState<"quotation" | "amc">("quotation");
  const [category, setCategory] = useState("software_onpremise");
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kindAttentionName, setKindAttentionName] = useState("");
  const [designation, setDesignation] = useState("");
  const [bdmId, setBdmId] = useState<string>("");
  const [bdmName, setBdmName] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [validityDays, setValidityDays] = useState(30);
  const [gstPercent, setGstPercent] = useState(18);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from settings (defaults) on first load
  useEffect(() => {
    if (settings && !hydrated && !editId) {
      setGstPercent(settings.defaultGstPercent ?? 18);
      setValidityDays(settings.defaultValidityDays ?? 30);
      setPaymentTerms(settings.defaultPaymentTerms || "");
      setTermsConditions(settings.defaultTermsConditions || "");
      setHydrated(true);
    }
  }, [settings, hydrated, editId]);

  // Hydrate from existing quotation when editing
  useEffect(() => {
    if (existing && editId && !hydrated) {
      setType((existing.type as any) || "quotation");
      setCategory(existing.category || "software_onpremise");
      setPropertyName(existing.propertyName || "");
      setAddress(existing.address || "");
      setCity(existing.city || "");
      setEmail(existing.email || "");
      setPhone(existing.phone || "");
      setKindAttentionName(existing.kindAttentionName || "");
      setDesignation(existing.designation || "");
      setBdmId(existing.bdmId || "");
      setBdmName(existing.bdmName || "");
      setLeadId((existing as any).leadId || "");
      setValidityDays(existing.validityDays ?? 30);
      setGstPercent(existing.gstPercent ?? 18);
      setPaymentTerms(existing.paymentTerms || "");
      setTermsConditions(existing.termsConditions || "");
      setNotes(existing.notes || "");
      setItems((existing.items as Item[]) || []);
      setHydrated(true);
    }
  }, [existing, editId, hydrated]);

  // Filter modules by category
  const filteredModules = useMemo(
    () => safeModules.filter((m) => !category || !m.category || m.category === category),
    [safeModules, category]
  );

  const addItem = () => {
    setItems([...items, { name: "", description: "", hsnCode: "", qty: 1, unit: "Nos", unitPrice: 0, lineTotal: 0 }]);
  };

  const addModule = (mod: Module) => {
    setItems([
      ...items,
      {
        moduleId: mod.id,
        name: mod.name,
        description: mod.description || "",
        hsnCode: mod.hsnCode || "",
        qty: 1,
        unit: mod.unit || "Nos",
        unitPrice: mod.price || 0,
        lineTotal: mod.price || 0,
      },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.lineTotal = (next.qty || 0) * (next.unitPrice || 0);
        return next;
      })
    );
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + (it.lineTotal || 0), 0);
  const gstAmount = (subtotal * gstPercent) / 100;
  const total = subtotal + gstAmount;

  const onUserChange = (id: string) => {
    setBdmId(id);
    const u = safeUsers.find((x) => x.id === id);
    if (u) setBdmName(`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "");
  };

  const selectedLead = safeLeads.find((l) => l.id === leadId);

  const pickLead = (lead: Lead) => {
    setLeadId(lead.id);
    setLeadPickerOpen(false);
    if (!propertyName) setPropertyName(lead.companyName || "");
    if (!kindAttentionName) setKindAttentionName(lead.contactPerson || "");
    if (!email) setEmail(lead.contactEmail || "");
    if (!phone) setPhone(lead.contactPhone || "");
    if (!city && lead.city) setCity(lead.city);
    if (!bdmId && lead.salesExecutiveId) {
      setBdmId(lead.salesExecutiveId);
      const u = safeUsers.find((x) => x.id === lead.salesExecutiveId);
      if (u) setBdmName(`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "");
    }
    toast({ title: "Lead linked", description: `${lead.companyName} — fields pre-filled` });
  };

  const clearLead = () => {
    setLeadId("");
    toast({ title: "Lead unlinked", description: "Customer fields kept; this quotation is now standalone." });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      // Convert rupees to paise for storage. Only set quotationDate/validUntil on creation
      // so that historical documents are not silently re-dated when edited.
      const body: any = {
        type, category, propertyName, address, city, email, phone,
        kindAttentionName, designation, bdmId: bdmId || null, bdmName,
        leadId: leadId || null,
        validityDays,
        items, // stored as JSON (rupees)
        subtotal: Math.round(subtotal * 100),
        gstPercent,
        gstAmount: Math.round(gstAmount * 100),
        total: Math.round(total * 100),
        paymentTerms, termsConditions, notes,
      };
      if (editId) {
        return apiRequest("PATCH", `/api/quotations/${editId}`, body);
      }
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + (validityDays || 30));
      body.quotationDate = new Date();
      body.validUntil = validUntil;
      body.status = "draft";
      return apiRequest("POST", "/api/quotations", body);
    },
    onSuccess: async (resp: any) => {
      const data = await resp.json();
      toast({ title: editId ? "Quotation updated" : "Quotation created", description: data.quotationNumber });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      navigate(`/quotations`);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const validate = () => {
    if (!propertyName.trim()) return "Property / Customer name is required";
    if (items.length === 0) return "Add at least one line item";
    for (const it of items) {
      if (!it.name?.trim()) return "Every item must have a name";
      if (!(it.qty > 0)) return "Quantity must be greater than 0";
    }
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      toast({ title: "Cannot save", description: err, variant: "destructive" });
      return;
    }
    saveMut.mutate();
  };

  if (loadError) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">{editId ? "Edit Quotation" : "New Quotation"}</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium" data-testid="text-load-error">
              Failed to load quotation form
            </p>
            <p className="text-xs text-muted-foreground mt-2">{(loadError as Error).message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              If this is a fresh deploy, the database tables may need to be created, or you may
              not have permission to view modules / users / settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">{editId ? "Edit Quotation" : "New Quotation"}</h1>
        </div>
        <div className="flex gap-2">
          {editId && (
            <Button variant="outline" onClick={() => window.open(`/api/quotations/${editId}/print`, "_blank")} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />Print Preview
            </Button>
          )}
          <Button onClick={handleSave} disabled={saveMut.isPending} data-testid="button-save">
            <Save className="h-4 w-4 mr-2" />
            {saveMut.isPending ? "Saving..." : editId ? "Update" : "Save Quotation"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quotation Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quotation">Quotation</SelectItem>
                <SelectItem value="amc">AMC Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Validity (days)</Label>
            <Input type="number" value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)} data-testid="input-validity" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Customer / Property Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Link to Sales Lead (optional)</Label>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={leadPickerOpen}
                    className="flex-1 justify-between font-normal"
                    data-testid="button-pick-lead"
                  >
                    {selectedLead
                      ? `${selectedLead.companyName} — ${selectedLead.contactPerson}`
                      : "Search & pick an existing lead..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type company, contact, email or phone..." data-testid="input-lead-search" />
                    <CommandList>
                      <CommandEmpty>
                        No matching leads. You can keep typing the customer name below to create a fresh client.
                      </CommandEmpty>
                      <CommandGroup>
                        {safeLeads.map((l) => (
                          <CommandItem
                            key={l.id}
                            value={`${l.companyName} ${l.contactPerson} ${l.contactEmail} ${l.contactPhone || ""} ${l.city || ""}`}
                            onSelect={() => pickLead(l)}
                            data-testid={`option-lead-${l.id}`}
                          >
                            <Check className={cn("mr-2 h-4 w-4", leadId === l.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{l.companyName}</span>
                              <span className="text-xs text-muted-foreground">
                                {l.contactPerson} · {l.contactEmail}
                                {l.city ? ` · ${l.city}` : ""}
                                {l.stage ? ` · ${l.stage}` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedLead && (
                <Button type="button" variant="ghost" size="sm" onClick={clearLead} data-testid="button-clear-lead">
                  <X className="h-4 w-4 mr-1" />Unlink
                </Button>
              )}
            </div>
            {selectedLead ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <Badge variant="secondary" data-testid="badge-linked-lead">Linked to lead</Badge>
                <span>
                  Stage: <b>{selectedLead.stage}</b>. After saving, this lead will move to <b>quote_sent</b>.
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Pick an existing lead to auto-fill the fields below, or just type a new client name to create a standalone quotation.
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Property / Customer Name *</Label>
            <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} data-testid="input-property" />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} data-testid="input-address" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} data-testid="input-city" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="91XXXXXXXXXX" data-testid="input-phone" />
          </div>
          <div>
            <Label>Kind Attention Name</Label>
            <Input value={kindAttentionName} onChange={(e) => setKindAttentionName(e.target.value)} data-testid="input-attention" />
          </div>
          <div>
            <Label>Designation</Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} data-testid="input-designation" />
          </div>
          <div>
            <Label>BDM (Business Development Manager)</Label>
            <Select value={bdmId} onValueChange={onUserChange}>
              <SelectTrigger data-testid="select-bdm"><SelectValue placeholder="Select BDM" /></SelectTrigger>
              <SelectContent>
                {safeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {(u.firstName || "") + " " + (u.lastName || "")} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Line Items</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select onValueChange={(modId) => { const m = safeModules.find(x => x.id === modId); if (m) addModule(m); }}>
                <SelectTrigger className="w-64" data-testid="select-add-module">
                  <SelectValue placeholder={`+ Add module${filteredModules.length ? ` (${filteredModules.length})` : ""}`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredModules.length === 0 && <div className="p-2 text-xs text-muted-foreground">No modules in this category</div>}
                  {filteredModules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.price ? `— ₹${m.price.toLocaleString("en-IN")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addItem} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />Add Custom Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No items yet. Add modules from the dropdown above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2 min-w-[260px]">Item / Description</th>
                    <th className="text-left p-2 w-24">HSN</th>
                    <th className="text-left p-2 w-20">Qty</th>
                    <th className="text-left p-2 w-20">Unit</th>
                    <th className="text-right p-2 w-32">Unit Price</th>
                    <th className="text-right p-2 w-32">Total</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b align-top" data-testid={`row-item-${idx}`}>
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2">
                        <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} placeholder="Item name" data-testid={`input-item-name-${idx}`} />
                        <Textarea value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Description (optional)" rows={2} className="mt-1" data-testid={`input-item-desc-${idx}`} />
                      </td>
                      <td className="p-2">
                        <Input value={it.hsnCode} onChange={(e) => updateItem(idx, { hsnCode: e.target.value })} data-testid={`input-item-hsn-${idx}`} />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={it.qty} onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })} data-testid={`input-item-qty-${idx}`} />
                      </td>
                      <td className="p-2">
                        <Input value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })} data-testid={`input-item-unit-${idx}`} />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} className="text-right" data-testid={`input-item-price-${idx}`} />
                      </td>
                      <td className="p-2 text-right font-semibold" data-testid={`text-item-total-${idx}`}>{fmt(it.lineTotal)}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} data-testid={`button-remove-item-${idx}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-end mt-4 gap-3">
            <div className="w-full sm:w-80 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  GST %
                  <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)} className="w-16 h-7" data-testid="input-gst" />
                </span>
                <span>{fmt(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t" data-testid="text-grand-total">
                <span>Grand Total</span><span className="text-primary">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment Terms & Conditions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Payment Terms (editable)</Label>
            <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={3} data-testid="input-payment-terms" />
          </div>
          <div>
            <Label>Terms & Conditions (editable)</Label>
            <Textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={6} data-testid="input-tnc" />
          </div>
          <div>
            <Label>Internal Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-notes" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
