import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Loader2, BookOpen, ArrowRight, Sparkles, FileText, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

interface SearchResult {
  id: string;
  content: string;
  languageCode?: string;
  similarity: number;
  source: {
    id: string;
    title: string;
    category: string;
    languageCode?: string;
  } | null;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  searchDurationMs: number;
  totalResults: number;
}

const categories = [
  { value: "", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "sales", label: "Sales" },
  { value: "implementation", label: "Implementation" },
  { value: "support", label: "Support" },
  { value: "product", label: "Product" },
  { value: "faq", label: "FAQ" },
  { value: "training", label: "Training" },
  { value: "policy", label: "Policy" },
  { value: "accounts", label: "Accounts" },
  { value: "development", label: "Development" },
  { value: "hr_admin", label: "HR & Admin" },
  { value: "digital_marketing", label: "Digital Marketing" },
];

export default function KnowledgeBaseSearch() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [languageCode, setLanguageCode] = useState("en");
  const [includeCrossLanguage, setIncludeCrossLanguage] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);

  const { data: metadata } = useQuery<KnowledgeBaseMetadata>({
    queryKey: ["/api/knowledge-base/metadata"],
  });

  const searchMutation = useMutation({
    mutationFn: async ({ query, category, languageCode, includeCrossLanguage }: { 
      query: string; 
      category?: string; 
      languageCode?: string;
      includeCrossLanguage?: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/knowledge-base/search", {
        query,
        category: category || undefined,
        languageCode,
        includeCrossLanguage,
        limit: 10,
      });
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      setResults(data);
    },
    onError: (error: Error) => {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({ title: "Please enter a search query", variant: "destructive" });
      return;
    }
    searchMutation.mutate({ query: query.trim(), category, languageCode, includeCrossLanguage });
  };

  const getLanguageName = (code: string) => {
    const lang = metadata?.languages?.find(l => l.code === code);
    return lang?.nativeName || code;
  };

  const getCategoryLabel = (cat: string) => {
    const found = categories.find(c => c.value === cat);
    return found?.label || cat;
  };

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`;
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "bg-green-500/20 text-green-700 dark:text-green-400";
    if (similarity >= 0.6) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    return "bg-gray-500/20 text-gray-700 dark:text-gray-400";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-lg sm:text-xl font-bold" data-testid="text-search-title">Knowledge Base</h1>
        </div>
        <p className="text-muted-foreground">
          Search our documentation, FAQs, and guides using natural language. 
          Ask questions like "How do I create a lead?" or "What is the implementation process?"
        </p>
      </div>

      <form onSubmit={handleSearch} className="max-w-3xl mx-auto space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Ask a question or search for information..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12"
              data-testid="input-search-query"
            />
          </div>
          <Button type="submit" size="lg" disabled={searchMutation.isPending} data-testid="button-search">
            {searchMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Search
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Select value={category || "all"} onValueChange={(val) => setCategory(val === "all" ? "" : val)}>
            <SelectTrigger className="w-[160px]" data-testid="select-search-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="implementation">Implementation</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
            </SelectContent>
          </Select>
          <Select value={languageCode} onValueChange={setLanguageCode}>
            <SelectTrigger className="w-[160px]" data-testid="select-search-language">
              <Globe className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {metadata?.languages?.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="cross-language"
              checked={includeCrossLanguage}
              onCheckedChange={setIncludeCrossLanguage}
              data-testid="switch-cross-language"
            />
            <Label htmlFor="cross-language" className="text-sm cursor-pointer">
              Include all languages
            </Label>
          </div>
        </div>
      </form>

      {results && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found {results.totalResults} result{results.totalResults !== 1 ? "s" : ""} for "{results.query}"
            </p>
            <p className="text-sm text-muted-foreground">
              Search completed in {results.searchDurationMs}ms
            </p>
          </div>

          {results.results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No results found</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-2">
                  Try rephrasing your question or using different keywords.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {results.results.map((result, index) => (
                <Card key={result.id} className="hover-elevate" data-testid={`card-result-${index}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-base">
                          {result.source?.title || "Untitled Document"}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {result.source?.category && (
                          <Badge variant="outline">
                            {getCategoryLabel(result.source.category)}
                          </Badge>
                        )}
                        {result.source?.languageCode && (
                          <Badge variant="secondary">
                            {getLanguageName(result.source.languageCode)}
                          </Badge>
                        )}
                        <Badge className={getSimilarityColor(result.similarity)}>
                          {formatSimilarity(result.similarity)} match
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {result.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!results && !searchMutation.isPending && (
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover-elevate cursor-pointer" onClick={() => setQuery("How do I create a new lead?")}>
              <CardContent className="pt-6">
                <p className="text-sm font-medium">How do I create a new lead?</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => setQuery("What are the implementation steps?")}>
              <CardContent className="pt-6">
                <p className="text-sm font-medium">What are the implementation steps?</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => setQuery("How to escalate a support ticket?")}>
              <CardContent className="pt-6">
                <p className="text-sm font-medium">How to escalate a support ticket?</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Click a suggestion above or type your own question
          </p>
        </div>
      )}
    </div>
  );
}
