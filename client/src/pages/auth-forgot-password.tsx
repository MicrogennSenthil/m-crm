import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import microgennLogo from "@assets/MG Logo_1764263883732.png";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

type ResetStep = "email" | "otp" | "password";

export default function AuthForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<ResetStep>("email");
  
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestOtpMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password/request-otp", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "OTP Sent",
        description: "If an account exists, you will receive a verification code",
      });
      setStep("otp");
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { email: string; otpCode: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password/reset", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset",
        description: "Your password has been successfully reset",
      });
      setLocation("/auth/login");
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    requestOtpMutation.mutate({ email });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }
    setStep("password");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ email, otpCode, newPassword });
  };

  if (step === "password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-primary">Create New Password</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your new password below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create new password (min. 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-new-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    data-testid="input-confirm-new-password"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>

              <button 
                className="w-full text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center justify-center"
                onClick={() => setStep("otp")}
                type="button"
                data-testid="button-back-to-otp"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Verification
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-primary">Check Your Email</CardTitle>
              <CardDescription className="text-muted-foreground">
                We've sent a verification code to<br />
                <span className="font-medium text-foreground">{email}</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP 
                  maxLength={6} 
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                  data-testid="input-reset-otp-code"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Code expires in 10 minutes
              </p>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={otpCode.length !== 6}
                data-testid="button-verify-reset-otp"
              >
                Continue
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button 
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => requestOtpMutation.mutate({ email })}
                  disabled={requestOtpMutation.isPending}
                  type="button"
                  data-testid="button-resend-reset-otp"
                >
                  {requestOtpMutation.isPending ? "Resending..." : "Resend Code"}
                </button>
                
                <button 
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center"
                  onClick={() => setStep("email")}
                  type="button"
                  data-testid="button-back-to-email"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Use Different Email
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img 
              src={microgennLogo} 
              alt="M CRM Logo" 
              className="h-16 w-auto"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Forgot Password?</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your email and we'll send you a reset code
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  data-testid="input-forgot-email"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={requestOtpMutation.isPending}
              data-testid="button-request-reset-otp"
            >
              {requestOtpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Code...
                </>
              ) : (
                "Send Reset Code"
              )}
            </Button>

            <button 
              className="w-full text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center justify-center mt-2"
              onClick={() => setLocation("/auth/login")}
              type="button"
              data-testid="link-back-to-login"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
