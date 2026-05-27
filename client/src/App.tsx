import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";

// Login is eager — it's the most common landing page for anonymous users
// and must render instantly without waiting on any other chunk.
import AuthLogin from "@/pages/auth-login";

// Everything below is lazy: signup/forgot are rarely the entry point,
// landing is for first-time visitors, and the entire authenticated shell
// (sidebar, voice-alert provider, bottom nav, 50+ pages) only matters
// AFTER login. Keeping it lazy makes the login bundle dramatically smaller.
const AuthSignup = lazy(() => import("@/pages/auth-signup"));
const AuthForgotPassword = lazy(() => import("@/pages/auth-forgot-password"));
const Landing = lazy(() => import("@/pages/landing"));
const AuthenticatedShell = lazy(() => import("@/components/authenticated-shell"));

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

const AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const isAuthPage = AUTH_PATHS.some((p) => location.startsWith(p));

  if (isLoading && !isAuthPage) {
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

  return (
    <Suspense fallback={<PageLoader />}>
      <AuthenticatedShell />
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    sessionStorage.removeItem("chunk_reload_attempted");
  }, []);

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
