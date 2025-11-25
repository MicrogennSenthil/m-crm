import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileUploader } from "./file-uploader";
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

  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.includes("pdf")) return "pdf";
    if (fileType.includes("word") || fileType.includes("document")) return "doc";
    if (fileType.includes("excel") || fileType.includes("spreadsheet")) return "xls";
    return "file";
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(attachment.fileSize)}</span>
                  <span>•</span>
                  <span>{formatDate(attachment.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                  data-testid={`button-download-${attachment.id}`}
                >
                  <a href={attachment.objectPath} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMutation.mutate(attachment.id)}
                  disabled={deleteMutation.isPending}
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
    </div>
  );
}
