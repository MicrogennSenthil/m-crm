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
  const announcedFollowupsRef = useRef<Set<string>>(new Set());
  const lastAnnouncementTimeRef = useRef<number>(0);

  const announceFollowup = useCallback(
    (followup: { id: string; companyName: string; isOverdue?: boolean }) => {
      if (!voiceAlertsEnabled || !isSupported) return;

      if (announcedFollowupsRef.current.has(followup.id)) return;

      const now = Date.now();
      if (now - lastAnnouncementTimeRef.current < 3000) return;

      let message: string;
      if (followup.isOverdue) {
        message = `Boss, you have an overdue followup. You have to call ${followup.companyName}`;
      } else {
        message = `Boss, you have an appointment. You have to call ${followup.companyName}`;
      }

      speak(message);
      announcedFollowupsRef.current.add(followup.id);
      lastAnnouncementTimeRef.current = now;
    },
    [voiceAlertsEnabled, isSupported, speak]
  );

  const resetAnnouncements = useCallback(() => {
    announcedFollowupsRef.current.clear();
  }, []);

  return {
    announceFollowup,
    resetAnnouncements,
    isSupported,
    isSpeaking,
  };
}
