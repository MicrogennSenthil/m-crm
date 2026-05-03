import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import type { QuotationSettings } from "@shared/schema";

export default function QuotationSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<QuotationSettings>({ queryKey: ["/api/quotation-settings"] });
  const [form, setForm] = useState<Partial<QuotationSettings>>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  const set = <K extends keyof QuotationSettings>(key: K, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const saveMut = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/quotation-settings", form),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotation-settings"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Quotation Settings</h1>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />{saveMut.isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotation Numbering</CardTitle>
          <CardDescription>Configure prefix, year suffix and starting number. Existing numbers are preserved.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label>Quotation Prefix</Label><Input value={form.quotationPrefix || ""} onChange={(e) => set("quotationPrefix", e.target.value)} data-testid="input-q-prefix" /></div>
          <div><Label>Year Suffix</Label><Input value={form.quotationYearSuffix || ""} onChange={(e) => set("quotationYearSuffix", e.target.value)} placeholder="26-27" data-testid="input-q-year" /></div>
          <div><Label>Next Number</Label><Input type="number" value={form.quotationNextNumber || 0} onChange={(e) => set("quotationNextNumber", parseInt(e.target.value) || 0)} data-testid="input-q-next" /></div>
          <div><Label>Number Padding (digits)</Label><Input type="number" value={form.numberPadding || 4} onChange={(e) => set("numberPadding", parseInt(e.target.value) || 4)} /></div>
          <div className="md:col-span-4 text-xs text-muted-foreground">
            Preview: <b>{`${form.quotationPrefix || ""}${String(form.quotationNextNumber || 0).padStart(form.numberPadding || 4, "0")}${form.quotationYearSuffix ? `/${form.quotationYearSuffix}` : ""}`}</b>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AMC Numbering</CardTitle>
          <CardDescription>Separate sequence for AMC contracts.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label>AMC Prefix</Label><Input value={form.amcPrefix || ""} onChange={(e) => set("amcPrefix", e.target.value)} data-testid="input-amc-prefix" /></div>
          <div><Label>Year Suffix</Label><Input value={form.amcYearSuffix || ""} onChange={(e) => set("amcYearSuffix", e.target.value)} data-testid="input-amc-year" /></div>
          <div><Label>Next Number</Label><Input type="number" value={form.amcNextNumber || 0} onChange={(e) => set("amcNextNumber", parseInt(e.target.value) || 0)} data-testid="input-amc-next" /></div>
          <div className="md:col-span-4 text-xs text-muted-foreground">
            Preview: <b>{`${form.amcPrefix || ""}${String(form.amcNextNumber || 0).padStart(form.numberPadding || 4, "0")}${form.amcYearSuffix ? `/${form.amcYearSuffix}` : ""}`}</b>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Defaults for New Quotations</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Default GST %</Label><Input type="number" value={form.defaultGstPercent || 0} onChange={(e) => set("defaultGstPercent", parseInt(e.target.value) || 0)} data-testid="input-default-gst" /></div>
          <div><Label>Default Validity Days</Label><Input type="number" value={form.defaultValidityDays || 30} onChange={(e) => set("defaultValidityDays", parseInt(e.target.value) || 30)} /></div>
          <div className="md:col-span-2"><Label>Default Payment Terms</Label><Textarea rows={3} value={form.defaultPaymentTerms || ""} onChange={(e) => set("defaultPaymentTerms", e.target.value)} data-testid="input-default-payment" /></div>
          <div className="md:col-span-2"><Label>Default Terms & Conditions</Label><Textarea rows={6} value={form.defaultTermsConditions || ""} onChange={(e) => set("defaultTermsConditions", e.target.value)} data-testid="input-default-tnc" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company / Letterhead Details</CardTitle>
          <CardDescription>Shown at the top of every printed quotation and email.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Label>Company Name</Label><Input value={form.companyName || ""} onChange={(e) => set("companyName", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.companyAddress || ""} onChange={(e) => set("companyAddress", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.companyPhone || ""} onChange={(e) => set("companyPhone", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.companyEmail || ""} onChange={(e) => set("companyEmail", e.target.value)} /></div>
          <div><Label>Website</Label><Input value={form.companyWebsite || ""} onChange={(e) => set("companyWebsite", e.target.value)} /></div>
          <div><Label>GSTIN</Label><Input value={form.companyGstin || ""} onChange={(e) => set("companyGstin", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Bank Details (shown in printed quotation)</Label><Textarea rows={3} value={form.bankDetails || ""} onChange={(e) => set("bankDetails", e.target.value)} placeholder="A/c Name: ...&#10;A/c No: ...&#10;Bank: ...&#10;IFSC: ..." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">M-WhatsApp Integration</CardTitle>
          <CardDescription>Configure your M-WhatsApp endpoint for sending quotations via WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.whatsappEnabled} onCheckedChange={(v) => set("whatsappEnabled", v)} data-testid="switch-wa-enabled" />
            <Label>Enable WhatsApp sending</Label>
          </div>
          <div><Label>API Endpoint URL</Label><Input value={form.whatsappEndpoint || ""} onChange={(e) => set("whatsappEndpoint", e.target.value)} placeholder="https://wa.microgenn.com/api/send-message" data-testid="input-wa-endpoint" /></div>
          <div><Label>API Token (Bearer)</Label><Input type="password" value={form.whatsappToken || ""} onChange={(e) => set("whatsappToken", e.target.value)} placeholder="Optional bearer token" data-testid="input-wa-token" /></div>
          <p className="text-xs text-muted-foreground">
            We'll POST <code>{`{ to, message, quotationNumber }`}</code> as JSON to this endpoint with optional <code>Authorization: Bearer &lt;token&gt;</code> header.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
