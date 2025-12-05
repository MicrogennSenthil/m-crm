import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Settings,
  RotateCcw,
  Users,
  Target,
  FileText,
  Headphones,
  RefreshCw,
  Hand,
  Save,
} from "lucide-react";
import type { AssignmentSetting, UserRole, Department } from "@shared/schema";

type ModuleConfig = {
  module: string;
  label: string;
  icon: typeof Target;
  color: string;
  description: string;
};

const modules: ModuleConfig[] = [
  { 
    module: "tickets", 
    label: "Support Tickets", 
    icon: Headphones, 
    color: "text-purple-500",
    description: "Configure how support tickets are assigned to engineers"
  },
  { 
    module: "tasks", 
    label: "Tasks", 
    icon: FileText, 
    color: "text-blue-500",
    description: "Configure how tasks are assigned to team members"
  },
  { 
    module: "leads", 
    label: "Sales Leads", 
    icon: Target, 
    color: "text-green-500",
    description: "Configure how leads are assigned to sales executives"
  },
];

const assignmentMethods = [
  { 
    value: "manual", 
    label: "Manual Assignment", 
    icon: Hand,
    description: "Manually select assignee when creating items" 
  },
  { 
    value: "round_robin", 
    label: "Round Robin", 
    icon: RotateCcw,
    description: "Automatically rotate assignments among available users" 
  },
  { 
    value: "none", 
    label: "No Assignment", 
    icon: Users,
    description: "Disable automatic assignment - items remain unassigned" 
  },
];

export default function AssignmentSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<Record<string, Partial<AssignmentSetting>>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  const { data: settings = [], isLoading } = useQuery<AssignmentSetting[]>({
    queryKey: ["/api/assignment-settings"],
    enabled: user?.role === "admin",
  });

  const { data: userRoles = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
    enabled: user?.role === "admin",
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: user?.role === "admin",
  });

  // Initialize local settings from server data
  useEffect(() => {
    if (settings.length > 0) {
      const newLocalSettings: Record<string, Partial<AssignmentSetting>> = {};
      settings.forEach(s => {
        newLocalSettings[s.module] = { ...s };
      });
      setLocalSettings(newLocalSettings);
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ module, data }: { module: string; data: Partial<AssignmentSetting> }) => {
      return await apiRequest("PUT", `/api/assignment-settings/${module}`, data);
    },
    onSuccess: (_, { module }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-settings"] });
      setHasChanges(prev => ({ ...prev, [module]: false }));
      toast({ title: "Settings saved", description: `Assignment settings for ${module} updated successfully.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const initializeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/assignment-settings/initialize", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-settings"] });
      toast({ title: "Initialized", description: "Default assignment settings have been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize settings", variant: "destructive" });
    },
  });

  const handleSettingChange = (module: string, field: keyof AssignmentSetting, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [field]: value,
      },
    }));
    setHasChanges(prev => ({ ...prev, [module]: true }));
  };

  const handleRoleToggle = (module: string, roleName: string, checked: boolean) => {
    const currentRoles = localSettings[module]?.assignableRoles || [];
    let newRoles: string[];
    
    if (checked) {
      newRoles = [...currentRoles, roleName];
    } else {
      newRoles = currentRoles.filter(r => r !== roleName);
    }
    
    handleSettingChange(module, "assignableRoles", newRoles);
  };

  const handleSave = (module: string) => {
    const data = localSettings[module];
    if (data) {
      updateSettingMutation.mutate({ module, data });
    }
  };

  const getSettingForModule = (module: string): Partial<AssignmentSetting> => {
    return localSettings[module] || settings.find(s => s.module === module) || {
      module,
      assignmentMethod: "manual",
      isEnabled: false,
      assignableRoles: [],
    };
  };

  if (user?.role !== "admin") {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Assignment Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure how items are automatically assigned in different modules
          </p>
        </div>
        {settings.length === 0 && (
          <Button 
            onClick={() => initializeMutation.mutate()}
            disabled={initializeMutation.isPending}
            data-testid="button-initialize-settings"
          >
            {initializeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Initialize Default Settings
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {modules.map((moduleConfig) => {
          const setting = getSettingForModule(moduleConfig.module);
          const Icon = moduleConfig.icon;
          const isModuleChanged = hasChanges[moduleConfig.module];
          
          return (
            <Card key={moduleConfig.module} data-testid={`card-module-${moduleConfig.module}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${moduleConfig.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{moduleConfig.label}</CardTitle>
                      <CardDescription>{moduleConfig.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={setting.isEnabled ?? false}
                        onCheckedChange={(checked) => 
                          handleSettingChange(moduleConfig.module, "isEnabled", checked)
                        }
                        data-testid={`switch-enabled-${moduleConfig.module}`}
                      />
                      <Label className="text-sm">
                        {setting.isEnabled ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Auto-Assign Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Manual Only</Badge>
                        )}
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSave(moduleConfig.module)}
                      disabled={!isModuleChanged || updateSettingMutation.isPending}
                      data-testid={`button-save-${moduleConfig.module}`}
                    >
                      {updateSettingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Assignment Method</Label>
                    <Select
                      value={setting.assignmentMethod || "manual"}
                      onValueChange={(value) => 
                        handleSettingChange(moduleConfig.module, "assignmentMethod", value)
                      }
                      disabled={!setting.isEnabled}
                    >
                      <SelectTrigger data-testid={`select-method-${moduleConfig.module}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignmentMethods.map((method) => {
                          const MethodIcon = method.icon;
                          return (
                            <SelectItem key={method.value} value={method.value}>
                              <div className="flex items-center gap-2">
                                <MethodIcon className="h-4 w-4" />
                                <span>{method.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {assignmentMethods.find(m => m.value === setting.assignmentMethod)?.description}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Restrict to Department (Optional)</Label>
                    <Select
                      value={setting.departmentId || "all"}
                      onValueChange={(value) => 
                        handleSettingChange(moduleConfig.module, "departmentId", value === "all" ? null : value)
                      }
                      disabled={!setting.isEnabled}
                    >
                      <SelectTrigger data-testid={`select-department-${moduleConfig.module}`}>
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Limit auto-assignment to users in a specific department
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Assignable Roles
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
                    {userRoles.filter(r => r.isActive).map((role) => (
                      <div key={role.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${moduleConfig.module}-${role.name}`}
                          checked={(setting.assignableRoles || []).includes(role.name)}
                          onCheckedChange={(checked) => 
                            handleRoleToggle(moduleConfig.module, role.name, checked as boolean)
                          }
                          disabled={!setting.isEnabled}
                          data-testid={`checkbox-role-${moduleConfig.module}-${role.name}`}
                        />
                        <Label 
                          htmlFor={`${moduleConfig.module}-${role.name}`}
                          className="text-sm cursor-pointer"
                        >
                          {role.displayName}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which roles can receive auto-assignments for this module
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            How Assignment Methods Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>How It Works</TableHead>
                <TableHead>Best For</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-gray-500" />
                    Manual
                  </div>
                </TableCell>
                <TableCell>User must select an assignee when creating items</TableCell>
                <TableCell>When assignments need careful consideration</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-blue-500" />
                    Round Robin
                  </div>
                </TableCell>
                <TableCell>Rotates through available users in order (A → B → C → A...)</TableCell>
                <TableCell>Fair distribution when workload is similar</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-green-500" />
                    Load Balanced
                  </div>
                </TableCell>
                <TableCell>Assigns to user with fewest active items</TableCell>
                <TableCell>When users have varying workloads</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
