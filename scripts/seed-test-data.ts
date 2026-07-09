/**
 * Seed a development admin user.
 * Usage: npx tsx scripts/seed-test-data.ts
 * Requires .env.local: DATABASE_URL, and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (optional defaults below).
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { hashPassword } from '../lib/auth/jwt';

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme';
  const name = process.env.SEED_ADMIN_NAME || 'Admin';

  const hash = await hashPassword(password);

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    await db
      .update(users)
      .set({ password_hash: hash, name, role: 'admin', active_status: true, updated_at: new Date() })
      .where(eq(users.id, existing.id));
    console.log(`Updated admin user: ${email}`);
    return;
  }

  await db.insert(users).values({
    email,
    name,
    role: 'admin',
    password_hash: hash,
    active_status: true,
  });
  console.log(`Created admin user: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
