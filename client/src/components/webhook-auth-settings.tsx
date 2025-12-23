import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Eye, EyeOff, Copy, Check, Link2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface WebhookAuthSettings {
  enabled: boolean;
  username: string;
  hasPassword: boolean;
}

interface WebhookAuthSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WEBHOOK_ENDPOINTS = [
  { name: "Facebook Lead Ads", path: "/api/webhooks/facebook" },
  { name: "LinkedIn Lead Gen", path: "/api/webhooks/linkedin" },
  { name: "Instagram Lead Ads", path: "/api/webhooks/instagram" },
  { name: "Twitter/X", path: "/api/webhooks/twitter" },
  { name: "Google Ads", path: "/api/webhooks/google" },
  { name: "YouTube", path: "/api/webhooks/youtube" },
  { name: "TikTok", path: "/api/webhooks/tiktok" },
  { name: "Pinterest", path: "/api/webhooks/pinterest" },
  { name: "Snapchat", path: "/api/webhooks/snapchat" },
  { name: "WhatsApp Business", path: "/api/webhooks/whatsapp" },
  { name: "Microsoft/Bing Ads", path: "/api/webhooks/microsoft" },
  { name: "Website Forms", path: "/api/webhooks/website" },
];

export function WebhookAuthSettingsDialog({ open, onOpenChange }: WebhookAuthSettingsDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<WebhookAuthSettings>({
    queryKey: ["/api/settings/webhook-auth"],
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setUsername(settings.username || "");
      setPassword("");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/webhook-auth", {
        enabled,
        username,
        password: password || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/webhook-auth"] });
      toast({
        title: "Settings Saved",
        description: "Webhook authentication settings have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (enabled && (!username || (!settings?.hasPassword && !password))) {
      toast({
        title: "Validation Error",
        description: "Username and password are required when enabling authentication",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const getWebhookUrl = (path: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}${path}`;
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Webhook Authentication Settings
          </DialogTitle>
          <DialogDescription>
            Configure authentication for external platforms sending leads via webhooks
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Basic Authentication
                </CardTitle>
                <CardDescription>
                  Enable username/password protection for webhook endpoints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="webhook-auth-enabled" className="flex-1">
                    Enable Webhook Authentication
                  </Label>
                  <Switch
                    id="webhook-auth-enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    data-testid="switch-webhook-auth"
                  />
                </div>

                {enabled && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="webhook-username">Username</Label>
                        <Input
                          id="webhook-username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter webhook username"
                          data-testid="input-webhook-username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webhook-password">
                          Password {settings?.hasPassword && "(leave empty to keep current)"}
                        </Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="webhook-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={settings?.hasPassword ? "••••••••" : "Enter webhook password"}
                              data-testid="input-webhook-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        When configuring external platforms, use HTTP Basic Authentication with these credentials.
                        The Authorization header format is: <code className="text-xs bg-muted px-1 py-0.5 rounded">Basic base64(username:password)</code>
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Webhook Endpoints
                </CardTitle>
                <CardDescription>
                  Use these URLs to configure lead capture from external platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {WEBHOOK_ENDPOINTS.map((endpoint) => (
                    <div
                      key={endpoint.path}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover-elevate"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          POST
                        </Badge>
                        <span className="text-sm font-medium">{endpoint.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground hidden sm:block max-w-[200px] truncate">
                          {getWebhookUrl(endpoint.path)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(getWebhookUrl(endpoint.path))}
                          data-testid={`button-copy-${endpoint.path.split('/').pop()}`}
                        >
                          {copiedUrl === getWebhookUrl(endpoint.path) ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-webhook-settings"
          >
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
