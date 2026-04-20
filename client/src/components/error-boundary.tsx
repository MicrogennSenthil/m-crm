import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    /Loading chunk \d+ failed/i.test(msg)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const chunkError = isChunkLoadError(error);

    // Auto-reload once on a chunk error to pick up the fresh build.
    // Use sessionStorage to prevent an infinite reload loop.
    if (chunkError) {
      const key = "chunk_reload_attempted";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        // Replace href forces the browser to re-fetch HTML from the server,
        // bypassing any stale cache entry.
        window.location.replace(window.location.href);
      }
    }

    return { hasError: true, error, isChunkError: chunkError };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    if (this.state.isChunkError) {
      // Clear the guard so the next hard-reload attempt is allowed.
      sessionStorage.removeItem("chunk_reload_attempted");
      window.location.replace(window.location.href);
      return;
    }
    this.setState({ hasError: false, error: null, isChunkError: false });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.onReset) {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-xl">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <p className="font-semibold text-lg">Failed to load lead details</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {this.state.error?.message ?? "An unexpected error occurred"}
              </p>
              <Button variant="outline" onClick={this.handleReset}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        );
      }

      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold text-lg">App updated — refreshing…</p>
              <p className="text-sm text-muted-foreground mt-1">
                A new version was deployed. The page will reload automatically.
              </p>
            </div>
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload now
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold text-lg">Something went wrong loading this page</p>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
          <Button variant="outline" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
