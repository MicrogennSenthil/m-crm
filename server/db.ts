import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 20,                       // allow up to 20 concurrent connections
  connectionTimeoutMillis: 5000, // fail fast if pool is exhausted
  // Release idle clients well before Neon (dev DB) can kill them with
  // "FATAL 57P01 terminating connection due to administrator command".
  // Neon idle suspend is ~5 minutes; we close at 20s so we always retire
  // the socket from our side.
  idleTimeoutMillis: 20_000,
  // Enable TCP keepalive so the OS detects half-open sockets quickly
  // (e.g. when Neon force-closes a connection from its side).
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  allowExitOnIdle: false,
});

// Prevent crashes from idle-client errors (e.g. Neon dropping idle TCP
// connections with "57P01 terminating connection due to administrator command").
// Without this listener Node treats the unhandled `error` event as fatal.
pool.on('error', (err: any) => {
  console.warn('[db.pool] idle client error:', err?.code || '', err?.message || err);
});

export const db = drizzle({ client: pool, schema });
