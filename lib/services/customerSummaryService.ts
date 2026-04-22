import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, leads, orders } from '@/lib/db/schema';

export async function refreshCustomerSummary(customerId: string) {
  const purchases = await db
    .select({
      sku: orders.sku,
      orderedAt: orders.order_date,
    })
    .from(orders)
    .where(eq(orders.customer_id, customerId))
    .orderBy(desc(orders.order_date));

  const leadRows = await db
    .select({
      leadType: leads.lead_type,
      activityStatus: leads.activity_status,
    })
    .from(leads)
    .where(eq(leads.customer_id, customerId));

  const [customerRow] = await db
    .select({ flagType: customers.flag_type })
    .from(customers)
    .where(eq(customers.id, customerId));

  const activeByType = leadRows.reduce<Record<string, number>>((acc, row) => {
    if (row.activityStatus === 'active') {
      acc[row.leadType] = (acc[row.leadType] ?? 0) + 1;
    }
    return acc;
  }, {});

  const topSkuCount = purchases.reduce<Record<string, number>>((acc, row) => {
    if (!row.sku) return acc;
    acc[row.sku] = (acc[row.sku] ?? 0) + 1;
    return acc;
  }, {});
  const topSkus = Object.entries(topSkuCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sku]) => sku);

  const summary = {
    purchase_summary: {
      count: purchases.length,
      last_purchase_at: purchases[0]?.orderedAt?.toISOString() ?? null,
      top_skus: topSkus,
    },
    lead_summary: {
      total_leads: leadRows.length,
      active_by_type: activeByType,
    },
    flag_summary: {
      active_flags: customerRow?.flagType ? [customerRow.flagType] : [],
    },
  };

  await db
    .update(customers)
    .set({
      metadata: summary,
      updated_at: new Date(),
    })
    .where(eq(customers.id, customerId));
}
