import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, leadLifecycleFollowupAttempts, leadLifecycleFollowups, leadLifecycles, leads } from '@/lib/db/schema';

export async function getLeadFollowupDetails(followupId: string) {
  const [row] = await db
    .select({
      followup: leadLifecycleFollowups,
      lifecycle: leadLifecycles,
      lead: leads,
      customer: customers,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .innerJoin(customers, eq(leads.customer_id, customers.id))
    .where(eq(leadLifecycleFollowups.id, followupId));

  if (!row) return null;

  const attempts = await db
    .select()
    .from(leadLifecycleFollowupAttempts)
    .where(eq(leadLifecycleFollowupAttempts.followup_id, followupId))
    .orderBy(desc(leadLifecycleFollowupAttempts.attempt_date));

  const previousFollowups = await db
    .select()
    .from(leadLifecycleFollowups)
    .where(
      and(
        eq(leadLifecycleFollowups.lifecycle_id, row.lifecycle.id),
        eq(leadLifecycleFollowups.status, 'connected')
      )
    )
    .orderBy(desc(leadLifecycleFollowups.followup_number));

  return {
    ...row,
    attempts,
    previousFollowups,
  };
}
