import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Search, UserCog, Users, ShieldCheck, LogIn, Ban, CheckCircle, Mail, Calendar, Crown, Shield } from "lucide-react";
import { format } from "date-fns";
import type { User, UserRole } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

const DEFAULT_ROLES = [
  { name: "admin", displayName: "Administrator" },
  { name: "sales_executive", displayName: "Sales Executive" },
  { name: "engineer", displayName: "Engineer" },
  { name: "support", displayName: "Support" },
];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: currentUser?.role === "admin",
  });

  const { data: roles = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
    enabled: currentUser?.role === "admin",
  });

  const availableRoles = roles.length > 0 ? roles : DEFAULT_ROLES;

  const impersonateMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await apiRequest("POST", "/api/auth/impersonate", { targetUserId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Impersonation Started",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Impersonation Failed",
        description: error.message || "Failed to impersonate user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { isActive?: boolean; role?: string } }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string, userEmail: string | null) => {
    if (userEmail === SUPER_ADMIN_EMAIL) {
      toast({
        title: "Cannot Change Role",
        description: "The super admin role cannot be modified",
        variant: "destructive",
      });
      return;
    }
    updateUserMutation.mutate({ userId, data: { role: newRole } });
  };

  const handleStatusToggle = (userId: string, currentStatus: boolean | null, userEmail: string | null) => {
    if (userEmail === SUPER_ADMIN_EMAIL) {
      toast({
        title: "Cannot Deactivate",
        description: "The super admin account cannot be deactivated",
        variant: "destructive",
      });
      return;
    }
    updateUserMutation.mutate({ userId, data: { isActive: currentStatus === false } });
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "sales_executive":
        return "secondary";
      case "engineer":
        return "outline";
      case "support":
        return "outline";
      default:
        return "secondary";
    }
  };

  const isSuperAdmin = (email: string | null) => email === SUPER_ADMIN_EMAIL;

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center">
          Only administrators can access user management.
        </p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 flex items-center gap-2">
            <UserCog className="h-7 w-7" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage users, assign roles, and control access
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold" data-testid="text-total-users">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold" data-testid="text-active-users">
                  {users.filter(u => u.isActive !== false).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administrators</p>
                <p className="text-2xl font-bold" data-testid="text-admin-count">
                  {users.filter(u => u.role === "admin").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-yellow-500/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Super Admin</p>
                <p className="text-sm font-medium truncate" data-testid="text-super-admin">
                  {SUPER_ADMIN_EMAIL.split('@')[0]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">All Users</CardTitle>
              <CardDescription>View and manage all registered users. Assign roles to control access.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Auth Provider</TableHead>
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
                            <AvatarFallback className="text-xs">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            {isSuperAdmin(user.email) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Crown className="h-4 w-4 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>Super Admin</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{user.email}</span>
                          {user.isEmailVerified && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin(user.email) ? (
                          <Badge variant="default" className="capitalize bg-yellow-500 hover:bg-yellow-600">
                            <Crown className="h-3 w-3 mr-1" />
                            Super Admin
                          </Badge>
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value, user.email)}
                            disabled={updateUserMutation.isPending}
                          >
                            <SelectTrigger 
                              className="w-[150px] h-8"
                              data-testid={`select-role-${user.id}`}
                            >
                              <SelectValue>
                                <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                                  {user.role?.replace("_", " ")}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.map((role) => (
                                <SelectItem 
                                  key={role.name} 
                                  value={role.name}
                                  data-testid={`option-role-${role.name}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {role.name === "admin" && <Shield className="h-3 w-3" />}
                                    <span className="capitalize">{role.displayName}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive !== false ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground capitalize">
                          {user.authProvider || "replit"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(user.lastLoginAt), "MMM d, yyyy")}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.id !== currentUser?.id && !isSuperAdmin(user.email) && (
                            <>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    disabled={impersonateMutation.isPending}
                                    data-testid={`button-impersonate-${user.id}`}
                                  >
                                    <LogIn className="h-4 w-4 mr-1" />
                                    Login As
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Impersonate User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      You will be logged in as <strong>{user.firstName} {user.lastName}</strong>. 
                                      You can return to your admin account at any time.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => impersonateMutation.mutate(user.id)}
                                      disabled={impersonateMutation.isPending}
                                    >
                                      {impersonateMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <LogIn className="mr-2 h-4 w-4" />
                                      )}
                                      Start Impersonation
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant={user.isActive !== false ? "ghost" : "outline"}
                                    disabled={updateUserMutation.isPending}
                                    data-testid={`button-toggle-status-${user.id}`}
                                  >
                                    {user.isActive !== false ? (
                                      <Ban className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {user.isActive !== false ? "Deactivate User" : "Activate User"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {user.isActive !== false
                                        ? `Are you sure you want to deactivate ${user.firstName} ${user.lastName}? They will no longer be able to login.`
                                        : `Are you sure you want to activate ${user.firstName} ${user.lastName}? They will be able to login again.`
                                      }
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleStatusToggle(user.id, user.isActive, user.email)}
                                      disabled={updateUserMutation.isPending}
                                    >
                                      {updateUserMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : null}
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {isSuperAdmin(user.email) && user.id !== currentUser?.id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button size="sm" variant="ghost" disabled>
                                    <Shield className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Super Admin - Protected</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Rights
          </CardTitle>
          <CardDescription>Overview of what each role can access in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">Super Admin</h3>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Full system access</li>
                <li>User management</li>
                <li>Role assignment</li>
                <li>Impersonation</li>
                <li>All modules access</li>
              </ul>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Administrator</h3>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Dashboard access</li>
                <li>All modules access</li>
                <li>Reports access</li>
                <li>Masters management</li>
                <li>User management</li>
              </ul>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="px-2">SE</Badge>
                <h3 className="font-semibold">Sales Executive</h3>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Dashboard access</li>
                <li>Tasks management</li>
                <li>Sales Pipeline</li>
                <li>Lead management</li>
                <li>Quote creation</li>
              </ul>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="px-2">ENG</Badge>
                <h3 className="font-semibold">Engineer</h3>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Dashboard access</li>
                <li>Tasks management</li>
                <li>Implementations</li>
                <li>Work Tracking</li>
                <li>Training records</li>
              </ul>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="px-2">SUP</Badge>
                <h3 className="font-semibold">Support</h3>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Dashboard access</li>
                <li>Tasks management</li>
                <li>Support Tickets</li>
                <li>Ticket escalation</li>
                <li>Customer feedback</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
