import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface FileUploaderProps {
  entityType: string;
  entityId: string;
  onComplete?: () => void;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string;
}

interface SelectedFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function FileUploader({
  entityType,
  entityId,
  onComplete,
  buttonVariant = "outline",
  buttonSize = "sm",
  children,
  disabled = false,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024,
  acceptedTypes = "*/*",
}: FileUploaderProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: SelectedFile[] = [];
    
    for (const file of files) {
      if (selectedFiles.length + validFiles.length >= maxFiles) {
        toast({
          title: "File limit reached",
          description: `Maximum ${maxFiles} files allowed`,
          variant: "destructive",
        });
        break;
      }
      
      if (file.size > maxFileSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB limit`,
          variant: "destructive",
        });
        continue;
      }
      
      validFiles.push({
        file,
        progress: 0,
        status: "pending",
      });
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    setIsUploading(true);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const selectedFile = selectedFiles[i];
      if (selectedFile.status !== "pending") continue;
      
      try {
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "uploading" as const, progress: 10 } : f
        ));
        
        const uploadUrlResponse = await fetch("/api/objects/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fileName: selectedFile.file.name }),
        });
        
        if (!uploadUrlResponse.ok) {
          throw new Error("Failed to get upload URL");
        }
        
        const { uploadURL, objectPath } = await uploadUrlResponse.json();
        
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 30 } : f
        ));
        
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: selectedFile.file,
          headers: {
            "Content-Type": selectedFile.file.type || "application/octet-stream",
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }
        
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 70 } : f
        ));
        
        await apiRequest("POST", "/api/attachments", {
          entityType,
          entityId,
          fileName: selectedFile.file.name,
          fileType: selectedFile.file.type || "application/octet-stream",
          fileSize: selectedFile.file.size,
          objectPath,
        });
        
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "done" as const, progress: 100 } : f
        ));
        
      } catch (error) {
        console.error("Upload error:", error);
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "error" as const, error: "Upload failed" } : f
        ));
      }
    }
    
    setIsUploading(false);
    
    const successCount = selectedFiles.filter(f => f.status === "done").length;
    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${successCount} file(s)`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/attachments/${entityType}/${entityId}`] });
      onComplete?.();
    }
    
    setTimeout(() => {
      setSelectedFiles([]);
      setShowDialog(false);
    }, 1500);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant={buttonVariant}
        size={buttonSize}
        disabled={disabled}
        data-testid="button-upload-file"
      >
        {children}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to select files or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max {maxFiles} files, up to {(maxFileSize / (1024 * 1024)).toFixed(0)}MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes}
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
            </div>
            
            {selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((selected, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                    data-testid={`file-item-${index}`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{selected.file.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(selected.file.size)}
                        </span>
                        {selected.status === "uploading" && (
                          <Progress value={selected.progress} className="h-1 flex-1" />
                        )}
                        {selected.status === "done" && (
                          <span className="text-xs text-green-600">Done</span>
                        )}
                        {selected.status === "error" && (
                          <span className="text-xs text-destructive">{selected.error}</span>
                        )}
                      </div>
                    </div>
                    {selected.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFiles([]);
                setShowDialog(false);
              }}
              disabled={isUploading}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={selectedFiles.length === 0 || isUploading || selectedFiles.every(f => f.status !== "pending")}
              data-testid="button-start-upload"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>Upload {selectedFiles.filter(f => f.status === "pending").length} file(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
