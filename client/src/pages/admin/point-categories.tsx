import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Star,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Target,
  FileText,
  Headphones,
  Briefcase,
  Settings,
  TrendingUp,
  TrendingDown,
  Award,
  Users,
} from "lucide-react";
import type { PointCategory, PointCategoryDepartmentSetting, UserPointBalance, UserPointLedger, User, Department } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

const pointCategorySchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  description: z.string().optional(),
  moduleType: z.enum(["lead", "task", "ticket", "project"]),
  basePoints: z.coerce.number().min(0, "Base points must be 0 or greater"),
  reassignPenalty: z.coerce.number().min(0, "Penalty must be 0 or greater"),
  completionBonus: z.coerce.number().min(0, "Bonus must be 0 or greater"),
  isActive: z.boolean().default(true),
});

const departmentSettingSchema = z.object({
  department: z.string().min(1, "Department is required"),
  basePoints: z.coerce.number().min(0),
  reassignPenalty: z.coerce.number().min(0),
  completionBonus: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
});

type PointCategoryFormData = z.infer<typeof pointCategorySchema>;
type DepartmentSettingFormData = z.infer<typeof departmentSettingSchema>;

const moduleTypes = [
  { value: "lead", label: "Lead", icon: Target },
  { value: "task", label: "Task", icon: FileText },
  { value: "ticket", label: "Ticket", icon: Headphones },
  { value: "project", label: "Project", icon: Briefcase },
];

