import { useState, useRef, useCallback } from "react";
import { Camera, RotateCcw, X, Check, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function CameraCapture({ onCapture, onClose, isOpen }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const startCamera = useCallback(async (mode: "user" | "environment") => {
    try {
      setIsLoading(true);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
      
      setFacingMode(mode);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [stream, toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopCamera();
      setCapturedImage(null);
      onClose();
    }
  }, [facingMode, startCamera, stopCamera, onClose]);

  const switchCamera = useCallback(() => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setCapturedImage(null);
    startCamera(newMode);
  }, [facingMode, startCamera]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  }, [facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera(facingMode);
  }, [facingMode, startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
      setCapturedImage(null);
      onClose();
    }
  }, [capturedImage, onCapture, stopCamera, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Capture Photo
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <canvas ref={canvasRef} className="hidden" />
          
          {!capturedImage ? (
            <>
              <div className="relative aspect-[4/3] bg-black">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                  data-testid="camera-video-preview"
                />
              </div>
              
              <div className="flex items-center justify-center gap-4 p-4 bg-background">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isLoading}
                  data-testid="button-switch-camera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
                
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16"
                  onClick={capturePhoto}
                  disabled={isLoading || !stream}
                  data-testid="button-capture-photo"
                >
                  <Camera className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleOpenChange(false)}
                  data-testid="button-close-camera"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="text-center text-sm text-muted-foreground pb-4">
                {facingMode === "user" ? "Front Camera" : "Back Camera"}
              </div>
            </>
          ) : (
            <>
              <div className="relative aspect-[4/3] bg-black">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                  data-testid="img-captured-photo"
                />
              </div>
              
              <div className="flex items-center justify-center gap-4 p-4 bg-background">
                <Button
                  variant="outline"
                  onClick={retakePhoto}
                  className="gap-2"
                  data-testid="button-retake-photo"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </Button>
                
                <Button
                  onClick={confirmPhoto}
                  className="gap-2"
                  data-testid="button-confirm-photo"
                >
                  <Check className="h-4 w-4" />
                  Use Photo
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
