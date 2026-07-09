import { sql, type SQL } from 'drizzle-orm';
import { ANALYTICS_TIMEZONE } from '@/lib/utils/analyticsDates';

/** IST calendar day for an attempt timestamp stored in UTC. */
export function attemptDayIst(attemptDateRef: SQL): SQL {
  return sql`date_trunc('day', ${attemptDateRef} AT TIME ZONE ${ANALYTICS_TIMEZONE})`;
}

export function sqlBrandCond(brand: string | null | undefined): SQL {
  return brand === 'fitelo'
    ? sql`AND l.brand = 'fitelo'`
    : sql`AND (l.brand = 'fitty' OR l.brand IS NULL)`;
}

/** Agent is globally active and brand-active in user_brand_profiles. */
export function sqlBrandActiveProfileExists(userTableAlias = 'u', brand?: string | null | undefined): SQL {
  const b = brand === 'fitelo' ? 'fitelo' : 'fitty';
  return sql`AND EXISTS (
    SELECT 1 FROM user_brand_profiles ubp
    WHERE ubp.user_id = ${sql.raw(userTableAlias)}.id
      AND ubp.brand = ${b}
      AND ubp.is_active = true
  )`;
}

/**
 * CRM connected follow-ups in range (connected_date).
 * Do not filter active lifecycle/lead — marking connected sets lead inactive and lifecycle completed.
 */
export function sqlConnectedFollowupFilters(opts: {
  startIso: string;
  endIso: string;
  brand: string | null | undefined;
  followupNumber?: number;
}): SQL {
  const { startIso, endIso, brand, followupNumber } = opts;
  const stageFilter =
    followupNumber !== undefined
      ? sql`AND lf.followup_number = ${followupNumber}`
      : sql``;

  return sql`
    lf.status = 'connected'
    AND lf.connected_date IS NOT NULL
    AND lf.connected_date >= ${startIso}::timestamp
    AND lf.connected_date <= ${endIso}::timestamp
    AND l.assigned_dt_id IS NOT NULL
    AND u.role = 'dt'
    ${sqlBrandCond(brand)}
    ${stageFilter}
  `;
}

export type DedupePartition = 'customer' | 'lead' | 'customer_dt';

function partitionColumns(partition: DedupePartition): string {
  switch (partition) {
    case 'customer':
      return 'customer_id, attempt_day_ist';
    case 'lead':
      return 'lead_id, attempt_day_ist';
    case 'customer_dt':
      return 'dt_id, customer_id, attempt_day_ist';
  }
}

export interface DedupedAttemptsCteOptions {
  startIso: string;
  endIso: string;
  brand: string | null | undefined;
  /** When set, filters attempts_base to this followup stage. */
  followupNumber?: number;
  /** Scope to the dialing agent (fa.dt_id). */
  dtId?: string;
  partition: DedupePartition;
  /** When true, applies lead-pool scheduling rules (per-stage analytics). */
  withLeadPoolFilter?: boolean;
}

/**
 * Reusable CTE chain:
 * attempts_base → attempts_ranked → attempts_deduped (last attempt per partition per IST day)
 * connected_customer_days (any connected wins per customer-day)
 *
 * Attempt rows include all leads/lifecycles (active or not); only brand and agent filters apply.
 */
export function dedupedAttemptsCte(opts: DedupedAttemptsCteOptions): SQL {
  const { startIso, endIso, brand, followupNumber, dtId, partition, withLeadPoolFilter } = opts;
  const brandCond = sqlBrandCond(brand);
  const followupFilter =
    followupNumber !== undefined
      ? sql`AND lf.followup_number = ${followupNumber}`
      : sql``;
  const dtFilter = dtId ? sql`AND fa.dt_id = ${dtId}` : sql``;

  const leadPoolFilter = withLeadPoolFilter
    ? sql`
        AND (
          (lf.attempt_count = 0 AND lf.scheduled_date >= ${startIso}::timestamp AND lf.scheduled_date <= ${endIso}::timestamp)
          OR (lf.attempt_count > 0 AND lf.first_attempt_date IS NOT NULL
              AND lf.first_attempt_date >= ${startIso}::timestamp AND lf.first_attempt_date <= ${endIso}::timestamp)
          OR (lf.attempt_count > 0 AND EXISTS (
            SELECT 1 FROM lead_lifecycle_followup_attempts fa_in_range
            WHERE fa_in_range.followup_id = lf.id
              AND fa_in_range.attempt_date >= ${startIso}::timestamp
              AND fa_in_range.attempt_date <= ${endIso}::timestamp
          ))
        )`
    : sql``;

  const partitionCols = partitionColumns(partition);

  return sql`
    attempts_base AS (
      SELECT
        fa.id,
        fa.dt_id,
        fa.followup_id,
        fa.attempt_date,
        fa.outcome,
        l.id AS lead_id,
        l.customer_id,
        lf.followup_number,
        ${attemptDayIst(sql`fa.attempt_date`)} AS attempt_day_ist
      FROM lead_lifecycle_followup_attempts fa
      INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
      INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
      INNER JOIN leads l ON ol.lead_id = l.id
      INNER JOIN users u ON fa.dt_id = u.id
      WHERE u.role = 'dt'
        AND u.active_status = true
        ${sqlBrandActiveProfileExists('u', brand)}
        ${brandCond}
        AND fa.attempt_date >= ${startIso}::timestamp
        AND fa.attempt_date <= ${endIso}::timestamp
        ${dtFilter}
        ${followupFilter}
        ${leadPoolFilter}
    ),
    attempts_ranked AS (
      SELECT
        ab.*,
        ROW_NUMBER() OVER (
          PARTITION BY ${sql.raw(partitionCols)}
          ORDER BY ab.attempt_date DESC
        ) AS rn
      FROM attempts_base ab
    ),
    attempts_deduped AS (
      SELECT * FROM attempts_ranked WHERE rn = 1
    ),
    connected_customer_days AS (
      SELECT DISTINCT customer_id, attempt_day_ist
      FROM attempts_base
      WHERE LOWER(TRIM(outcome)) = 'connected'
    )
  `;
}

