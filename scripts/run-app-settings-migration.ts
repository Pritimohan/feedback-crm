/**
 * Run app_settings migration (per-brand Exotel Exophones).
 * Usage: npm run db:migrate-app-settings
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const migrationPath = join(
    process.cwd(),
    'drizzle',
    'migrations',
    '0015_app_settings.sql'
  );
  const migration = readFileSync(migrationPath, 'utf-8');

  console.log('Running app_settings migration...');
  try {
    await sql.unsafe(migration);
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
