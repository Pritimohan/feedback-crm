import { NextResponse } from 'next/server';
import { desc, inArray, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { customers, leads, orders } from '@/lib/db/schema';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const baseCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      flagType: customers.flag_type,
      createdAt: customers.created_at,
    })
    .from(customers)
    .orderBy(desc(customers.created_at));

  const customerIds = baseCustomers.map((c) => c.id);
  if (!customerIds.length) return NextResponse.json({ customers: [] });

  const leadRows = await db
    .select({
      customerId: leads.customer_id,
      activityStatus: leads.activity_status,
      currentFollowupNumber: leads.current_followup_number,
      leadType: leads.lead_type,
      source: leads.source,
      purchaseDate: leads.purchase_date,
      variant: leads.variant,
    })
    .from(leads)
    .where(inArray(leads.customer_id, customerIds));

  const orderAggRows = await db
    .select({
      customerId: orders.customer_id,
      totalAmount: sql<string>`COALESCE(SUM(${orders.total_amount}), 0)`,
      lastOrderDate: sql<Date | null>`MAX(${orders.order_date})`,
    })
    .from(orders)
    .where(inArray(orders.customer_id, customerIds))
    .groupBy(orders.customer_id);

  const leadByCustomer = new Map<
    string,
    {
      activityStatus: string;
      currentFollowupNumber: number;
      leadType: string;
      source: string | null;
      purchaseDate: string | null;
      variant: string | null;
    }
  >();
  for (const row of leadRows) {
    if (!leadByCustomer.has(row.customerId)) {
      leadByCustomer.set(row.customerId, {
        activityStatus: row.activityStatus,
        currentFollowupNumber: row.currentFollowupNumber ?? 0,
        leadType: row.leadType,
        source: row.source ?? null,
        purchaseDate: row.purchaseDate ?? null,
        variant: row.variant ?? null,
      });
    }
  }

  const orderByCustomer = new Map(
    orderAggRows.map((row) => [
      row.customerId,
      {
        totalAmount: row.totalAmount ?? '0',
        lastOrderDate: row.lastOrderDate,
      },
    ])
  );

  const data = baseCustomers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    flagType: customer.flagType,
    currentLifecycleStage: leadByCustomer.get(customer.id)?.activityStatus ?? 'inactive',
    currentFollowupStage: leadByCustomer.get(customer.id)?.currentFollowupNumber ?? null,
    leadType: leadByCustomer.get(customer.id)?.leadType ?? null,
    source: leadByCustomer.get(customer.id)?.source ?? null,
    purchaseDate: leadByCustomer.get(customer.id)?.purchaseDate ?? null,
    variant: leadByCustomer.get(customer.id)?.variant ?? null,
    ltvScore: orderByCustomer.get(customer.id)?.totalAmount ?? '0',
    lastOrderDate: orderByCustomer.get(customer.id)?.lastOrderDate ?? null,
    createdAt: customer.createdAt,
  }));

  return NextResponse.json({ customers: data });
}
