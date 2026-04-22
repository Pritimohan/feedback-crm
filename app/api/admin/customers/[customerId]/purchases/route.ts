import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';

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
  const body = await request.json();
  if (!body?.sku && !body?.shopifyOrderId) {
    return NextResponse.json({ error: 'sku or shopifyOrderId is required' }, { status: 400 });
  }

  const [row] = await db
    .insert(orders)
    .values({
      customer_id: customerId,
      sku: body.sku,
      shopify_order_id: body.shopifyOrderId ?? body.orderRef,
      product_name: body.productName,
      quantity: body.quantity ?? 1,
      channel: body.channel ?? 'unknown',
      order_date: body.orderDate ? new Date(body.orderDate) : body.orderedAt ? new Date(body.orderedAt) : new Date(),
      delivery_date: body.deliveryDate ? new Date(body.deliveryDate) : null,
      delivery_status: body.deliveryStatus ?? 'pending',
      total_amount: body.totalAmount ?? body.amount,
      pack_size: body.packSize ?? 1,
      metadata: body.metadata,
    })
    .returning();

  await refreshCustomerSummary(customerId);
  return NextResponse.json({ data: row }, { status: 201 });
}
