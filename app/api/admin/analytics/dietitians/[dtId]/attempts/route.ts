import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  leadLifecycleFollowupAttempts,
  leadLifecycleFollowups,
  leadLifecycles,
  leads,
  customers,
} from '@/lib/db/schema';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import { formatOutcomeForDisplay } from '@/lib/utils/analyticsOutcomes';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';

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
    const limit = Math.min(Number(searchParams.get('limit') ?? '40') || 40, 100);

    if (!VALID_FILTERS.includes(filterType)) {
      return NextResponse.json({ error: 'Invalid filter type' }, { status: 400 });
    }

    const { startDate, endDate } = getAnalyticsDateRange(
      filterType,
      startDateParam,
      endDateParam
    );

    const brand = await getCrmBrandFromCookie();

    const rows = await db
      .select({
        attemptId: leadLifecycleFollowupAttempts.id,
        customerName: customers.name,
        phone: customers.phone,
        followupNumber: leadLifecycleFollowups.followup_number,
        outcome: leadLifecycleFollowupAttempts.outcome,
        attemptAt: leadLifecycleFollowupAttempts.attempt_date,
      })
      .from(leadLifecycleFollowupAttempts)
      .innerJoin(
        leadLifecycleFollowups,
        eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
      )
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .innerJoin(customers, eq(leads.customer_id, customers.id))
      .where(
        and(
          eq(leadLifecycleFollowupAttempts.dt_id, dtId),
          leadMatchesCrmBrand(brand),
          gte(leadLifecycleFollowupAttempts.attempt_date, startDate),
          lte(leadLifecycleFollowupAttempts.attempt_date, endDate)
        )
      )
      .orderBy(desc(leadLifecycleFollowupAttempts.attempt_date))
      .limit(limit);

    const attempts = rows.map((r) => ({
      attemptId: String(r.attemptId),
      customerName: r.customerName ?? '—',
      phone: r.phone ?? '',
      stage: followupStageLabel(r.followupNumber ?? 0),
      outcome: formatOutcomeForDisplay(r.outcome),
      attemptAt: r.attemptAt ? new Date(r.attemptAt).toISOString() : '',
    }));

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error('Error fetching dietitian attempts:', error);
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 });
  }
}
