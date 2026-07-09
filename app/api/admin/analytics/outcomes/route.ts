import { NextResponse, NextRequest } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { OutcomesAnalytics, OutcomeCountRow } from '@/types/analytics';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import {
  ATTEMPT_OUTCOME_KEYS,
  CONNECTED_CHOICE_KEYS,
  formatAttemptOutcomeLabel,
  formatConnectedChoiceForDisplay,
  isExcludedAttemptOutcome,
  normalizeAttemptOutcomeForChart,
} from '@/lib/utils/analyticsOutcomes';
import {
  dedupedAttemptsCte,
  sqlConnectedFollowupFilters,
} from '@/lib/analytics/uniqueAttemptsSql';

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

    const [choiceResult, attemptResult] = await Promise.all([
      db.execute(sql`
        SELECT
          lf.payload->>'connected_choice' AS choice,
          COUNT(DISTINCT lf.id)::int AS cnt
        FROM lead_lifecycle_followups lf
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN users u ON l.assigned_dt_id = u.id
        WHERE ${sqlConnectedFollowupFilters({
          startIso: startStr,
          endIso: endStr,
          brand,
        })}
        GROUP BY lf.payload->>'connected_choice'
      `),
      db.execute(sql`
        WITH ${dedupedAttemptsCte({
          startIso: startStr,
          endIso: endStr,
          brand,
          partition: 'customer',
          withLeadPoolFilter: false,
        })}
        SELECT LOWER(TRIM(outcome)) AS outcome, COUNT(*)::int AS cnt
        FROM attempts_deduped
        GROUP BY LOWER(TRIM(outcome))
      `),
    ]);

    const choiceRows = Array.isArray(choiceResult)
      ? choiceResult
      : (choiceResult as { rows?: unknown[] })?.rows ?? [];
    const attemptRows = Array.isArray(attemptResult)
      ? attemptResult
      : (attemptResult as { rows?: unknown[] })?.rows ?? [];

    const choiceCountMap = new Map<string, number>();
    for (const row of choiceRows as { choice?: string | null; cnt?: number }[]) {
      const key = (row.choice ?? '').toLowerCase();
      if (key) choiceCountMap.set(key, Number(row.cnt ?? 0));
    }

    const byConnectedChoice: OutcomeCountRow[] = CONNECTED_CHOICE_KEYS.map((key) => ({
      key,
      label: formatConnectedChoiceForDisplay(key),
      count: choiceCountMap.get(key) ?? 0,
    }));

    const attemptCountMap = new Map<string, number>();
    for (const row of attemptRows as { outcome?: string | null; cnt?: number }[]) {
      const chartKey = normalizeAttemptOutcomeForChart(row.outcome ?? '');
      if (!chartKey) continue;
      attemptCountMap.set(chartKey, (attemptCountMap.get(chartKey) ?? 0) + Number(row.cnt ?? 0));
    }

    const unknownKeys = [...attemptCountMap.keys()].filter(
      (k) =>
        !isExcludedAttemptOutcome(k) &&
        !ATTEMPT_OUTCOME_KEYS.includes(k as (typeof ATTEMPT_OUTCOME_KEYS)[number])
    );
    unknownKeys.sort((a, b) => (attemptCountMap.get(b) ?? 0) - (attemptCountMap.get(a) ?? 0));

    const orderedKeys = [...ATTEMPT_OUTCOME_KEYS, ...unknownKeys];
    const byAttemptOutcome: OutcomeCountRow[] = orderedKeys.map((key) => ({
      key,
      label: formatAttemptOutcomeLabel(key),
      count: attemptCountMap.get(key) ?? 0,
    }));

    const response: OutcomesAnalytics = {
      byConnectedChoice,
      byAttemptOutcome,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching outcomes analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outcomes analytics' },
      { status: 500 }
    );
  }
}
