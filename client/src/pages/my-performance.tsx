import { CallAnalytics } from "@/components/call-analytics";

export default function MyPerformancePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">My Performance</h1>
        <p className="text-muted-foreground">Track your call activity and performance metrics</p>
      </div>
      
      <CallAnalytics />
    </div>
  );
}
