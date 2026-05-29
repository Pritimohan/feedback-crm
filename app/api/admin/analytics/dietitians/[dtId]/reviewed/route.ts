import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';
import type { AgentReviewedRow } from '@/types/analytics';

const VALID_FILTERS: AnalyticsFilterType[] = [
  'today',
  'yesterday',
  'week',
  'month',
  'quarter',
  'custom',
];

export async function GET(request: NextRequest, context: { params: Promise<{ dtId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { dtId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const filterType = (searchParams.get('filter') || 'today') as AnalyticsFilterType;
    const startDateParam = searchParams.get('startDate') ?? undefined;
    const endDateParam = searchParams.get('endDate') ?? undefined;
    const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 100);

    if (!VALID_FILTERS.includes(filterType)) {
      return NextResponse.json({ error: 'Invalid filter type' }, { status: 400 });
    }

    const { startDate, endDate } = getAnalyticsDateRange(
      filterType,
      startDateParam,
      endDateParam
    );

    const brand = await getCrmBrandFromCookie();
    const brandCond =
      brand === 'fitelo'
        ? sql`AND l.brand = 'fitelo'`
        : sql`AND (l.brand = 'fitty' OR l.brand IS NULL)`;

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const result = await db.execute(sql`
      SELECT *
      FROM (
        SELECT DISTINCT ON (l.id)
          fa.id AS attempt_id,
          l.id AS lead_id,
          c.name AS customer_name,
          c.phone AS phone,
          lf.followup_number,
          lf.connected_date,
          fa.attempt_date
        FROM lead_lifecycle_followups lf
        INNER JOIN lead_lifecycle_followup_attempts fa
          ON fa.followup_id = lf.id
          AND fa.dt_id = ${dtId}::uuid
          AND LOWER(fa.outcome) = 'connected'
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN customers c ON l.customer_id = c.id
        WHERE lf.status = 'connected'
          AND lf.connected_date IS NOT NULL
          AND lf.connected_date >= ${startStr}::timestamp
          AND lf.connected_date <= ${endStr}::timestamp
          AND lf.payload->>'connected_choice' = 'reviewed'
          ${brandCond}
        ORDER BY l.id, lf.connected_date DESC
      ) reviewed_leads
      ORDER BY connected_date DESC
      LIMIT ${limit}
    `);

    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];

    const reviewed: AgentReviewedRow[] = (rows as Record<string, unknown>[]).map((r) => ({
      attemptId: String(r.attempt_id ?? ''),
      leadId: String(r.lead_id ?? ''),
      customerName: String(r.customer_name ?? '—'),
      phone: String(r.phone ?? ''),
      stage: followupStageLabel(Number(r.followup_number ?? 0)),
      connectedAt: r.connected_date ? new Date(r.connected_date as string).toISOString() : '',
      attemptAt: r.attempt_date ? new Date(r.attempt_date as string).toISOString() : '',
    }));

    return NextResponse.json({ reviewed, total: reviewed.length });
  } catch (error) {
    console.error('Error fetching agent reviewed conversions:', error);
    return NextResponse.json({ error: 'Failed to fetch reviewed conversions' }, { status: 500 });
  }
}
