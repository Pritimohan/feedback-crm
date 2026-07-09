import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  dedupedAttemptsCte,
  sqlBrandActiveProfileExists,
  sqlBrandCond,
  type DedupedAttemptsCteOptions,
} from './uniqueAttemptsSql';

export interface AttemptCountQueryOptions {
  startIso: string;
  endIso: string;
  brand: string | null | undefined;
  /** Scope to the dialing agent (fa.dt_id). */
  dtId?: string;
  followupNumber?: number;
  withLeadPoolFilter?: boolean;
}

export interface ActivityMetrics {
  totalDials: number;
  uniqueCustomerDays: number;
  uniqueCustomerDaysConnected: number;
}

export interface AgentAttemptCounts {
  totalDials: number;
  uniqueCustomerDays: number;
  uniqueCustomerDaysConnected: number;
}

function toCteOpts(opts: AttemptCountQueryOptions, partition: DedupedAttemptsCteOptions['partition']): DedupedAttemptsCteOptions {
  return {
    startIso: opts.startIso,
    endIso: opts.endIso,
    brand: opts.brand,
    dtId: opts.dtId,
    followupNumber: opts.followupNumber,
    withLeadPoolFilter: opts.withLeadPoolFilter ?? false,
    partition,
  };
}

function firstRowCount(result: unknown, key = 'cnt'): number {
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  const row = rows[0] as Record<string, unknown> | undefined;
  return Number(row?.[key] ?? 0);
}

/** Raw attempt row count — every dial in range, credited to fa.dt_id. */
export async function countTotalDials(opts: AttemptCountQueryOptions): Promise<number> {
  const brandCond = sqlBrandCond(opts.brand);
  const dtFilter = opts.dtId ? sql`AND fa.dt_id = ${opts.dtId}` : sql``;
  const followupFilter =
    opts.followupNumber !== undefined
      ? sql`AND lf.followup_number = ${opts.followupNumber}`
      : sql``;

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM lead_lifecycle_followup_attempts fa
    INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
    INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
    INNER JOIN leads l ON ol.lead_id = l.id
    INNER JOIN users u ON fa.dt_id = u.id
    WHERE u.role = 'dt'
      AND u.active_status = true
      ${sqlBrandActiveProfileExists('u', opts.brand)}
      ${brandCond}
      AND fa.attempt_date >= ${opts.startIso}::timestamp
      AND fa.attempt_date <= ${opts.endIso}::timestamp
      ${dtFilter}
      ${followupFilter}
  `);
  return firstRowCount(result);
}

/** Unique customer-days (IST) — one per customer per calendar day. */
export async function countUniqueCustomerDays(opts: AttemptCountQueryOptions): Promise<number> {
  const result = await db.execute(sql`
    WITH ${dedupedAttemptsCte(toCteOpts(opts, 'customer'))}
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT DISTINCT customer_id, attempt_day_ist FROM attempts_base
    ) customer_days
  `);
  return firstRowCount(result);
}

/** Unique lead-days (IST) — one per lead per calendar day (stage analytics). */
export async function countUniqueLeadDays(opts: AttemptCountQueryOptions): Promise<number> {
  const result = await db.execute(sql`
    WITH ${dedupedAttemptsCte(toCteOpts(opts, 'lead'))}
    SELECT COUNT(*)::int AS cnt FROM attempts_deduped
  `);
  return firstRowCount(result);
}

/** Customer-days where any dial that day was connected. */
export async function countUniqueCustomerDaysConnected(opts: AttemptCountQueryOptions): Promise<number> {
  const result = await db.execute(sql`
    WITH ${dedupedAttemptsCte(toCteOpts(opts, 'customer'))}
    SELECT COUNT(*)::int AS cnt FROM connected_customer_days
  `);
  return firstRowCount(result);
}

/** Raw connected attempt row count. */
export async function countConnectedDials(opts: AttemptCountQueryOptions): Promise<number> {
  const brandCond = sqlBrandCond(opts.brand);
  const dtFilter = opts.dtId ? sql`AND fa.dt_id = ${opts.dtId}` : sql``;
  const followupFilter =
    opts.followupNumber !== undefined
      ? sql`AND lf.followup_number = ${opts.followupNumber}`
      : sql``;

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM lead_lifecycle_followup_attempts fa
    INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
    INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
    INNER JOIN leads l ON ol.lead_id = l.id
    INNER JOIN users u ON fa.dt_id = u.id
    WHERE u.role = 'dt'
      AND u.active_status = true
      ${sqlBrandActiveProfileExists('u', opts.brand)}
      ${brandCond}
      AND fa.attempt_date >= ${opts.startIso}::timestamp
      AND fa.attempt_date <= ${opts.endIso}::timestamp
      AND LOWER(TRIM(fa.outcome)) = 'connected'
      ${dtFilter}
      ${followupFilter}
  `);
  return firstRowCount(result);
}

