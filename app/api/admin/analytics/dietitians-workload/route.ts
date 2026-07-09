import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { and, eq, ne, gte, lte, lt, sql, isNotNull, gt, or } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getBrandActiveDietitians } from '@/lib/services/dtBrandProfileService';
import {
  fetchAgentAttemptCountsByDt,
  fetchOverdueAttemptCountsByDt,
} from '@/lib/analytics/attemptCounts';
import {
  leadLifecycleFollowups,
  leadLifecycles,
  leads,
} from '@/lib/db/schema';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata';

type StageKey = 'counselling' | 'fu1' | 'fu2' | 'fu3';

function emptyStageSets(): Record<StageKey, Set<string>> {
  return { counselling: new Set(), fu1: new Set(), fu2: new Set(), fu3: new Set() };
}

function setsToCounts(s: Record<StageKey, Set<string>>): Record<StageKey, number> {
  return {
    counselling: s.counselling.size,
    fu1: s.fu1.size,
    fu2: s.fu2.size,
    fu3: s.fu3.size,
  };
}

/** Stage buckets for followup_number 0..3. */
function stageKey(n: number): StageKey {
  if (n === 0) return 'counselling';
  if (n === 1) return 'fu1';
  if (n === 2) return 'fu2';
  return 'fu3';
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

    const brand = await getCrmBrandFromCookie();

    const filterParam = request.nextUrl.searchParams.get('filter');
    const dateParam = request.nextUrl.searchParams.get('date');
    const endDateParam = request.nextUrl.searchParams.get('endDate');

    let dateStr = dateParam;
    if (!dateStr && filterParam === 'yesterday') {
      dateStr = dayjs().tz(TZ).subtract(1, 'day').format('YYYY-MM-DD');
    } else if (!dateStr && filterParam === 'custom' && endDateParam) {
      dateStr = endDateParam;
    }
    if (!dateStr) {
      dateStr = dayjs().tz(TZ).format('YYYY-MM-DD');
    }

    const dayStart = dayjs.tz(dateStr, TZ).startOf('day').toDate();
    const dayEnd = dayjs.tz(dateStr, TZ).endOf('day').toDate();

    const activeDTs = await getBrandActiveDietitians(brand);

    const pendingBase = and(
      eq(leadLifecycleFollowups.status, 'pending'),
      eq(leadLifecycles.status, 'active'),
      eq(leads.activity_status, 'active'),
      isNotNull(leadLifecycleFollowups.assigned_dt_id),
      leadMatchesCrmBrand(brand)
    );

    const newDueRows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        fn: leadLifecycleFollowups.followup_number,
        leadId: leads.id,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          pendingBase,
          eq(leadLifecycleFollowups.followup_number, 0),
          eq(leadLifecycleFollowups.attempt_count, 0),
          gte(leadLifecycleFollowups.scheduled_date, dayStart),
          lte(leadLifecycleFollowups.scheduled_date, dayEnd)
        )
      );

    /** Due today but not "new" (followup_number 0 and attempt_count 0). */
    const reschedDueRows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        fn: leadLifecycleFollowups.followup_number,
        leadId: leads.id,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          pendingBase,
          gte(leadLifecycleFollowups.scheduled_date, dayStart),
          lte(leadLifecycleFollowups.scheduled_date, dayEnd),
          or(
            gt(leadLifecycleFollowups.attempt_count, 0),
            ne(leadLifecycleFollowups.followup_number, 0)
          )
        )
      );

    const overdueRows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        fn: leadLifecycleFollowups.followup_number,
        leadId: leads.id,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(and(pendingBase, lt(leadLifecycleFollowups.scheduled_date, dayStart)));

    const agg = new Map<
      string,
      {
        newDueLeadIds: Set<string>;
        reschedDueLeadIds: Set<string>;
        overdueLeadIds: Set<string>;
        byNewSets: Record<StageKey, Set<string>>;
        byReschedSets: Record<StageKey, Set<string>>;
        byOverdueSets: Record<StageKey, Set<string>>;
      }
    >();

    for (const dt of activeDTs) {
      agg.set(dt.id, {
        newDueLeadIds: new Set(),
        reschedDueLeadIds: new Set(),
        overdueLeadIds: new Set(),
        byNewSets: emptyStageSets(),
        byReschedSets: emptyStageSets(),
        byOverdueSets: emptyStageSets(),
      });
    }

    // newDueRows are followup_number = 0 only; byNewSets only populate counselling.
    for (const row of newDueRows) {
      const id = String(row.dtId ?? '');
      const leadId = String(row.leadId ?? '');
      const bucket = agg.get(id);
      if (!bucket || !leadId) continue;
      bucket.newDueLeadIds.add(leadId);
      bucket.byNewSets[stageKey(Number(row.fn ?? 0))].add(leadId);
    }
    for (const row of reschedDueRows) {
      const id = String(row.dtId ?? '');
      const leadId = String(row.leadId ?? '');
      const bucket = agg.get(id);
      if (!bucket || !leadId) continue;
      bucket.reschedDueLeadIds.add(leadId);
      bucket.byReschedSets[stageKey(Number(row.fn ?? 0))].add(leadId);
    }
    for (const row of overdueRows) {
      const id = String(row.dtId ?? '');
      const leadId = String(row.leadId ?? '');
      const bucket = agg.get(id);
      if (!bucket || !leadId) continue;
      bucket.overdueLeadIds.add(leadId);
      bucket.byOverdueSets[stageKey(Number(row.fn ?? 0))].add(leadId);
    }

    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const [attemptCountsByDt, overdueByDt] = await Promise.all([
      fetchAgentAttemptCountsByDt({ startIso, endIso, brand }),
      fetchOverdueAttemptCountsByDt({ startIso, endIso, brand }),
    ]);

    const todayDueRows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        n: sql<number>`cast(count(distinct ${leads.id}) as int)`,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          eq(leadLifecycleFollowups.status, 'pending'),
          eq(leadLifecycles.status, 'active'),
          eq(leads.activity_status, 'active'),
          isNotNull(leadLifecycleFollowups.assigned_dt_id),
          gte(leadLifecycleFollowups.scheduled_date, dayStart),
          lte(leadLifecycleFollowups.scheduled_date, dayEnd)
        )
      )
      .groupBy(leadLifecycleFollowups.assigned_dt_id);

    const overdueOnlyRows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        n: sql<number>`cast(count(distinct ${leads.id}) as int)`,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          eq(leadLifecycleFollowups.status, 'pending'),
          eq(leadLifecycles.status, 'active'),
          eq(leads.activity_status, 'active'),
          isNotNull(leadLifecycleFollowups.assigned_dt_id),
          leadMatchesCrmBrand(brand),
          lt(leadLifecycleFollowups.scheduled_date, dayStart)
        )
      )
      .groupBy(leadLifecycleFollowups.assigned_dt_id);

    const todayDueMap = new Map(todayDueRows.map((r) => [String(r.dtId ?? ''), Number(r.n ?? 0)]));
    const overdueMap = new Map(overdueOnlyRows.map((r) => [String(r.dtId ?? ''), Number(r.n ?? 0)]));

    return NextResponse.json({
      dietitians: activeDTs.map((dt) => {
        const a = agg.get(dt.id)!;
        const attemptCounts = attemptCountsByDt.get(dt.id) ?? {
          totalDials: 0,
          uniqueCustomerDays: 0,
          uniqueCustomerDaysConnected: 0,
        };

        return {
          dtId: dt.id,
          dtName: dt.name,
          todayDue: todayDueMap.get(dt.id) ?? 0,
          overdue: overdueMap.get(dt.id) ?? 0,
          newDueToday: a.newDueLeadIds.size,
          newDueTodayByStage: setsToCounts(a.byNewSets),
          rescheduledDueToday: a.reschedDueLeadIds.size,
          rescheduledDueTodayByStage: setsToCounts(a.byReschedSets),
          overdueDueToday: a.overdueLeadIds.size,
          overdueByStage: setsToCounts(a.byOverdueSets),
          overdueAttempted: overdueByDt.get(dt.id) ?? 0,
          callsAttempted: attemptCounts.uniqueCustomerDays,
          callsConnected: attemptCounts.uniqueCustomerDaysConnected,
          totalDials: attemptCounts.totalDials,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching dietitian workload:', error);
    const details =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? { message: error.message, stack: error.stack }
        : undefined;
    return NextResponse.json(
      { error: 'Failed to fetch agent workload', ...(details ? { details } : {}) },
      { status: 500 }
    );
  }
}
