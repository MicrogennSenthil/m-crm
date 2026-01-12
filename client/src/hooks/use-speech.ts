import { useCallback, useEffect, useRef, useState } from "react";

type VoiceGender = "male" | "female";

interface SpeechConfig {
  voicePreference: VoiceGender;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
}

export function useSpeech(config: SpeechConfig): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const getPreferredVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (availableVoices.length === 0) return null;

    const genderKeywords = config.voicePreference === "male" 
      ? ["male", "david", "james", "daniel", "microsoft david", "google uk english male", "rishi"]
      : ["female", "samantha", "victoria", "zira", "microsoft zira", "google uk english female", "fiona", "moira"];

    const englishVoices = availableVoices.filter(
      (voice) => voice.lang.startsWith("en")
    );

    for (const keyword of genderKeywords) {
      const matchingVoice = englishVoices.find((voice) =>
        voice.name.toLowerCase().includes(keyword)
      );
      if (matchingVoice) return matchingVoice;
    }

    for (const keyword of genderKeywords) {
      const matchingVoice = availableVoices.find((voice) =>
        voice.name.toLowerCase().includes(keyword)
      );
      if (matchingVoice) return matchingVoice;
    }

    return englishVoices[0] || availableVoices[0] || null;
  }, [availableVoices, config.voicePreference]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      const voice = getPreferredVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = config.rate ?? 0.9;
      utterance.pitch = config.pitch ?? 1.0;
      utterance.volume = config.volume ?? 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, getPreferredVoice, config.rate, config.pitch, config.volume]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    availableVoices,
  };
}

export function useFollowupVoiceAlerts(
  voicePreference: VoiceGender,
  voiceAlertsEnabled: boolean
) {
  const { speak, isSupported, isSpeaking } = useSpeech({ voicePreference });
  const announcedKeysRef = useRef<Set<string>>(new Set());
  const lastAnnouncementTimeRef = useRef<number>(0);

  const announceFollowup = useCallback(
    (followup: { id: string; companyName: string; isOverdue?: boolean }) => {
      if (!voiceAlertsEnabled || !isSupported) return;

      // The id should already include the date for proper deduplication
      // e.g., "leadId-2026-01-12" to allow re-announcement for new dates
      if (announcedKeysRef.current.has(followup.id)) return;

      const now = Date.now();
      if (now - lastAnnouncementTimeRef.current < 3000) return;

      let message: string;
      if (followup.isOverdue) {
        message = `Boss, you have an overdue followup. You have to call ${followup.companyName}`;
      } else {
        message = `Boss, you have an appointment. You have to call ${followup.companyName}`;
      }

      speak(message);
      announcedKeysRef.current.add(followup.id);
      lastAnnouncementTimeRef.current = now;
    },
    [voiceAlertsEnabled, isSupported, speak]
  );

  const resetAnnouncements = useCallback(() => {
    announcedKeysRef.current.clear();
  }, []);

  return {
    announceFollowup,
    resetAnnouncements,
    isSupported,
    isSpeaking,
  };
}

// Voice alert type for unified system
export interface VoiceAlert {
  id: string;
  department: 'sales' | 'support' | 'implementation' | 'tasks' | 'development';
  type: 'new_lead' | 'followup_due' | 'overdue' | 'new_ticket' | 'ticket_escalated' | 'new_task' | 'task_due' | 'project_update' | 'dev_task_assigned';
  entityId: string;
  entityName: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  createdAt: string;
}

interface VoiceAlertsResponse {
  alerts: VoiceAlert[];
  voicePreference: VoiceGender;
  voiceAlertsEnabled: boolean;
  totalAlerts: number;
}

