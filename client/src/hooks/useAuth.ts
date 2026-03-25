import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/schema";

const AUTH_STORAGE_KEY = "mcrm:auth:user";

function getStoredUser(): User | undefined {
  try {
    const cached = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return undefined;
}

export function storeUser(user: User | null) {
  try {
    if (user) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
}

export function clearStoredUser() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}

export function useAuth() {
  const initialData = getStoredUser();

  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    initialData,
    initialDataUpdatedAt: 0,
  });

  useEffect(() => {
    if (user) {
      storeUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (isError) {
      clearStoredUser();
    }
  }, [isError]);

  return {
    user: isError ? undefined : user,
    isLoading: isLoading && !initialData,
    isAuthenticated: !isError && !!user,
  };
}
