import { and, asc, eq, inArray } from 'drizzle-orm';
import type { CrmBrand } from '@/lib/crmBrand';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import { db } from '@/lib/db';
import { callLogs, leads, leadLifecycleFollowups, users } from '@/lib/db/schema';

export type CustomerInteractionRow = {
  customerId: string;
  outcome: string;
  notes: string | null;
  timestamp: Date;
  followupNumber: number;
  agentName: string | null;
  formData: Record<string, unknown> | null;
};

function resolveFormData(
  followupPayload: unknown,
  rawPayload: unknown
): Record<string, unknown> | null {
  if (followupPayload && typeof followupPayload === 'object' && followupPayload !== null) {
    return followupPayload as Record<string, unknown>;
  }
  if (rawPayload && typeof rawPayload === 'object' && rawPayload !== null) {
    return rawPayload as Record<string, unknown>;
  }
  return null;
}

export async function fetchInteractionsForCustomers(
  customerIds: string[],
  brand: CrmBrand
): Promise<CustomerInteractionRow[]> {
  if (!customerIds.length) {
    return [];
  }

  const rows = await db
    .select({
      customerId: callLogs.customer_id,
      outcome: callLogs.attempt_outcome,
      notes: callLogs.attempt_notes,
      timestamp: callLogs.created_at,
      followupNumber: callLogs.followup_number,
      rawPayload: callLogs.raw_payload,
      followupPayload: leadLifecycleFollowups.payload,
      dtName: users.name,
    })
    .from(callLogs)
    .innerJoin(leads, eq(callLogs.lead_id, leads.id))
    .leftJoin(leadLifecycleFollowups, eq(callLogs.followup_id, leadLifecycleFollowups.id))
    .leftJoin(users, eq(callLogs.dt_id, users.id))
    .where(and(inArray(callLogs.customer_id, customerIds), leadMatchesCrmBrand(brand)))
    .orderBy(asc(callLogs.created_at));

  return rows.map((row) => ({
    customerId: row.customerId,
    outcome: row.outcome,
    notes: row.notes,
    timestamp: row.timestamp,
    followupNumber: row.followupNumber,
    agentName: row.dtName ?? null,
    formData: resolveFormData(row.followupPayload, row.rawPayload),
  }));
}
