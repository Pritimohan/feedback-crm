import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { and, eq, ne, gte, lte, lt, sql, isNotNull, gt, or, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  users,
  leadLifecycleFollowups,
  leadLifecycleFollowupAttempts,
  leadLifecycles,
  leads,
  callLogs,
} from '@/lib/db/schema';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata';

type StageKey = 'counselling' | 'fu1' | 'fu2';

function emptyStageSets(): Record<StageKey, Set<string>> {
  return { counselling: new Set(), fu1: new Set(), fu2: new Set() };
}

function setsToCounts(s: Record<StageKey, Set<string>>): Record<StageKey, number> {
  return {
    counselling: s.counselling.size,
    fu1: s.fu1.size,
    fu2: s.fu2.size,
  };
}

/** Final stage is followup_number 2; legacy rows with fn > 2 roll into fu2 for workload breakdown. */
function stageKey(n: number): StageKey {
  if (n === 0) return 'counselling';
  if (n === 1) return 'fu1';
  return 'fu2';
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

    const activeDTs = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, 'dt'), eq(users.active_status, true)));

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

    const attemptDayWhere = and(
      eq(leadLifecycles.status, 'active'),
      eq(leads.activity_status, 'active'),
      leadMatchesCrmBrand(brand),
      gte(leadLifecycleFollowupAttempts.attempt_date, dayStart),
      lte(leadLifecycleFollowupAttempts.attempt_date, dayEnd)
    );

    const attemptRows = await db
      .select({
        dtId: leadLifecycleFollowupAttempts.dt_id,
        callsAttempted: sql<number>`cast(count(*) as int)`,
        callsConnected: sql<number>`cast(sum(case when ${leadLifecycleFollowupAttempts.outcome} = ${'connected'} then 1 else 0 end) as int)`,
      })
      .from(leadLifecycleFollowupAttempts)
      .innerJoin(
        leadLifecycleFollowups,
        eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
      )
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(attemptDayWhere)
      .groupBy(leadLifecycleFollowupAttempts.dt_id);

    const attemptsByDt = new Map(
      attemptRows.map((r) => [
        String(r.dtId ?? ''),
        {
          callsAttempted: Number(r.callsAttempted ?? 0),
          callsConnected: Number(r.callsConnected ?? 0),
        },
      ])
    );

    const callLogDayFilter = and(
      gte(callLogs.created_at, dayStart),
      lte(callLogs.created_at, dayEnd),
      eq(leads.activity_status, 'active'),
      or(isNull(callLogs.lifecycle_id), eq(leadLifecycles.status, 'active'))
    );

    const callLogAggRows = await db
      .select({
        dtId: callLogs.dt_id,
        callsAttempted: sql<number>`cast(count(distinct coalesce(${callLogs.attempt_id}, ${callLogs.id})) as int)`,
        callsConnected: sql<number>`cast(count(distinct case when lower(trim(${callLogs.attempt_outcome})) = 'connected' then coalesce(${callLogs.attempt_id}, ${callLogs.id}) end) as int)`,
      })
      .from(callLogs)
      .innerJoin(leads, eq(callLogs.lead_id, leads.id))
      .leftJoin(leadLifecycles, eq(callLogs.lifecycle_id, leadLifecycles.id))
      .where(callLogDayFilter)
      .groupBy(callLogs.dt_id);

    const callsFromLogsByDt = new Map(
      callLogAggRows.map((r) => [
        String(r.dtId ?? ''),
        {
          callsAttempted: Number(r.callsAttempted ?? 0),
          callsConnected: Number(r.callsConnected ?? 0),
        },
      ])
    );

    const overdueFromAttemptsRows = await db
      .select({
        dtId: leadLifecycleFollowupAttempts.dt_id,
        n: sql<number>`cast(count(*) as int)`,
      })
      .from(leadLifecycleFollowupAttempts)
      .innerJoin(
        leadLifecycleFollowups,
        eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
      )
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          eq(leadLifecycleFollowupAttempts.was_overdue, true),
          gte(leadLifecycleFollowupAttempts.attempt_date, dayStart),
          lte(leadLifecycleFollowupAttempts.attempt_date, dayEnd),
          leadMatchesCrmBrand(brand)
        )
      )
      .groupBy(leadLifecycleFollowupAttempts.dt_id);

    const overdueFromAttemptsMap = new Map(
      overdueFromAttemptsRows.map((r) => [String(r.dtId ?? ''), Number(r.n ?? 0)])
    );

    const overdueFromLogsRows = await db
      .select({
        dtId: callLogs.dt_id,
        n: sql<number>`cast(count(distinct coalesce(${callLogs.attempt_id}, ${callLogs.id})) as int)`,
      })
      .from(callLogs)
      .innerJoin(leads, eq(callLogs.lead_id, leads.id))
      .leftJoin(leadLifecycles, eq(callLogs.lifecycle_id, leadLifecycles.id))
      .where(
        and(
          callLogDayFilter,
          eq(callLogs.was_overdue, true)
        )
      )
      .groupBy(callLogs.dt_id);

    const overdueFromLogsMap = new Map(
      overdueFromLogsRows.map((r) => [String(r.dtId ?? ''), Number(r.n ?? 0)])
    );

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
        const fromAttempts = attemptsByDt.get(dt.id) ?? { callsAttempted: 0, callsConnected: 0 };
        const fromLogs = callsFromLogsByDt.get(dt.id) ?? { callsAttempted: 0, callsConnected: 0 };
        const useLogs = fromLogs.callsAttempted > 0;
        const callsAttempted = useLogs ? fromLogs.callsAttempted : fromAttempts.callsAttempted;
        const callsConnected = useLogs ? fromLogs.callsConnected : fromAttempts.callsConnected;

        const overdueLogN = overdueFromLogsMap.get(dt.id) ?? 0;
        const overdueAttN = overdueFromAttemptsMap.get(dt.id) ?? 0;
        const overdueAttempted = overdueLogN > 0 ? overdueLogN : overdueAttN;

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
          overdueAttempted,
          callsAttempted,
          callsConnected,
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
      { error: 'Failed to fetch dietitian workload', ...(details ? { details } : {}) },
      { status: 500 }
    );
  }
}