/** Funnel activity block: total dials + unique customer-day metrics. */
export async function fetchActivityMetrics(opts: AttemptCountQueryOptions): Promise<ActivityMetrics> {
  const result = await db.execute(sql`
    WITH ${dedupedAttemptsCte(toCteOpts(opts, 'customer'))}
    SELECT
      (SELECT COUNT(*)::int FROM attempts_base) AS total_dials,
      (SELECT COUNT(*)::int FROM (
        SELECT DISTINCT customer_id, attempt_day_ist FROM attempts_base
      ) customer_days) AS unique_customer_days,
      (SELECT COUNT(*)::int FROM connected_customer_days) AS unique_customer_days_connected
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  const row = rows[0] as
    | {
        total_dials?: number;
        unique_customer_days?: number;
        unique_customer_days_connected?: number;
      }
    | undefined;
  return {
    totalDials: Number(row?.total_dials ?? 0),
    uniqueCustomerDays: Number(row?.unique_customer_days ?? 0),
    uniqueCustomerDaysConnected: Number(row?.unique_customer_days_connected ?? 0),
  };
}

/** Per dialing agent: total dials + unique customer-days + connected customer-days. */
export async function fetchAgentAttemptCountsByDt(
  opts: Omit<AttemptCountQueryOptions, 'dtId'>
): Promise<Map<string, AgentAttemptCounts>> {
  const result = await db.execute(sql`
    WITH ${dedupedAttemptsCte(toCteOpts(opts, 'customer_dt'))},
    dt_total_dials AS (
      SELECT dt_id, COUNT(*)::int AS total_dials
      FROM attempts_base
      GROUP BY dt_id
    ),
    dt_unique AS (
      SELECT dt_id, COUNT(*)::int AS unique_customer_days
      FROM attempts_deduped
      GROUP BY dt_id
    ),
    dt_connected AS (
      SELECT dt_id, COUNT(*)::int AS unique_connected
      FROM (
        SELECT DISTINCT dt_id, customer_id, attempt_day_ist
        FROM attempts_base
        WHERE LOWER(TRIM(outcome)) = 'connected'
      ) connected_dt_days
      GROUP BY dt_id
    )
    SELECT
      COALESCE(t.dt_id, u.dt_id, c.dt_id)::text AS dt_id,
      COALESCE(t.total_dials, 0)::int AS total_dials,
      COALESCE(u.unique_customer_days, 0)::int AS unique_customer_days,
      COALESCE(c.unique_connected, 0)::int AS unique_customer_days_connected
    FROM dt_total_dials t
    FULL OUTER JOIN dt_unique u USING (dt_id)
    FULL OUTER JOIN dt_connected c USING (dt_id)
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  const map = new Map<string, AgentAttemptCounts>();
  for (const r of rows) {
    const row = r as {
      dt_id?: string;
      total_dials?: number;
      unique_customer_days?: number;
      unique_customer_days_connected?: number;
    };
    const dtId = String(row.dt_id ?? '');
    if (!dtId) continue;
    map.set(dtId, {
      totalDials: Number(row.total_dials ?? 0),
      uniqueCustomerDays: Number(row.unique_customer_days ?? 0),
      uniqueCustomerDaysConnected: Number(row.unique_customer_days_connected ?? 0),
    });
  }
  return map;
}

/** Raw overdue attempt count per dialing agent. */
export async function fetchOverdueAttemptCountsByDt(
  opts: Omit<AttemptCountQueryOptions, 'dtId'>
): Promise<Map<string, number>> {
  const brandCond = sqlBrandCond(opts.brand);
  const result = await db.execute(sql`
    SELECT fa.dt_id::text AS dt_id, COUNT(*)::int AS cnt
    FROM lead_lifecycle_followup_attempts fa
    INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
    INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
    INNER JOIN leads l ON ol.lead_id = l.id
    INNER JOIN users u ON fa.dt_id = u.id
    WHERE fa.was_overdue = true
      AND u.role = 'dt'
      AND u.active_status = true
      ${sqlBrandActiveProfileExists('u', opts.brand)}
      ${brandCond}
      AND fa.attempt_date >= ${opts.startIso}::timestamp
      AND fa.attempt_date <= ${opts.endIso}::timestamp
    GROUP BY fa.dt_id
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  const map = new Map<string, number>();
  for (const r of rows) {
    const row = r as { dt_id?: string; cnt?: number };
    map.set(String(row.dt_id ?? ''), Number(row.cnt ?? 0));
  }
  return map;
}
