import { NextResponse } from 'next/server';
import { desc, inArray, sql } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { customers, leads, orders } from '@/lib/db/schema';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const brand = await getCrmBrandFromCookie();

  const leadRows = await db
    .select({
      customerId: leads.customer_id,
      activityStatus: leads.activity_status,
      currentFollowupNumber: leads.current_followup_number,
      leadType: leads.lead_type,
      updatedAt: leads.updated_at,
    })
    .from(leads)
    .where(leadMatchesCrmBrand(brand))
    .orderBy(desc(leads.updated_at));

  const customerIds = Array.from(new Set(leadRows.map((r) => r.customerId)));
  if (!customerIds.length) return NextResponse.json({ customers: [] });

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
    .where(inArray(customers.id, customerIds))
    .orderBy(desc(customers.created_at));

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
    }
  >();
  for (const row of leadRows) {
    if (!leadByCustomer.has(row.customerId)) {
      leadByCustomer.set(row.customerId, {
        activityStatus: row.activityStatus,
        currentFollowupNumber: row.currentFollowupNumber ?? 0,
        leadType: row.leadType,
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
    ltvScore: orderByCustomer.get(customer.id)?.totalAmount ?? '0',
    lastOrderDate: orderByCustomer.get(customer.id)?.lastOrderDate ?? null,
    createdAt: customer.createdAt,
  }));

  return NextResponse.json({ customers: data });
}
