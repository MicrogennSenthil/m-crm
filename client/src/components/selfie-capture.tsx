import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, RotateCcw, Check, X, Loader2, FlipHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SelfieCaptureProps {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  isUploading?: boolean;
}

export function SelfieCapture({ onCapture, onCancel, isUploading }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setError(
        err.name === "NotAllowedError" 
          ? "Camera access denied. Please allow camera access to take a selfie."
          : err.name === "NotFoundError"
          ? "No camera found on this device."
          : "Unable to access camera. Please try again."
      );
      setIsLoading(false);
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
  }, [facingMode]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const xOffset = (video.videoWidth - size) / 2;
    const yOffset = (video.videoHeight - size) / 2;

    if (facingMode === "user") {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, xOffset, yOffset, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }, "image/jpeg", 0.9);
  }, [facingMode, stream]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCapturedBlob(null);
    startCamera();
  }, [startCamera]);

  const confirmCapture = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  }, [capturedBlob, onCapture]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden bg-muted border-4 border-primary/20">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        
        {!capturedImage && !error && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            data-testid="video-selfie-preview"
          />
        )}
        
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="w-full h-full object-cover"
            data-testid="img-captured-selfie"
          />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center gap-3">
        {!capturedImage ? (
          <>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onCancel}
              disabled={isLoading}
              data-testid="button-cancel-selfie"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <Button
              size="lg"
              className="rounded-full h-16 w-16"
              onClick={capturePhoto}
              disabled={isLoading || !!error}
              data-testid="button-capture-selfie"
            >
              <Camera className="h-6 w-6" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              disabled={isLoading}
              data-testid="button-switch-camera"
            >
              <FlipHorizontal className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={retakePhoto}
              disabled={isUploading}
              data-testid="button-retake-selfie"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            
            <Button
              onClick={confirmCapture}
              disabled={isUploading}
              data-testid="button-confirm-selfie"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Use Photo
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

interface SelfieCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (blob: Blob) => void;
  isUploading?: boolean;
}

export function SelfieCaptureDialog({ 
  open, 
  onOpenChange, 
  onCapture,
  isUploading 
}: SelfieCaptureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Take a Selfie
          </DialogTitle>
          <DialogDescription>
            Position yourself in the center of the frame and click the capture button.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <SelfieCapture
            onCapture={onCapture}
            onCancel={() => onOpenChange(false)}
            isUploading={isUploading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