// Unified voice alerts hook for all departments
export function useUnifiedVoiceAlerts(
  departmentFilter?: 'sales' | 'support' | 'implementation' | 'tasks' | 'development' | 'all',
  pollingIntervalMs: number = 120000 // 2 minutes default
) {
  const [alerts, setAlerts] = useState<VoiceAlert[]>([]);
  const [voicePreference, setVoicePreference] = useState<VoiceGender>('female');
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalAlerts, setTotalAlerts] = useState(0);
  
  const { speak, isSupported, isSpeaking, stop } = useSpeech({ voicePreference });
  const announcedKeysRef = useRef<Set<string>>(new Set());
  const alertQueueRef = useRef<VoiceAlert[]>([]);
  const isProcessingQueueRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Fetch alerts from unified endpoint
  const fetchAlerts = useCallback(async () => {
    const now = Date.now();
    // Prevent fetching more than once every 30 seconds
    if (now - lastFetchTimeRef.current < 30000) return;
    
    try {
      setIsLoading(true);
      lastFetchTimeRef.current = now;
      
      const response = await fetch('/api/alerts/voice', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch voice alerts');
      }
      
      const data: VoiceAlertsResponse = await response.json();
      
      setVoicePreference(data.voicePreference);
      setVoiceAlertsEnabled(data.voiceAlertsEnabled);
      setTotalAlerts(data.totalAlerts);
      
      // Filter by department if specified
      let filteredAlerts = data.alerts;
      if (departmentFilter && departmentFilter !== 'all') {
        filteredAlerts = data.alerts.filter(a => a.department === departmentFilter);
      }
      
      setAlerts(filteredAlerts);
      
      // Queue new alerts for announcement
      if (data.voiceAlertsEnabled) {
        const newAlerts = filteredAlerts.filter(
          alert => !announcedKeysRef.current.has(alert.id)
        );
        
        if (newAlerts.length > 0) {
          alertQueueRef.current.push(...newAlerts);
          processAlertQueue();
        }
      }
    } catch (error) {
      console.error('Error fetching voice alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [departmentFilter]);

  // Process alert queue with delays between announcements
  const processAlertQueue = useCallback(() => {
    if (isProcessingQueueRef.current || !isSupported || !voiceAlertsEnabled) return;
    if (alertQueueRef.current.length === 0) return;
    
    isProcessingQueueRef.current = true;
    
    const processNext = () => {
      const alert = alertQueueRef.current.shift();
      if (!alert) {
        isProcessingQueueRef.current = false;
        return;
      }
      
      if (announcedKeysRef.current.has(alert.id)) {
        // Already announced, skip to next
        setTimeout(processNext, 100);
        return;
      }
      
      speak(alert.message);
      announcedKeysRef.current.add(alert.id);
      
      // Wait 4 seconds between announcements
      setTimeout(processNext, 4000);
    };
    
    processNext();
  }, [isSupported, voiceAlertsEnabled, speak]);

  // Announce a specific alert manually
  const announceAlert = useCallback(
    (alert: VoiceAlert) => {
      if (!voiceAlertsEnabled || !isSupported) return;
      if (announcedKeysRef.current.has(alert.id)) return;
      
      speak(alert.message);
      announcedKeysRef.current.add(alert.id);
    },
    [voiceAlertsEnabled, isSupported, speak]
  );

  // Announce all pending alerts
  const announceAllPending = useCallback(() => {
    if (!voiceAlertsEnabled || !isSupported) return;
    
    const pendingAlerts = alerts.filter(
      alert => !announcedKeysRef.current.has(alert.id)
    );
    
    if (pendingAlerts.length > 0) {
      alertQueueRef.current.push(...pendingAlerts);
      processAlertQueue();
    }
  }, [alerts, voiceAlertsEnabled, isSupported, processAlertQueue]);

  // Reset announcements (for testing or manual re-announcement)
  const resetAnnouncements = useCallback(() => {
    announcedKeysRef.current.clear();
    alertQueueRef.current = [];
    stop();
    isProcessingQueueRef.current = false;
  }, [stop]);

  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchAlerts();
    
    // Set up interval
    const interval = setInterval(fetchAlerts, pollingIntervalMs);
    
    return () => clearInterval(interval);
  }, [fetchAlerts, pollingIntervalMs]);

  // Get counts by priority
  const alertCounts = {
    high: alerts.filter(a => a.priority === 'high').length,
    medium: alerts.filter(a => a.priority === 'medium').length,
    low: alerts.filter(a => a.priority === 'low').length,
    total: alerts.length,
    unannounced: alerts.filter(a => !announcedKeysRef.current.has(a.id)).length,
  };

  // Get counts by department
  const departmentCounts = {
    sales: alerts.filter(a => a.department === 'sales').length,
    support: alerts.filter(a => a.department === 'support').length,
    implementation: alerts.filter(a => a.department === 'implementation').length,
    tasks: alerts.filter(a => a.department === 'tasks').length,
    development: alerts.filter(a => a.department === 'development').length,
  };

  return {
    alerts,
    alertCounts,
    departmentCounts,
    voicePreference,
    voiceAlertsEnabled,
    isLoading,
    isSpeaking,
    isSupported,
    totalAlerts,
    fetchAlerts,
    announceAlert,
    announceAllPending,
    resetAnnouncements,
    stopSpeaking: stop,
  };
}
