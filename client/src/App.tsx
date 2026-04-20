import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceAlertProvider } from "@/providers/VoiceAlertProvider";
import { UserProfileMenu } from "@/components/user-profile-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarPinned } from "@/hooks/use-sidebar-pinned";
import microgennLogo from "@assets/Logo_1764615397514.png";

// Only keep truly small/critical pages eager
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import AuthLogin from "@/pages/auth-login";

// Lazy load everything else to minimise the initial JS bundle
const AuthSignup = lazy(() => import("@/pages/auth-signup"));
const AuthForgotPassword = lazy(() => import("@/pages/auth-forgot-password"));
const Home = lazy(() => import("@/pages/home"));
const Sales = lazy(() => import("@/pages/sales"));
const Implementations = lazy(() => import("@/pages/implementations"));
const ImplementationDashboard = lazy(() => import("@/pages/implementation-dashboard"));
const Support = lazy(() => import("@/pages/support"));
const SupportDashboard = lazy(() => import("@/pages/support-dashboard"));
const SalesDashboard = lazy(() => import("@/pages/sales-dashboard"));
const Tasks = lazy(() => import("@/pages/tasks"));
const DevelopmentDashboard = lazy(() => import("@/pages/development-dashboard"));
const DevelopmentTasks = lazy(() => import("@/pages/development-tasks"));
const DepartmentUsers = lazy(() => import("@/pages/department-users"));
const Reports = lazy(() => import("@/pages/reports"));
const SalesReports = lazy(() => import("@/pages/reports-sales"));
const ImplementationReports = lazy(() => import("@/pages/reports-implementation"));
const SupportReports = lazy(() => import("@/pages/reports-support"));
const DevelopmentReports = lazy(() => import("@/pages/reports-development"));
const FeedbackReports = lazy(() => import("@/pages/reports-feedback"));
const AccountsReports = lazy(() => import("@/pages/reports-accounts"));
const TasksReports = lazy(() => import("@/pages/reports-tasks"));
const MarketingReports = lazy(() => import("@/pages/reports-marketing"));
const SeedsReport = lazy(() => import("@/pages/seeds-report"));
const Masters = lazy(() => import("@/pages/masters"));
const Settings = lazy(() => import("@/pages/settings"));
const TaskDetail = lazy(() => import("@/pages/task-detail"));
const TodaysTasks = lazy(() => import("@/pages/todays-tasks"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const UserManagement = lazy(() => import("@/pages/user-management"));
const UserMaster = lazy(() => import("@/pages/admin/user-master"));
const UserRoleMaster = lazy(() => import("@/pages/admin/user-role-master"));
const UserRightsAllocation = lazy(() => import("@/pages/admin/user-rights-allocation"));
const UserApproval = lazy(() => import("@/pages/admin/user-approval"));
const KnowledgeBaseAdmin = lazy(() => import("@/pages/knowledge-base-admin"));
const KnowledgeBaseSearch = lazy(() => import("@/pages/knowledge-base-search"));
const SmtpConfig = lazy(() => import("@/pages/admin/smtp-config"));
const PointCategories = lazy(() => import("@/pages/admin/point-categories"));
const AssignmentSettings = lazy(() => import("@/pages/admin/assignment-settings"));
const DatabaseControl = lazy(() => import("@/pages/admin/database-control"));
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin-dashboard"));
const AccountsContracts = lazy(() => import("@/pages/accounts-contracts"));
const HRFeedback = lazy(() => import("@/pages/hr-feedback"));
const MarketingDailyReport = lazy(() => import("@/pages/marketing-daily-report"));
const MarketingDashboard = lazy(() => import("@/pages/marketing-dashboard"));
const Extractor = lazy(() => import("@/pages/extractor"));
const MyPerformance = lazy(() => import("@/pages/my-performance"));
const SalesPlanning = lazy(() => import("@/pages/sales-planning"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { isPinned, setIsPinned } = useSidebarPinned();

  // Prefetch the most-visited page chunks in the background so the first
  // navigation to any of these pages feels instant (no Suspense "Loading...").
  useEffect(() => {
    const prefetch = () => {
      import("@/pages/tasks");
      import("@/pages/home");
      import("@/pages/sales");
      import("@/pages/support");
      import("@/pages/knowledge-base-search");
      import("@/pages/hr-feedback");
      import("@/pages/implementations");
      import("@/pages/accounts-contracts");
      import("@/pages/todays-tasks");
      import("@/pages/marketing-dashboard");
      import("@/pages/marketing-daily-report");
    };
    // Small delay so it doesn't compete with the initial page render
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, []);

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider 
      style={style as React.CSSProperties}
      defaultOpen={isPinned}
    >
      <div className="flex h-screen w-full">
        <AppSidebar isPinned={isPinned} onPinChange={setIsPinned} />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-50 h-[52px] flex items-center justify-between gap-2 px-2 sm:px-4 border-b-2 border-b-[#FF9933] bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="min-h-[44px] min-w-[44px]" />
              <img 
                src={microgennLogo} 
                alt="M-CRM" 
                className="h-8 sm:h-10 w-auto object-contain"
                data-testid="logo-mcrm"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-6 pb-20 md:pb-6">
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/tasks" component={Tasks} />
                <Route path="/my-performance" component={MyPerformance} />
                <Route path="/tasks/today" component={TodaysTasks} />
                <Route path="/tasks/:id" component={TaskDetail} />
                <Route path="/extractor" component={Extractor} />
                <Route path="/sales" component={Sales} />
                <Route path="/sales-dashboard" component={SalesDashboard} />
                <Route path="/sales-planning" component={SalesPlanning} />
                <Route path="/implementations" component={Implementations} />
                <Route path="/implementation-dashboard" component={ImplementationDashboard} />
                <Route path="/support" component={Support} />
                <Route path="/support-dashboard" component={SupportDashboard} />
                <Route path="/reports" component={Reports} />
                <Route path="/reports/sales" component={SalesReports} />
                <Route path="/reports/implementation" component={ImplementationReports} />
                <Route path="/reports/support" component={SupportReports} />
                <Route path="/reports/development" component={DevelopmentReports} />
                <Route path="/reports/feedback" component={FeedbackReports} />
                <Route path="/reports/accounts" component={AccountsReports} />
                <Route path="/reports/tasks" component={TasksReports} />
                <Route path="/reports/marketing" component={MarketingReports} />
                <Route path="/masters" component={Masters} />
                <Route path="/settings" component={Settings} />
                <Route path="/admin/users" component={UserMaster} />
                <Route path="/admin/user-roles" component={UserRoleMaster} />
                <Route path="/admin/user-rights" component={UserRightsAllocation} />
                <Route path="/admin/user-approval" component={UserApproval} />
                <Route path="/admin/user-management" component={UserManagement} />
                <Route path="/knowledge-base" component={KnowledgeBaseSearch} />
                <Route path="/admin/knowledge-base" component={KnowledgeBaseAdmin} />
                <Route path="/admin/smtp-config" component={SmtpConfig} />
                <Route path="/admin/point-categories" component={PointCategories} />
                <Route path="/admin/assignment-settings" component={AssignmentSettings} />
                <Route path="/admin/database-control" component={DatabaseControl} />
                <Route path="/admin/dashboard" component={SuperAdminDashboard} />
                <Route path="/department-users" component={DepartmentUsers} />
                <Route path="/development/dashboard" component={DevelopmentDashboard} />
                <Route path="/development/tasks" component={DevelopmentTasks} />
                <Route path="/accounts/contracts" component={AccountsContracts} />
                <Route path="/hr/feedback" component={HRFeedback} />
                <Route path="/marketing/daily-report" component={MarketingDailyReport} />
                <Route path="/marketing/dashboard" component={MarketingDashboard} />
                <Route path="/reports/seeds" component={SeedsReport} />
                <Route component={Home} />
              </Switch>
            </Suspense>
            </ErrorBoundary>
          </main>
          <BottomNav />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

const AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/auth/login" component={AuthLogin} />
            <Route path="/auth/signup" component={AuthSignup} />
            <Route path="/auth/forgot-password" component={AuthForgotPassword} />
            <Route path="/" component={Landing} />
            <Route component={Landing} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (AUTH_PATHS.includes(location)) {
    return <Redirect to="/" />;
  }

  return <AuthenticatedLayout />;
}

export default function App() {
  // Clear the chunk-reload guard whenever the app boots successfully,
  // so future deploys can trigger the auto-reload again.
  useEffect(() => {
    sessionStorage.removeItem("chunk_reload_attempted");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <VoiceAlertProvider pollingInterval={120000}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </VoiceAlertProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
