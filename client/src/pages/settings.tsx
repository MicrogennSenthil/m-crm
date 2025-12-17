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
import { Copy, ExternalLink, Globe, CheckCircle2, MessageCircle, Monitor, Lock, Eye, EyeOff, Loader2, Key, Camera, Pencil, Save, X } from "lucide-react";
import { SiFacebook, SiLinkedin, SiInstagram, SiX, SiGoogle, SiYoutube, SiTiktok, SiPinterest, SiSnapchat, SiWhatsapp } from "react-icons/si";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SelfieCaptureDialog } from "@/components/selfie-capture";

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
        <div className="space-y-2">
          <Label className="text-sm font-medium">Verify Token</Label>
          <div className="p-3 rounded-md bg-muted border">
            <p className="text-xs text-muted-foreground mb-2">
              Set this environment variable on your server:
            </p>
            <code className="font-mono text-xs bg-background px-2 py-1 rounded">
              {verifyToken}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Configure this token in your platform's webhook settings. The server will validate incoming webhooks against this secret.
            </p>
          </div>
        </div>
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

function PasswordChangeCard({ user }: { user: any }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "New password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation do not match",
        variant: "destructive",
      });
      return;
    }
    
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const hasLocalAuth = user?.authProvider === "local" || user?.passwordHash;
  
  if (!hasLocalAuth) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">External Authentication</p>
              <p className="text-xs text-muted-foreground">
                Your account uses external authentication (e.g., Replit Auth). Password management is handled by your authentication provider.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Key className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10 pr-10"
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-current-password"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-new-password"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            disabled={changePasswordMutation.isPending}
            data-testid="button-change-password"
          >
            {changePasswordMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing Password...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [baseUrl, setBaseUrl] = useState("");
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string }) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSelfieCapture = async (blob: Blob) => {
    setIsUploadingImage(true);
    try {
      // Get signed upload URL from backend
      const uploadUrlResponse = await apiRequest("POST", "/api/profile/upload-image", { fileName: "profile.jpg" });
      const { uploadURL, objectPath } = await uploadUrlResponse.json();
      
      // Upload the image to object storage
      const uploadResult = await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "image/jpeg",
        },
      });
      
      if (!uploadResult.ok) {
        throw new Error("Failed to upload image to storage");
      }
      
      // Save the image path to user profile
      await apiRequest("PUT", "/api/profile/image", { objectPath });
      
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been updated successfully.",
      });
      
      setShowSelfieCapture(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveProfile = () => {
    if (!firstName.trim()) {
      toast({
        title: "Validation Error",
        description: "First name is required.",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  const handleCancelEdit = () => {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setIsEditingProfile(false);
  };

  const getProfileImageUrl = () => {
    if (!user?.profileImageUrl) return undefined;
    if (user.profileImageUrl.startsWith("/objects/")) {
      return user.profileImageUrl;
    }
    return user.profileImageUrl;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold mb-1">Settings</h1>
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">Profile</CardTitle>
                  <CardDescription>Your account information</CardDescription>
                </div>
                {!isEditingProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    data-testid="button-edit-profile"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20">
                    <AvatarImage src={getProfileImageUrl()} />
                    <AvatarFallback className="text-xl sm:text-2xl bg-primary/10 text-primary">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
                    onClick={() => setShowSelfieCapture(true)}
                    data-testid="button-take-selfie"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                
                {isEditingProfile ? (
                  <div className="flex-1 space-y-3 w-full sm:w-auto">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter first name"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter last name"
                        data-testid="input-last-name"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-cancel-edit"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center sm:text-left">
                    <h3 className="text-base sm:text-lg font-semibold">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
                    <Badge variant="secondary" className="mt-2 capitalize">
                      {user?.role?.replace("_", " ")}
                    </Badge>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="text-sm text-muted-foreground">
                <p>Click the camera icon on your profile picture to take a new selfie.</p>
              </div>
            </CardContent>
          </Card>

          <SelfieCaptureDialog
            open={showSelfieCapture}
            onOpenChange={setShowSelfieCapture}
            onCapture={handleSelfieCapture}
            isUploading={isUploadingImage}
          />

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

          <PasswordChangeCard user={user} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                Social Media & Advertising Lead Integrations
              </CardTitle>
              <CardDescription>
                Connect your advertising platforms to automatically capture leads from Google, Facebook, LinkedIn, YouTube, TikTok, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Tabs defaultValue="google" className="space-y-4">
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="inline-flex w-max">
                    <TabsTrigger value="google" className="gap-1" data-testid="tab-google">
                      <SiGoogle className="h-4 w-4" />
                      <span className="hidden sm:inline">Google</span>
                    </TabsTrigger>
                    <TabsTrigger value="youtube" className="gap-1" data-testid="tab-youtube">
                      <SiYoutube className="h-4 w-4" />
                      <span className="hidden sm:inline">YouTube</span>
                    </TabsTrigger>
                    <TabsTrigger value="facebook" className="gap-1" data-testid="tab-facebook">
                      <SiFacebook className="h-4 w-4" />
                      <span className="hidden sm:inline">Facebook</span>
                    </TabsTrigger>
                    <TabsTrigger value="instagram" className="gap-1" data-testid="tab-instagram">
                      <SiInstagram className="h-4 w-4" />
                      <span className="hidden sm:inline">Instagram</span>
                    </TabsTrigger>
                    <TabsTrigger value="linkedin" className="gap-1" data-testid="tab-linkedin">
                      <SiLinkedin className="h-4 w-4" />
                      <span className="hidden sm:inline">LinkedIn</span>
                    </TabsTrigger>
                    <TabsTrigger value="twitter" className="gap-1" data-testid="tab-twitter">
                      <SiX className="h-4 w-4" />
                      <span className="hidden sm:inline">X/Twitter</span>
                    </TabsTrigger>
                    <TabsTrigger value="tiktok" className="gap-1" data-testid="tab-tiktok">
                      <SiTiktok className="h-4 w-4" />
                      <span className="hidden sm:inline">TikTok</span>
                    </TabsTrigger>
                    <TabsTrigger value="pinterest" className="gap-1" data-testid="tab-pinterest">
                      <SiPinterest className="h-4 w-4" />
                      <span className="hidden sm:inline">Pinterest</span>
                    </TabsTrigger>
                    <TabsTrigger value="snapchat" className="gap-1" data-testid="tab-snapchat">
                      <SiSnapchat className="h-4 w-4" />
                      <span className="hidden sm:inline">Snapchat</span>
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="gap-1" data-testid="tab-whatsapp">
                      <SiWhatsapp className="h-4 w-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </TabsTrigger>
                    <TabsTrigger value="microsoft" className="gap-1" data-testid="tab-microsoft">
                      <Monitor className="h-4 w-4" />
                      <span className="hidden sm:inline">Bing</span>
                    </TabsTrigger>
                    <TabsTrigger value="website" className="gap-1" data-testid="tab-website">
                      <Globe className="h-4 w-4" />
                      <span className="hidden sm:inline">Website</span>
                    </TabsTrigger>
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <TabsContent value="google" className="mt-4">
                  <IntegrationCard
                    icon={SiGoogle}
                    title="Google Ads Lead Forms"
                    description="Capture leads from Google Search and Display Lead Form Extensions"
                    webhookUrl={`${baseUrl}/api/webhooks/google`}
                    steps={[
                      "Sign into Google Ads and go to Campaigns > Ads & Assets > Extensions",
                      "Select your Lead Form Extension",
                      "Under 'Lead Delivery Option', expand 'Manage your leads with a webhook'",
                      "Enter the Webhook URL and a verification key",
                      "Click 'Send test data' to verify the connection",
                      "Save and add the extension to your campaign"
                    ]}
                    docsUrl="https://developers.google.com/google-ads/webhook/docs/implementation"
                  />
                </TabsContent>

                <TabsContent value="youtube" className="mt-4">
                  <IntegrationCard
                    icon={SiYoutube}
                    title="YouTube Lead Forms"
                    description="Capture leads from YouTube video ad campaigns via Google Ads"
                    webhookUrl={`${baseUrl}/api/webhooks/youtube`}
                    steps={[
                      "YouTube Lead Forms are managed through Google Ads",
                      "Create a Video campaign in Google Ads with Lead Form extension",
                      "Configure the Lead Form Extension with webhook delivery",
                      "Enter the Webhook URL shown above",
                      "Test the integration before launching your campaign"
                    ]}
                    docsUrl="https://support.google.com/google-ads/answer/9423234"
                  />
                </TabsContent>

                <TabsContent value="facebook" className="mt-4">
                  <IntegrationCard
                    icon={SiFacebook}
                    title="Facebook Lead Ads"
                    description="Automatically capture leads from your Facebook Lead Ad campaigns"
                    webhookUrl={`${baseUrl}/api/webhooks/facebook`}
                    verifyToken="FB_WEBHOOK_VERIFY_TOKEN"
                    steps={[
                      "Go to Facebook Business Suite > All Tools > Events Manager",
                      "Select your Facebook Page and go to 'Subscriptions'",
                      "Click 'Add Webhook' under the Leadgen section",
                      "Paste the Webhook URL shown above",
                      "Set the verify token in your server environment variables",
                      "Click 'Verify and Save' to complete the setup",
                      "Test by submitting a lead through your Facebook Lead Ad"
                    ]}
                    docsUrl="https://developers.facebook.com/docs/marketing-api/guides/lead-ads/quickstart/"
                  />
                </TabsContent>

                <TabsContent value="instagram" className="mt-4">
                  <IntegrationCard
                    icon={SiInstagram}
                    title="Instagram Lead Ads"
                    description="Capture leads from Instagram Lead Ad campaigns (via Facebook Business)"
                    webhookUrl={`${baseUrl}/api/webhooks/instagram`}
                    verifyToken="FB_WEBHOOK_VERIFY_TOKEN"
                    steps={[
                      "Instagram Lead Ads are managed through Facebook Business Suite",
                      "Go to Facebook Events Manager and select your Instagram Business Account",
                      "Under 'Subscriptions', add a webhook for Leadgen",
                      "Paste the Webhook URL shown above",
                      "Use the same FB_WEBHOOK_VERIFY_TOKEN as Facebook (shared Meta API)",
                      "Verify and save the webhook subscription",
                      "Create Lead Ads in Instagram through Facebook Ads Manager"
                    ]}
                    docsUrl="https://www.facebook.com/business/help/1462876307360828"
                  />
                </TabsContent>

                <TabsContent value="linkedin" className="mt-4">
                  <IntegrationCard
                    icon={SiLinkedin}
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

                <TabsContent value="twitter" className="mt-4">
                  <IntegrationCard
                    icon={SiX}
                    title="X (Twitter) Lead Generation"
                    description="Capture leads from X/Twitter Lead Generation Cards and ads"
                    webhookUrl={`${baseUrl}/api/webhooks/twitter`}
                    steps={[
                      "Go to X Ads Manager (ads.twitter.com)",
                      "Create or select a Lead Generation Card campaign",
                      "Navigate to your Lead Gen Card settings",
                      "Configure webhook integration with the URL shown above",
                      "Map the form fields and save the settings"
                    ]}
                    docsUrl="https://developer.twitter.com/en/docs/twitter-ads-api/creatives/api-reference/cards"
                  />
                </TabsContent>

                <TabsContent value="tiktok" className="mt-4">
                  <IntegrationCard
                    icon={SiTiktok}
                    title="TikTok Lead Generation"
                    description="Capture leads from TikTok In-Feed and TopView Lead Ads"
                    webhookUrl={`${baseUrl}/api/webhooks/tiktok`}
                    steps={[
                      "Go to TikTok Ads Manager",
                      "Navigate to Assets > Instant Forms",
                      "Create or select your Lead Form",
                      "Under CRM Integration, choose 'Webhook'",
                      "Paste the Webhook URL shown above",
                      "Test the connection and save"
                    ]}
                    docsUrl="https://ads.tiktok.com/help/article/lead-generation"
                  />
                </TabsContent>

                <TabsContent value="pinterest" className="mt-4">
                  <IntegrationCard
                    icon={SiPinterest}
                    title="Pinterest Lead Ads"
                    description="Capture leads from Pinterest Lead Generation campaigns"
                    webhookUrl={`${baseUrl}/api/webhooks/pinterest`}
                    steps={[
                      "Go to Pinterest Business Hub",
                      "Navigate to Ads > Conversions",
                      "Set up Lead Ads conversion tracking",
                      "Configure webhook delivery with the URL shown above",
                      "Test the integration before launching"
                    ]}
                    docsUrl="https://help.pinterest.com/en/business/article/lead-ads"
                  />
                </TabsContent>

                <TabsContent value="snapchat" className="mt-4">
                  <IntegrationCard
                    icon={SiSnapchat}
                    title="Snapchat Lead Ads"
                    description="Capture leads from Snapchat Lead Generation ads"
                    webhookUrl={`${baseUrl}/api/webhooks/snapchat`}
                    steps={[
                      "Go to Snapchat Ads Manager",
                      "Navigate to Lead Forms under Creative Assets",
                      "Create or edit your Lead Form",
                      "Under CRM Integration, select 'Webhook'",
                      "Enter the Webhook URL shown above",
                      "Save and attach to your campaign"
                    ]}
                    docsUrl="https://businesshelp.snapchat.com/s/article/lead-gen-forms"
                  />
                </TabsContent>

                <TabsContent value="whatsapp" className="mt-4">
                  <IntegrationCard
                    icon={SiWhatsapp}
                    title="WhatsApp Business"
                    description="Capture leads from WhatsApp Click-to-Message ads and inquiries"
                    webhookUrl={`${baseUrl}/api/webhooks/whatsapp`}
                    verifyToken="WA_WEBHOOK_VERIFY_TOKEN"
                    steps={[
                      "WhatsApp webhooks are configured through Facebook Business API",
                      "Go to Meta for Developers and select your WhatsApp Business App",
                      "Navigate to WhatsApp > Configuration > Webhooks",
                      "Enter the Webhook URL shown above",
                      "Set the verify token in your server environment variables",
                      "Subscribe to 'messages' webhook field",
                      "Incoming messages will create leads automatically"
                    ]}
                    docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/set-up"
                  />
                </TabsContent>

                <TabsContent value="microsoft" className="mt-4">
                  <IntegrationCard
                    icon={Monitor}
                    title="Microsoft/Bing Ads"
                    description="Capture leads from Microsoft Advertising Lead Form Extensions"
                    webhookUrl={`${baseUrl}/api/webhooks/microsoft`}
                    steps={[
                      "Sign into Microsoft Advertising",
                      "Go to All Campaigns > Ad Extensions > Lead Form Extensions",
                      "Create or edit a Lead Form Extension",
                      "Under 'Lead delivery', choose 'Webhook'",
                      "Enter the Webhook URL shown above",
                      "Save and associate with your campaigns"
                    ]}
                    docsUrl="https://help.ads.microsoft.com/apex/index/3/en/60038"
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
              <CardDescription>All platforms are ready to receive leads</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  { icon: SiGoogle, name: "Google Ads", color: "text-blue-500" },
                  { icon: SiYoutube, name: "YouTube", color: "text-red-600" },
                  { icon: SiFacebook, name: "Facebook", color: "text-blue-600" },
                  { icon: SiInstagram, name: "Instagram", color: "text-pink-600" },
                  { icon: SiLinkedin, name: "LinkedIn", color: "text-blue-700" },
                  { icon: SiX, name: "X/Twitter", color: "text-foreground" },
                  { icon: SiTiktok, name: "TikTok", color: "text-foreground" },
                  { icon: SiPinterest, name: "Pinterest", color: "text-red-700" },
                  { icon: SiSnapchat, name: "Snapchat", color: "text-yellow-400" },
                  { icon: SiWhatsapp, name: "WhatsApp", color: "text-green-500" },
                  { icon: Monitor, name: "Bing Ads", color: "text-cyan-600" },
                  { icon: Globe, name: "Website", color: "text-green-600" },
                ].map((platform) => (
                  <div key={platform.name} className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border">
                    <platform.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${platform.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{platform.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Ready</p>
                    </div>
                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
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
