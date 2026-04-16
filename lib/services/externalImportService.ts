import { and, desc, eq, sql } from 'drizzle-orm';
import { db, type FeedbackDbTransaction } from '@/lib/db';
import { customers, leads, users } from '@/lib/db/schema';
import { createLifecycleForLead } from '@/lib/services/leadLifecycleEngine';

/**
 * Fitty-style `findAvailableDT`: least total assignments per active DT, deterministic tie-break.
 * Maps Fitty's `customers.assigned_dt_id` to `leads.assigned_dt_id`; counts all assigned leads (not only active), matching Fitty's "total assigned" comment.
 */
export async function resolveAssignedDt(
  preferredDtId?: string | null,
  tx?: FeedbackDbTransaction
): Promise<string | null> {
  const d = tx ?? db;

  if (preferredDtId) {
    const [preferred] = await d
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, preferredDtId), eq(users.role, 'dt'), eq(users.active_status, true)));
    if (preferred) return preferred.id;
  }

  const dtLoads = await d
    .select({
      dtId: users.id,
      assignedCount: sql<number>`COUNT(${leads.id})`,
    })
    .from(users)
    .leftJoin(leads, eq(leads.assigned_dt_id, users.id))
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true)))
    .groupBy(users.id);

  if (dtLoads.length === 0) return null;

  dtLoads.sort((a, b) => {
    const countDiff = Number(a.assignedCount) - Number(b.assignedCount);
    if (countDiff !== 0) return countDiff;
    return (a.dtId ?? '').localeCompare(b.dtId ?? '');
  });

  const candidate = dtLoads[0].dtId;
  if (!candidate) return null;

  const [stillActive] = await d
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, candidate), eq(users.role, 'dt'), eq(users.active_status, true)));
  return stillActive?.id ?? null;
}

export async function resolveExistingCustomerByPhone(phone: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
  return customer ?? null;
}

export async function resolveOrCreateLeadForCustomer(params: {
  customerId: string;
  leadType: 'nps' | 'review';
  preferredDtId?: string | null;
  brand?: 'fitty' | 'fitelo';
  remarks?: string;
  tx?: FeedbackDbTransaction;
}) {
  const d = params.tx ?? db;

  const [existingActiveLead] = await d
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.customer_id, params.customerId),
        eq(leads.lead_type, params.leadType),
        eq(leads.activity_status, 'active')
      )
    );

  if (existingActiveLead) {
    return { lead: existingActiveLead, created: false };
  }

  let resolvedDtId = await resolveAssignedDt(params.preferredDtId, params.tx);
  if (!resolvedDtId) {
    const [latestLeadForCustomer] = await d
      .select({ assignedDtId: leads.assigned_dt_id })
      .from(leads)
      .where(and(eq(leads.customer_id, params.customerId), eq(leads.activity_status, 'active')))
      .orderBy(desc(leads.updated_at))
      .limit(1);

    resolvedDtId = latestLeadForCustomer?.assignedDtId ?? null;
  }

  const [lead] = await d
    .insert(leads)
    .values({
      customer_id: params.customerId,
      lead_type: params.leadType,
      activity_status: 'active',
      assigned_dt_id: resolvedDtId,
      brand: params.brand,
      remarks: params.remarks,
    })
    .returning();

  return { lead, created: true };
}

export async function ensureLifecycleForLead(
  leadId: string,
  anchorDate?: string,
  tx?: FeedbackDbTransaction
) {
  return createLifecycleForLead({
    leadId,
    anchorDate: anchorDate ? new Date(anchorDate) : new Date(),
    lifecycleType: 'feedback_default',
    tx,
  });
}
