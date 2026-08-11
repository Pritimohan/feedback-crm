import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
/** Honor sslmode in DATABASE_URL; default to require for hosted DBs that support TLS. */
const sslMode = (() => {
  try {
    return new URL(connectionString).searchParams.get('sslmode')?.toLowerCase() ?? null;
  } catch {
    return null;
  }
})();
const ssl =
  sslMode === 'disable' || sslMode === 'allow' || sslMode === 'prefer'
    ? false
    : 'require';
const client = postgres(connectionString, { ssl });

export const db = drizzle(client, { schema });

/** Drizzle transaction client (same query API as `db` inside `db.transaction`). */
export type FeedbackDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Database or transaction — both expose the same query API. */
export type FeedbackDb = typeof db | FeedbackDbTransaction;
