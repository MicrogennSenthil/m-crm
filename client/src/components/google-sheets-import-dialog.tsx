import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, ChevronRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Spreadsheet {
  id: string;
  name: string;
}

interface GoogleSheetsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEAD_FIELDS = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "contactPerson", label: "Contact Person", required: true },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "address", label: "Address", required: false },
  { key: "source", label: "Lead Source", required: false },
  { key: "notes", label: "Notes", required: false },
];

export function GoogleSheetsImportDialog({ open, onOpenChange }: GoogleSheetsImportDialogProps) {
  const [step, setStep] = useState<"select" | "mapping" | "confirm" | "result">("select");
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<Spreadsheet | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [skipHeader, setSkipHeader] = useState(true);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  const { data: spreadsheets, isLoading: spreadsheetsLoading, error: spreadsheetsError, refetch: refetchSpreadsheets } = useQuery<Spreadsheet[]>({
    queryKey: ["/api/google-sheets/spreadsheets"],
    enabled: open,
  });

  const { data: sheetNames, isLoading: sheetsLoading } = useQuery<string[]>({
    queryKey: ["/api/google-sheets", selectedSpreadsheet?.id, "sheets"],
    enabled: !!selectedSpreadsheet?.id,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<any[][]>({
    queryKey: ["/api/google-sheets", selectedSpreadsheet?.id, selectedSheet, "preview"],
    enabled: !!selectedSpreadsheet?.id && !!selectedSheet,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/google-sheets/import-leads", {
        spreadsheetId: selectedSpreadsheet?.id,
        sheetName: selectedSheet,
        columnMapping,
        skipHeader,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setImportResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (data.success > 0) {
        toast({
          title: "Import Successful",
          description: `${data.success} leads imported successfully`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import leads",
        variant: "destructive",
      });
    },
  });

  const handleReset = () => {
    setStep("select");
    setSelectedSpreadsheet(null);
    setSelectedSheet("");
    setColumnMapping({});
    setImportResult(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 300);
  };

  const headerRow = previewData?.[0] || [];

  const handleColumnMappingChange = (fieldKey: string, columnIndex: string) => {
    const idx = parseInt(columnIndex, 10);
    if (isNaN(idx)) {
      const newMapping = { ...columnMapping };
      delete newMapping[fieldKey];
      setColumnMapping(newMapping);
    } else {
      setColumnMapping({ ...columnMapping, [fieldKey]: idx });
    }
  };

  const canProceedToConfirm = columnMapping.companyName !== undefined || columnMapping.contactPerson !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Import Leads from Google Sheets
          </DialogTitle>
          <DialogDescription>
            Connect to your Google Sheets and import lead data directly into the CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2 border-b">
          <Badge variant={step === "select" ? "default" : "secondary"}>1. Select Sheet</Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === "mapping" ? "default" : "secondary"}>2. Map Columns</Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === "confirm" || step === "result" ? "default" : "secondary"}>3. Import</Badge>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {step === "select" && (
            <div className="space-y-4 py-4">
              {spreadsheetsError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to connect to Google Sheets. Please ensure the integration is set up correctly.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <Label>Select a Spreadsheet</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetchSpreadsheets()}
                  disabled={spreadsheetsLoading}
                  data-testid="button-refresh-spreadsheets"
                >
                  <RefreshCw className={`h-4 w-4 ${spreadsheetsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {spreadsheetsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-2">
                  {spreadsheets?.map((sheet) => (
                    <Card
                      key={sheet.id}
                      className={`cursor-pointer transition-colors hover-elevate ${
                        selectedSpreadsheet?.id === sheet.id ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        setSelectedSpreadsheet(sheet);
                        setSelectedSheet("");
                      }}
                      data-testid={`card-spreadsheet-${sheet.id}`}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{sheet.name}</span>
                      </CardContent>
                    </Card>
                  ))}
                  {spreadsheets?.length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No spreadsheets found. Make sure you have Google Sheets in your connected account.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {selectedSpreadsheet && (
                <div className="space-y-2 mt-4">
                  <Label>Select a Sheet</Label>
                  {sheetsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger data-testid="select-sheet-name">
                        <SelectValue placeholder="Choose a sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames?.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skipHeader"
                  checked={skipHeader}
                  onCheckedChange={(checked) => setSkipHeader(checked as boolean)}
                  data-testid="checkbox-skip-header"
                />
                <Label htmlFor="skipHeader" className="text-sm">
                  First row contains headers (skip during import)
                </Label>
              </div>

              {previewLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Preview (First Row)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {headerRow.map((cell: any, idx: number) => (
                          <Badge key={idx} variant="outline">
                            Col {idx + 1}: {cell || "(empty)"}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <Label>Map Columns to Lead Fields</Label>
                    {LEAD_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center gap-4">
                        <div className="w-40 flex items-center gap-1">
                          <span className={field.required ? "font-medium" : ""}>
                            {field.label}
                          </span>
                          {field.required && <span className="text-destructive">*</span>}
                        </div>
                        <Select
                          value={columnMapping[field.key]?.toString() || ""}
                          onValueChange={(val) => handleColumnMappingChange(field.key, val)}
                        >
                          <SelectTrigger className="flex-1" data-testid={`select-mapping-${field.key}`}>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Not Mapped --</SelectItem>
                            {headerRow.map((cell: any, idx: number) => (
                              <SelectItem key={idx} value={idx.toString()}>
                                Column {idx + 1}: {cell || "(empty)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4 py-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You are about to import leads from "{selectedSpreadsheet?.name}" - {selectedSheet}.
                  {previewData && (
                    <span className="block mt-1">
                      Approximately {skipHeader ? previewData.length - 1 : previewData.length}+ rows will be processed.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Column Mappings</CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-1">
                  {LEAD_FIELDS.filter((f) => columnMapping[f.key] !== undefined).map((field) => (
                    <div key={field.key} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{field.label}:</span>
                      <span className="text-muted-foreground">
                        Column {(columnMapping[field.key] || 0) + 1} ({headerRow[columnMapping[field.key]] || "empty"})
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {step === "result" && importResult && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Card className="flex-1">
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                    <div className="text-sm text-muted-foreground">Leads Imported</div>
                  </CardContent>
                </Card>
                {importResult.failed > 0 && (
                  <Card className="flex-1">
                    <CardContent className="p-4 text-center">
                      <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <div className="text-2xl font-bold text-destructive">{importResult.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm text-destructive">Errors</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-import">
            {step === "result" ? "Close" : "Cancel"}
          </Button>

          <div className="flex gap-2">
            {step === "mapping" && (
              <Button variant="outline" onClick={() => setStep("select")} data-testid="button-back-select">
                Back
              </Button>
            )}
            {step === "confirm" && (
              <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-mapping">
                Back
              </Button>
            )}

            {step === "select" && selectedSheet && (
              <Button onClick={() => setStep("mapping")} data-testid="button-next-mapping">
                Next: Map Columns
              </Button>
            )}

            {step === "mapping" && canProceedToConfirm && (
              <Button onClick={() => setStep("confirm")} data-testid="button-next-confirm">
                Next: Review
              </Button>
            )}

            {step === "confirm" && (
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                data-testid="button-start-import"
              >
                {importMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Start Import"
                )}
              </Button>
            )}

            {step === "result" && (
              <Button onClick={handleReset} data-testid="button-import-another">
                Import Another
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
