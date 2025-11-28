import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, User, ArrowLeft, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import microgennLogo from "@assets/MG Logo_1764263883732.png";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

type SignupStep = "form" | "otp";

export default function AuthSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<SignupStep>("form");
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const requestOtpMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/signup/request-otp", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "OTP Sent",
        description: "A verification code has been sent to your email",
      });
      setStep("otp");
    },
    onError: (error: any) => {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { email: string; otpCode: string }) => {
      const response = await apiRequest("POST", "/api/auth/signup/verify-otp", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Created",
        description: `Welcome, ${data.user.firstName}! Your account has been verified.`,
      });
      setLocation("/");
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired OTP",
        variant: "destructive",
      });
    },
  });

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName || !lastName || !email || !password) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    requestOtpMutation.mutate({ email, firstName, lastName, password });
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

    verifyOtpMutation.mutate({ email, otpCode });
  };

  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-primary">Verify Your Email</CardTitle>
              <CardDescription className="text-muted-foreground">
                We've sent a 6-digit code to<br />
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
                  data-testid="input-otp-code"
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
                disabled={verifyOtpMutation.isPending || otpCode.length !== 6}
                data-testid="button-verify-otp"
              >
                {verifyOtpMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Create Account"
                )}
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button 
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => requestOtpMutation.mutate({ email, firstName, lastName, password })}
                  disabled={requestOtpMutation.isPending}
                  type="button"
                  data-testid="button-resend-otp"
                >
                  {requestOtpMutation.isPending ? "Resending..." : "Resend Code"}
                </button>
                
                <button 
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center"
                  onClick={() => setStep("form")}
                  type="button"
                  data-testid="button-back-to-form"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign Up
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
            <CardTitle className="text-2xl font-bold text-primary">Create Account</CardTitle>
            <CardDescription className="text-muted-foreground">
              Join M CRM to manage your business
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="pl-10"
                    data-testid="input-signup-firstname"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-signup-lastname"
                />
              </div>
            </div>
            
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
                  data-testid="input-signup-email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password (min. 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  data-testid="input-signup-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-signup-password"
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
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  data-testid="input-signup-confirm-password"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={requestOtpMutation.isPending}
              data-testid="button-signup-submit"
            >
              {requestOtpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Verification Code...
                </>
              ) : (
                "Continue with Email Verification"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button 
                className="text-accent hover:text-accent/80 hover:underline"
                onClick={() => setLocation("/auth/login")}
                data-testid="link-login"
              >
                Sign in
              </button>
            </p>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation("/api/login")}
              data-testid="button-signup-with-replit"
            >
              Continue with Replit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
