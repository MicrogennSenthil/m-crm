import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ── JWT token management (VPS cookie-bypass auth) ──────────────────────────
const TOKEN_KEY = "mcrm:auth:token";

export function storeAuthToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearAuthToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON error message
    try {
      const json = JSON.parse(text);
      if (json.message) {
        throw new Error(json.message);
      }
    } catch (e) {
      // Not JSON or no message field, use raw text
    }
    throw new Error(text || `Request failed with status ${res.status}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey
    // Pattern 1: ["/api/path"] - simple path
    // Pattern 2: ["/api/path", id] - path with id segment (string/number)
    // Pattern 3: ["/api/path", { search: "foo" }] - path with query params (object)
    // Pattern 4: ["/api/path", id, { search: "foo" }] - path with id and query params
    
    let pathSegments: string[] = [];
    let queryParams: Record<string, string> = {};
    
    for (const segment of queryKey) {
      if (typeof segment === 'string') {
        pathSegments.push(segment);
      } else if (typeof segment === 'number') {
        pathSegments.push(String(segment));
      } else if (typeof segment === 'object' && segment !== null) {
        // Object means query parameters
        for (const [key, value] of Object.entries(segment)) {
          if (value !== undefined && value !== null && value !== '') {
            queryParams[key] = String(value);
          }
        }
      }
    }
    
    let url = pathSegments.join('/');
    
    // Append query parameters if any
    const searchParams = new URLSearchParams(queryParams);
    const paramString = searchParams.toString();
    if (paramString) {
      url = `${url}?${paramString}`;
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// ── Safe query helpers ────────────────────────────────────────────────────
// These throw on !res.ok (so React Query gets an `error` instead of trying
// to render an error-shaped JSON body), and validate the response shape so
// callers can rely on getting an array / object back.

export function safeArrayQueryFn<T>(url: string): () => Promise<T[]> {
  return async () => {
    const res = await fetch(url, { credentials: "include", headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text();
      let msg = body || `Request failed with status ${res.status}`;
      try { const j = JSON.parse(body); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? (data as T[]) : [];
  };
}

export function safeObjectQueryFn<T>(url: string): () => Promise<T | null> {
  return async () => {
    const res = await fetch(url, { credentials: "include", headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text();
      let msg = body || `Request failed with status ${res.status}`;
      try { const j = JSON.parse(body); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object" && !Array.isArray(data)) return data as T;
    return null;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
