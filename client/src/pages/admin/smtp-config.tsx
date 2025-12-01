import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Server, Key, Lock, Send, Loader2, Eye, EyeOff, Trash2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const smtpFormSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().min(1, "Port must be a positive number").max(65535, "Port must be less than 65536"),
  user: z.string().email("Valid email is required"),
  pass: z.string().min(1, "Password is required"),
  from: z.string().min(1, "From address is required"),
  secure: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

type SmtpFormValues = z.infer<typeof smtpFormSchema>;

export default function SmtpConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpFormSchema),
    defaultValues: {
      host: "",
      port: 587,
      user: "",
      pass: "",
      from: "",
      secure: false,
      enabled: true,
    },
  });

  const { data: smtpData, isLoading } = useQuery({
    queryKey: ["/api/admin/smtp-config"],
  });

  useEffect(() => {
    if (smtpData?.config) {
      form.reset({
        host: smtpData.config.host || "",
        port: smtpData.config.port || 587,
        user: smtpData.config.user || "",
        pass: "", // Don't populate password from masked value
        from: smtpData.config.from || "",
        secure: smtpData.config.secure || false,
        enabled: smtpData.config.enabled ?? true,
      });
    }
  }, [smtpData, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: SmtpFormValues) => {
      const response = await apiRequest("POST", "/api/admin/smtp-config", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "SMTP configuration has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/smtp-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMTP configuration.",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/admin/smtp-config/test", { testEmail: email });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Successful",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/smtp-config");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Deleted",
        description: "SMTP configuration has been deleted.",
      });
      form.reset({
        host: "",
        port: 587,
        user: "",
        pass: "",
        from: "",
        secure: false,
        enabled: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/smtp-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete SMTP configuration.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SmtpFormValues) => {
    // If password field is empty and config exists, keep the existing password
    if (!data.pass && smtpData?.configured) {
      toast({
        title: "Password Required",
        description: "Please enter the SMTP password to update the configuration.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a test email address.",
        variant: "destructive",
      });
      return;
    }
    testMutation.mutate(testEmail);
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You need administrator privileges to access this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">SMTP Configuration</h1>
        <p className="text-muted-foreground">
          Configure email sending via SMTP server (Gmail, custom mail server, etc.)
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>SMTP Server Settings</CardTitle>
                  <CardDescription>Configure your SMTP server connection details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="smtp.gmail.com" 
                              {...field} 
                              data-testid="input-smtp-host"
                            />
                          </FormControl>
                          <FormDescription>SMTP server hostname</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <Select
                            value={field.value?.toString()}
                            onValueChange={(val) => field.onChange(parseInt(val))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-smtp-port">
                                <SelectValue placeholder="Select port" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="587">587 (TLS - Recommended)</SelectItem>
                              <SelectItem value="465">465 (SSL)</SelectItem>
                              <SelectItem value="25">25 (Plain - Not recommended)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>SMTP server port</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username / Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              placeholder="your-email@gmail.com" 
                              {...field} 
                              data-testid="input-smtp-user"
                            />
                          </FormControl>
                          <FormDescription>SMTP authentication username</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password / App Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"}
                                placeholder={smtpData?.configured ? "Enter new password to update" : "Enter password"}
                                {...field} 
                                data-testid="input-smtp-pass"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            For Gmail, use App Password (16 characters)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="M-CRM <your-email@gmail.com>" 
                            {...field} 
                            data-testid="input-smtp-from"
                          />
                        </FormControl>
                        <FormDescription>
                          Sender name and email (e.g., "M-CRM &lt;noreply@company.com&gt;")
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="flex flex-wrap items-center gap-6">
                    <FormField
                      control={form.control}
                      name="secure"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-smtp-secure"
                            />
                          </FormControl>
                          <div>
                            <FormLabel className="mb-0">Use SSL</FormLabel>
                            <FormDescription className="text-xs">
                              Enable for port 465
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-smtp-enabled"
                            />
                          </FormControl>
                          <div>
                            <FormLabel className="mb-0">Enable SMTP</FormLabel>
                            <FormDescription className="text-xs">
                              Use SMTP for emails
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button 
                      type="submit" 
                      disabled={saveMutation.isPending}
                      data-testid="button-save-config"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Save Configuration
                    </Button>

                    {smtpData?.configured && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            type="button" 
                            variant="destructive"
                            data-testid="button-delete-config"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Configuration
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete SMTP Configuration?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove all SMTP settings. The application will fall back to Resend API for email delivery.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {smtpData?.configured && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Send className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Test Configuration</CardTitle>
                    <CardDescription>Send a test email to verify your SMTP settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                    data-testid="input-test-email"
                  />
                  <Button
                    onClick={handleTestEmail}
                    disabled={testMutation.isPending || !testEmail}
                    data-testid="button-send-test"
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Test Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {smtpData?.configured ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>SMTP Configured</AlertTitle>
                  <AlertDescription>
                    Emails will be sent via your SMTP server.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle>Not Configured</AlertTitle>
                  <AlertDescription>
                    Using Resend API as fallback for email delivery.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Gmail App Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To use Gmail SMTP, you need to create an App Password:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Enable 2-Factor Authentication on your Google account</li>
                <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary underline">App Passwords</a></li>
                <li>Select "Mail" as the app</li>
                <li>Copy the 16-character password</li>
              </ol>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Gmail SMTP Settings:</p>
                <div className="text-xs text-muted-foreground space-y-1 font-mono bg-muted p-3 rounded-md">
                  <p>Host: smtp.gmail.com</p>
                  <p>Port: 587 (TLS) or 465 (SSL)</p>
                  <p>Secure: Off for 587, On for 465</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-500" />
                Security Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your SMTP password is stored securely in the database. For maximum security, consider using environment variables on your production server.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
