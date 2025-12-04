import { useState } from "react";
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
  Loader2, Search, KeyRound, Users, Building2, CheckCircle, XCircle, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import type { User, Department } from "@shared/schema";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface CanManagePasswordsResponse {
  canManage: boolean;
  role: string | null;
  managedDepartments: { id: string; name: string }[];
}

export default function DepartmentUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [sendEmailNotification, setSendEmailNotification] = useState(true);

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery<CanManagePasswordsResponse>({
    queryKey: ["/api/can-manage-passwords"],
  });

  const { data: departmentUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/department-users"],
    enabled: !!permissionsData?.canManage,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword, sendEmail }: { userId: string; newPassword: string; sendEmail: boolean }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/reset-password`, { newPassword, sendEmail });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Password Reset", 
        description: data.message || "Password has been reset successfully",
      });
      setPasswordResetDialogOpen(false);
      setPasswordResetTarget(null);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" });
    },
  });

  const handlePasswordResetClick = (user: User) => {
    setPasswordResetTarget(user);
    setNewPassword("");
    setSendEmailNotification(true);
    setPasswordResetDialogOpen(true);
  };

  const handlePasswordReset = () => {
    if (passwordResetTarget && newPassword.length >= 8) {
      resetPasswordMutation.mutate({
        userId: passwordResetTarget.id,
        newPassword,
        sendEmail: sendEmailNotification,
      });
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const getUserInitials = (user: User) => {
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || "?";
  };

  const getDepartmentName = (departmentId: string | null | undefined) => {
    if (!departmentId) return "-";
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || "-";
  };

  const filteredUsers = departmentUsers.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  const isLoading = permissionsLoading || usersLoading;

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!permissionsLoading && !permissionsData?.canManage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-center max-w-md">
              You need to be an admin or department head to access this page. 
              Department heads can manage passwords for users in their department.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Department User Management
              </CardTitle>
              <CardDescription>
                {permissionsData?.role === "admin" 
                  ? "Manage passwords for all users (Admin)"
                  : `Manage passwords for users in: ${permissionsData?.managedDepartments.map(d => d.name).join(", ")}`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-department-users"
              />
            </div>
          </div>

          {permissionsData?.role === "department_head" && permissionsData.managedDepartments.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {permissionsData.managedDepartments.map(dept => (
                <Badge key={dept.id} variant="outline" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {dept.name}
                </Badge>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-dept-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profileImageUrl || undefined} />
                            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.role?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getDepartmentName(user.departmentId)}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePasswordResetClick(user)}
                          disabled={user.id === currentUser?.id}
                          title={user.id === currentUser?.id ? "Cannot reset your own password here" : "Reset Password"}
                          data-testid={`button-reset-password-${user.id}`}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Reset Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No users found in your department(s)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={passwordResetDialogOpen} onOpenChange={setPasswordResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {passwordResetTarget?.firstName} {passwordResetTarget?.lastName} ({passwordResetTarget?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  data-testid="input-new-password"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={generateRandomPassword}
                  data-testid="button-generate-password"
                >
                  Generate
                </Button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-sm text-destructive">Password must be at least 8 characters</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="send-email" className="text-sm">
                Send password to user via email
              </Label>
              <Switch
                id="send-email"
                checked={sendEmailNotification}
                onCheckedChange={setSendEmailNotification}
                data-testid="switch-send-email"
              />
            </div>

            {!sendEmailNotification && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Make sure to share the password with the user manually.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setPasswordResetDialogOpen(false);
                setPasswordResetTarget(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordReset}
              disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
