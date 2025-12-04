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
  Loader2, Search, Plus, Pencil, Trash2, CheckCircle, XCircle, AlertTriangle, ArrowRightLeft
} from "lucide-react";
import { format } from "date-fns";
import type { User, UserRole, Department } from "@shared/schema";
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
import { Switch } from "@/components/ui/switch";

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

interface UserAssignments {
  leads: number;
  tasks: number;
  tickets: number;
  projects: number;
  total: number;
}

export default function UserMaster() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [reassignTarget, setReassignTarget] = useState<User | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [userAssignments, setUserAssignments] = useState<UserAssignments | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "sales_executive",
    departmentId: "",
    isActive: true,
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
    enabled: currentUser?.role === "admin",
  });

  const { data: roles = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  useEffect(() => {
    if (editingUser) {
      console.log("Setting form data from editingUser:", editingUser);
      console.log("editingUser.role:", editingUser.role);
      setFormData({
        email: editingUser.email || "",
        firstName: editingUser.firstName || "",
        lastName: editingUser.lastName || "",
        role: editingUser.role || "sales_executive",
        departmentId: editingUser.departmentId || "",
        isActive: editingUser.isActive ?? true,
      });
    } else {
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "sales_executive",
        departmentId: "",
        isActive: true,
      });
    }
  }, [editingUser]);

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Created", description: "New user has been created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User has been updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`);
      return response.json();
    },
    onSuccess: (data: { message: string; deactivated?: boolean }) => {
      if (data.deactivated) {
        toast({ 
          title: "User Deactivated", 
          description: data.message,
          variant: "default"
        });
      } else {
        toast({ title: "User Deleted", description: "User has been deleted successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) => {
      const response = await apiRequest("POST", `/api/users/${fromUserId}/reassign`, { toUserId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Items Reassigned", 
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setReassignDialogOpen(false);
      setReassignTarget(null);
      setReassignToUserId("");
      setUserAssignments(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reassign items", variant: "destructive" });
    },
  });

  // Function to check user assignments before delete
  const handleDeleteClick = async (user: User) => {
    setDeleteTarget(user);
    setLoadingAssignments(true);
    
    try {
      const response = await apiRequest("GET", `/api/users/${user.id}/assignments`);
      const assignments = await response.json() as UserAssignments;
      setUserAssignments(assignments);
      
      if (assignments.total > 0) {
        // User has assignments, show reassign dialog
        setReassignTarget(user);
        setReassignDialogOpen(true);
      } else {
        // No assignments, show regular delete dialog
        setDeleteDialogOpen(true);
      }
    } catch (error) {
      // If error, just show regular delete dialog
      setDeleteDialogOpen(true);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleReassignAndDeactivate = () => {
    if (reassignTarget && reassignToUserId) {
      reassignMutation.mutate(
        { fromUserId: reassignTarget.id, toUserId: reassignToUserId },
        {
          onSuccess: () => {
            // After reassignment, deactivate the user
            updateUserMutation.mutate({ 
              id: reassignTarget.id, 
              data: { isActive: false } 
            });
          }
        }
      );
    }
  };

  const handleDeactivateWithoutReassign = () => {
    if (reassignTarget) {
      updateUserMutation.mutate(
        { id: reassignTarget.id, data: { isActive: false } },
        {
          onSuccess: () => {
            toast({ 
              title: "User Deactivated", 
              description: "User has been deactivated. Their assigned items remain unchanged.",
            });
            setReassignDialogOpen(false);
            setReassignTarget(null);
            setUserAssignments(null);
          }
        }
      );
    }
  };

  // Get active users for reassignment (excluding the user being deleted)
  const activeUsersForReassign = users.filter(
    u => u.isActive && u.id !== reassignTarget?.id
  );

  const handleSubmit = () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const submitData = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      departmentId: formData.departmentId || undefined,
      isActive: formData.isActive,
    };

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: submitData });
    } else {
      createUserMutation.mutate(submitData);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  const getUserInitials = (user: User) => {
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "-";
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || "-";
  };

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" data-testid="text-page-title">User Master</h1>
          <p className="text-muted-foreground">Manage system users</p>
        </div>
        <Button 
          onClick={() => { setEditingUser(null); setUserDialogOpen(true); }}
          data-testid="button-add-user"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Badge variant="secondary">{filteredUsers.length} Users</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Approved</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
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
                          <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          {user.email === SUPER_ADMIN_EMAIL && (
                            <Badge variant="default" className="text-xs">Super Admin</Badge>
                          )}
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
                    <TableCell className="hidden sm:table-cell">
                      {user.isApproved ? (
                        <Badge variant="default" className="bg-green-500">Approved</Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-500 border-orange-500">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingUser(user); setUserDialogOpen(true); }}
                          disabled={user.email === SUPER_ADMIN_EMAIL && currentUser?.email !== SUPER_ADMIN_EMAIL}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(user)}
                          disabled={user.email === SUPER_ADMIN_EMAIL || loadingAssignments}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user information" : "Create a new user in the system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter first name"
                  data-testid="input-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter last name"
                  data-testid="input-user-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                disabled={!!editingUser}
                data-testid="input-user-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    console.log("Role changed to:", value);
                    setFormData({ ...formData, role: value });
                  }}
                >
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue placeholder="Select role">
                      {roles.find(r => r.name === formData.role)?.displayName || formData.role || "Select role"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.isActive).map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.departmentId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-user-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No Department</SelectItem>
                    {departments.filter(d => d.isActive).map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active Status</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-user-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {(createUserMutation.isPending || updateUserMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.firstName} {deleteTarget?.lastName}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassignment Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={(open) => {
        setReassignDialogOpen(open);
        if (!open) {
          setReassignTarget(null);
          setReassignToUserId("");
          setUserAssignments(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              User Has Assigned Items
            </DialogTitle>
            <DialogDescription>
              {reassignTarget?.firstName} {reassignTarget?.lastName} has items assigned that need to be handled before deactivation.
            </DialogDescription>
          </DialogHeader>
          
          {userAssignments && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Assigned Items:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {userAssignments.leads > 0 && (
                    <div className="flex justify-between">
                      <span>Leads:</span>
                      <Badge variant="secondary">{userAssignments.leads}</Badge>
                    </div>
                  )}
                  {userAssignments.tasks > 0 && (
                    <div className="flex justify-between">
                      <span>Tasks:</span>
                      <Badge variant="secondary">{userAssignments.tasks}</Badge>
                    </div>
                  )}
                  {userAssignments.tickets > 0 && (
                    <div className="flex justify-between">
                      <span>Tickets:</span>
                      <Badge variant="secondary">{userAssignments.tickets}</Badge>
                    </div>
                  )}
                  {userAssignments.projects > 0 && (
                    <div className="flex justify-between">
                      <span>Projects:</span>
                      <Badge variant="secondary">{userAssignments.projects}</Badge>
                    </div>
                  )}
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                  <span>Total:</span>
                  <Badge>{userAssignments.total}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Reassign items to:
                </Label>
                <Select
                  value={reassignToUserId}
                  onValueChange={setReassignToUserId}
                >
                  <SelectTrigger data-testid="select-reassign-user">
                    <SelectValue placeholder="Select an active user" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsersForReassign.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setReassignDialogOpen(false);
                setReassignTarget(null);
                setReassignToUserId("");
                setUserAssignments(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleDeactivateWithoutReassign}
              disabled={updateUserMutation.isPending}
              data-testid="button-deactivate-only"
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Deactivate Only
            </Button>
            <Button
              onClick={handleReassignAndDeactivate}
              disabled={!reassignToUserId || reassignMutation.isPending}
              data-testid="button-reassign-deactivate"
            >
              {reassignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reassign & Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
