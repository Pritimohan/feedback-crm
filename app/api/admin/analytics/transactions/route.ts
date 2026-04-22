import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  leadLifecycleFollowups,
  leadLifecycleFollowupAttempts,
  leadLifecycles,
  leads,
  customers,
  users,
} from '@/lib/db/schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import type { TransactionRow } from '@/types/analytics';
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

function formatTimeToCall(scheduled: Date | null, attempt: Date | null): string {
  if (!scheduled || !attempt) return '—';
  const ms = attempt.getTime() - scheduled.getTime();
  if (ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const rows = await db
      .select({
        customerName: customers.name,
        dietitianName: users.name,
        followupNumber: leadLifecycleFollowups.followup_number,
        outcome: leadLifecycleFollowupAttempts.outcome,
        attemptDate: leadLifecycleFollowupAttempts.attempt_date,
        scheduledDate: leadLifecycleFollowups.scheduled_date,
      })
      .from(leadLifecycleFollowupAttempts)
      .innerJoin(
        leadLifecycleFollowups,
        eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
      )
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .innerJoin(customers, eq(leads.customer_id, customers.id))
      .innerJoin(users, eq(leadLifecycleFollowupAttempts.dt_id, users.id))
      .where(
        and(
          eq(leadLifecycles.status, 'active'),
          eq(leads.activity_status, 'active'),
          gte(leadLifecycleFollowupAttempts.attempt_date, startDate),
          lte(leadLifecycleFollowupAttempts.attempt_date, endDate)
        )
      )
      .orderBy(desc(leadLifecycleFollowupAttempts.attempt_date))
      .limit(50);

    const transactions: TransactionRow[] = rows.map((r) => {
      const attempt = r.attemptDate ? new Date(r.attemptDate) : null;
      const scheduled = r.scheduledDate ? new Date(r.scheduledDate) : null;
      const outcome = formatOutcomeForDisplay(r.outcome);
      const connected = (r.outcome ?? '').toLowerCase() === 'connected';

      return {
        customerName: r.customerName ?? '—',
        dietitianName: r.dietitianName ?? '—',
        stage: followupStageLabel(r.followupNumber ?? 0),
        attempted: true,
        connected,
        outcome,
        timeToCall: formatTimeToCall(scheduled, attempt),
      };
    });

    return NextResponse.json({
      transactions,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('Error fetching transaction analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
