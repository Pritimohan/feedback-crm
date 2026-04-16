import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });

export const db = drizzle(client, { schema });

/** Drizzle transaction client (same query API as `db` inside `db.transaction`). */
export type FeedbackDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
