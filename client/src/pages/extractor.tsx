import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Search, Building2, Phone, Globe, Star, CheckCircle2, XCircle, Download, Loader2, MapPinned, Factory, AlertTriangle, Trash2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ExtractedPlace, ExtractorOption } from "@shared/schema";

const DEFAULT_INDUSTRY_OPTIONS = [
  "Hospitals",
  "Clinics",
  "Dental Clinics",
  "Eye Hospitals",
  "Diagnostic Centers",
  "Pharmacies",
  "Medical Stores",
  "Healthcare",
  "Laboratories",
  "Nursing Homes",
  "Other"
];

const DEFAULT_SEGMENT_OPTIONS = [
  "Enterprise",
  "Mid-Market",
  "Small Business",
  "Startup",
  "Government",
  "Non-Profit"
];

interface ExtractedPlaceResult {
  googlePlaceId: string;
  businessName: string;
  contactPhone: string | null;
  website: string | null;
  address: string;
  city: string | null;
  area: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  reviewCount: number | null;
  industry: string | null;
  segment: string | null;
  priceLevel: string | null;
  businessStatus: string;
}

export default function ExtractorPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [industry, setIndustry] = useState("");
  const [segment, setSegment] = useState("");
  const [searchResults, setSearchResults] = useState<ExtractedPlaceResult[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [newIndustry, setNewIndustry] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [isAddingIndustry, setIsAddingIndustry] = useState(false);
  const [isAddingSegment, setIsAddingSegment] = useState(false);

  // Fetch custom extractor options
  const { data: customOptions = [] } = useQuery<ExtractorOption[]>({
    queryKey: ["/api/extractor/options"],
  });

  // Combine default and custom options
  const customIndustries = customOptions.filter(o => o.type === 'industry').map(o => o.label);
  const customSegments = customOptions.filter(o => o.type === 'segment').map(o => o.label);
  const allIndustries = [...DEFAULT_INDUSTRY_OPTIONS, ...customIndustries.filter(i => !DEFAULT_INDUSTRY_OPTIONS.includes(i))];
  const allSegments = [...DEFAULT_SEGMENT_OPTIONS, ...customSegments.filter(s => !DEFAULT_SEGMENT_OPTIONS.includes(s))];

  // Fetch saved extracted places
  const { data: savedPlaces = [], isLoading: isLoadingSaved } = useQuery<ExtractedPlace[]>({
    queryKey: ["/api/extractor/places", { isImported: "false" }],
  });

  // Add new option mutation
  const addOptionMutation = useMutation({
    mutationFn: async ({ type, value, label }: { type: 'industry' | 'segment'; value: string; label: string }) => {
      const response = await apiRequest("POST", "/api/extractor/options", { type, value, label });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/options"] });
      toast({
        title: "Added Successfully",
        description: `New ${variables.type} "${variables.label}" has been added`,
      });
      if (variables.type === 'industry') {
        setNewIndustry("");
        setIsAddingIndustry(false);
        setIndustry(variables.label);
      } else {
        setNewSegment("");
        setIsAddingSegment(false);
        setSegment(variables.label);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add",
        description: error.message || "Failed to add new option",
        variant: "destructive",
      });
    }
  });

  // Delete option mutation
  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/extractor/options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/options"] });
      toast({
        title: "Deleted",
        description: "Option removed successfully",
      });
    }
  });

  const handleAddIndustry = () => {
    if (!newIndustry.trim()) return;
    addOptionMutation.mutate({ 
      type: 'industry', 
      value: newIndustry.toLowerCase().replace(/\s+/g, '_'), 
      label: newIndustry.trim() 
    });
  };

  const handleAddSegment = () => {
    if (!newSegment.trim()) return;
    addOptionMutation.mutate({ 
      type: 'segment', 
      value: newSegment.toLowerCase().replace(/\s+/g, '_'), 
      label: newSegment.trim() 
    });
  };

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/extractor/search", {
        query: searchQuery,
        city,
        area,
        industry,
        segment
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.places || []);
      setHasSearched(true);
      setSelectedPlaces(new Set());
      toast({
        title: "Search Complete",
        description: `Found ${data.total || 0} businesses`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search Google Maps",
        variant: "destructive",
      });
    }
  });

  // Save places mutation
  const savePlacesMutation = useMutation({
    mutationFn: async (places: ExtractedPlaceResult[]) => {
      const response = await apiRequest("POST", "/api/extractor/places", {
        places,
        searchQuery: `${searchQuery} ${city} ${area}`.trim()
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/places"] });
      setSearchResults([]);
      setSelectedPlaces(new Set());
      toast({
        title: "Saved Successfully",
        description: `Saved ${data.saved} places for review`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save places",
        variant: "destructive",
      });
    }
  });

  // Import as seeds mutation
  const importMutation = useMutation({
    mutationFn: async (placeIds: string[]) => {
      const response = await apiRequest("POST", "/api/extractor/import-as-seeds", {
        placeIds,
        skipDuplicates: true
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/places"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} seeds. ${data.skipped > 0 ? `Skipped ${data.skipped} (${data.duplicates?.length || 0} duplicates)` : ""}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import as seeds",
        variant: "destructive",
      });
    }
  });

  // Delete place mutation
  const deletePlaceMutation = useMutation({
    mutationFn: async (placeId: string) => {
      await apiRequest("DELETE", `/api/extractor/places/${placeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extractor/places"] });
      toast({
        title: "Deleted",
        description: "Place removed from list",
      });
    }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate();
  };

  const toggleSelectAll = (places: ExtractedPlaceResult[]) => {
    if (selectedPlaces.size === places.length) {
      setSelectedPlaces(new Set());
    } else {
      setSelectedPlaces(new Set(places.map(p => p.googlePlaceId)));
    }
  };

  const toggleSelect = (placeId: string) => {
    const newSelected = new Set(selectedPlaces);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaces(newSelected);
  };

  const handleSaveSelected = () => {
    const placesToSave = searchResults.filter(p => selectedPlaces.has(p.googlePlaceId));
    if (placesToSave.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one place to save",
        variant: "destructive",
      });
      return;
    }
    savePlacesMutation.mutate(placesToSave);
  };

  const handleImportSelected = (places: ExtractedPlace[]) => {
    const selectedIds = places
      .filter(p => selectedPlaces.has(p.id))
      .map(p => p.id);
    
    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one place to import",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(selectedIds);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPinned className="h-6 w-6 text-primary" />
            Google Maps Extractor
          </h1>
          <p className="text-muted-foreground">
            Search and extract business data from Google Maps to create new seeds
          </p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Businesses
          </CardTitle>
          <CardDescription>
            Enter search criteria to find businesses on Google Maps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="search-query">Search Query *</Label>
              <Input
                id="search-query"
                placeholder="e.g., Hospitals, Dental Clinics, Healthcare Centers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-search-query"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., Chennai, Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                data-testid="input-city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area / Locality</Label>
              <Input
                id="area"
                placeholder="e.g., Anna Nagar, Andheri"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                data-testid="input-area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <div className="flex gap-2">
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry" data-testid="select-industry" className="flex-1">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {allIndustries.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isAddingIndustry} onOpenChange={setIsAddingIndustry}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline" data-testid="button-add-industry">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Industry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-industry">Industry Name</Label>
                        <Input
                          id="new-industry"
                          placeholder="e.g., Veterinary Clinics"
                          value={newIndustry}
                          onChange={(e) => setNewIndustry(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddIndustry()}
                          data-testid="input-new-industry"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleAddIndustry} 
                        disabled={!newIndustry.trim() || addOptionMutation.isPending}
                        data-testid="button-save-industry"
                      >
                        {addOptionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Industry"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment">Segment</Label>
              <div className="flex gap-2">
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger id="segment" data-testid="select-segment" className="flex-1">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Segments</SelectItem>
                    {allSegments.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isAddingSegment} onOpenChange={setIsAddingSegment}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline" data-testid="button-add-segment">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Segment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-segment">Segment Name</Label>
                        <Input
                          id="new-segment"
                          placeholder="e.g., Healthcare Chain"
                          value={newSegment}
                          onChange={(e) => setNewSegment(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSegment()}
                          data-testid="input-new-segment"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleAddSegment} 
                        disabled={!newSegment.trim() || addOptionMutation.isPending}
                        data-testid="button-save-segment"
                      >
                        {addOptionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Segment"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button 
              onClick={handleSearch} 
              disabled={searchMutation.isPending}
              data-testid="button-search"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search Google Maps
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Search Results
                </CardTitle>
                <CardDescription>
                  Found {searchResults.length} businesses
                </CardDescription>
              </div>
              {searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedPlaces.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSelectAll(searchResults)}
                    data-testid="button-select-all-results"
                  >
                    {selectedPlaces.size === searchResults.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSelected}
                    disabled={selectedPlaces.size === 0 || savePlacesMutation.isPending}
                    data-testid="button-save-selected"
                  >
                    {savePlacesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Save Selected
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No businesses found. Try a different search query or location.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedPlaces.size === searchResults.length}
                          onCheckedChange={() => toggleSelectAll(searchResults)}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((place) => (
                      <TableRow key={place.googlePlaceId} data-testid={`row-result-${place.googlePlaceId}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPlaces.has(place.googlePlaceId)}
                            onCheckedChange={() => toggleSelect(place.googlePlaceId)}
                            data-testid={`checkbox-${place.googlePlaceId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{place.businessName}</div>
                          {place.website && (
                            <a 
                              href={place.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1 text-sm">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{place.address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {place.contactPhone ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {place.contactPhone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {place.rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm">{place.rating}</span>
                              {place.reviewCount && (
                                <span className="text-xs text-muted-foreground">
                                  ({place.reviewCount})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={place.businessStatus === "OPERATIONAL" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {place.businessStatus === "OPERATIONAL" ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Open</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> {place.businessStatus}</>
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Saved Places (Not Yet Imported) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Saved Places (Pending Import)
              </CardTitle>
              <CardDescription>
                {savedPlaces.length} places ready to import as seeds
              </CardDescription>
            </div>
            {savedPlaces.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    // Select all saved places
                    setSelectedPlaces(new Set(savedPlaces.map(p => p.id)));
                  }}
                  variant="outline"
                  size="sm"
                  data-testid="button-select-all-saved"
                >
                  Select All
                </Button>
                <Button
                  onClick={() => handleImportSelected(savedPlaces)}
                  disabled={selectedPlaces.size === 0 || importMutation.isPending}
                  data-testid="button-import-seeds"
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import as Seeds
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSaved ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedPlaces.length === 0 ? (
            <Alert>
              <AlertDescription>
                No saved places. Search and save places from Google Maps to see them here.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={savedPlaces.length > 0 && savedPlaces.every(p => selectedPlaces.has(p.id))}
                        onCheckedChange={() => {
                          if (savedPlaces.every(p => selectedPlaces.has(p.id))) {
                            setSelectedPlaces(new Set());
                          } else {
                            setSelectedPlaces(new Set(savedPlaces.map(p => p.id)));
                          }
                        }}
                        data-testid="checkbox-select-all-saved"
                      />
                    </TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedPlaces.map((place) => (
                    <TableRow key={place.id} data-testid={`row-saved-${place.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPlaces.has(place.id)}
                          onCheckedChange={() => {
                            const newSelected = new Set(selectedPlaces);
                            if (newSelected.has(place.id)) {
                              newSelected.delete(place.id);
                            } else {
                              newSelected.add(place.id);
                            }
                            setSelectedPlaces(newSelected);
                          }}
                          data-testid={`checkbox-saved-${place.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{place.businessName}</div>
                        {place.website && (
                          <a 
                            href={place.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                          >
                            {place.website}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>{place.city || "N/A"}</TableCell>
                      <TableCell>{place.area || "N/A"}</TableCell>
                      <TableCell>
                        {place.contactPhone || <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell>
                        {place.industry && (
                          <Badge variant="outline" className="text-xs">
                            {place.industry}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePlaceMutation.mutate(place.id)}
                          disabled={deletePlaceMutation.isPending}
                          data-testid={`button-delete-${place.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
