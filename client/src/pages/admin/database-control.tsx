import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Database, Trash2, AlertTriangle, Users, ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";

const TRANSACTION_TABLES = [
  { name: "leads", label: "Leads", description: "Sales leads and opportunities" },
  { name: "projects", label: "Projects", description: "Implementation projects" },
  { name: "project_modules", label: "Project Modules", description: "Project module assignments" },
  { name: "project_engineers", label: "Project Engineers", description: "Engineer assignments to projects" },
  { name: "project_handoffs", label: "Project Handoffs", description: "Project completion handoffs" },
  { name: "project_progress", label: "Project Progress", description: "Project progress entries" },
  { name: "training_sessions", label: "Training Sessions", description: "Scheduled training sessions" },
  { name: "training_records", label: "Training Records", description: "Completed training records" },
  { name: "tickets", label: "Support Tickets", description: "Customer support tickets" },
  { name: "ticket_messages", label: "Ticket Messages", description: "Ticket conversation messages" },
  { name: "tasks", label: "Tasks", description: "Task management entries" },
  { name: "follow_ups", label: "Follow-ups", description: "Follow-up records" },
  { name: "quotes", label: "Quotes", description: "Sales quotes" },
  { name: "activities", label: "Activity Logs", description: "System activity logs" },
  { name: "point_transactions", label: "Point Transactions", description: "Gamification point transactions" },
];

const MASTER_TABLES = [
  { name: "customers", label: "Customers", description: "Customer master data" },
  { name: "modules", label: "Modules", description: "Implementation modules" },
  { name: "departments", label: "Departments", description: "Department master" },
  { name: "user_roles", label: "User Roles", description: "Role definitions" },
  { name: "user_role_rights", label: "User Rights", description: "Role permissions" },
  { name: "point_categories", label: "Point Categories", description: "Gamification categories" },
  { name: "knowledge_base_documents", label: "Knowledge Base", description: "KB documents" },
];

export default function DatabaseControl() {
  const { toast } = useToast();
  const [confirmationType, setConfirmationType] = useState<"transaction" | "master" | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  const truncateTransactionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/truncate-transactions");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ 
        title: "Transaction Data Cleared", 
        description: "All transaction tables have been truncated successfully.",
      });
      setConfirmationType(null);
      setConfirmationText("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to truncate", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const truncateMasterMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/truncate-masters");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ 
        title: "Master Data Cleared", 
        description: "All master tables have been truncated successfully.",
      });
      setConfirmationType(null);
      setConfirmationText("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to truncate", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleConfirm = () => {
    if (confirmationType === "transaction") {
      truncateTransactionMutation.mutate();
    } else if (confirmationType === "master") {
      truncateMasterMutation.mutate();
    }
  };

  const isPending = truncateTransactionMutation.isPending || truncateMasterMutation.isPending;
  const isConfirmationValid = confirmationText === "CONFIRM DELETE";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Database Control</h1>
          <p className="text-muted-foreground">Manage and truncate database tables</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction Data Card */}
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Transaction Data</CardTitle>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                {TRANSACTION_TABLES.length} Tables
              </Badge>
            </div>
            <CardDescription>
              Leads, projects, tickets, tasks, and other operational data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              {TRANSACTION_TABLES.map((table) => (
                <div 
                  key={table.name} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{table.label}</p>
                    <p className="text-xs text-muted-foreground">{table.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {table.name}
                  </Badge>
                </div>
              ))}
            </div>
            <Separator />
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmationType("transaction")}
              disabled={isPending}
              data-testid="button-truncate-transactions"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Truncate All Transaction Data
            </Button>
          </CardContent>
        </Card>

        {/* Master Data Card */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Master Data</CardTitle>
              </div>
              <Badge variant="outline" className="text-red-600 border-red-300">
                {MASTER_TABLES.length} Tables
              </Badge>
            </div>
            <CardDescription>
              Customers, modules, departments, roles, and configuration data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              {MASTER_TABLES.map((table) => (
                <div 
                  key={table.name} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{table.label}</p>
                    <p className="text-xs text-muted-foreground">{table.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {table.name}
                  </Badge>
                </div>
              ))}
            </div>
            <Separator />
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-400">
                  <strong>Warning:</strong> Truncating master data will also clear related transaction data due to foreign key relationships.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={() => setConfirmationType("master")}
              disabled={isPending}
              data-testid="button-truncate-masters"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Truncate All Master Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmationType !== null} onOpenChange={() => {
        if (!isPending) {
          setConfirmationType(null);
          setConfirmationText("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {confirmationType === "transaction" 
                ? "Truncate Transaction Data?" 
                : "Truncate Master Data?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {confirmationType === "transaction" 
                    ? `This will permanently delete ALL data from ${TRANSACTION_TABLES.length} transaction tables including leads, projects, tickets, tasks, and activity logs.`
                    : `This will permanently delete ALL data from ${MASTER_TABLES.length} master tables including customers, modules, departments, and roles. This will also cascade delete related transaction data.`}
                </p>
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <p className="text-sm font-semibold text-destructive mb-2">
                    This action cannot be undone!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Type <strong className="text-foreground">CONFIRM DELETE</strong> to proceed:
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmation">Confirmation</Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Type CONFIRM DELETE"
                    className="font-mono"
                    data-testid="input-confirmation"
                    disabled={isPending}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!isConfirmationValid || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-truncate"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Data
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
