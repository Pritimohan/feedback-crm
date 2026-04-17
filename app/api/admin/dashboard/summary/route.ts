import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, customers, leadLifecycleFollowups, leads, users } from '@/lib/db/schema';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [customerCounts, leadCounts, callCounts, dtCounts, pendingFollowups, connectedCalls] =
    await Promise.all([
      db.select({ total: sql<number>`count(*)` }).from(customers),
      db
        .select({
          active: sql<number>`count(*) filter (where ${leads.activity_status} = 'active')`,
          deferred: sql<number>`count(*) filter (where ${leads.activity_status} = 'deferred')`,
          inactive: sql<number>`count(*) filter (where ${leads.activity_status} = 'inactive')`,
        })
        .from(leads),
      db
        .select({
          totalToday: sql<number>`count(*) filter (where ${callLogs.created_at} >= date_trunc('day', now()))`,
        })
        .from(callLogs),
      db
        .select({
          totalDt: sql<number>`count(*) filter (where ${users.role} = 'dt')`,
          activeDt: sql<number>`count(*) filter (where ${users.role} = 'dt' and ${users.active_status} = true)`,
        })
        .from(users),
      db
        .select({ total: sql<number>`count(*)` })
        .from(leadLifecycleFollowups)
        .where(eq(leadLifecycleFollowups.status, 'pending')),
      db
        .select({
          connectedToday: sql<number>`count(*) filter (where ${callLogs.created_at} >= date_trunc('day', now()) and ${callLogs.attempt_outcome} = 'connected')`,
        })
        .from(callLogs),
    ]);

  const dtLoad = await getDtLoadDistribution();
  const totalToday = Number(callCounts[0]?.totalToday ?? 0);
  const connectedToday = Number(connectedCalls[0]?.connectedToday ?? 0);

  return NextResponse.json({
    data: {
      customers: {
        total: Number(customerCounts[0]?.total ?? 0),
      },
      leads: {
        active: Number(leadCounts[0]?.active ?? 0),
        deferred: Number(leadCounts[0]?.deferred ?? 0),
        inactive: Number(leadCounts[0]?.inactive ?? 0),
      },
      calls: {
        totalToday,
        connectedToday,
        connectedRate: totalToday > 0 ? Number(((connectedToday / totalToday) * 100).toFixed(2)) : 0,
      },
      dt: {
        total: Number(dtCounts[0]?.totalDt ?? 0),
        active: Number(dtCounts[0]?.activeDt ?? 0),
      },
      followups: {
        pending: Number(pendingFollowups[0]?.total ?? 0),
      },
      distribution: dtLoad,
    },
  });
}
