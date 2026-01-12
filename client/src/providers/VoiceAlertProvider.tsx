import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSpeech } from '@/hooks/use-speech';

interface VoiceAlert {
  id: string;
  department: string;
  type: string;
  entityId: number;
  priority: 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date | string;
  announced?: boolean;
}

type Department = 'sales' | 'support' | 'implementation' | 'tasks' | 'development' | 'all';

interface VoiceAlertContextType {
  alerts: VoiceAlert[];
  getAlertsByDepartment: (department: Department) => VoiceAlert[];
  getAlertCountsByDepartment: (department: Department) => { total: number; high: number; medium: number; low: number };
  isEnabled: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  voiceGender: 'male' | 'female';
  currentAnnouncementId: string | null;
  setVoiceGender: (gender: 'male' | 'female') => void;
  toggleEnabled: () => void;
  announceAllPending: (department?: Department) => void;
  stopSpeaking: () => void;
  markAnnounced: (alertId: string) => void;
}

const VoiceAlertContext = createContext<VoiceAlertContextType | null>(null);

function useVoiceAlertContext() {
  const context = useContext(VoiceAlertContext);
  if (!context) {
    throw new Error('useVoiceAlerts must be used within VoiceAlertProvider');
  }
  return context;
}

export function useVoiceAlerts(department: Department = 'all') {
  const context = useVoiceAlertContext();
  
  const departmentAlerts = useMemo(() => {
    if (department === 'all') return context.alerts;
    return context.alerts.filter(a => a.department === department);
  }, [context.alerts, department]);
  
  const alertCounts = useMemo(() => {
    return context.getAlertCountsByDepartment(department);
  }, [context, department]);
  
  const announceAllPending = useCallback(() => {
    context.announceAllPending(department);
  }, [context, department]);
  
  return {
    alerts: departmentAlerts,
    alertCounts,
    isEnabled: context.isEnabled,
    isSpeaking: context.isSpeaking,
    isSupported: context.isSupported,
    voiceGender: context.voiceGender,
    currentAnnouncementId: context.currentAnnouncementId,
    setVoiceGender: context.setVoiceGender,
    toggleEnabled: context.toggleEnabled,
    announceAllPending,
    stopSpeaking: context.stopSpeaking,
    markAnnounced: context.markAnnounced,
  };
}

export function useGlobalVoiceAlerts() {
  return useVoiceAlerts('all');
}

interface VoiceAlertProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export function VoiceAlertProvider({ children, pollingInterval = 120000 }: VoiceAlertProviderProps) {
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('voiceAlertsEnabled') === 'true';
    }
    return false;
  });
  
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('voiceAlertGender') as 'male' | 'female') || 'female';
    }
    return 'female';
  });
  
  // Persist announced IDs in sessionStorage to prevent re-announcements during session
  const [announcedIds, setAnnouncedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('voiceAlertAnnouncedIds');
        if (stored) {
          return new Set(JSON.parse(stored) as string[]);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return new Set();
  });
  const [announcementQueue, setAnnouncementQueue] = useState<VoiceAlert[]>([]);
  const [currentAnnouncementId, setCurrentAnnouncementId] = useState<string | null>(null);
  
  const { speak, stop: stopSpeaking, isSpeaking, isSupported } = useSpeech({ voicePreference: voiceGender });

  // Persist announced IDs to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('voiceAlertAnnouncedIds', JSON.stringify(Array.from(announcedIds)));
    }
  }, [announcedIds]);

  useEffect(() => {
    localStorage.setItem('voiceAlertsEnabled', String(isEnabled));
  }, [isEnabled]);
  
  useEffect(() => {
    localStorage.setItem('voiceAlertGender', voiceGender);
  }, [voiceGender]);

  const { data: alertsResponse } = useQuery<{ alerts: VoiceAlert[] }>({
    queryKey: ['/api/alerts/voice', { limit: 50 }],
    enabled: isEnabled,
    refetchInterval: isEnabled ? pollingInterval : false,
  });

  const alerts = useMemo(() => {
    return alertsResponse?.alerts || [];
  }, [alertsResponse]);

  const getAlertsByDepartment = useCallback((department: Department) => {
    if (department === 'all') return alerts;
    return alerts.filter(a => a.department === department);
  }, [alerts]);

  const getAlertCountsByDepartment = useCallback((department: Department) => {
    const deptAlerts = getAlertsByDepartment(department);
    const pending = deptAlerts.filter(a => !announcedIds.has(a.id));
    return {
      total: pending.length,
      high: pending.filter(a => a.priority === 'high').length,
      medium: pending.filter(a => a.priority === 'medium').length,
      low: pending.filter(a => a.priority === 'low').length,
    };
  }, [getAlertsByDepartment, announcedIds]);

  const markAnnounced = useCallback((alertId: string) => {
    setAnnouncedIds(prev => new Set(Array.from(prev).concat([alertId])));
  }, []);

  const announceAlert = useCallback((alert: VoiceAlert) => {
    if (!isSupported || !isEnabled) return;
    setCurrentAnnouncementId(alert.id);
    speak(alert.message);
    markAnnounced(alert.id);
  }, [isSupported, isEnabled, speak, markAnnounced]);

  useEffect(() => {
    if (announcementQueue.length === 0 || isSpeaking) return;
    
    const [nextAlert, ...remaining] = announcementQueue;
    setAnnouncementQueue(remaining);
    announceAlert(nextAlert);
  }, [announcementQueue, isSpeaking, announceAlert]);

  useEffect(() => {
    if (!isSpeaking && currentAnnouncementId) {
      setCurrentAnnouncementId(null);
    }
  }, [isSpeaking, currentAnnouncementId]);

  const announceAllPending = useCallback((department: Department = 'all') => {
    if (!isSupported || !isEnabled) return;
    
    const deptAlerts = getAlertsByDepartment(department);
    const pendingAlerts = deptAlerts.filter(a => !announcedIds.has(a.id));
    if (pendingAlerts.length === 0) return;
    
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = Array.from(pendingAlerts).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    setAnnouncementQueue(sorted);
  }, [isSupported, isEnabled, getAlertsByDepartment, announcedIds]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      const newValue = !prev;
      if (!newValue) {
        stopSpeaking();
        setAnnouncementQueue([]);
        setCurrentAnnouncementId(null);
      }
      return newValue;
    });
  }, [stopSpeaking]);

  const handleStopSpeaking = useCallback(() => {
    stopSpeaking();
    setAnnouncementQueue([]);
    setCurrentAnnouncementId(null);
  }, [stopSpeaking]);

  const value: VoiceAlertContextType = {
    alerts,
    getAlertsByDepartment,
    getAlertCountsByDepartment,
    isEnabled,
    isSpeaking,
    isSupported,
    voiceGender,
    currentAnnouncementId,
    setVoiceGender,
    toggleEnabled,
    announceAllPending,
    stopSpeaking: handleStopSpeaking,
    markAnnounced,
  };

  return (
    <VoiceAlertContext.Provider value={value}>
      {children}
    </VoiceAlertContext.Provider>
  );
}
