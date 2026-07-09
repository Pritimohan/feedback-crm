import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { leadLifecycleFollowups, leadLifecycles, leads, users } from '@/lib/db/schema';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';
import { getBrandActiveDietitians } from '@/lib/services/dtBrandProfileService';
import { countConnectedDials, countTotalDials, countUniqueCustomerDays } from '@/lib/analytics/attemptCounts';
import { getAnalyticsDayBoundsForInstant } from '@/lib/utils/analyticsDates';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const brand = await getCrmBrandFromCookie();
  const brandActiveDts = await getBrandActiveDietitians(brand);
  const { startDate, endDate } = getAnalyticsDayBoundsForInstant();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const attemptOpts = { startIso, endIso, brand };

  const [customerCounts, leadCounts, totalToday, uniqueToday, connectedToday, dtCounts, pendingFollowups] =
    await Promise.all([
      db
        .select({ total: sql<number>`count(distinct ${leads.customer_id})` })
        .from(leads)
        .where(leadMatchesCrmBrand(brand)),
      db
        .select({
          active: sql<number>`count(*) filter (where ${leads.activity_status} = 'active')`,
          deferred: sql<number>`count(*) filter (where ${leads.activity_status} = 'deferred')`,
          inactive: sql<number>`count(*) filter (where ${leads.activity_status} = 'inactive')`,
        })
        .from(leads)
        .where(leadMatchesCrmBrand(brand)),
      countTotalDials(attemptOpts),
      countUniqueCustomerDays(attemptOpts),
      countConnectedDials(attemptOpts),
      db
        .select({
          totalDt: sql<number>`count(*) filter (where ${users.role} = 'dt')`,
          activeDt: sql<number>`count(*) filter (where ${users.role} = 'dt' and ${users.active_status} = true)`,
        })
        .from(users),
      db
        .select({ total: sql<number>`count(*)` })
        .from(leadLifecycleFollowups)
        .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
        .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
        .where(and(eq(leadLifecycleFollowups.status, 'pending'), leadMatchesCrmBrand(brand))),
    ]);

  const dtLoad = await getDtLoadDistribution(undefined, brand);

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
        uniqueToday,
        totalToday,
        connectedToday,
        connectedRate: totalToday > 0 ? Number(((connectedToday / totalToday) * 100).toFixed(2)) : 0,
      },
      dt: {
        total: Number(dtCounts[0]?.totalDt ?? 0),
        active: brandActiveDts.length,
      },
      followups: {
        pending: Number(pendingFollowups[0]?.total ?? 0),
      },
      distribution: dtLoad,
    },
  });
}
