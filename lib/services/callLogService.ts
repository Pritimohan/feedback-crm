import { and, desc, eq } from 'drizzle-orm';
import { callLogs, customers, leads, type NewCallLog } from '@/lib/db/schema';
import { db } from '@/lib/db';

export async function createCallLog(input: NewCallLog) {
  const [row] = await db.insert(callLogs).values(input).returning();
  return row;
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
