import { useState, useEffect, useCallback } from "react";

const SIDEBAR_PINNED_KEY = "sidebar_pinned";

export function useSidebarPinned() {
  const [isPinned, setIsPinnedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SIDEBAR_PINNED_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_PINNED_KEY, String(isPinned));
  }, [isPinned]);

  const setIsPinned = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsPinnedState(value);
  }, []);

  const togglePinned = useCallback(() => {
    setIsPinnedState((prev) => !prev);
  }, []);

  return { isPinned, setIsPinned, togglePinned };
}
