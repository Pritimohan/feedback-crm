import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { CrmBrand } from '@/lib/crmBrand';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import { db } from '@/lib/db';
import { customers, leads, orders } from '@/lib/db/schema';

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  leadType: string | null;
  assignedDtId: string | null;
  currentLifecycleStage: string;
  currentFollowupStage: number | null;
  source: string | null;
  purchaseDate: string | null;
  variant: string | null;
  ltvScore: string;
  lastOrderDate: Date | null;
  createdAt: Date;
  latestProductName: string | null;
  sku: string | null;
};

export async function fetchCustomerListRows(params: {
  brand: CrmBrand;
  restrictToDtId?: string;
}): Promise<CustomerListRow[]> {
  const { brand, restrictToDtId } = params;

  const leadRows = await db
    .select({
      customerId: leads.customer_id,
      assignedDtId: leads.assigned_dt_id,
      leadType: leads.lead_type,
      activityStatus: leads.activity_status,
      currentFollowupNumber: leads.current_followup_number,
      source: leads.source,
      purchaseDate: leads.purchase_date,
      variant: leads.variant,
      updatedAt: leads.updated_at,
    })
    .from(leads)
    .where(
      restrictToDtId
        ? and(eq(leads.assigned_dt_id, restrictToDtId), leadMatchesCrmBrand(brand))
        : leadMatchesCrmBrand(brand)
    )
    .orderBy(desc(leads.updated_at));

  const customerIds = Array.from(new Set(leadRows.map((row) => row.customerId)));
  if (!customerIds.length) {
    return [];
  }

  const baseCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
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

  const latestOrderRows = await db
    .select({
      customerId: orders.customer_id,
      productName: orders.product_name,
      sku: orders.sku,
    })
    .from(orders)
    .where(inArray(orders.customer_id, customerIds))
    .orderBy(desc(orders.order_date));

  const leadByCustomer = new Map<
    string,
    {
      assignedDtId: string | null;
      leadType: string;
      activityStatus: string;
      currentFollowupNumber: number;
      source: string | null;
      purchaseDate: string | null;
      variant: string | null;
    }
  >();
  for (const row of leadRows) {
    if (!leadByCustomer.has(row.customerId)) {
      leadByCustomer.set(row.customerId, {
        assignedDtId: row.assignedDtId ?? null,
        leadType: row.leadType,
        activityStatus: row.activityStatus,
        currentFollowupNumber: row.currentFollowupNumber ?? 0,
        source: row.source ?? null,
        purchaseDate: row.purchaseDate ?? null,
        variant: row.variant ?? null,
      });
    }
  }

  const orderAggByCustomer = new Map(
    orderAggRows.map((row) => [
      row.customerId,
      {
        totalAmount: row.totalAmount ?? '0',
        lastOrderDate: row.lastOrderDate,
      },
    ])
  );

  const latestOrderByCustomer = new Map<string, { productName: string | null; sku: string | null }>();
  for (const row of latestOrderRows) {
    if (!latestOrderByCustomer.has(row.customerId)) {
      latestOrderByCustomer.set(row.customerId, {
        productName: row.productName,
        sku: row.sku,
      });
    }
  }

  return baseCustomers.map((customer) => {
    const leadMeta = leadByCustomer.get(customer.id);
    const orderMeta = orderAggByCustomer.get(customer.id);
    const latestOrder = latestOrderByCustomer.get(customer.id);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      leadType: leadMeta?.leadType ?? null,
      assignedDtId: leadMeta?.assignedDtId ?? null,
      currentLifecycleStage: leadMeta?.activityStatus ?? 'inactive',
      currentFollowupStage: leadMeta?.currentFollowupNumber ?? null,
      source: leadMeta?.source ?? null,
      purchaseDate: leadMeta?.purchaseDate ?? null,
      variant: leadMeta?.variant ?? null,
      ltvScore: orderMeta?.totalAmount ?? '0',
      lastOrderDate: orderMeta?.lastOrderDate ?? null,
      createdAt: customer.createdAt,
      latestProductName: latestOrder?.productName ?? null,
      sku: latestOrder?.sku ?? null,
    };
  });
}
