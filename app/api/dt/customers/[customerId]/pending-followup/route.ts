import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { leadLifecycleFollowups, leadLifecycles, leads } from '@/lib/db/schema';

export async function GET(_request: Request, context: { params: Promise<{ customerId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { customerId } = await context.params;

    const [row] = await db
      .select({
        followupId: leadLifecycleFollowups.id,
      })
      .from(leadLifecycleFollowups)
      .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
      .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
      .where(
        and(
          eq(leads.customer_id, customerId),
          eq(leads.assigned_dt_id, session.id),
          eq(leadLifecycles.status, 'active'),
          eq(leadLifecycleFollowups.status, 'pending')
        )
      )
      .orderBy(asc(leadLifecycleFollowups.scheduled_date));

    return NextResponse.json({ followupId: row?.followupId ?? null });
  } catch (error) {
    console.error('Get pending followup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
