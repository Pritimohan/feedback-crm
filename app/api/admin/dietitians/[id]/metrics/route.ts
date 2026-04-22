import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users, leads, orders, leadLifecycleFollowups } from '@/lib/db/schema';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;

  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.role, 'dt')));
  if (!user) return NextResponse.json({ error: 'Dietitian not found' }, { status: 404 });

  const [leadAgg, orderAgg, taskAgg] = await Promise.all([
    db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${leads.activity_status} = 'active')`,
      inactive: sql<number>`count(*) filter (where ${leads.activity_status} = 'inactive')`,
    }).from(leads).where(eq(leads.assigned_dt_id, id)),
    db.select({
      totalOrders: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(${orders.total_amount}),0)`,
      newOrdersThisMonth: sql<number>`count(*) filter (where date_trunc('month', ${orders.order_date}) = date_trunc('month', now()))`,
    }).from(orders),
    db.select({
      pending: sql<number>`count(*) filter (where ${leadLifecycleFollowups.status} = 'pending')`,
      completedThisMonth: sql<number>`count(*) filter (where ${leadLifecycleFollowups.status} = 'connected' and date_trunc('month', ${leadLifecycleFollowups.updated_at}) = date_trunc('month', now()))`,
    }).from(leadLifecycleFollowups).where(eq(leadLifecycleFollowups.assigned_dt_id, id)),
  ]);

  const totalCustomers = Number(leadAgg[0]?.total ?? 0);
  const totalRevenue = Number(orderAgg[0]?.totalRevenue ?? 0);

  return NextResponse.json({
    totalCustomers,
    activeCustomers: Number(leadAgg[0]?.active ?? 0),
    inactiveCustomers: Number(leadAgg[0]?.inactive ?? 0),
    totalOrders: Number(orderAgg[0]?.totalOrders ?? 0),
    newOrdersThisMonth: Number(orderAgg[0]?.newOrdersThisMonth ?? 0),
    totalRevenue,
    averageLTV: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    pendingTasks: Number(taskAgg[0]?.pending ?? 0),
    completedTasksThisMonth: Number(taskAgg[0]?.completedThisMonth ?? 0),
  });
}
