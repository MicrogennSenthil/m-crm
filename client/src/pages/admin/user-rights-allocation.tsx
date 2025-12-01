import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Loader2, Shield, Save, Key, Eye, FilePlus, FileEdit, Trash
} from "lucide-react";
import type { UserRole, UserRoleRight, SystemModule } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Permission = {
  moduleId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export default function UserRightsAllocation() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
    enabled: currentUser?.role === "admin",
  });

  const { data: systemModules = [], isLoading: modulesLoading } = useQuery<SystemModule[]>({
    queryKey: ["/api/system-modules"],
    enabled: currentUser?.role === "admin",
  });

  const { data: roleRights = [], isLoading: rightsLoading, refetch: refetchRights } = useQuery<UserRoleRight[]>({
    queryKey: ["/api/user-role-rights", selectedRoleId],
    queryFn: async () => {
      const res = await fetch(`/api/user-role-rights?roleId=${selectedRoleId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch role rights");
      return res.json();
    },
    enabled: !!selectedRoleId && currentUser?.role === "admin",
  });

  // Seed default modules if none exist
  const seedModulesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/system-modules/seed", {});
      return response.json();
    },
    onSuccess: (data: { message: string; created: SystemModule[] }) => {
      toast({ title: "Modules Seeded", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/system-modules"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to seed modules", variant: "destructive" });
    },
  });

  // Initialize permissions when role or modules change
  useEffect(() => {
    if (selectedRoleId && systemModules.length > 0) {
      // Map by 'module' field (which stores the module ID) - database uses 'module' not 'moduleId'
      const existingRightsMap = new Map(
        roleRights.map((r: any) => [r.module, r])
      );

      const newPermissions = systemModules.map((mod) => {
        const existing = existingRightsMap.get(mod.id);
        return {
          moduleId: mod.id,
          canView: existing?.canView ?? false,
          canCreate: existing?.canCreate ?? false,
          canEdit: existing?.canEdit ?? false,
          canDelete: existing?.canDelete ?? false,
        };
      });

      setPermissions(newPermissions);
      setHasChanges(false);
    }
  }, [selectedRoleId, systemModules, roleRights]);

  const updatePermissionMutation = useMutation({
    mutationFn: async (data: { roleId: string; rights: Permission[] }) => {
      const response = await apiRequest("POST", `/api/user-roles/${data.roleId}/rights/bulk`, {
        rights: data.rights,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Permissions Updated", description: "Role permissions have been saved successfully" });
      refetchRights();
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update permissions", variant: "destructive" });
    },
  });

  const handlePermissionChange = (moduleId: string, field: keyof Permission, value: boolean) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.moduleId === moduleId ? { ...p, [field]: value } : p
      )
    );
    setHasChanges(true);
  };

  const handleSelectAll = (field: keyof Permission, value: boolean) => {
    if (field === "moduleId") return;
    setPermissions((prev) =>
      prev.map((p) => ({ ...p, [field]: value }))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedRoleId) {
      toast({ title: "Error", description: "Please select a role first", variant: "destructive" });
      return;
    }
    updatePermissionMutation.mutate({ roleId: selectedRoleId, rights: permissions });
  };

  const getModuleName = (moduleId: string) => {
    const mod = systemModules.find((m) => m.id === moduleId);
    return mod?.displayName || mod?.name || moduleId;
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Admin privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = rolesLoading || modulesLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" data-testid="text-page-title">User Rights Allocation</h1>
          <p className="text-muted-foreground">Configure module permissions for each role</p>
        </div>
        <div className="flex gap-2">
          {systemModules.length === 0 && (
            <Button 
              variant="outline" 
              onClick={() => seedModulesMutation.mutate()}
              disabled={seedModulesMutation.isPending}
            >
              {seedModulesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Default Modules
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || updatePermissionMutation.isPending || !selectedRoleId}
            data-testid="button-save-permissions"
          >
            {updatePermissionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <Label className="text-sm text-muted-foreground mb-2 block">Select Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Choose a role to configure" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {role.displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRole && (
              <Badge variant="outline" className="self-end">
                <Key className="h-3 w-3 mr-1" />
                Configuring: {selectedRole.displayName}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : systemModules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No system modules found. Click "Seed Default Modules" to create them.</p>
            </div>
          ) : !selectedRoleId ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please select a role to configure its permissions.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Module</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </div>
                        <Checkbox
                          checked={permissions.every((p) => p.canView)}
                          onCheckedChange={(checked) => handleSelectAll("canView", !!checked)}
                          data-testid="checkbox-all-view"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <FilePlus className="h-4 w-4" />
                          <span>Create</span>
                        </div>
                        <Checkbox
                          checked={permissions.every((p) => p.canCreate)}
                          onCheckedChange={(checked) => handleSelectAll("canCreate", !!checked)}
                          data-testid="checkbox-all-create"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <FileEdit className="h-4 w-4" />
                          <span>Edit</span>
                        </div>
                        <Checkbox
                          checked={permissions.every((p) => p.canEdit)}
                          onCheckedChange={(checked) => handleSelectAll("canEdit", !!checked)}
                          data-testid="checkbox-all-edit"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <Trash className="h-4 w-4" />
                          <span>Delete</span>
                        </div>
                        <Checkbox
                          checked={permissions.every((p) => p.canDelete)}
                          onCheckedChange={(checked) => handleSelectAll("canDelete", !!checked)}
                          data-testid="checkbox-all-delete"
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => {
                    const mod = systemModules.find((m) => m.id === perm.moduleId);
                    return (
                      <TableRow key={perm.moduleId} data-testid={`row-module-${perm.moduleId}`}>
                        <TableCell className="font-medium">
                          {mod?.displayName || mod?.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.canView}
                            onCheckedChange={(checked) => handlePermissionChange(perm.moduleId, "canView", !!checked)}
                            data-testid={`checkbox-view-${perm.moduleId}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.canCreate}
                            onCheckedChange={(checked) => handlePermissionChange(perm.moduleId, "canCreate", !!checked)}
                            data-testid={`checkbox-create-${perm.moduleId}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.canEdit}
                            onCheckedChange={(checked) => handlePermissionChange(perm.moduleId, "canEdit", !!checked)}
                            data-testid={`checkbox-edit-${perm.moduleId}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perm.canDelete}
                            onCheckedChange={(checked) => handlePermissionChange(perm.moduleId, "canDelete", !!checked)}
                            data-testid={`checkbox-delete-${perm.moduleId}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
            <Button 
              onClick={handleSave}
              disabled={updatePermissionMutation.isPending}
              size="sm"
            >
              {updatePermissionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
