import { and, desc, eq } from 'drizzle-orm';
import { db, type FeedbackDbTransaction } from '@/lib/db';
import { customers, leads } from '@/lib/db/schema';
import { createLifecycleForLead } from '@/lib/services/leadLifecycleEngine';
import { selectLeastLoadedDt } from '@/lib/services/callDistributionService';

/**
 * Fitty-style `findAvailableDT`: least total assignments per eligible DT, deterministic tie-break.
 * Maps Fitty's `customers.assigned_dt_id` to `leads.assigned_dt_id`; counts all assigned leads (not only active), matching Fitty's "total assigned" comment.
 */
export async function resolveAssignedDt(
  preferredDtId: string | null | undefined,
  tx: FeedbackDbTransaction | undefined,
  options: { brand: 'fitty' | 'fitelo'; leadType: 'nps' | 'review' | 'feedback' }
): Promise<string | null> {
  return selectLeastLoadedDt(preferredDtId, tx, options);
}

export async function resolveExistingCustomerByPhone(phone: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
  return customer ?? null;
}

export async function resolveOrCreateLeadForCustomer(params: {
  customerId: string;
  leadType: 'nps' | 'review' | 'feedback';
  preferredDtId?: string | null;
  brand?: 'fitty' | 'fitelo';
  remarks?: string;
  tx?: FeedbackDbTransaction;
}) {
  const d = params.tx ?? db;
  const brand = params.brand ?? 'fitty';

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

  let resolvedDtId = await resolveAssignedDt(params.preferredDtId, params.tx, {
    brand,
    leadType: params.leadType,
  });
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

export type EnsureLifecycleForLeadOptions = {
  scheduleFirstCallNextCalendarDay?: boolean;
  scheduleFirstCallAfterDays?: number;
};

export async function ensureLifecycleForLead(
  leadId: string,
  anchorDate?: string,
  tx?: FeedbackDbTransaction,
  options?: EnsureLifecycleForLeadOptions
) {
  return createLifecycleForLead({
    leadId,
    anchorDate: anchorDate ? new Date(anchorDate) : new Date(),
    lifecycleType: 'feedback_default',
    tx,
    scheduleFirstCallNextCalendarDay: options?.scheduleFirstCallNextCalendarDay,
    scheduleFirstCallAfterDays: options?.scheduleFirstCallAfterDays,
  });
}
