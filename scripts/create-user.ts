/**
 * Create or update a user by email.
 *
 * Usage:
 * npm run user:create -- --email "admin@test.com" --name "Test Admin" --role "admin" --password "Admin@123"
 *
 * Update password only (keeps name/role):
 * npm run user:create -- --email "user@test.com" --password "NewSecret" --password-only
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

config({ path: '.env.local' });

type CliArgs = {
  email: string;
  name: string;
  role: string;
  password: string;
  passwordOnly: boolean;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseArgs(): CliArgs {
  const email = getArg('--email');
  const name = getArg('--name');
  const role = getArg('--role');
  const password = getArg('--password');
  const passwordOnly = process.argv.includes('--password-only');

  if (passwordOnly) {
    if (!email || !password) {
      throw new Error(
        'Missing required args for --password-only. Use: --email <email> --password <password> --password-only'
      );
    }
    return {
      email: email.toLowerCase().trim(),
      name: '',
      role: '',
      password,
      passwordOnly: true,
    };
  }

  if (!email || !name || !role || !password) {
    throw new Error(
      'Missing required args. Use: --email <email> --name <name> --role <role> --password <password>'
    );
  }

  return {
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role: role.trim(),
    password,
    passwordOnly: false,
  };
}

async function main() {
  const { db } = await import('../lib/db');
  const { users } = await import('../lib/db/schema');
  const { hashPassword } = await import('../lib/auth/jwt');
  const args = parseArgs();
  const passwordHash = await hashPassword(args.password);

  const existing = await db.query.users.findFirst({
    where: eq(users.email, args.email),
  });

  if (existing) {
    if (args.passwordOnly) {
      await db
        .update(users)
        .set({
          password_hash: passwordHash,
          updated_at: new Date(),
        })
        .where(eq(users.id, existing.id));

      console.log(`Updated password for: ${args.email}`);
      return;
    }

    await db
      .update(users)
      .set({
        name: args.name,
        role: args.role,
        password_hash: passwordHash,
        active_status: true,
        updated_at: new Date(),
      })
      .where(eq(users.id, existing.id));

    console.log(`Updated user: ${args.email} (${args.role})`);
    return;
  }

  if (args.passwordOnly) {
    throw new Error(`No user found for ${args.email}; create the user first with full --name and --role.`);
  }

  await db.insert(users).values({
    email: args.email,
    name: args.name,
    role: args.role,
    password_hash: passwordHash,
    active_status: true,
  });

  console.log(`Created user: ${args.email} (${args.role})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