export default function PointCategoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<"categories" | "user-points">("categories");
  const [activeTab, setActiveTab] = useState("lead");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PointCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PointCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<PointCategory | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const form = useForm<PointCategoryFormData>({
    resolver: zodResolver(pointCategorySchema),
    defaultValues: {
      departmentId: "",
      description: "",
      moduleType: "lead",
      basePoints: 1,
      reassignPenalty: 1,
      completionBonus: 0,
      isActive: true,
    },
  });

  const deptForm = useForm<DepartmentSettingFormData>({
    resolver: zodResolver(departmentSettingSchema),
    defaultValues: {
      department: "",
      basePoints: 1,
      reassignPenalty: 1,
      completionBonus: 0,
      isActive: true,
    },
  });

  const { data: categories = [], isLoading } = useQuery<PointCategory[]>({
    queryKey: ["/api/point-categories"],
    enabled: user?.role === "admin",
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: user?.role === "admin",
  });

  const { data: departmentSettings = [] } = useQuery<PointCategoryDepartmentSetting[]>({
    queryKey: ["/api/point-categories", selectedCategory?.id, "department-settings"],
    queryFn: () =>
      selectedCategory
        ? fetch(`/api/point-categories/${selectedCategory.id}/department-settings`).then((r) =>
            r.json()
          )
        : Promise.resolve([]),
    enabled: !!selectedCategory,
  });

  const { data: userBalances = [], isLoading: loadingBalances } = useQuery<UserPointBalance[]>({
    queryKey: ["/api/point-balances"],
    enabled: user?.role === "admin" && mainTab === "user-points",
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" && mainTab === "user-points",
  });

  const { data: userLedger = [] } = useQuery<UserPointLedger[]>({
    queryKey: ["/api/point-ledger", selectedUserId],
    queryFn: () =>
      selectedUserId
        ? fetch(`/api/point-ledger/${selectedUserId}`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selectedUserId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PointCategoryFormData) => {
      return await apiRequest("POST", "/api/point-categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/point-categories"] });
      toast({ title: "Success", description: "Point category created successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create point category",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PointCategoryFormData> }) => {
      return await apiRequest("PATCH", `/api/point-categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/point-categories"] });
      toast({ title: "Success", description: "Point category updated successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update point category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/point-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/point-categories"] });
      toast({ title: "Success", description: "Point category deleted successfully" });
      setDeleteCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete point category",
        variant: "destructive",
      });
    },
  });

  const createDeptSettingMutation = useMutation({
    mutationFn: async (data: DepartmentSettingFormData) => {
      return await apiRequest("POST", `/api/point-categories/${selectedCategory?.id}/department-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/point-categories", selectedCategory?.id, "department-settings"],
      });
      toast({ title: "Success", description: "Department override created successfully" });
      setIsDeptDialogOpen(false);
      deptForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create department override",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    form.reset({
      departmentId: "",
      description: "",
      moduleType: "lead",
      basePoints: 1,
      reassignPenalty: 1,
      completionBonus: 0,
      isActive: true,
    });
  };

  const handleEdit = (category: PointCategory) => {
    setEditingCategory(category);
    form.reset({
      departmentId: category.departmentId || "",
      description: category.description || "",
      moduleType: category.moduleType as any,
      basePoints: category.basePoints,
      reassignPenalty: category.reassignPenalty,
      completionBonus: category.completionBonus,
      isActive: category.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: PointCategoryFormData) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeptSubmit = (data: DepartmentSettingFormData) => {
    createDeptSettingMutation.mutate(data);
  };

  const filteredCategories = categories.filter((c) => c.moduleType === activeTab);

  const getDepartmentName = (departmentId: string | null | undefined) => {
    if (!departmentId) return "-";
    const dept = departmentsList.find((d) => d.id === departmentId);
    return dept?.name || "-";
  };

  const getModuleIcon = (moduleType: string) => {
    const module = moduleTypes.find((m) => m.value === moduleType);
    const Icon = module?.icon || Target;
    return <Icon className="h-4 w-4" />;
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getUserName = (userId: string) => {
    const u = allUsers.find((u) => u.id === userId);
    if (u?.firstName && u?.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    return u?.email || userId.slice(0, 8);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      assign: { label: "Assignment", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
      reassign_from: { label: "Reassign Penalty", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
      reassign_to: { label: "Reassignment", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
      complete: { label: "Completion Bonus", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
      adjustment: { label: "Adjustment", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
    };
    return labels[action] || { label: action, color: "bg-gray-100 text-gray-800" };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Points Management
          </h1>
          <p className="text-muted-foreground">
            Configure point values and view user point balances
          </p>
        </div>
        {mainTab === "categories" && (
          <Button
            onClick={() => {
              form.setValue("moduleType", activeTab as any);
              setIsDialogOpen(true);
            }}
            data-testid="button-add-category"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Settings className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="user-points" data-testid="tab-user-points">
            <Users className="h-4 w-4 mr-2" />
            User Points
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user-points" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  User Point Balances
                </CardTitle>
                <CardDescription>
                  View total and module-specific points for all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBalances ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : userBalances.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No point data available yet
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Tasks</TableHead>
                          <TableHead className="text-right">Tickets</TableHead>
                          <TableHead className="text-right">Projects</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userBalances.map((balance) => (
                          <TableRow
                            key={balance.id}
                            className={`cursor-pointer hover-elevate ${selectedUserId === balance.userId ? "bg-muted" : ""}`}
                            onClick={() => setSelectedUserId(balance.userId)}
                            data-testid={`row-user-balance-${balance.userId}`}
                          >
                            <TableCell className="font-medium">
                              {getUserName(balance.userId)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {balance.totalPoints}
                            </TableCell>
                            <TableCell className="text-right">{balance.leadPoints}</TableCell>
                            <TableCell className="text-right">{balance.taskPoints}</TableCell>
                            <TableCell className="text-right">{balance.ticketPoints}</TableCell>
                            <TableCell className="text-right">{balance.projectPoints}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Transaction History
                </CardTitle>
                <CardDescription>
                  {selectedUserId
                    ? `Point history for ${getUserName(selectedUserId)}`
                    : "Select a user to view their transaction history"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedUserId ? (
                  <p className="text-muted-foreground text-center py-8">
                    Click on a user to view their point history
                  </p>
                ) : userLedger.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No transactions found for this user
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {userLedger.map((entry) => {
                        const actionInfo = getActionLabel(entry.action);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 p-3 border rounded-lg"
                            data-testid={`ledger-entry-${entry.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                                <Badge variant="outline" className="capitalize">
                                  {entry.moduleType}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {entry.reason}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {entry.createdAt && new Date(entry.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className={`text-lg font-bold ${entry.points >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {entry.points >= 0 ? "+" : ""}{entry.points}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Lead Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.moduleType === "lead").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Task Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.moduleType === "task").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Headphones className="h-4 w-4 text-green-500" />
              Ticket Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.moduleType === "ticket").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-500" />
              Project Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.moduleType === "project").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="lead" className="gap-2" data-testid="tab-lead">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger value="task" className="gap-2" data-testid="tab-task">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="ticket" className="gap-2" data-testid="tab-ticket">
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-2" data-testid="tab-project">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Projects</span>
          </TabsTrigger>
        </TabsList>

        {["lead", "task", "ticket", "project"].map((module) => (
          <TabsContent key={module} value={module} className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {getModuleIcon(module)}
                    {moduleTypes.find((m) => m.value === module)?.label} Point Categories
                  </CardTitle>
                  <CardDescription>
                    Configure point values for {module} assignments
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No point categories defined for {module}s yet.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        form.setValue("moduleType", module as any);
                        setIsDialogOpen(true);
                      }}
                      data-testid={`button-add-first-${module}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Category
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-center">Base Points</TableHead>
                        <TableHead className="text-center">Reassign Penalty</TableHead>
                        <TableHead className="text-center">Completion Bonus</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((category) => (
                        <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{getDepartmentName(category.departmentId)}</p>
                              {category.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {category.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="gap-1">
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              +{category.basePoints}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1">
                              <TrendingDown className="h-3 w-3 text-red-500" />
                              -{category.reassignPenalty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1">
                              <Award className="h-3 w-3 text-yellow-500" />
                              +{category.completionBonus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={category.isActive ? "default" : "secondary"}>
                              {category.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedCategory(category)}
                                data-testid={`button-dept-settings-${category.id}`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(category)}
                                data-testid={`button-edit-${category.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteCategory(category)}
                                data-testid={`button-delete-${category.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
        ))}
      </Tabs>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Point Category" : "Add Point Category"}
            </DialogTitle>
            <DialogDescription>
              Configure point values for this category. Points are awarded on assignment,
              deducted on reassignment, and bonus added on completion.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentsList.filter(d => d.isActive).map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description..."
                        {...field}
                        data-testid="input-category-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moduleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-module-type">
                          <SelectValue placeholder="Select module" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {moduleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="basePoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Points</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-base-points"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">On assign</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reassignPenalty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Penalty</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-reassign-penalty"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">On reassign</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="completionBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-completion-bonus"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">On complete</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable this category for point calculations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Overrides for "{selectedCategory?.name}"
            </DialogTitle>
            <DialogDescription>
              Configure department-specific point values that override the default settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Default: Base +{selectedCategory?.basePoints}, Penalty -{selectedCategory?.reassignPenalty}, 
                Bonus +{selectedCategory?.completionBonus}
              </div>
              <Button size="sm" onClick={() => setIsDeptDialogOpen(true)} data-testid="button-add-dept-override">
                <Plus className="h-4 w-4 mr-2" />
                Add Override
              </Button>
            </div>

            {departmentSettings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No department-specific overrides configured.</p>
                <p className="text-sm">Default values will be used for all departments.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Base</TableHead>
                    <TableHead className="text-center">Penalty</TableHead>
                    <TableHead className="text-center">Bonus</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentSettings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="capitalize">{setting.department}</TableCell>
                      <TableCell className="text-center">+{setting.basePoints}</TableCell>
                      <TableCell className="text-center">-{setting.reassignPenalty}</TableCell>
                      <TableCell className="text-center">+{setting.completionBonus}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={setting.isActive ? "default" : "secondary"}>
                          {setting.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department Override</DialogTitle>
            <DialogDescription>
              Configure custom point values for a specific department.
            </DialogDescription>
          </DialogHeader>

          <Form {...deptForm}>
            <form onSubmit={deptForm.handleSubmit(handleDeptSubmit)} className="space-y-4">
              <FormField
                control={deptForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentsList.filter(d => d.isActive).map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={deptForm.control}
                  name="basePoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Points</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={deptForm.control}
                  name="reassignPenalty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Penalty</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={deptForm.control}
                  name="completionBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeptDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createDeptSettingMutation.isPending}>
                  {createDeptSettingMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Add Override
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Point Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
