import Redis from "ioredis";

// ──────────────────────────────────────────────────────────────
// In-memory fallback (used when Redis is not configured)
// ──────────────────────────────────────────────────────────────
interface MemEntry {
  data: any;
  expiresAt: number;
}
const memStore = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.data as T;
}

function memSet(key: string, data: any, ttlSeconds: number): void {
  memStore.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memInvalidate(pattern: string): void {
  for (const key of memStore.keys()) {
    if (key.startsWith(pattern)) memStore.delete(key);
  }
}

// ──────────────────────────────────────────────────────────────
// Redis client (optional — only active when REDIS_URL is set)
// ──────────────────────────────────────────────────────────────
let redis: Redis | null = null;
let redisReady = false;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    // Fail fast if Redis is not reachable — don't block requests
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redis.on("ready", () => {
    redisReady = true;
    console.log("[Cache] Redis connected — using Redis cache");
  });

  redis.on("error", (err) => {
    if (redisReady) {
      console.warn("[Cache] Redis error, falling back to in-memory:", err.message);
    }
    redisReady = false;
  });

  redis.on("reconnecting", () => {
    redisReady = false;
  });

  // Initiate connection (non-blocking)
  redis.connect().catch(() => {
    console.warn("[Cache] Redis unavailable — using in-memory cache");
  });
} else {
  console.log("[Cache] REDIS_URL not set — using in-memory cache");
}

// ──────────────────────────────────────────────────────────────
// Public API — same interface regardless of backend
// ──────────────────────────────────────────────────────────────

export async function getCachedAsync<T>(key: string): Promise<T | null> {
  if (redis && redisReady) {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      // Redis blip — fall through to memory
    }
  }
  return memGet<T>(key);
}

export async function setCachedAsync(key: string, data: any, ttlSeconds: number): Promise<void> {
  if (redis && redisReady) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      return;
    } catch {
      // Redis blip — fall through to memory
    }
  }
  memSet(key, data, ttlSeconds);
}

export async function invalidateCacheAsync(pattern: string): Promise<void> {
  if (redis && redisReady) {
    try {
      // Scan for all keys matching the prefix pattern
      let cursor = "0";
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${pattern}*`, "COUNT", 200);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== "0");

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }
      return;
    } catch {
      // Fall through to memory
    }
  }
  memInvalidate(pattern);
}

// ──────────────────────────────────────────────────────────────
// Synchronous wrappers (for existing code compatibility)
// These use in-memory and fire Redis in the background
// ──────────────────────────────────────────────────────────────

export function getCached<T>(key: string): T | null {
  // Always check memory first (fast path)
  const memResult = memGet<T>(key);
  if (memResult !== null) return memResult;

  // If Redis is active, trigger an async background warm of memory cache
  // (next call will hit memory, this call returns null and triggers DB fetch)
  if (redis && redisReady) {
    redis.get(key).then((raw) => {
      if (raw) {
        // Warm the local memory store with remaining TTL from Redis
        redis!.ttl(key).then((ttl) => {
          if (ttl > 0) memSet(key, JSON.parse(raw), ttl);
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return null;
}

export function setCached(key: string, data: any, ttlSeconds: number): void {
  // Always set in memory for instant reads
  memSet(key, data, ttlSeconds);
  // Also persist to Redis asynchronously
  if (redis && redisReady) {
    redis.set(key, JSON.stringify(data), "EX", ttlSeconds).catch(() => {});
  }
}

export function invalidateCache(pattern: string): void {
  // Invalidate memory immediately
  memInvalidate(pattern);
  // Invalidate Redis asynchronously
  if (redis && redisReady) {
    invalidateCacheAsync(pattern).catch(() => {});
  }
}

export function invalidateCacheKey(key: string): void {
  memStore.delete(key);
  if (redis && redisReady) {
    redis.del(key).catch(() => {});
  }
}
