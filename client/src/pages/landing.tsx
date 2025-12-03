import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, TrendingUp, Wrench, Headphones, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import microgennLogo from "@assets/Logo_1764615397514.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b-2 border-b-[#FF9933]">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={microgennLogo} alt="M-CRM" className="h-10 w-auto" />
            <span className="font-bold text-xl text-primary">M-CRM</span>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/auth/login")}
              data-testid="button-header-login"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => setLocation("/auth/signup")}
              data-testid="button-header-signup"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            M-CRM
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Comprehensive platform for managing sales pipeline, implementation projects,
            and customer support with seamless workflow integration
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={() => setLocation("/auth/signup")}
              data-testid="button-cta-signup"
            >
              Create Free Account
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/auth/login")}
              data-testid="button-cta-login"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Sales Management</h3>
                <p className="text-sm text-muted-foreground">
                  Track leads from social channels, schedule demos, and manage quotes
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Wrench className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Implementation</h3>
                <p className="text-sm text-muted-foreground">
                  Assign engineers, track modules, and record training sessions
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Headphones className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Support Tickets</h3>
                <p className="text-sm text-muted-foreground">
                  Multi-level escalation, automated routing, and feedback collection
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <LayoutDashboard className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Unified Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Complete visibility across sales, projects, and support
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Social media lead integration",
              "Multi-stage sales pipeline",
              "Follow-up tracking system",
              "Project module checklist",
              "Training records management",
              "Round-robin ticket assignment",
              "Multi-level escalation matrix",
              "Customer feedback automation",
              "Complete interaction history",
              "Role-based access control",
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