/** Count expression: unique customer-days attempted. */
export function countDistinctCustomerDays(): SQL {
  return sql`COUNT(DISTINCT (customer_id, attempt_day_ist))::int`;
}

/** Count expression: unique lead-days attempted (per-stage). */
export function countDistinctLeadDays(): SQL {
  return sql`COUNT(DISTINCT (lead_id, attempt_day_ist))::int`;
}

/** Count expression: unique (dt, customer)-days attempted. */
export function countDistinctDtCustomerDays(): SQL {
  return sql`COUNT(DISTINCT (dt_id, customer_id, attempt_day_ist))::int`;
}

// --- Pure helpers for unit tests (mirror SQL dedupe rules) ---

export interface AttemptRowForDedupe {
  customerId: string;
  leadId: string;
  attemptDay: string;
  outcome: string;
  attemptAt: string;
  dtId?: string;
}

function dayKey(customerId: string, attemptDay: string, dtId?: string): string {
  return dtId ? `${dtId}|${customerId}|${attemptDay}` : `${customerId}|${attemptDay}`;
}

function leadDayKey(leadId: string, attemptDay: string): string {
  return `${leadId}|${attemptDay}`;
}

/** Raw dial count (no dedupe). */
export function countTotalDialsFromRows(rows: AttemptRowForDedupe[]): number {
  return rows.length;
}

/** Unique customer-days (or dt+customer-days when dtId set on rows). */
export function countUniqueCustomerDays(rows: AttemptRowForDedupe[]): number {
  const keys = new Set<string>();
  for (const r of rows) {
    keys.add(dayKey(r.customerId, r.attemptDay, r.dtId));
  }
  return keys.size;
}

/** Connected customer-days: any call that day was connected. */
export function countConnectedCustomerDays(rows: AttemptRowForDedupe[]): number {
  const connected = new Map<string, boolean>();
  for (const r of rows) {
    const key = dayKey(r.customerId, r.attemptDay, r.dtId);
    if (r.outcome.toLowerCase() === 'connected') {
      connected.set(key, true);
    } else if (!connected.has(key)) {
      connected.set(key, false);
    }
  }
  return [...connected.values()].filter(Boolean).length;
}

/** Last attempt per customer-day (for disposition charts). */
export function dedupeLastAttemptPerCustomerDay(
  rows: AttemptRowForDedupe[]
): AttemptRowForDedupe[] {
  const byKey = new Map<string, AttemptRowForDedupe>();
  for (const r of rows) {
    const key = dayKey(r.customerId, r.attemptDay, r.dtId);
    const prev = byKey.get(key);
    if (!prev || r.attemptAt > prev.attemptAt) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()];
}

/** Unique lead-days within a stage. */
export function countUniqueLeadDays(rows: AttemptRowForDedupe[]): number {
  const keys = new Set<string>();
  for (const r of rows) {
    keys.add(leadDayKey(r.leadId, r.attemptDay));
  }
  return keys.size;
}

/** Connected lead-days: any connected that day. */
export function countConnectedLeadDays(rows: AttemptRowForDedupe[]): number {
  const connected = new Map<string, boolean>();
  for (const r of rows) {
    const key = leadDayKey(r.leadId, r.attemptDay);
    if (r.outcome.toLowerCase() === 'connected') {
      connected.set(key, true);
    } else if (!connected.has(key)) {
      connected.set(key, false);
    }
  }
  return [...connected.values()].filter(Boolean).length;
}
