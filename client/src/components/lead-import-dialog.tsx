import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  leads: any[];
}

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadImportDialog({ open, onOpenChange }: LeadImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (leads: Record<string, string>[]) => {
      const response = await apiRequest("POST", "/api/leads/bulk-import", { leads });
      return await response.json() as ImportResult;
    },
    onSuccess: (data: ImportResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      if (data.success > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.success} lead(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import leads",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setResult(null);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast({
            title: "Parse Warning",
            description: `${results.errors.length} row(s) had issues and were skipped`,
            variant: "default",
          });
        }
        setPreviewData(results.data as Record<string, string>[]);
      },
      error: (error) => {
        toast({
          title: "File Error",
          description: error.message || "Failed to parse CSV file",
          variant: "destructive",
        });
      }
    });
  };

  const handleImport = () => {
    if (previewData.length > 0) {
      importMutation.mutate(previewData);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setResult(null);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = `Company Name,Contact Person,Email,Phone,Source,Value,Notes
"Acme Corp","John Doe","john@acme.com","+1-555-0100","linkedin",50000,"Interested in Enterprise plan"
"Tech Startup","Jane Smith","jane@techstartup.io","+1-555-0200","facebook",25000,"Demo requested"`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import leads into your sales pipeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!result && (
            <>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="csv-file" className="mb-2 block">
                    CSV File
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      data-testid="input-csv-file"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>CSV Format</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">Your CSV should include these columns:</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Company Name</Badge>
                    <Badge variant="secondary">Contact Person</Badge>
                    <Badge variant="secondary">Email</Badge>
                    <Badge variant="secondary">Phone</Badge>
                    <Badge variant="secondary">Source</Badge>
                    <Badge variant="secondary">Value</Badge>
                    <Badge variant="secondary">Notes</Badge>
                  </div>
                  <p className="mt-2 text-xs">
                    Valid sources: facebook, linkedin, instagram, twitter, website, referral
                  </p>
                </AlertDescription>
              </Alert>

              {previewData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preview ({previewData.length} records)</Label>
                    <Badge variant="outline">{file?.name}</Badge>
                  </div>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="space-y-2">
                      {previewData.slice(0, 5).map((row, idx) => (
                        <div
                          key={idx}
                          className="text-sm p-2 bg-muted rounded"
                          data-testid={`preview-row-${idx}`}
                        >
                          <span className="font-medium">
                            {row["Company Name"] || row.companyName || "Unknown"}
                          </span>
                          {" - "}
                          <span className="text-muted-foreground">
                            {row["Contact Person"] || row.contactPerson || "No contact"}
                          </span>
                          {" - "}
                          <span className="text-muted-foreground">
                            {row["Email"] || row.contactEmail || "No email"}
                          </span>
                        </div>
                      ))}
                      {previewData.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ...and {previewData.length - 5} more records
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {importMutation.isPending && (
            <div className="space-y-2">
              <Label>Importing leads...</Label>
              <Progress value={50} className="animate-pulse" />
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Alert variant={result.failed > 0 ? "default" : "default"}>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Import Complete</AlertTitle>
                <AlertDescription>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">{result.success}</Badge>
                      <span>Imported</span>
                    </div>
                    {result.failed > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{result.failed}</Badge>
                        <span>Failed</span>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Errors
                  </Label>
                  <ScrollArea className="h-32 border border-destructive/20 rounded-md p-2">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-destructive">
                        {error}
                      </p>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel-import">
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && previewData.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                data-testid="button-confirm-import"
              >
                Import {previewData.length} Lead{previewData.length !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
