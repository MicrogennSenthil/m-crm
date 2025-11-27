import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Camera, Video, Upload, X, Trash2, Play, Pause, 
  StopCircle, RotateCcw, Check, Loader2, Image, FileVideo
} from "lucide-react";

interface MediaAttachment {
  type: 'photo' | 'video' | 'file';
  url: string;
  name: string;
  size?: number;
}

interface MediaCaptureProps {
  onMediaCaptured: (attachments: MediaAttachment[]) => void;
  attachments: MediaAttachment[];
  entityType: string;
  entityId: string;
  disabled?: boolean;
}

export function MediaCapture({ 
  onMediaCaptured, 
  attachments, 
  entityType, 
  entityId,
  disabled = false 
}: MediaCaptureProps) {
  const { toast } = useToast();
  
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      closeCamera();
    };
  }, []);

  const openCamera = async (mode: 'photo' | 'video') => {
    try {
      const constraints = mode === 'video' 
        ? { video: true, audio: true } 
        : { video: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      setCameraMode(mode);
      setShowCamera(true);
      setCapturedPhoto(null);
      setCapturedVideo(null);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({ title: "Could not access camera", description: "Please allow camera access", variant: "destructive" });
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setShowCamera(false);
    setIsRecordingVideo(false);
    setVideoDuration(0);
    setCapturedPhoto(null);
    setCapturedVideo(null);
  };

  const capturePhoto = () => {
    if (videoPreviewRef.current && canvasRef.current) {
      const video = videoPreviewRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setCapturedVideo(url);
      };

      mediaRecorder.start();
      setIsRecordingVideo(true);
      setVideoDuration(0);

      timerRef.current = setInterval(() => {
        setVideoDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting video recording:", error);
      toast({ title: "Could not start recording", variant: "destructive" });
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const retake = () => {
    setCapturedPhoto(null);
    setCapturedVideo(null);
    setVideoDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadBlob = async (blob: Blob, fileName: string, type: 'photo' | 'video') => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      const newAttachment: MediaAttachment = {
        type,
        url: data.url,
        name: fileName,
        size: blob.size,
      };
      
      onMediaCaptured([...attachments, newAttachment]);
      closeCamera();
      toast({ title: "Success", description: `${type === 'photo' ? 'Photo' : 'Video'} saved` });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const savePhoto = async () => {
    if (!capturedPhoto) return;
    
    const response = await fetch(capturedPhoto);
    const blob = await response.blob();
    const fileName = `photo_${Date.now()}.jpg`;
    await uploadBlob(blob, fileName, 'photo');
  };

  const saveVideo = async () => {
    if (videoChunksRef.current.length === 0) return;
    
    const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
    const fileName = `video_${Date.now()}.webm`;
    await uploadBlob(blob, fileName, 'video');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments: MediaAttachment[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        const type: 'photo' | 'video' | 'file' = 
          file.type.startsWith('image/') ? 'photo' : 
          file.type.startsWith('video/') ? 'video' : 'file';

        newAttachments.push({
          type,
          url: data.url,
          name: file.name,
          size: file.size,
        });
      }

      onMediaCaptured([...attachments, ...newAttachments]);
      toast({ title: "Success", description: "Files uploaded" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    onMediaCaptured(updated);
  };

  return (
    <div className="space-y-3">
      {showCamera ? (
        <Card>
          <CardContent className="p-3">
            {!capturedPhoto && !capturedVideo ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video 
                    ref={videoPreviewRef} 
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {isRecordingVideo && (
                    <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded text-sm">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      {formatDuration(videoDuration)}
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                
                <div className="flex items-center justify-center gap-2">
                  {cameraMode === 'photo' ? (
                    <Button onClick={capturePhoto} size="sm" data-testid="button-capture-photo">
                      <Camera className="h-4 w-4 mr-2" /> Capture
                    </Button>
                  ) : isRecordingVideo ? (
                    <Button onClick={stopVideoRecording} variant="destructive" size="sm" data-testid="button-stop-recording">
                      <StopCircle className="h-4 w-4 mr-2" /> Stop
                    </Button>
                  ) : (
                    <Button onClick={startVideoRecording} size="sm" data-testid="button-start-recording">
                      <Video className="h-4 w-4 mr-2" /> Record
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={closeCamera}>
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {capturedPhoto && (
                  <img src={capturedPhoto} alt="Captured" className="w-full rounded-lg aspect-video object-cover" />
                )}
                {capturedVideo && (
                  <video src={capturedVideo} controls className="w-full rounded-lg aspect-video" />
                )}
                
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={retake}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Retake
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={capturedPhoto ? savePhoto : saveVideo}
                    disabled={isUploading}
                    data-testid="button-save-capture"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openCamera('photo')}
            disabled={disabled || isUploading}
            data-testid="button-take-photo"
          >
            <Camera className="h-4 w-4 mr-2" /> Take Photo
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openCamera('video')}
            disabled={disabled || isUploading}
            data-testid="button-record-video"
          >
            <Video className="h-4 w-4 mr-2" /> Record Video
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            data-testid="button-upload-file"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group">
              {att.type === 'photo' ? (
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <div className="w-16 h-16 rounded border overflow-hidden hover:ring-2 ring-primary transition-all">
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                </a>
              ) : att.type === 'video' ? (
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center hover:ring-2 ring-primary transition-all">
                    <FileVideo className="h-6 w-6 text-muted-foreground" />
                  </div>
                </a>
              ) : (
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center hover:ring-2 ring-primary transition-all">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                </a>
              )}
              <button
                type="button"
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(idx)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
