import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, customers, leadLifecycleFollowups, leadLifecycles, leads } from '@/lib/db/schema';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const brand = await getCrmBrandFromCookie();

  const [customerCount, callsToday, completedToday] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${customers.id})` })
      .from(customers)
      .innerJoin(leads, eq(leads.customer_id, customers.id))
      .where(leadMatchesCrmBrand(brand)),
    db
      .select({ total: sql<number>`count(*) filter (where ${callLogs.created_at} >= date_trunc('day', now()))` })
      .from(callLogs)
      .innerJoin(leads, eq(callLogs.lead_id, leads.id))
      .where(leadMatchesCrmBrand(brand)),
    db
      .select({
        total: sql<number>`count(*) filter (where ${leadLifecycleFollowups.updated_at} >= date_trunc('day', now()) and ${leadLifecycleFollowups.status} = 'connected')`,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(and(eq(leadLifecycleFollowups.status, 'connected'), leadMatchesCrmBrand(brand))),
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
