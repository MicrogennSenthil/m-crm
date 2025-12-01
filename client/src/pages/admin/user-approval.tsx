import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Loader2, Search, UserCheck, UserX, Clock, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SUPER_ADMIN_EMAIL = "senthil@microgenn.com";

export default function UserApproval() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users/all"],
    enabled: currentUser?.role === "admin",
  });

  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/users/${userId}/approve`, {});
      return response.json();
    },
    onSuccess: (_, userId) => {
      const user = users.find(u => u.id === userId);
      toast({ 
        title: "User Approved", 
        description: `${user?.firstName} ${user?.lastName} can now login to the system` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setApproveDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve user", variant: "destructive" });
    },
  });

  const rejectUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/reject`, { reason });
      return response.json();
    },
    onSuccess: (_, { userId }) => {
      const user = users.find(u => u.id === userId);
      toast({ 
        title: "User Rejected", 
        description: `${user?.firstName} ${user?.lastName} has been rejected and deactivated` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject user", variant: "destructive" });
    },
  });

  const revokeApprovalMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/users/${userId}/revoke-approval`, {});
      return response.json();
    },
    onSuccess: (_, userId) => {
      const user = users.find(u => u.id === userId);
      toast({ 
        title: "Approval Revoked", 
        description: `${user?.firstName} ${user?.lastName}'s approval has been revoked` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to revoke approval", variant: "destructive" });
    },
  });

  const pendingUsers = users.filter(user => !user.isApproved && user.isActive);
  const approvedUsers = users.filter(user => user.isApproved);
  const rejectedUsers = users.filter(user => !user.isApproved && !user.isActive);

  const getFilteredUsers = () => {
    let list: User[] = [];
    if (activeTab === "pending") list = pendingUsers;
    else if (activeTab === "approved") list = approvedUsers;
    else if (activeTab === "rejected") list = rejectedUsers;

    if (!searchQuery) return list;

    const searchLower = searchQuery.toLowerCase();
    return list.filter(user =>
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  };

  const filteredUsers = getFilteredUsers();

  const getUserInitials = (user: User) => {
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
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
          <h1 className="text-lg sm:text-xl font-bold" data-testid="text-page-title">User Approval</h1>
          <p className="text-muted-foreground">
            Approve or reject user registrations. Only approved users can login.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingUsers.length}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedUsers.length}</p>
                <p className="text-sm text-muted-foreground">Approved Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedUsers.length}</p>
                <p className="text-sm text-muted-foreground">Rejected Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({pendingUsers.length})
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Approved ({approvedUsers.length})
                </TabsTrigger>
                <TabsTrigger value="rejected" data-testid="tab-rejected">
                  Rejected ({rejectedUsers.length})
                </TabsTrigger>
              </TabsList>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </Tabs>
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
                  <TableHead>Registered</TableHead>
                  {activeTab === "approved" && <TableHead>Approved By</TableHead>}
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
                    <TableCell>
                      {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy h:mm a") : "-"}
                    </TableCell>
                    {activeTab === "approved" && (
                      <TableCell>
                        {user.approvedAt ? (
                          <div className="text-sm">
                            <p>{format(new Date(user.approvedAt), "MMM d, yyyy")}</p>
                          </div>
                        ) : "-"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {activeTab === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => { setSelectedUser(user); setApproveDialogOpen(true); }}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-${user.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => { setSelectedUser(user); setRejectDialogOpen(true); }}
                              data-testid={`button-reject-${user.id}`}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {activeTab === "approved" && user.email !== SUPER_ADMIN_EMAIL && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeApprovalMutation.mutate(user.id)}
                            disabled={revokeApprovalMutation.isPending}
                            data-testid={`button-revoke-${user.id}`}
                          >
                            {revokeApprovalMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Revoke
                              </>
                            )}
                          </Button>
                        )}
                        {activeTab === "rejected" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => { setSelectedUser(user); setApproveDialogOpen(true); }}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`button-reapprove-${user.id}`}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Re-approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={activeTab === "approved" ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {selectedUser?.firstName} {selectedUser?.lastName}? 
              They will be able to login to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && approveUserMutation.mutate(selectedUser.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Approve"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject {selectedUser?.firstName} {selectedUser?.lastName}? 
              Their account will be deactivated and they won't be able to login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
              data-testid="input-reject-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && rejectUserMutation.mutate({ userId: selectedUser.id, reason: rejectReason })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
