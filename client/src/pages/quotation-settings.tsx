import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, safeObjectQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Copy, Check, Eye, EyeOff } from "lucide-react";
import type { QuotationSettings } from "@shared/schema";

export default function QuotationSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<QuotationSettings | null>({
    queryKey: ["/api/quotation-settings"],
    queryFn: safeObjectQueryFn<QuotationSettings>("/api/quotation-settings"),
  });
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

  if (error) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Quotation Settings</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium" data-testid="text-settings-error">
              Failed to load quotation settings
            </p>
            <p className="text-xs text-muted-foreground mt-2">{(error as Error).message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              If this is a fresh deploy, the database tables may need to be created, or you may
              not have permission to view settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">M-WhatsApp CRM Bridge (Stage Automation)</CardTitle>
          <CardDescription>
            Each time a lead's stage changes, M-CRM POSTs the transition to the bridge so it can fire the
            template you configured in the bridge's Stage Automation tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!form.bridgeEnabled}
              onCheckedChange={(v) => set("bridgeEnabled", v)}
              data-testid="switch-bridge-enabled"
            />
            <Label>Enable stage-change webhooks</Label>
          </div>
          <div>
            <Label>Bridge Base URL</Label>
            <Input
              value={form.bridgeUrl || ""}
              onChange={(e) => set("bridgeUrl", e.target.value)}
              placeholder="https://wa.microgenn.com:4000/api/crm-bridge"
              data-testid="input-bridge-url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              We append <code>/webhook/stage-changed</code> automatically — paste just the base URL.
            </p>
          </div>
          <div>
            <Label>Bridge API Token (Bearer)</Label>
            <Input
              type="password"
              value={form.bridgeToken || ""}
              onChange={(e) => set("bridgeToken", e.target.value)}
              placeholder="Optional bearer token"
              data-testid="input-bridge-token"
            />
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <div className="font-medium mb-1">POST {(form.bridgeUrl || "").replace(/\/$/, "")}/webhook/stage-changed</div>
            <pre className="overflow-x-auto">{`{
  "leadId": "...",
  "leadName": "Acme Hotels",
  "phone": "919876543210",
  "fromStage": "lead",
  "toStage": "demo_scheduled"
}`}</pre>
          </div>
        </CardContent>
      </Card>

      <IntegrationReferenceCard bridgeUrl={form.bridgeUrl || "https://wa.microgenn.com:4000/api/crm-bridge"} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Integration Reference card — copy-paste ready values for the M-WhatsApp team
// ───────────────────────────────────────────────────────────────────────────

function CopyBlock({
  label,
  value,
  testId,
  multiline = false,
  masked = false,
}: {
  label: string;
  value: string;
  testId: string;
  multiline?: boolean;
  masked?: boolean;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  const display = masked && !revealed ? value.replace(/./g, "•") : value;

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: `${label} copied` });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          {masked && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((r) => !r)}
              data-testid={`button-toggle-${testId}`}
            >
              {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!value}
            data-testid={`button-copy-${testId}`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>
      {multiline ? (
        <pre className="rounded-md bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre" data-testid={`text-${testId}`}>
          {display || "(not configured)"}
        </pre>
      ) : (
        <div
          className="rounded-md bg-muted/40 p-2 text-xs font-mono break-all"
          data-testid={`text-${testId}`}
        >
          {display || "(not configured)"}
        </div>
      )}
    </div>
  );
}

function IntegrationReferenceCard({ bridgeUrl }: { bridgeUrl: string }) {
  const cleanBase = bridgeUrl.replace(/\/$/, "");
  const postUrl = `${cleanBase}/webhook/stage-changed`;
  const samplePayload = JSON.stringify(
    {
      leadId: "...",
      leadName: "Acme Hotels",
      phone: "919876543210",
      fromStage: "lead",
      toStage: "demo_scheduled",
    },
    null,
    2,
  );
  const curlSample = `curl -X POST '${postUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '${samplePayload.replace(/\n/g, " ").replace(/  +/g, " ")}'`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integration Reference (for M-WhatsApp Team)</CardTitle>
        <CardDescription>
          Copy-paste ready values for the M-WhatsApp bridge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CopyBlock label="Webhook URL" value={postUrl} testId="webhook-url" />

        <CopyBlock
          label="Sample payload (JSON body)"
          value={samplePayload}
          testId="webhook-payload"
          multiline
        />

        <CopyBlock label="curl test command" value={curlSample} testId="webhook-curl" multiline />

        <div>
          <Label className="text-xs font-medium">CRM_DATABASE_URL (for the M-WhatsApp project's secret)</Label>
          <div className="rounded-md bg-muted/40 p-3 mt-1 text-xs text-muted-foreground space-y-1">
            <p>For security, database credentials are never sent through the application API.</p>
            <p>Read the value directly on the VPS:</p>
            <pre className="mt-1 bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
              {`grep DATABASE_URL /var/www/m-crm/ecosystem.config.cjs`}
            </pre>
            <p>Set this as <code className="font-mono bg-muted px-1 rounded">CRM_DATABASE_URL</code> in the M-WhatsApp project secrets.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
