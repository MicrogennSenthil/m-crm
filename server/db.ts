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
  connectionTimeoutMillis: 5000, // fail fast if pool is exhausted (5s not 3min)
  idleTimeoutMillis: 30000,      // release idle connections after 30s
  allowExitOnIdle: false,
});

export const db = drizzle({ client: pool, schema });
