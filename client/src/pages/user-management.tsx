import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Loader2, Search, Users, ShieldCheck, Building, Key, 
  Plus, Pencil, Trash2, CheckCircle, XCircle, History,
  Crown, Settings, Eye, FileEdit, FilePlus, Trash
} from "lucide-react";
import { format } from "date-fns";
import type { User, UserRole, UserRoleRight, Department, SystemModule } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

type RoleChangeHistoryItem = {
  id: string;
  userId: string;
  previousRoleId: string | null;
  newRoleId: string | null;
  changedBy: string;
  reason: string | null;
  createdAt: Date | null;
  previousRole?: UserRole;
  newRole?: UserRole;
  changedByUser?: User;
};

type RoleWithRights = UserRole & { rights: UserRoleRight[] };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingModule, setEditingModule] = useState<SystemModule | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: currentUser?.role === "admin",
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
    enabled: currentUser?.role === "admin",
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: currentUser?.role === "admin",
  });

  const { data: systemModules = [], isLoading: modulesLoading } = useQuery<SystemModule[]>({
    queryKey: ["/api/system-modules"],
    enabled: currentUser?.role === "admin",
  });

  const { data: roleChangeHistory = [] } = useQuery<RoleChangeHistoryItem[]>({
    queryKey: ["/api/role-change-history", selectedUserId],
    enabled: !!selectedUserId && historyDialogOpen,
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/user-roles", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Created", description: "New role has been created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setRoleDialogOpen(false);
      setEditingRole(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create role", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserRole> }) => {
      const response = await apiRequest("PATCH", `/api/user-roles/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Updated", description: "Role has been updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setRoleDialogOpen(false);
      setEditingRole(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update role", variant: "destructive" });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/departments", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Department Created", description: "New department has been created" });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDepartmentDialogOpen(false);
      setEditingDepartment(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create department", variant: "destructive" });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      const response = await apiRequest("PATCH", `/api/departments/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Department Updated", description: "Department has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDepartmentDialogOpen(false);
      setEditingDepartment(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update department", variant: "destructive" });
    },
  });

  const createModuleMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string; description?: string; icon?: string; sortOrder?: number }) => {
      const response = await apiRequest("POST", "/api/system-modules", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Module Created", description: "New system module has been created" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-modules"] });
      setModuleDialogOpen(false);
      setEditingModule(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create module", variant: "destructive" });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SystemModule> }) => {
      const response = await apiRequest("PATCH", `/api/system-modules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Module Updated", description: "System module has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-modules"] });
      setModuleDialogOpen(false);
      setEditingModule(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update module", variant: "destructive" });
    },
  });

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

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const endpoints: Record<string, string> = {
        role: `/api/user-roles/${id}`,
        department: `/api/departments/${id}`,
        module: `/api/system-modules/${id}`,
      };
      const response = await apiRequest("DELETE", endpoints[type]);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: `${deleteTarget?.type} has been deleted` });
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-modules"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, { role: roleId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User role has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User status has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user status", variant: "destructive" });
    },
  });

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  const isSuperAdmin = (email: string | null) => email === SUPER_ADMIN_EMAIL;

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center">
          Only administrators can access user management.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users, roles, departments, and permissions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2" data-testid="tab-roles">
            <ShieldCheck className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" data-testid="tab-permissions">
            <Key className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2" data-testid="tab-departments">
            <Building className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2" data-testid="tab-modules">
            <Settings className="h-4 w-4" />
            Modules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage system users and their roles</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.profileImageUrl || undefined} />
                              <AvatarFallback>
                                {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {user.firstName} {user.lastName}
                              </span>
                              {isSuperAdmin(user.email) && (
                                <Crown className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role || ""}
                            onValueChange={(value) => {
                              if (!isSuperAdmin(user.email)) {
                                updateUserRoleMutation.mutate({ userId: user.id, roleId: value });
                              }
                            }}
                            disabled={isSuperAdmin(user.email)}
                          >
                            <SelectTrigger className="w-40" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.name}>
                                  {role.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.isActive !== false}
                              onCheckedChange={(checked) => {
                                if (!isSuperAdmin(user.email)) {
                                  toggleUserStatusMutation.mutate({ userId: user.id, isActive: checked });
                                }
                              }}
                              disabled={isSuperAdmin(user.email)}
                              data-testid={`switch-status-${user.id}`}
                            />
                            <Badge variant={user.isActive !== false ? "default" : "secondary"}>
                              {user.isActive !== false ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.lastLoginAt ? format(new Date(user.lastLoginAt), "PPp") : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setHistoryDialogOpen(true);
                            }}
                            data-testid={`button-history-${user.id}`}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Roles</CardTitle>
                  <CardDescription>Define roles and their permissions</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingRole(null);
                    setRoleDialogOpen(true);
                  }}
                  data-testid="button-add-role"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                        <TableCell className="font-mono">{role.name}</TableCell>
                        <TableCell>{role.displayName}</TableCell>
                        <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={role.isActive !== false ? "default" : "secondary"}>
                            {role.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingRole(role);
                                setRoleDialogOpen(true);
                              }}
                              data-testid={`button-edit-role-${role.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteTarget({ type: "role", id: role.id, name: role.displayName });
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-role-${role.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Role Permissions</CardTitle>
                  <CardDescription>Configure module access permissions for each role</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PermissionMatrix 
                roles={roles} 
                modules={modules} 
                isLoading={rolesLoading || modulesLoading} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Organize users by departments</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingDepartment(null);
                    setDepartmentDialogOpen(true);
                  }}
                  data-testid="button-add-department"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deptsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : departments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No departments defined. Create your first department.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id} data-testid={`row-department-${dept.id}`}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dept.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={dept.isActive !== false ? "default" : "secondary"}>
                            {dept.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingDepartment(dept);
                                setDepartmentDialogOpen(true);
                              }}
                              data-testid={`button-edit-department-${dept.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteTarget({ type: "department", id: dept.id, name: dept.name });
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-department-${dept.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Modules</CardTitle>
                  <CardDescription>Define system modules for permission control</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => seedModulesMutation.mutate()}
                    disabled={seedModulesMutation.isPending}
                    data-testid="button-seed-modules"
                  >
                    {seedModulesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Seed Default Modules
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingModule(null);
                      setModuleDialogOpen(true);
                    }}
                    data-testid="button-add-module"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Module
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {modulesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : systemModules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No system modules defined. Create modules to enable permission management.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemModules.map((module) => (
                      <TableRow key={module.id} data-testid={`row-module-${module.id}`}>
                        <TableCell className="font-mono">{module.name}</TableCell>
                        <TableCell>{module.displayName}</TableCell>
                        <TableCell className="text-muted-foreground">{module.description || "-"}</TableCell>
                        <TableCell>{module.sortOrder || 0}</TableCell>
                        <TableCell>
                          <Badge variant={module.isActive !== false ? "default" : "secondary"}>
                            {module.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingModule(module);
                                setModuleDialogOpen(true);
                              }}
                              data-testid={`button-edit-module-${module.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteTarget({ type: "module", id: module.id, name: module.displayName });
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-module-${module.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RoleFormDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        role={editingRole}
        onSubmit={(data) => {
          if (editingRole) {
            updateRoleMutation.mutate({ id: editingRole.id, data });
          } else {
            createRoleMutation.mutate(data);
          }
        }}
        isPending={createRoleMutation.isPending || updateRoleMutation.isPending}
      />

      <DepartmentFormDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        department={editingDepartment}
        onSubmit={(data) => {
          if (editingDepartment) {
            updateDepartmentMutation.mutate({ id: editingDepartment.id, data });
          } else {
            createDepartmentMutation.mutate(data);
          }
        }}
        isPending={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
      />

      <ModuleFormDialog
        open={moduleDialogOpen}
        onOpenChange={setModuleDialogOpen}
        module={editingModule}
        onSubmit={(data) => {
          if (editingModule) {
            updateModuleMutation.mutate({ id: editingModule.id, data });
          } else {
            createModuleMutation.mutate(data);
          }
        }}
        isPending={createModuleMutation.isPending || updateModuleMutation.isPending}
      />

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Role Change History</DialogTitle>
            <DialogDescription>View the history of role changes for this user</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            {roleChangeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No role change history found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Previous Role</TableHead>
                    <TableHead>New Role</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleChangeHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell>
                        {history.createdAt ? format(new Date(history.createdAt), "PPp") : "-"}
                      </TableCell>
                      <TableCell>{history.previousRole?.displayName || "-"}</TableCell>
                      <TableCell>{history.newRole?.displayName || "-"}</TableCell>
                      <TableCell>
                        {history.changedByUser?.firstName} {history.changedByUser?.lastName}
                      </TableCell>
                      <TableCell>{history.reason || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole | null;
  onSubmit: (data: { name: string; displayName: string; description?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDisplayName(role.displayName);
      setDescription(role.description || "");
    } else {
      setName("");
      setDisplayName("");
      setDescription("");
    }
  }, [role, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, displayName, description: description || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Add Role"}</DialogTitle>
          <DialogDescription>
            {role ? "Update the role details" : "Create a new role in the system"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name (System ID)</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., sales_manager"
              required
              data-testid="input-role-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-display-name">Display Name</Label>
            <Input
              id="role-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Sales Manager"
              required
              data-testid="input-role-display-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role's responsibilities"
              data-testid="input-role-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-role">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {role ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onSubmit: (data: { name: string; description?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [department, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description: description || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>
            {department ? "Update the department details" : "Create a new department"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Department Name</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering"
              required
              data-testid="input-department-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the department"
              data-testid="input-department-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-department">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {department ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModuleFormDialog({
  open,
  onOpenChange,
  module,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: SystemModule | null;
  onSubmit: (data: { name: string; displayName: string; description?: string; icon?: string; sortOrder?: number }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (module) {
      setName(module.name);
      setDisplayName(module.displayName);
      setDescription(module.description || "");
      setIcon(module.icon || "");
      setSortOrder(module.sortOrder || 0);
    } else {
      setName("");
      setDisplayName("");
      setDescription("");
      setIcon("");
      setSortOrder(0);
    }
  }, [module, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      displayName,
      description: description || undefined,
      icon: icon || undefined,
      sortOrder,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? "Edit System Module" : "Add System Module"}</DialogTitle>
          <DialogDescription>
            {module ? "Update the module details" : "Create a new system module for permission control"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Module Name (System ID)</Label>
            <Input
              id="module-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., sales"
              required
              data-testid="input-module-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-display-name">Display Name</Label>
            <Input
              id="module-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Sales Management"
              required
              data-testid="input-module-display-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the module"
              data-testid="input-module-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module-icon">Icon (Lucide icon name)</Label>
              <Input
                id="module-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g., BarChart3"
                data-testid="input-module-icon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-sort-order">Sort Order</Label>
              <Input
                id="module-sort-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                data-testid="input-module-sort-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-module">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {module ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrix({
  roles,
  modules,
  isLoading,
}: {
  roles: UserRole[];
  modules: SystemModule[];
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: roleRights = [], refetch: refetchRights, isLoading: rightsLoading } = useQuery<UserRoleRight[]>({
    queryKey: ["/api/user-role-rights", selectedRole],
    enabled: !!selectedRole,
  });

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0].id);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (roleRights && modules) {
      const permMap: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }> = {};
      modules.forEach(mod => {
        const right = roleRights.find((r: UserRoleRight) => r.moduleId === mod.id);
        permMap[mod.id] = {
          canView: right?.canView ?? false,
          canCreate: right?.canCreate ?? false,
          canEdit: right?.canEdit ?? false,
          canDelete: right?.canDelete ?? false,
        };
      });
      setPermissions(permMap);
    }
  }, [roleRights, modules]);

  const togglePermission = (moduleId: string, permission: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [permission]: !prev[moduleId]?.[permission],
      }
    }));
  };

  const toggleAllForModule = (moduleId: string, enable: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        canView: enable,
        canCreate: enable,
        canEdit: enable,
        canDelete: enable,
      }
    }));
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const rightsToSave = Object.entries(permissions).map(([moduleId, perm]) => ({
        moduleId,
        ...perm,
      }));

      await apiRequest("POST", `/api/user-roles/${selectedRole}/rights/bulk`, { rights: rightsToSave });
      toast({ title: "Success", description: "Permissions saved successfully" });
      refetchRights();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save permissions", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || rightsLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No system modules defined. Create modules in the Modules tab first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="role-select">Select Role:</Label>
          <Select value={selectedRole || ""} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[200px]" data-testid="select-permission-role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(role => (
                <SelectItem key={role.id} value={role.id} data-testid={`option-role-${role.id}`}>
                  {role.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={savePermissions} disabled={isSaving || !selectedRole} data-testid="button-save-permissions">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Permissions
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Module</TableHead>
              <TableHead className="text-center w-24">
                <div className="flex flex-col items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">View</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-24">
                <div className="flex flex-col items-center gap-1">
                  <FilePlus className="h-4 w-4" />
                  <span className="text-xs">Create</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-24">
                <div className="flex flex-col items-center gap-1">
                  <FileEdit className="h-4 w-4" />
                  <span className="text-xs">Edit</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-24">
                <div className="flex flex-col items-center gap-1">
                  <Trash className="h-4 w-4" />
                  <span className="text-xs">Delete</span>
                </div>
              </TableHead>
              <TableHead className="text-center w-24">All</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((mod, index) => {
              const perm = permissions[mod.id] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
              const allEnabled = perm.canView && perm.canCreate && perm.canEdit && perm.canDelete;
              
              return (
                <TableRow key={mod.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{mod.displayName}</span>
                      <span className="text-xs text-muted-foreground">{mod.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canView}
                      onCheckedChange={() => togglePermission(mod.id, 'canView')}
                      data-testid={`checkbox-view-${mod.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canCreate}
                      onCheckedChange={() => togglePermission(mod.id, 'canCreate')}
                      data-testid={`checkbox-create-${mod.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canEdit}
                      onCheckedChange={() => togglePermission(mod.id, 'canEdit')}
                      data-testid={`checkbox-edit-${mod.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={perm.canDelete}
                      onCheckedChange={() => togglePermission(mod.id, 'canDelete')}
                      data-testid={`checkbox-delete-${mod.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={allEnabled}
                      onCheckedChange={(checked) => toggleAllForModule(mod.id, !!checked)}
                      data-testid={`checkbox-all-${mod.id}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span>View: Can view records</span>
        </div>
        <div className="flex items-center gap-2">
          <FilePlus className="h-4 w-4" />
          <span>Create: Can create new records</span>
        </div>
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4" />
          <span>Edit: Can modify records</span>
        </div>
        <div className="flex items-center gap-2">
          <Trash className="h-4 w-4" />
          <span>Delete: Can delete records</span>
        </div>
      </div>
    </div>
  );
}
