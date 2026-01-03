import { CallAnalytics } from "@/components/call-analytics";
import { CallDetails } from "@/components/call-details";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileSpreadsheet } from "lucide-react";

export default function MyPerformancePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">My Performance</h1>
        <p className="text-muted-foreground">Track your call activity and performance metrics</p>
      </div>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="analytics" className="flex items-center gap-2" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4" />
            Analytics Overview
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2" data-testid="tab-details">
            <FileSpreadsheet className="h-4 w-4" />
            Detailed Report
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics">
          <CallAnalytics />
        </TabsContent>
        
        <TabsContent value="details">
          <CallDetails />
        </TabsContent>
      </Tabs>
    </div>
  );
}
