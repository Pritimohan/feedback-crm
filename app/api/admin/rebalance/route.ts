import { NextResponse } from 'next/server';
import { and, eq, lte, sql } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users, leadLifecycleFollowups, leadLifecycles, leads } from '@/lib/db/schema';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';

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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const brand = await getCrmBrandFromCookie();

  const activeDTs = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true)));

  const rows = await db
    .select({
      dtId: leadLifecycleFollowups.assigned_dt_id,
      overdue: sql<number>`count(*) filter (where ${leadLifecycleFollowups.scheduled_date} < ${todayStart})`,
      todayDue: sql<number>`count(*) filter (where ${leadLifecycleFollowups.scheduled_date} >= ${todayStart} and ${leadLifecycleFollowups.scheduled_date} <= ${todayEnd})`,
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

  return NextResponse.json({
    currentDistribution,
    proposedDistribution,
    activeDTs,
    totalTodaysCalls,
    totalTodaysDue: currentDistribution.reduce((s, d) => s + d.todaysDue, 0),
    totalOverdue: currentDistribution.reduce((s, d) => s + d.overdue, 0),
    customersToMove: currentDistribution.reduce((sum, curr, idx) => {
      const next = proposedDistribution[idx];
      return sum + Math.max(0, curr.todaysCalls - next.todaysCalls);
    }, 0),
    loadSnapshot: await getDtLoadDistribution(undefined, brand),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const snapshot = await GET();
  const json = await snapshot.json();
  return NextResponse.json({
    success: true,
    message: 'Preview rebalance computed successfully. Automatic reassignment execution is not enabled in this build.',
    customersReassigned: 0,
    totalTodaysCalls: json.totalTodaysCalls ?? 0,
    newDistribution: json.proposedDistribution ?? [],
  });
}
