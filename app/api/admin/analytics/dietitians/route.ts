import { NextResponse, NextRequest } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import {
  ANALYTICS_TIMEZONE,
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import type { DietitianAnalyticsRow } from '@/types/analytics';

export interface DietitianAnalyticsResponse {
  dietitians: DietitianAnalyticsRow[];
  dateRange: { startDate: string; endDate: string };
}

const VALID_FILTERS: AnalyticsFilterType[] = [
  'today',
  'yesterday',
  'week',
  'month',
  'quarter',
  'custom',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brand = await getCrmBrandFromCookie();
    const leadBrandCond =
      brand === 'fitelo'
        ? sql`AND l.brand = 'fitelo'`
        : sql`AND (l.brand = 'fitty' OR l.brand IS NULL)`;

    const searchParams = request.nextUrl.searchParams;
    const filterType = (searchParams.get('filter') || 'today') as AnalyticsFilterType;
    const startDateParam = searchParams.get('startDate') ?? undefined;
    const endDateParam = searchParams.get('endDate') ?? undefined;

    if (!VALID_FILTERS.includes(filterType)) {
      return NextResponse.json({ error: 'Invalid filter type' }, { status: 400 });
    }

    const { startDate, endDate } = getAnalyticsDateRange(
      filterType,
      startDateParam,
      endDateParam
    );

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const result = await db.execute(sql`
      WITH lead_pool AS (
        SELECT lf.id AS followup_id, lf.followup_number, lf.scheduled_date,
               lf.first_attempt_date, lf.attempt_count, l.assigned_dt_id, l.id AS lead_id
        FROM lead_lifecycle_followups lf
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN users u_act ON l.assigned_dt_id = u_act.id AND u_act.role = 'dt' AND u_act.active_status = true
        WHERE ol.status = 'active'
          AND l.assigned_dt_id IS NOT NULL
          AND l.activity_status = 'active'
          ${leadBrandCond}
          AND (
            (lf.attempt_count = 0 AND lf.scheduled_date >= ${startStr}::timestamp AND lf.scheduled_date <= ${endStr}::timestamp)
            OR (lf.attempt_count > 0 AND lf.first_attempt_date IS NOT NULL
                AND lf.first_attempt_date >= ${startStr}::timestamp AND lf.first_attempt_date <= ${endStr}::timestamp)
            OR (lf.attempt_count > 0 AND EXISTS (
              SELECT 1 FROM lead_lifecycle_followup_attempts fa_in_range
              WHERE fa_in_range.followup_id = lf.id
                AND fa_in_range.attempt_date >= ${startStr}::timestamp
                AND fa_in_range.attempt_date <= ${endStr}::timestamp
            ))
          )
      ),
      attempts_in_range AS (
        SELECT
          fa.dt_id,
          fa.outcome,
          fa.attempt_date,
          lp.followup_number,
          lp.assigned_dt_id,
          lp.first_attempt_date,
          lp.scheduled_date,
          l.id AS lead_id,
          l.customer_id,
          date_trunc('day', fa.attempt_date AT TIME ZONE ${ANALYTICS_TIMEZONE}) AS attempt_day_ist
        FROM lead_lifecycle_followup_attempts fa
        INNER JOIN lead_pool lp ON fa.followup_id = lp.followup_id
        INNER JOIN lead_lifecycle_followups lf ON lf.id = lp.followup_id
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        WHERE fa.attempt_date >= ${startStr}::timestamp AND fa.attempt_date <= ${endStr}::timestamp
      ),
      connected_dt_days AS (
        SELECT DISTINCT dt_id, customer_id, attempt_day_ist
        FROM attempts_in_range
        WHERE LOWER(TRIM(outcome)) = 'connected'
      ),
      attempts_deduped AS (
        SELECT DISTINCT ON (a.dt_id, a.lead_id, a.attempt_day_ist)
          a.dt_id,
          a.lead_id,
          a.attempt_day_ist,
          a.outcome,
          a.followup_number
        FROM attempts_in_range a
        ORDER BY a.dt_id, a.lead_id, a.attempt_day_ist, a.attempt_date DESC
      ),
      dt_stats AS (
        SELECT
          u.id AS dt_id,
          u.name AS dt_name,
          (SELECT COUNT(DISTINCT lp.lead_id)::int FROM lead_pool lp WHERE lp.assigned_dt_id = u.id) AS leads,
          (SELECT COUNT(DISTINCT lp.lead_id)::int FROM lead_pool lp
            WHERE lp.assigned_dt_id = u.id
              AND lp.followup_number = 0
              AND lp.attempt_count = 0
          ) AS new_leads,
          (SELECT COUNT(DISTINCT lp.lead_id)::int FROM lead_pool lp
            WHERE lp.assigned_dt_id = u.id
              AND NOT EXISTS (
                SELECT 1 FROM lead_pool lp_new
                WHERE lp_new.lead_id = lp.lead_id
                  AND lp_new.assigned_dt_id = u.id
                  AND lp_new.followup_number = 0
                  AND lp_new.attempt_count = 0
              )
          ) AS rescheduled_leads,
          (SELECT COUNT(DISTINCT (a.customer_id, a.attempt_day_ist))::int FROM attempts_in_range a WHERE a.dt_id = u.id) AS attempted,
          (SELECT COUNT(*)::int FROM connected_dt_days c WHERE c.dt_id = u.id) AS connected,
          (SELECT COUNT(DISTINCT l.id)::int
           FROM lead_lifecycle_followups lf
           INNER JOIN lead_lifecycle_followup_attempts fa
             ON fa.followup_id = lf.id
             AND fa.dt_id = u.id
             AND LOWER(fa.outcome) = 'connected'
           INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
           INNER JOIN leads l ON ol.lead_id = l.id
           WHERE lf.status = 'connected'
             AND lf.connected_date IS NOT NULL
             AND lf.connected_date >= ${startStr}::timestamp
             AND lf.connected_date <= ${endStr}::timestamp
             AND lf.payload->>'connected_choice' = 'reviewed'
             ${leadBrandCond}
          ) AS reviewed,
          (SELECT COUNT(*)::int FROM (
            SELECT a.lead_id, a.attempt_day_ist FROM attempts_in_range a
            WHERE a.dt_id = u.id AND a.followup_number = 0
            GROUP BY a.lead_id, a.attempt_day_ist
            HAVING BOOL_OR(LOWER(TRIM(a.outcome)) = 'connected')
          ) counselling_days) AS counselling,
          (SELECT COUNT(DISTINCT (a.lead_id, a.attempt_day_ist))::int FROM attempts_in_range a WHERE a.dt_id = u.id AND a.followup_number = 0) AS fu0_att,
          (SELECT COUNT(*)::int FROM (
            SELECT a.lead_id, a.attempt_day_ist FROM attempts_in_range a
            WHERE a.dt_id = u.id AND a.followup_number = 1
            GROUP BY a.lead_id, a.attempt_day_ist
            HAVING BOOL_OR(LOWER(TRIM(a.outcome)) = 'connected')
          ) fu1_conn_days) AS fu1_conn,
          (SELECT COUNT(DISTINCT (a.lead_id, a.attempt_day_ist))::int FROM attempts_in_range a WHERE a.dt_id = u.id AND a.followup_number = 1) AS fu1_att,
          (SELECT COUNT(*)::int FROM (
            SELECT a.lead_id, a.attempt_day_ist FROM attempts_in_range a
            WHERE a.dt_id = u.id AND a.followup_number = 2
            GROUP BY a.lead_id, a.attempt_day_ist
            HAVING BOOL_OR(LOWER(TRIM(a.outcome)) = 'connected')
          ) fu2_conn_days) AS fu2_conn,
          (SELECT COUNT(DISTINCT (a.lead_id, a.attempt_day_ist))::int FROM attempts_in_range a WHERE a.dt_id = u.id AND a.followup_number = 2) AS fu2_att,
          (SELECT COUNT(*)::int FROM (
            SELECT a.lead_id, a.attempt_day_ist FROM attempts_in_range a
            WHERE a.dt_id = u.id AND a.followup_number = 3
            GROUP BY a.lead_id, a.attempt_day_ist
            HAVING BOOL_OR(LOWER(TRIM(a.outcome)) = 'connected')
          ) fu3_conn_days) AS fu3_conn,
          (SELECT COUNT(DISTINCT (a.lead_id, a.attempt_day_ist))::int FROM attempts_in_range a WHERE a.dt_id = u.id AND a.followup_number = 3) AS fu3_att,
          (SELECT COUNT(*)::int FROM attempts_deduped ad
            WHERE ad.dt_id = u.id
              AND LOWER(TRIM(ad.outcome)) IN ('cnr','no_answer','wrong_number','failed','unreachable','not_interested')
          ) AS unreachable_count,
          (SELECT AVG(EXTRACT(EPOCH FROM (lp.first_attempt_date - lp.scheduled_date))/3600)
           FROM lead_pool lp
           WHERE lp.assigned_dt_id = u.id AND lp.first_attempt_date IS NOT NULL) AS ttc_avg
        FROM users u
        WHERE u.role = 'dt' AND u.active_status = true
          AND (u.id IN (SELECT assigned_dt_id FROM lead_pool) OR u.id IN (SELECT dt_id FROM attempts_in_range))
      )
      SELECT * FROM dt_stats
      WHERE leads > 0 OR attempted > 0
      ORDER BY attempted DESC
    `);

    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];

    const dietitians: DietitianAnalyticsRow[] = rows.map((r) => {
      const row = r as Record<string, unknown>;
      const attempted = Number(row.attempted ?? 0);
      const connected = Number(row.connected ?? 0);
      const reviewed = Number(row.reviewed ?? 0);
      const fu2Conn = Number(row.fu2_conn ?? 0);
      const fu2Att = Number(row.fu2_att ?? 0);
      const fu3Conn = Number(row.fu3_conn ?? 0);
      const fu3Att = Number(row.fu3_att ?? 0);
      const unreachableCount = Number(row.unreachable_count ?? 0);

      return {
        dtId: String(row.dt_id ?? ''),
        dtName: String(row.dt_name ?? ''),
        leads: Number(row.leads ?? 0),
        newLeads: Number(row.new_leads ?? 0),
        rescheduledLeads: Number(row.rescheduled_leads ?? 0),
        attempted,
        connected,
        reviewed,
        attemptPct:
          Number(row.leads ?? 0) > 0
            ? Math.round((attempted / Number(row.leads ?? 0)) * 100)
            : 0,
        connPct: attempted > 0 ? Math.round((connected / attempted) * 100) : 0,
        conversionPct: connected > 0 ? Math.round((reviewed / connected) * 100) : 0,
        counselling: Number(row.counselling ?? 0),
        fu0Att: Number(row.fu0_att ?? 0),
        fu1Conn: Number(row.fu1_conn ?? 0),
        fu1Att: Number(row.fu1_att ?? 0),
        fu2Conn,
        fu2Att,
        fu3Conn,
        fu3Att,
        unreachablePct: attempted > 0 ? Math.round((unreachableCount / attempted) * 100) : 0,
        tToCallHours: parseFloat(Number(row.ttc_avg ?? 0).toFixed(1)),
      };
    });

    const allDtResult = await db.execute(sql`
      SELECT id, name FROM users WHERE role = 'dt' AND active_status = true
    `);
    const allDtRows = Array.isArray(allDtResult)
      ? allDtResult
      : (allDtResult as { rows?: unknown[] })?.rows ?? [];

    const existingIds = new Set(dietitians.map((d) => d.dtId));
    for (const row of allDtRows as Record<string, unknown>[]) {
      const id = String(row.id ?? '');
      if (!existingIds.has(id)) {
        dietitians.push({
          dtId: id,
          dtName: String(row.name ?? ''),
          leads: 0,
          newLeads: 0,
          rescheduledLeads: 0,
          attempted: 0,
          connected: 0,
          reviewed: 0,
          attemptPct: 0,
          connPct: 0,
          conversionPct: 0,
          counselling: 0,
          fu0Att: 0,
          fu1Conn: 0,
          fu1Att: 0,
          fu2Conn: 0,
          fu2Att: 0,
          fu3Conn: 0,
          fu3Att: 0,
          unreachablePct: 0,
          tToCallHours: 0,
        });
      }
    }

    const response: DietitianAnalyticsResponse = {
      dietitians: dietitians.sort((a, b) => b.attempted - a.attempted),
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dietitian analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent analytics' },
      { status: 500 }
    );
  }
}
