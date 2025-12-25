import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, FileText, Trash2, RotateCcw, Eye, EyeOff, Search, BarChart3, BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface KnowledgeBaseSource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  contentType: string;
  languageCode: string;
  translationGroupId: string | null;
  translationStatus: string;
  isActive: boolean;
  isIndexed: boolean;
  tokenCount: number | null;
  chunkCount: number | null;
  createdAt: string;
  createdBy: string | null;
}

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

interface KnowledgeBaseMetadata {
  categories: string[];
  contentTypes: string[];
  languages: SupportedLanguage[];
}

interface Analytics {
  totalSources: number;
  activeSources: number;
  totalChunks: number;
  totalQueries: number;
  avgSearchTimeMs: number;
  recentQueries: {
    id: string;
    query: string;
    resultsCount: number;
    searchDurationMs: number;
    createdAt: string;
    user: { id: string; name: string } | null;
  }[];
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  contentType: z.string().min(1, "Content type is required"),
  languageCode: z.string().min(1, "Language is required"),
  content: z.string().min(100, "Content must be at least 100 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export default function KnowledgeBaseAdmin() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("sources");

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<KnowledgeBaseSource[]>({
    queryKey: ["/api/knowledge-base/sources"],
  });

  const { data: metadata } = useQuery<KnowledgeBaseMetadata>({
    queryKey: ["/api/knowledge-base/metadata"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/knowledge-base/analytics"],
    enabled: selectedTab === "analytics",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "general",
      contentType: "document",
      languageCode: "en",
      content: "",
    },
  });

  const handlePermissionError = (error: Error, action: string) => {
    const message = error.message.toLowerCase();
    if (message.includes("access denied") || message.includes("permission") || message.includes("403")) {
      toast({ 
        title: "Permission Required", 
        description: `You don't have permission to ${action}. Please contact your administrator.`,
      });
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/knowledge-base/sources", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Document created", description: "Document has been indexed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/analytics"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      handlePermissionError(error, "create documents");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge-base/sources/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted", description: "Document has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/analytics"] });
    },
    onError: (error: Error) => {
      handlePermissionError(error, "delete documents");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/knowledge-base/sources/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/sources"] });
    },
    onError: (error: Error) => {
      handlePermissionError(error, "update document status");
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/knowledge-base/sources/${id}/reindex`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Re-indexed", description: `Created ${data.totalChunks} chunks` });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/analytics"] });
    },
    onError: (error: Error) => {
      handlePermissionError(error, "re-index documents");
    },
  });

  const reindexAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/knowledge-base/reindex-all`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Bulk Re-index Complete", 
        description: data.indexed > 0 
          ? `Indexed ${data.indexed} documents with ${data.totalChunks} chunks` 
          : data.message 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/analytics"] });
    },
    onError: (error: Error) => {
      handlePermissionError(error, "re-index all documents");
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: "General",
      sales: "Sales",
      implementation: "Implementation",
      support: "Support",
      product: "Product",
      faq: "FAQ",
      training: "Training",
      policy: "Policy",
      accounts: "Accounts",
      development: "Development",
      hr_admin: "HR & Admin",
      digital_marketing: "Digital Marketing",
    };
    return labels[category] || category;
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      document: "Document",
      faq: "FAQ",
      guide: "Guide",
      article: "Article",
      policy: "Policy",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" data-testid="text-knowledge-base-title">Knowledge Base Management</h1>
          <p className="text-muted-foreground">Manage documents for semantic search</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => reindexAllMutation.mutate()}
            disabled={reindexAllMutation.isPending}
            data-testid="button-reindex-all"
          >
            {reindexAllMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Indexing...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Re-index All
              </>
            )}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-document">
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Document</DialogTitle>
              <DialogDescription>
                Add a document to the knowledge base. The content will be automatically chunked and indexed for semantic search.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Document title" {...field} data-testid="input-document-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description" {...field} data-testid="input-document-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {metadata?.categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {getCategoryLabel(cat)}
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
                    name="contentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-content-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {metadata?.contentTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {getContentTypeLabel(type)}
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
                    name="languageCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {metadata?.languages?.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.nativeName} ({lang.name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste your document content here..." 
                          className="min-h-[200px]"
                          {...field} 
                          data-testid="textarea-document-content"
                        />
                      </FormControl>
                      <FormDescription>
                        Content will be automatically chunked and indexed. Minimum 100 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-document">
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Indexing...
                      </>
                    ) : (
                      "Add Document"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="sources" data-testid="tab-sources">
            <BookOpen className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-6">
          {sourcesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No documents yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-2">
                  Add your first document to start building your knowledge base for semantic search.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => (
                <Card key={source.id} data-testid={`card-source-${source.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{source.title}</CardTitle>
                        {source.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {source.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant={source.isActive ? "default" : "secondary"}>
                        {source.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline">{getCategoryLabel(source.category)}</Badge>
                      <Badge variant="outline">{getContentTypeLabel(source.contentType)}</Badge>
                      <Badge variant="secondary">
                        {metadata?.languages?.find(l => l.code === source.languageCode)?.nativeName || source.languageCode}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Chunks:</span>
                        <span className="font-medium">{source.chunkCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens:</span>
                        <span className="font-medium">{source.tokenCount?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: source.id, isActive: !source.isActive })}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`button-toggle-active-${source.id}`}
                    >
                      {source.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reindexMutation.mutate(source.id)}
                      disabled={reindexMutation.isPending}
                      data-testid={`button-reindex-${source.id}`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-delete-${source.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{source.title}"? This will remove all indexed chunks and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(source.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Documents</CardDescription>
                    <CardTitle className="text-2xl">{analytics.totalSources}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Documents</CardDescription>
                    <CardTitle className="text-2xl">{analytics.activeSources}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Chunks</CardDescription>
                    <CardTitle className="text-2xl">{analytics.totalChunks.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Avg Search Time</CardDescription>
                    <CardTitle className="text-2xl">{analytics.avgSearchTimeMs}ms</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Searches</CardTitle>
                  <CardDescription>Last 20 search queries</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.recentQueries.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No search queries yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.recentQueries.map((q) => (
                        <div key={q.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{q.query}</p>
                            <p className="text-sm text-muted-foreground">
                              {q.user?.name || "Anonymous"} • {new Date(q.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p>{q.resultsCount} results</p>
                            <p className="text-muted-foreground">{q.searchDurationMs}ms</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
