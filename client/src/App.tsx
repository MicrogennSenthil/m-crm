import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarPinned } from "@/hooks/use-sidebar-pinned";
import microgennLogo from "@assets/MG Logo_1764263883732.png";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Sales from "@/pages/sales";
import Implementations from "@/pages/implementations";
import ImplementationDashboard from "@/pages/implementation-dashboard";
import Support from "@/pages/support";
import Reports from "@/pages/reports";
import SalesReports from "@/pages/reports-sales";
import ImplementationReports from "@/pages/reports-implementation";
import SupportReports from "@/pages/reports-support";
import Masters from "@/pages/masters";
import Settings from "@/pages/settings";
import Tasks from "@/pages/tasks";
import TaskDetail from "@/pages/task-detail";
import AuthLogin from "@/pages/auth-login";
import AuthSignup from "@/pages/auth-signup";
import AuthForgotPassword from "@/pages/auth-forgot-password";
import AdminUsers from "@/pages/admin-users";
import UserManagement from "@/pages/user-management";
import UserMaster from "@/pages/admin/user-master";
import UserRoleMaster from "@/pages/admin/user-role-master";
import UserRightsAllocation from "@/pages/admin/user-rights-allocation";
import UserApproval from "@/pages/admin/user-approval";
import KnowledgeBaseAdmin from "@/pages/knowledge-base-admin";
import KnowledgeBaseSearch from "@/pages/knowledge-base-search";

function AuthenticatedLayout() {
  const { isPinned, setIsPinned } = useSidebarPinned();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider 
      style={style as React.CSSProperties}
      open={isPinned ? true : undefined}
      onOpenChange={isPinned ? undefined : undefined}
    >
      <div className="flex h-screen w-full">
        <AppSidebar isPinned={isPinned} onPinChange={setIsPinned} />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-50 h-[52px] flex items-center justify-between gap-2 px-2 sm:px-4 border-b-2 border-b-[#FF9933] bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="min-h-[44px] min-w-[44px] md:hidden" />
            </div>
            <div className="flex items-center gap-4">
              <img 
                src={microgennLogo} 
                alt="M-CRM" 
                className="h-10 sm:h-12 w-auto object-contain"
                data-testid="logo-mcrm"
              />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-6">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/tasks/:id" component={TaskDetail} />
              <Route path="/sales" component={Sales} />
              <Route path="/implementations" component={Implementations} />
              <Route path="/implementation-dashboard" component={ImplementationDashboard} />
              <Route path="/support" component={Support} />
              <Route path="/reports" component={Reports} />
              <Route path="/reports/sales" component={SalesReports} />
              <Route path="/reports/implementation" component={ImplementationReports} />
              <Route path="/reports/support" component={SupportReports} />
              <Route path="/masters" component={Masters} />
              <Route path="/settings" component={Settings} />
              <Route path="/admin/users" component={UserMaster} />
              <Route path="/admin/user-roles" component={UserRoleMaster} />
              <Route path="/admin/user-rights" component={UserRightsAllocation} />
              <Route path="/admin/user-approval" component={UserApproval} />
              <Route path="/admin/user-management" component={UserManagement} />
              <Route path="/knowledge-base" component={KnowledgeBaseSearch} />
              <Route path="/admin/knowledge-base" component={KnowledgeBaseAdmin} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth/login" component={AuthLogin} />
        <Route path="/auth/signup" component={AuthSignup} />
        <Route path="/auth/forgot-password" component={AuthForgotPassword} />
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return <AuthenticatedLayout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
