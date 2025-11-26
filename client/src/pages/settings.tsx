import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Facebook, Linkedin, Instagram, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

function WebhookUrlField({ label, url, description }: { label: string; url: string; description?: string }) {
  const { toast } = useToast();
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input 
          value={url} 
          readOnly 
          className="font-mono text-xs sm:text-sm bg-muted"
          data-testid={`input-webhook-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
        <Button 
          size="icon" 
          variant="outline" 
          onClick={copyToClipboard}
          data-testid={`button-copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function IntegrationCard({ 
  icon: Icon, 
  title, 
  description, 
  webhookUrl, 
  verifyToken,
  steps,
  docsUrl 
}: { 
  icon: any;
  title: string;
  description: string;
  webhookUrl: string;
  verifyToken?: string;
  steps: string[];
  docsUrl?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      
      <WebhookUrlField 
        label="Webhook URL" 
        url={webhookUrl}
        description="Use this URL in your platform's webhook configuration"
      />
      
      {verifyToken && (
        <WebhookUrlField 
          label="Verify Token" 
          url={verifyToken}
          description="Required for Facebook/Instagram webhook verification"
        />
      )}

      <Separator />
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">Setup Instructions</Label>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>
      
      {docsUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={docsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Documentation
          </a>
        </Button>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [baseUrl, setBaseUrl] = useState("");
  const verifyToken = "microgenn_crm_webhook";
  
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, preferences, and integrations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile & Preferences</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Lead Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <h3 className="text-base sm:text-lg font-semibold">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
                  <Badge variant="secondary" className="mt-2 capitalize">
                    {user?.role?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Appearance</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="theme" className="text-sm sm:text-base">Theme</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Switch between light and dark mode
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
              <CardDescription>Manage notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Email notifications for escalated tickets, new assignments, and feedback requests will be sent to <strong className="break-all">{user?.email}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                Social Media Lead Integrations
              </CardTitle>
              <CardDescription>
                Connect your social media accounts to automatically capture leads from Facebook, LinkedIn, and Instagram ads
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Tabs defaultValue="facebook" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                  <TabsTrigger value="facebook" className="gap-1" data-testid="tab-facebook">
                    <Facebook className="h-4 w-4" />
                    <span className="hidden sm:inline">Facebook</span>
                  </TabsTrigger>
                  <TabsTrigger value="linkedin" className="gap-1" data-testid="tab-linkedin">
                    <Linkedin className="h-4 w-4" />
                    <span className="hidden sm:inline">LinkedIn</span>
                  </TabsTrigger>
                  <TabsTrigger value="instagram" className="gap-1" data-testid="tab-instagram">
                    <Instagram className="h-4 w-4" />
                    <span className="hidden sm:inline">Instagram</span>
                  </TabsTrigger>
                  <TabsTrigger value="website" className="gap-1" data-testid="tab-website">
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Website</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="facebook" className="mt-4">
                  <IntegrationCard
                    icon={Facebook}
                    title="Facebook Lead Ads"
                    description="Automatically capture leads from your Facebook Lead Ad campaigns"
                    webhookUrl={`${baseUrl}/api/webhooks/facebook`}
                    verifyToken={verifyToken}
                    steps={[
                      "Go to Facebook Business Suite > All Tools > Events Manager",
                      "Select your Facebook Page and go to 'Subscriptions'",
                      "Click 'Add Webhook' under the Leadgen section",
                      "Paste the Webhook URL and Verify Token shown above",
                      "Click 'Verify and Save' to complete the setup",
                      "Test by submitting a lead through your Facebook Lead Ad"
                    ]}
                    docsUrl="https://developers.facebook.com/docs/marketing-api/guides/lead-ads/quickstart/"
                  />
                </TabsContent>

                <TabsContent value="linkedin" className="mt-4">
                  <IntegrationCard
                    icon={Linkedin}
                    title="LinkedIn Lead Gen Forms"
                    description="Capture leads from LinkedIn Lead Gen Form campaigns"
                    webhookUrl={`${baseUrl}/api/webhooks/linkedin`}
                    steps={[
                      "Go to LinkedIn Campaign Manager",
                      "Navigate to Account Assets > Lead Gen Forms",
                      "Select your Lead Gen Form and go to 'Integrations'",
                      "Choose 'Webhook' as integration type",
                      "Paste the Webhook URL shown above",
                      "Map the form fields and save the integration"
                    ]}
                    docsUrl="https://business.linkedin.com/marketing-solutions/cx/21/08/lead-gen-forms"
                  />
                </TabsContent>

                <TabsContent value="instagram" className="mt-4">
                  <IntegrationCard
                    icon={Instagram}
                    title="Instagram Lead Ads"
                    description="Capture leads from Instagram Lead Ad campaigns (via Facebook Business)"
                    webhookUrl={`${baseUrl}/api/webhooks/instagram`}
                    verifyToken={verifyToken}
                    steps={[
                      "Instagram Lead Ads are managed through Facebook Business Suite",
                      "Go to Facebook Events Manager and select your Instagram Business Account",
                      "Under 'Subscriptions', add a webhook for Leadgen",
                      "Paste the Webhook URL and Verify Token shown above",
                      "Verify and save the webhook subscription",
                      "Create Lead Ads in Instagram through Facebook Ads Manager"
                    ]}
                    docsUrl="https://www.facebook.com/business/help/1462876307360828"
                  />
                </TabsContent>

                <TabsContent value="website" className="mt-4">
                  <IntegrationCard
                    icon={Globe}
                    title="Website Forms"
                    description="Capture leads from your website contact or inquiry forms"
                    webhookUrl={`${baseUrl}/api/webhooks/website`}
                    steps={[
                      "Configure your website form to POST data to the Webhook URL",
                      "Send form data as JSON with fields: company, name, email, phone, notes",
                      "The webhook accepts both camelCase (companyName) and standard (company) field names",
                      "Test by submitting a form on your website"
                    ]}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Example Request</Label>
                    <pre className="p-3 rounded-lg bg-muted text-xs overflow-x-auto">
{`POST ${baseUrl}/api/webhooks/website
Content-Type: application/json

{
  "company": "Acme Corp",
  "name": "John Doe",
  "email": "john@acme.com",
  "phone": "+1234567890",
  "notes": "Interested in CRM demo"
}`}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Integration Status</CardTitle>
              <CardDescription>Recent lead captures from connected platforms</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: Facebook, name: "Facebook", color: "text-blue-600" },
                  { icon: Linkedin, name: "LinkedIn", color: "text-blue-700" },
                  { icon: Instagram, name: "Instagram", color: "text-pink-600" },
                  { icon: Globe, name: "Website", color: "text-green-600" },
                ].map((platform) => (
                  <div key={platform.name} className="flex items-center gap-3 p-3 rounded-lg border">
                    <platform.icon className={`h-5 w-5 ${platform.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{platform.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to receive leads</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
