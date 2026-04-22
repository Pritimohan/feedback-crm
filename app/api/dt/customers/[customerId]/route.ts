import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, customers, leads, orders, users } from '@/lib/db/schema';

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

    const [customerRow] = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        createdAt: customers.created_at,
      })
      .from(customers)
      .where(eq(customers.id, customerId));

    if (!customerRow) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const [leadRow] = await db
      .select({
        assignedDtId: leads.assigned_dt_id,
        leadType: leads.lead_type,
        activityStatus: leads.activity_status,
        currentFollowupNumber: leads.current_followup_number,
      })
      .from(leads)
      .where(eq(leads.customer_id, customerId))
      .orderBy(desc(leads.created_at));

    const customerOrders = await db
      .select({
        id: orders.id,
        productName: orders.product_name,
        quantity: orders.quantity,
        totalAmount: orders.total_amount,
        orderDate: orders.order_date,
        deliveryStatus: orders.delivery_status,
      })
      .from(orders)
      .where(eq(orders.customer_id, customerId))
      .orderBy(desc(orders.order_date));

    const interactions = await db
      .select({
        id: callLogs.id,
        outcome: callLogs.attempt_outcome,
        notes: callLogs.attempt_notes,
        timestamp: callLogs.created_at,
        followupNumber: callLogs.followup_number,
        dtName: users.name,
      })
      .from(callLogs)
      .leftJoin(users, eq(callLogs.dt_id, users.id))
      .where(eq(callLogs.customer_id, customerId))
      .orderBy(asc(callLogs.created_at));

    const ltv = customerOrders.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);

    return NextResponse.json({
      customer: {
        id: customerRow.id,
        name: customerRow.name,
        phone: customerRow.phone,
        email: customerRow.email,
        leadType: leadRow?.leadType ?? null,
        assignedDtId: leadRow?.assignedDtId ?? null,
        currentLifecycleStage: leadRow?.activityStatus ?? 'inactive',
        currentFollowupStage: leadRow?.currentFollowupNumber ?? null,
        ltvScore: String(ltv),
        createdAt: customerRow.createdAt,
      },
      orders: customerOrders,
      interactions: interactions.map((row) => ({
        id: row.id,
        outcome: row.outcome,
        notes: row.notes,
        timestamp: row.timestamp,
        followupNumber: row.followupNumber,
        dt: row.dtName ? { name: row.dtName } : null,
      })),
    });
  } catch (error) {
    console.error('Get DT customer details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
