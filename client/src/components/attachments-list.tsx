import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, Download, Trash2, Loader2, Image, Music, Video, 
  File, Eye, X, Play, Pause, Volume2, VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileUploader } from "./file-uploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attachment } from "@shared/schema";

interface AttachmentsListProps {
  entityType: string;
  entityId: string;
  title?: string;
  showUploadButton?: boolean;
}

export function AttachmentsList({
  entityType,
  entityId,
  title = "Attachments",
  showUploadButton = true,
}: AttachmentsListProps) {
  const { toast } = useToast();
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const { data: attachments, isLoading } = useQuery<Attachment[]>({
    queryKey: [`/api/attachments/${entityType}/${entityId}`],
    enabled: !!entityId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/attachments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/attachments/${entityType}/${entityId}`] });
      toast({
        title: "File deleted",
        description: "The attachment has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the attachment",
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (mimeType: string): "image" | "audio" | "video" | "document" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
  };

  const getFileIcon = (mimeType: string) => {
    const type = getFileType(mimeType);
    switch (type) {
      case "image":
        return <Image className="h-5 w-5 shrink-0 text-green-500" />;
      case "audio":
        return <Music className="h-5 w-5 shrink-0 text-purple-500" />;
      case "video":
        return <Video className="h-5 w-5 shrink-0 text-blue-500" />;
      default:
        return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
    }
  };

  const canPreview = (mimeType: string): boolean => {
    const type = getFileType(mimeType);
    return type === "image" || type === "audio" || type === "video";
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderPreview = (attachment: Attachment) => {
    const type = getFileType(attachment.fileType);
    
    switch (type) {
      case "image":
        return (
          <div className="flex items-center justify-center max-h-[70vh]">
            <img 
              src={attachment.objectPath} 
              alt={attachment.fileName}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        );
      case "audio":
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-500/10 to-purple-500/5 rounded-lg">
            <div className="w-32 h-32 bg-purple-500/20 rounded-full flex items-center justify-center mb-6">
              <Music className="h-16 w-16 text-purple-500" />
            </div>
            <p className="text-lg font-medium mb-4 text-center">{attachment.fileName}</p>
            <audio 
              controls 
              autoPlay
              className="w-full max-w-md"
              data-testid="audio-player"
            >
              <source src={attachment.objectPath} type={attachment.fileType} />
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      case "video":
        return (
          <div className="flex items-center justify-center">
            <video 
              controls 
              autoPlay
              className="max-w-full max-h-[70vh] rounded-lg"
              data-testid="video-player"
            >
              <source src={attachment.objectPath} type={attachment.fileType} />
              Your browser does not support the video element.
            </video>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{attachment.fileName}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Preview not available for this file type
            </p>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{title}</h4>
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="attachments-section">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        {showUploadButton && (
          <FileUploader
            entityType={entityType}
            entityId={entityId}
            buttonSize="sm"
            buttonVariant="outline"
          >
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Upload
            </span>
          </FileUploader>
        )}
      </div>

      {(!attachments || attachments.length === 0) ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No attachments yet
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-md hover-elevate"
              data-testid={`attachment-item-${attachment.id}`}
            >
              {getFileIcon(attachment.fileType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {getFileType(attachment.fileType)}
                  </Badge>
                  <span>{formatFileSize(attachment.fileSize)}</span>
                  <span>•</span>
                  <span>{formatDate(attachment.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canPreview(attachment.fileType) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewAttachment(attachment)}
                    title="Preview"
                    data-testid={`button-preview-${attachment.id}`}
                  >
                    <Eye className="h-4 w-4 text-primary" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                  data-testid={`button-download-${attachment.id}`}
                >
                  <a href={attachment.objectPath} target="_blank" rel="noopener noreferrer" title="Download">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMutation.mutate(attachment.id)}
                  disabled={deleteMutation.isPending}
                  title="Delete"
                  data-testid={`button-delete-${attachment.id}`}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewAttachment && getFileIcon(previewAttachment.fileType)}
              <span className="truncate">{previewAttachment?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewAttachment && renderPreview(previewAttachment)}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              asChild
            >
              <a 
                href={previewAttachment?.objectPath} 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid="button-download-preview"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
            <Button onClick={() => setPreviewAttachment(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
