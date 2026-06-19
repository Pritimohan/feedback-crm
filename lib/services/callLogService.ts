import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { callLogs, customers, leads, type NewCallLog } from '@/lib/db/schema';
import { db, type FeedbackDbTransaction } from '@/lib/db';

/** Max age of an adhoc call_log (no attempt_id) that can be linked when logging an outcome. */
export const CALL_LOG_ATTEMPT_LINK_WINDOW_MS = 30 * 60 * 1000;

/** Cluster window for deduping duplicate call history rows (adhoc + attempt_api). */
export const CALL_HISTORY_DEDUPE_WINDOW_MS = 3 * 60 * 1000;

export type AttemptCallLogInput = Omit<NewCallLog, 'id' | 'created_at'> & {
  updated_at: Date;
};

export async function createCallLog(input: NewCallLog) {
  const [row] = await db.insert(callLogs).values(input).returning();
  return row;
}

/**
 * Links an attempt outcome to the adhoc call_log created at dial time when possible,
 * instead of inserting a second row for the same physical call.
 */
export async function upsertCallLogForAttempt(
  tx: FeedbackDbTransaction,
  input: AttemptCallLogInput
) {
  const linkWindowStart = new Date(input.updated_at.getTime() - CALL_LOG_ATTEMPT_LINK_WINDOW_MS);

  const [orphan] = await tx
    .select({ id: callLogs.id })
    .from(callLogs)
    .where(
      and(
        eq(callLogs.customer_id, input.customer_id),
        eq(callLogs.lead_id, input.lead_id),
        eq(callLogs.dt_id, input.dt_id),
        isNull(callLogs.attempt_id),
        gte(callLogs.created_at, linkWindowStart)
      )
    )
    .orderBy(desc(callLogs.created_at))
    .limit(1);

  if (orphan) {
    const [updated] = await tx
      .update(callLogs)
      .set({
        lifecycle_id: input.lifecycle_id,
        followup_id: input.followup_id,
        attempt_id: input.attempt_id,
        attempt_outcome: input.attempt_outcome,
        attempt_notes: input.attempt_notes,
        scheduled_date_at_attempt: input.scheduled_date_at_attempt,
        was_overdue: input.was_overdue,
        lead_type: input.lead_type,
        followup_number: input.followup_number,
        ingest_source: input.ingest_source,
        ingest_status: input.ingest_status,
        raw_payload: input.raw_payload,
        updated_at: input.updated_at,
      })
      .where(eq(callLogs.id, orphan.id))
      .returning();
    return updated!;
  }

  const [created] = await tx.insert(callLogs).values(input).returning();
  return created;
}

export type CallHistoryDedupeRow = {
  id: string;
  customerId: string;
  outcome: string;
  updatedAt: Date;
  attemptId?: string | null;
};

function callHistoryRowScore(row: CallHistoryDedupeRow): number {
  let score = 0;
  if (row.attemptId) score += 20;
  if (row.outcome !== 'initiated') score += 10;
  return score;
}

/** Collapse adhoc + attempt_api duplicates for the same dial in call history UI. */
export function dedupeCallHistoryRows<T extends CallHistoryDedupeRow>(rows: T[]): T[] {
  const sorted = [...rows].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  const used = new Set<string>();
  const kept: T[] = [];

  for (const row of sorted) {
    if (used.has(row.id)) continue;

    const cluster = sorted.filter(
      (candidate) =>
        !used.has(candidate.id) &&
        candidate.customerId === row.customerId &&
        Math.abs(candidate.updatedAt.getTime() - row.updatedAt.getTime()) <= CALL_HISTORY_DEDUPE_WINDOW_MS
    );

    const best = cluster.reduce((winner, candidate) =>
      callHistoryRowScore(candidate) > callHistoryRowScore(winner) ? candidate : winner
    );

    kept.push(best);
    cluster.forEach((candidate) => used.add(candidate.id));
  }

  return kept.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function enrichCallLogBySid(params: {
  providerCallSid: string;
  providerStatusRaw?: string;
  providerRecordingUrl?: string;
  providerStartAt?: Date | null;
  providerEndAt?: Date | null;
  providerDurationSec?: number | null;
  providerRingSec?: number | null;
  providerTalkSec?: number | null;
  rawPayload?: unknown;
}) {
  const [row] = await db
    .update(callLogs)
    .set({
      provider_status_raw: params.providerStatusRaw,
      provider_recording_url: params.providerRecordingUrl,
      provider_start_at: params.providerStartAt ?? null,
      provider_end_at: params.providerEndAt ?? null,
      provider_duration_sec: params.providerDurationSec ?? null,
      provider_ring_sec: params.providerRingSec ?? null,
      provider_talk_sec: params.providerTalkSec ?? null,
      ingest_source: 'exotel_webhook',
      ingest_status: 'enriched',
      raw_payload: params.rawPayload as Record<string, unknown> | undefined,
      updated_at: new Date(),
    })
    .where(eq(callLogs.provider_call_sid, params.providerCallSid))
    .returning();

  return row ?? null;
}

export async function createOrUpdateAdhocCallLogBySid(params: {
  providerCallSid: string;
  dtId?: string | null;
  customerPhone: string;
  dtPhone?: string;
  customerId?: string | null;
  providerStatusRaw?: string;
  rawPayload?: unknown;
}) {
  const now = new Date();

  let resolvedCustomerId = params.customerId ?? null;
  if (!resolvedCustomerId) {
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, params.customerPhone));
    resolvedCustomerId = customer?.id ?? null;
  }
  if (!resolvedCustomerId) return null;

  const [activeLead] = await db
    .select({
      id: leads.id,
      assignedDtId: leads.assigned_dt_id,
      leadType: leads.lead_type,
      followupNumber: leads.current_followup_number,
      lifecycleId: leads.active_lifecycle_id,
    })
    .from(leads)
    .where(and(eq(leads.customer_id, resolvedCustomerId), eq(leads.activity_status, 'active')))
    .orderBy(desc(leads.updated_at))
    .limit(1);
  if (!activeLead) return null;
  const resolvedDtId = params.dtId ?? activeLead.assignedDtId;
  if (!resolvedDtId) return null;

  const [existing] = await db
    .select({ id: callLogs.id })
    .from(callLogs)
    .where(eq(callLogs.provider_call_sid, params.providerCallSid))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(callLogs)
      .set({
        provider_status_raw: params.providerStatusRaw ?? null,
        dt_number: params.dtPhone ?? null,
        customer_number: params.customerPhone,
        ingest_source: 'exotel_webhook',
        ingest_status: 'enriched',
        raw_payload: params.rawPayload as Record<string, unknown> | undefined,
        updated_at: now,
      })
      .where(eq(callLogs.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(callLogs)
    .values({
      customer_id: resolvedCustomerId,
      lead_id: activeLead.id,
      lifecycle_id: activeLead.lifecycleId,
      followup_id: null,
      attempt_id: null,
      dt_id: resolvedDtId,
      provider: 'exotel',
      provider_call_sid: params.providerCallSid,
      provider_status_raw: params.providerStatusRaw ?? 'initiated',
      dt_number: params.dtPhone ?? null,
      customer_number: params.customerPhone,
      attempt_outcome: 'initiated',
      lead_type: activeLead.leadType,
      followup_number: activeLead.followupNumber ?? 0,
      ingest_source: 'api_call',
      ingest_status: 'partial',
      raw_payload: params.rawPayload as Record<string, unknown> | undefined,
      updated_at: now,
    })
    .returning();

  return created;
}
