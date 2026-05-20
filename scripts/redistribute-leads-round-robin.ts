/**
 * Redistribute all leads assigned to one dietitian evenly between two others (round-robin).
 *
 * Default: Varuni → Gurpreet & Bhoomi (50/50), fitelo brand + active leads only.
 *
 * Usage:
 *   npm run redistribute-leads                              # dry run
 *   npm run redistribute-leads:apply                    # apply (avoids npm eating --execute)
 *   npm run redistribute-leads -- --all-brands                # any brand
 *   npm run redistribute-leads -- --include-inactive        # all activity_status
 *   npm run redistribute-leads -- --preview 50              # show first N row mappings
 *   npm run redistribute-leads -- --source-email x@y.co --target-0 a@b.co --target-1 c@d.co
 */
import { config } from 'dotenv';
import { and, asc, eq, inArray } from 'drizzle-orm';

config({ path: '.env.local' });

const DEFAULT_SOURCE = 'varuni.gupta@fitelo.co';
const DEFAULT_TARGETS = ['gurpreet.kaur1@fitelo.co', 'bhoomi.singh@fitelo.co'] as const;

type CliOptions = {
  execute: boolean;
  allBrands: boolean;
  includeInactive: boolean;
  previewLimit: number;
  sourceEmail: string;
  targetEmails: [string, string];
};

function normalizeEmail(s: string): string {
  return s.toLowerCase().trim();
}

function parseArgs(): CliOptions {
  const argv = process.argv;
  const execute = argv.includes('--execute');
  const allBrands = argv.includes('--all-brands');
  const includeInactive = argv.includes('--include-inactive');

  let previewLimit = 25;
  const previewIdx = argv.indexOf('--preview');
  if (previewIdx !== -1 && argv[previewIdx + 1]) {
    previewLimit = Math.max(0, parseInt(argv[previewIdx + 1], 10) || 0);
  }

  let sourceEmail = normalizeEmail(DEFAULT_SOURCE);
  const sourceIdx = argv.indexOf('--source-email');
  if (sourceIdx !== -1 && argv[sourceIdx + 1]) {
    sourceEmail = normalizeEmail(argv[sourceIdx + 1]);
  }

  let targetA = normalizeEmail(DEFAULT_TARGETS[0]);
  let targetB = normalizeEmail(DEFAULT_TARGETS[1]);
  const t0 = argv.indexOf('--target-0');
  const t1 = argv.indexOf('--target-1');
  if (t0 !== -1 && argv[t0 + 1]) targetA = normalizeEmail(argv[t0 + 1]);
  if (t1 !== -1 && argv[t1 + 1]) targetB = normalizeEmail(argv[t1 + 1]);

  if (targetA === targetB) {
    throw new Error('--target-0 and --target-1 must be different emails');
  }

  return {
    execute,
    allBrands,
    includeInactive,
    previewLimit,
    sourceEmail,
    targetEmails: [targetA, targetB],
  };
}

async function main() {
  const opts = parseArgs();
  const { db } = await import('../lib/db');
  const { users, leads, leadLifecycles, leadLifecycleFollowups } = await import('../lib/db/schema');

  const source = await db.query.users.findFirst({
    where: eq(users.email, opts.sourceEmail),
  });
  if (!source) {
    throw new Error(`Source user not found: ${opts.sourceEmail}`);
  }

  const targets: { id: string; email: string; name: string; role: string }[] = [];
  for (const email of opts.targetEmails) {
    const u = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!u) {
      throw new Error(`Target user not found: ${email}`);
    }
    targets.push({ id: u.id, email: u.email, name: u.name, role: u.role });
  }

  if (source.role !== 'dt') {
    console.warn(`Warning: source user ${source.email} has role "${source.role}" (expected "dt")`);
  }
  for (const t of targets) {
    if (t.role !== 'dt') {
      console.warn(`Warning: target user ${t.email} has role "${t.role}" (expected "dt")`);
    }
  }

  const conditions = [eq(leads.assigned_dt_id, source.id)];
  if (!opts.allBrands) {
    conditions.push(eq(leads.brand, 'fitelo'));
  }
  if (!opts.includeInactive) {
    conditions.push(eq(leads.activity_status, 'active'));
  }

  const leadRows = await db
    .select({
      id: leads.id,
      customer_id: leads.customer_id,
      created_at: leads.created_at,
    })
    .from(leads)
    .where(and(...conditions))
    .orderBy(asc(leads.created_at), asc(leads.id));

  if (leadRows.length === 0) {
    console.log('No leads matched filters. Nothing to do.');
    return;
  }

  const plans = leadRows.map((row, i) => ({
    leadId: row.id,
    customerId: row.customer_id,
    newDtId: targets[i % 2].id,
    newDtEmail: targets[i % 2].email,
  }));

  const counts = { [targets[0].email]: 0, [targets[1].email]: 0 } as Record<string, number>;
  for (const p of plans) {
    counts[p.newDtEmail] = (counts[p.newDtEmail] ?? 0) + 1;
  }

  console.log(`Mode: ${opts.execute ? 'EXECUTE (writes)' : 'DRY RUN'}`);
  console.log(`Source: ${source.email} (${source.id})`);
  console.log(`Targets: ${targets.map((t) => `${t.email} (${t.id})`).join(', ')}`);
  console.log(`Filters: brand=${opts.allBrands ? 'any' : 'fitelo'}, activity=${opts.includeInactive ? 'any' : 'active'}`);
  console.log(`Total leads: ${plans.length}`);
  console.log(`Split: ${targets[0].email} → ${counts[targets[0].email] ?? 0}, ${targets[1].email} → ${counts[targets[1].email] ?? 0}`);

  if (opts.previewLimit > 0) {
    console.log(`\nFirst ${Math.min(opts.previewLimit, plans.length)} assignments:`);
    plans.slice(0, opts.previewLimit).forEach((p, idx) => {
      console.log(`  ${idx + 1}. lead=${p.leadId} customer=${p.customerId} → ${p.newDtEmail}`);
    });
  }

  if (!opts.execute) {
    console.log('\nRe-run with --execute to apply updates.');
    return;
  }

  let leadsUpdated = 0;
  let followupsUpdated = 0;

  for (const p of plans) {
    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ assigned_dt_id: p.newDtId, updated_at: new Date() })
        .where(eq(leads.id, p.leadId));

      const lifecycleRows = await tx
        .select({ id: leadLifecycles.id })
        .from(leadLifecycles)
        .where(eq(leadLifecycles.lead_id, p.leadId));

      const lifecycleIds = lifecycleRows.map((r) => r.id);
      if (lifecycleIds.length > 0) {
        const fu = await tx
          .update(leadLifecycleFollowups)
          .set({ assigned_dt_id: p.newDtId, updated_at: new Date() })
          .where(
            and(eq(leadLifecycleFollowups.status, 'pending'), inArray(leadLifecycleFollowups.lifecycle_id, lifecycleIds))
          )
          .returning({ id: leadLifecycleFollowups.id });
        followupsUpdated += fu.length;
      }
    });
    leadsUpdated += 1;
  }

  console.log(`\nDone. Leads updated: ${leadsUpdated}, pending follow-ups updated: ${followupsUpdated}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
