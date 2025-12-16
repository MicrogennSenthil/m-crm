import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";

interface RescheduleDemoDialogProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export function RescheduleDemoDialog({ lead, open, onClose }: RescheduleDemoDialogProps) {
  const { toast } = useToast();
  const [demoDate, setDemoDate] = useState<Date | undefined>(
    lead.demoDate ? new Date(lead.demoDate) : undefined
  );
  const [demoTime, setDemoTime] = useState(
    lead.demoDate ? format(new Date(lead.demoDate), "HH:mm") : "10:00"
  );
  const [reason, setReason] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isDemoTimeValid = () => {
    if (!demoDate) return false;
    if (!isToday(demoDate)) return true;
    
    const now = new Date();
    const [hours, minutes] = demoTime.split(":").map(Number);
    const selectedTime = new Date(demoDate);
    selectedTime.setHours(hours, minutes, 0, 0);
    
    return selectedTime > now;
  };

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!demoDate) throw new Error("Please select a date");
      
      const dateWithTime = new Date(demoDate);
      const [hours, minutes] = demoTime.split(":").map(Number);
      dateWithTime.setHours(hours, minutes, 0, 0);

      await apiRequest("PATCH", `/api/leads/${lead.id}`, {
        demoDate: dateWithTime.toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Demo Rescheduled",
        description: `Demo for ${lead.companyName} has been rescheduled to ${format(demoDate!, "PPP")} at ${demoTime}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-dashboard/stats"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule demo",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!demoDate) {
      toast({
        title: "Error",
        description: "Please select a demo date",
        variant: "destructive",
      });
      return;
    }
    rescheduleMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reschedule Demo
          </DialogTitle>
          <DialogDescription>
            Reschedule the demo for {lead.companyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {lead.demoDate && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Current Demo:</p>
              <p className="text-sm font-medium">
                {format(new Date(lead.demoDate), "PPP 'at' h:mm a")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>New Demo Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal min-h-[44px]"
                  data-testid="button-select-demo-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {demoDate ? format(demoDate, "PPP") : "Select new date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[110]" align="start">
                <Calendar
                  mode="single"
                  selected={demoDate}
                  onSelect={(date) => {
                    setDemoDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-time">Demo Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="demo-time"
                type="time"
                value={demoTime}
                onChange={(e) => setDemoTime(e.target.value)}
                className="pl-10 min-h-[44px]"
                data-testid="input-demo-time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-reason">Reason (Optional)</Label>
            <Textarea
              id="reschedule-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rescheduling..."
              className="min-h-20"
              data-testid="textarea-reschedule-reason"
            />
          </div>

          {demoDate && isToday(demoDate) && !isDemoTimeValid() && (
            <p className="text-sm text-destructive">
              Please select a future time for today's demo
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!demoDate || !isDemoTimeValid() || rescheduleMutation.isPending}
            data-testid="button-confirm-reschedule"
          >
            {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule Demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
