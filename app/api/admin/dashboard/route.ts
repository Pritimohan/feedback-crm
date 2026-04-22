import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, customers, leadLifecycleFollowups } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [customerCount, callsToday, completedToday] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(customers),
    db.select({ total: sql<number>`count(*) filter (where ${callLogs.created_at} >= date_trunc('day', now()))` }).from(callLogs),
    db
      .select({ total: sql<number>`count(*) filter (where ${leadLifecycleFollowups.updated_at} >= date_trunc('day', now()) and ${leadLifecycleFollowups.status} = 'connected')` })
      .from(leadLifecycleFollowups)
      .where(eq(leadLifecycleFollowups.status, 'connected')),
  ]);

  const totalCalls = Number(callsToday[0]?.total ?? 0);
  const totalCompleted = Number(completedToday[0]?.total ?? 0);
  return NextResponse.json({
    totalCustomers: Number(customerCount[0]?.total ?? 0),
    callsToday: totalCalls,
    tasksCompleted: totalCompleted,
    reorderRate: totalCalls > 0 ? Number(((totalCompleted / totalCalls) * 100).toFixed(1)) : 0,
  });
}
