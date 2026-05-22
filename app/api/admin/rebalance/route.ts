import { NextResponse } from 'next/server';
import { and, eq, lte, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users, leadLifecycleFollowups, leadLifecycles, leads } from '@/lib/db/schema';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';
import {
  getRebalancePreviewData,
  rebalanceByPercentages,
  getActiveDietitians,
} from '@/lib/services/rebalanceEligibilityService';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function calculateCallsToMove(
  current: { dtId: string; count: number }[],
  proposed: { dtId: string; count: number }[]
): number {
  let toMove = 0;
  for (const curr of current) {
    const prop = proposed.find((p) => p.dtId === curr.dtId);
    if (prop && curr.count > prop.count) {
      toMove += curr.count - prop.count;
    }
  }
  return toMove;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const brand = await getCrmBrandFromCookie();
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const todayStartIso = todayStart.toISOString();
    const todayEndIso = todayEnd.toISOString();

    const activeDTs = await getActiveDietitians();

    if (activeDTs.length === 0) {
      return NextResponse.json(
        {
          error: 'No active agents found',
          currentDistribution: [],
          proposedDistribution: [],
          activeDTs: [],
          totalTodaysCalls: 0,
          rebalanceConfig: { label: "Today's Calls", dts: [] },
          poolSummary: { totalLeads: 0, totalReassignable: 0, totalLocked: 0, onInactiveDt: 0 },
        },
        { status: 400 }
      );
    }

    const rows = await db
      .select({
        dtId: leadLifecycleFollowups.assigned_dt_id,
        overdue: sql<number>`count(*) filter (where ${leadLifecycleFollowups.scheduled_date} < ${todayStartIso}::timestamptz)`,
        todayDue: sql<number>`count(*) filter (where ${leadLifecycleFollowups.scheduled_date} >= ${todayStartIso}::timestamptz and ${leadLifecycleFollowups.scheduled_date} <= ${todayEndIso}::timestamptz)`,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          eq(leadLifecycleFollowups.status, 'pending'),
          lte(leadLifecycleFollowups.scheduled_date, todayEnd),
          leadMatchesCrmBrand(brand)
        )
      )
      .groupBy(leadLifecycleFollowups.assigned_dt_id);

    const byDt = new Map(rows.map((r) => [r.dtId ?? '', r]));
    const currentDistribution = activeDTs.map((dt) => {
      const r = byDt.get(dt.id);
      const overdue = Number(r?.overdue ?? 0);
      const todaysDue = Number(r?.todayDue ?? 0);
      return {
        dtId: dt.id,
        dtName: dt.name,
        dtEmail: dt.email,
        overdue,
        todaysDue,
        todaysCalls: overdue + todaysDue,
      };
    });

    const totalTodaysCalls = currentDistribution.reduce((s, d) => s + d.todaysCalls, 0);
    const equalPerDt = activeDTs.length ? Math.floor(totalTodaysCalls / activeDTs.length) : 0;
    const remainder = activeDTs.length ? totalTodaysCalls % activeDTs.length : 0;
    const proposedDistribution = currentDistribution.map((d, i) => ({
      ...d,
      todaysCalls: equalPerDt + (i < remainder ? 1 : 0),
    }));

    const { rebalanceConfig, poolSummary } = await getRebalancePreviewData();

    return NextResponse.json({
      currentDistribution,
      proposedDistribution,
      activeDTs,
      totalTodaysCalls,
      totalTodaysDue: currentDistribution.reduce((s, d) => s + d.todaysDue, 0),
      totalOverdue: currentDistribution.reduce((s, d) => s + d.overdue, 0),
      customersToMove: calculateCallsToMove(
        currentDistribution.map((d) => ({ dtId: d.dtId, count: d.todaysCalls })),
        proposedDistribution.map((d) => ({ dtId: d.dtId, count: d.todaysCalls }))
      ),
      loadSnapshot: await getDtLoadDistribution(undefined, brand),
      rebalanceConfig,
      poolSummary,
    });
  } catch (error) {
    console.error('Error fetching rebalance preview:', error);
    return NextResponse.json({ error: 'Failed to fetch distribution data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    let percentages: { dtId: string; percentage: number }[] | undefined;

    try {
      const body = await request.json();
      if (body?.percentages && Array.isArray(body.percentages)) {
        percentages = body.percentages.map((p: { dtId: string; percentage: number }) => ({
          dtId: String(p.dtId),
          percentage: Number(p.percentage),
        }));
      }
    } catch {
      // No body
    }

    const activeDTs = await getActiveDietitians();
    const resolvedPercentages =
      percentages && percentages.length > 0
        ? percentages
        : activeDTs.map((dt) => ({
            dtId: dt.id,
            percentage: activeDTs.length > 0 ? 100 / activeDTs.length : 0,
          }));

    const result = await rebalanceByPercentages(resolvedPercentages);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const snapshot = await GET();
    const json = await snapshot.json();

    return NextResponse.json({
      success: true,
      message: result.message,
      customersReassigned: result.leadsReassigned,
      leadsReassigned: result.leadsReassigned,
      followupsReassigned: result.followupsReassigned,
      totalTodaysCalls: json.totalTodaysCalls ?? 0,
      newDistribution: json.currentDistribution ?? [],
      rebalanceConfig: json.rebalanceConfig,
      poolSummary: json.poolSummary,
    });
  } catch (error) {
    console.error('Error executing rebalance:', error);
    return NextResponse.json({ error: 'Failed to execute rebalance' }, { status: 500 });
  }
}
