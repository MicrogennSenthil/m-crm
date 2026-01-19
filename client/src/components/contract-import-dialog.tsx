import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle, Download, FileSpreadsheet } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ContractType } from "@shared/schema";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  created: { customerId: string; contractId: string; clientName: string }[];
}

interface ContractImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  serialNo: string;
  clientName: string;
  mobileNo: string;
  module: string;
  contractType: string;
}

export function ContractImportDialog({ open, onOpenChange }: ContractImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: contractTypes = [] } = useQuery<ContractType[]>({
    queryKey: ["/api/contract-types"],
  });

  const importMutation = useMutation({
    mutationFn: async (clients: ParsedRow[]) => {
      const response = await apiRequest("POST", "/api/customer-contracts/bulk-import", { clients });
      return await response.json() as ImportResult;
    },
    onSuccess: (data: ImportResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/customer-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      if (data.success > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.success} client(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import clients",
        variant: "destructive",
      });
    },
  });

  const normalizeColumnName = (col: string): string => {
    const normalized = col.toLowerCase().trim().replace(/[.\s]+/g, "_");
    
    if (normalized.includes("s_no") || normalized.includes("sno") || normalized === "s.no" || normalized === "serial") {
      return "serialNo";
    }
    if (normalized.includes("client") || normalized.includes("name") || normalized === "customer") {
      return "clientName";
    }
    if (normalized.includes("mob") || normalized.includes("phone") || normalized.includes("mobile") || normalized.includes("contact")) {
      return "mobileNo";
    }
    if (normalized.includes("module")) {
      return "module";
    }
    if (normalized.includes("contract") || normalized.includes("type")) {
      return "contractType";
    }
    return normalized;
  };

  const parseRawData = (rawData: Record<string, string>[]): ParsedRow[] => {
    return rawData.map((row) => {
      const normalizedRow: ParsedRow = {
        serialNo: "",
        clientName: "",
        mobileNo: "",
        module: "",
        contractType: "",
      };
      
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = normalizeColumnName(key);
        if (normalizedKey in normalizedRow) {
          (normalizedRow as any)[normalizedKey] = value?.toString().trim() || "";
        }
      });
      
      return normalizedRow;
    }).filter(row => row.clientName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setResult(null);
    
    const fileName = selectedFile.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
          
          const parsedData = parseRawData(rawData);
          
          if (parsedData.length === 0) {
            toast({
              title: "No Valid Data",
              description: "No valid client data found in the file. Make sure you have a CLIENT NAME column.",
              variant: "destructive",
            });
          }
          
          setPreviewData(parsedData);
        } catch (error) {
          toast({
            title: "File Error",
            description: "Failed to parse Excel file. Please check the file format.",
            variant: "destructive",
          });
        }
      };
      reader.onerror = () => {
        toast({
          title: "File Error",
          description: "Failed to read the file",
          variant: "destructive",
        });
      };
      reader.readAsBinaryString(selectedFile);
    } else {
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
          
          const rawData = results.data as Record<string, string>[];
          const parsedData = parseRawData(rawData);
          
          if (parsedData.length === 0) {
            toast({
              title: "No Valid Data",
              description: "No valid client data found in the file. Make sure you have a CLIENT NAME column.",
              variant: "destructive",
            });
          }
          
          setPreviewData(parsedData);
        },
        error: (error) => {
          toast({
            title: "File Error",
            description: error.message || "Failed to parse file",
            variant: "destructive",
          });
        }
      });
    }
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
    const template = `S.NO,CLIENT NAME,MOB.NO,Module,Contract Type
1,"ABC Hospital","+91-9876543210","HMS","AMC"
2,"XYZ Clinic","+91-9876543211","POS","Subscription"
3,"City Medical","+91-9876543212","CRM","Warranty"`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Clients
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to bulk import clients with contracts
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!result && (
            <>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="import-file" className="mb-2 block">
                    CSV / Excel File
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="import-file"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      data-testid="input-import-file"
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
                <AlertTitle>Required Columns</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">Your file should include these columns:</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">S.NO</Badge>
                    <Badge variant="secondary">CLIENT NAME</Badge>
                    <Badge variant="secondary">MOB.NO</Badge>
                    <Badge variant="secondary">Module</Badge>
                    <Badge variant="secondary">Contract Type</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available contract types: {contractTypes.map(ct => ct.displayName).join(", ") || "Loading..."}
                  </p>
                </AlertDescription>
              </Alert>

              {previewData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Preview ({previewData.length} rows)</h4>
                    <Badge variant="outline">{file?.name}</Badge>
                  </div>
                  <ScrollArea className="h-64 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">S.NO</TableHead>
                          <TableHead>Client Name</TableHead>
                          <TableHead>Mobile No</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Contract Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 10).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-muted-foreground">{row.serialNo || idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.clientName}</TableCell>
                            <TableCell>{row.mobileNo}</TableCell>
                            <TableCell>{row.module}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.contractType}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {previewData.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              ... and {previewData.length - 10} more rows
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {result.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>{result.success} imported</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span>{result.failed} failed</span>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import Errors</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-32 mt-2">
                      <ul className="list-disc list-inside space-y-1">
                        {result.errors.map((error, idx) => (
                          <li key={idx} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {result.created.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Successfully Created</h4>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    <ul className="space-y-1">
                      {result.created.map((item, idx) => (
                        <li key={idx} className="text-sm flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {item.clientName}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} data-testid="button-close-import">
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && previewData.length > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={importMutation.isPending}
              data-testid="button-import-clients"
            >
              {importMutation.isPending ? (
                <>
                  <Progress value={50} className="w-16 h-2 mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {previewData.length} Clients
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
