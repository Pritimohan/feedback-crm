import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';
import { insertCustomerOrder, type IncomingOrderInput } from '@/lib/services/customerOrderService';

export async function GET(_request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { customerId } = await context.params;
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customer_id, customerId))
    .orderBy(desc(orders.order_date));
  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { customerId } = await context.params;
  const body = (await request.json()) as IncomingOrderInput & {
    orderRef?: string;
    orderedAt?: string;
    amount?: string;
  };
  const order: IncomingOrderInput = {
    ...body,
    shopifyOrderId: body.shopifyOrderId ?? body.orderRef,
    orderDate: body.orderDate ?? body.orderedAt,
    totalAmount: body.totalAmount ?? body.amount,
  };
  if (!order.sku && !order.shopifyOrderId && !order.externalOrderId && !order.marketplaceOrderId) {
    return NextResponse.json(
      { error: 'sku, shopifyOrderId, externalOrderId, or marketplaceOrderId is required' },
      { status: 400 }
    );
  }

  const row = await insertCustomerOrder(customerId, order);
  await refreshCustomerSummary(customerId);
  return NextResponse.json({ data: row }, { status: 201 });
}
