import { and, eq, or } from 'drizzle-orm';
import { db, type FeedbackDb } from '@/lib/db';
import { orders, type Order } from '@/lib/db/schema';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';

/** Diet plan sends an id; missing rows are loaded from here. */
const ORDER_DETAILS_API_BASE = 'https://retention-crm.internal.livfitty.com';

export type EnsureCustomerOrderResult =
  | { status: 'exists'; order: Order }
  | { status: 'created'; order: Order }
  | { status: 'failed'; error: string };

export interface IncomingOrderInput {
  channel?: string | null;
  orderSource?: string | null;
  externalOrderId?: string | null;
  shopifyOrderId?: string | null;
  marketplaceOrderId?: string | null;
  refCode?: string | null;
  sku?: string | null;
  productName?: string | null;
  quantity?: number | string | null;
  packSize?: number | string | null;
  orderDate?: string | null;
  deliveryDate?: string | null;
  deliveryStatus?: string | null;
  totalAmount?: string | number | null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function cleanDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cleanAmount(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return cleanText(value);
}

function hasOrderIdentity(order: {
  externalOrderId: string | null;
  marketplaceOrderId: string | null;
  shopifyOrderId: string | null;
  sku: string | null;
}): boolean {
  return Boolean(order.externalOrderId || order.marketplaceOrderId || order.shopifyOrderId || order.sku);
}

export async function insertCustomerOrder(
  customerId: string,
  order: IncomingOrderInput | undefined,
  executor: FeedbackDb = db
): Promise<Order | null> {
  if (!order) return null;

  const externalOrderId = cleanText(order.externalOrderId);
  const marketplaceOrderId = cleanText(order.marketplaceOrderId);
  const shopifyOrderId = cleanText(order.shopifyOrderId);
  const sku = cleanText(order.sku);

  if (!hasOrderIdentity({ externalOrderId, marketplaceOrderId, shopifyOrderId, sku })) {
    return null;
  }

  const identityMatches = [
    externalOrderId ? eq(orders.external_order_id, externalOrderId) : null,
    marketplaceOrderId ? eq(orders.marketplace_order_id, marketplaceOrderId) : null,
    shopifyOrderId ? eq(orders.shopify_order_id, shopifyOrderId) : null,
  ].filter((match): match is NonNullable<typeof match> => match !== null);

  if (identityMatches.length > 0) {
    const identity =
      identityMatches.length === 1 ? identityMatches[0] : or(...identityMatches);
    const [existing] = await executor
      .select()
      .from(orders)
      .where(and(eq(orders.customer_id, customerId), identity))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await executor
    .insert(orders)
    .values({
      customer_id: customerId,
      channel: cleanText(order.channel) ?? 'unknown',
      order_source: cleanText(order.orderSource),
      external_order_id: externalOrderId,
      shopify_order_id: shopifyOrderId,
      marketplace_order_id: marketplaceOrderId,
      ref_code: cleanText(order.refCode),
      sku,
      product_name: cleanText(order.productName),
      quantity: cleanInt(order.quantity, 1),
      pack_size: cleanInt(order.packSize, 1),
      order_date: cleanDate(order.orderDate) ?? new Date(),
      delivery_date: cleanDate(order.deliveryDate),
      delivery_status: cleanText(order.deliveryStatus) ?? 'pending',
      total_amount: cleanAmount(order.totalAmount),
    })
    .returning();

  return created ?? null;
}

async function findCustomerOrderById(customerId: string, orderId: string): Promise<Order | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.customer_id, customerId),
        or(
          eq(orders.external_order_id, orderId),
          eq(orders.marketplace_order_id, orderId),
          eq(orders.shopify_order_id, orderId)
        )
      )
    )
    .limit(1);
  return row ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pick(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function asText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeOrderDetails(payload: unknown, requestedOrderId: string): IncomingOrderInput {
  const root = asRecord(payload);
  if (!root) {
    throw new Error('Order details response was not an object');
  }
  const record = asRecord(root.data) ?? asRecord(root.order) ?? asRecord(root.result) ?? root;

  return {
    channel: asText(pick(record, 'channel')),
    orderSource: asText(pick(record, 'orderSource', 'order_source')),
    externalOrderId: requestedOrderId,
    shopifyOrderId: asText(pick(record, 'shopifyOrderId', 'shopify_order_id')),
    marketplaceOrderId: asText(pick(record, 'marketplaceOrderId', 'marketplace_order_id')),
    refCode: asText(pick(record, 'refCode', 'ref_code')),
    sku: asText(pick(record, 'sku')),
    productName: asText(pick(record, 'productName', 'product_name')),
    quantity: pick(record, 'quantity') as IncomingOrderInput['quantity'],
    packSize: pick(record, 'packSize', 'pack_size') as IncomingOrderInput['packSize'],
    orderDate: asText(pick(record, 'orderDate', 'order_date')),
    deliveryDate: asText(pick(record, 'deliveryDate', 'delivery_date')),
    deliveryStatus: asText(pick(record, 'deliveryStatus', 'delivery_status')),
    totalAmount: pick(record, 'totalAmount', 'total_amount') as IncomingOrderInput['totalAmount'],
  };
}

async function fetchOrderDetails(orderId: string): Promise<IncomingOrderInput> {
  const token = process.env.ORDER_DETAILS_API_TOKEN?.trim();
  if (!token) {
    throw new Error('ORDER_DETAILS_API_TOKEN is not configured');
  }

  const url = `${ORDER_DETAILS_API_BASE}/api/v1/orders/${encodeURIComponent(orderId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error('Could not reach the orders service');
  }

  if (response.status === 404) {
    throw new Error('Order not found');
  }
  if (!response.ok) {
    throw new Error('Could not fetch order details');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Order details response was not JSON');
  }

  return normalizeOrderDetails(payload, orderId);
}

export async function ensureCustomerOrder(
  customerId: string,
  orderId: string
): Promise<EnsureCustomerOrderResult> {
  const id = orderId.trim();
  if (!id) {
    return { status: 'failed', error: 'orderId is empty' };
  }

  const existing = await findCustomerOrderById(customerId, id);
  if (existing) {
    if (existing.product_name?.trim()) {
      return { status: 'exists', order: existing };
    }
    try {
      const details = await fetchOrderDetails(id);
      const productName = cleanText(details.productName);
      if (!productName) {
        return { status: 'exists', order: existing };
      }
      const [updated] = await db
        .update(orders)
        .set({ product_name: productName, updated_at: new Date() })
        .where(eq(orders.id, existing.id))
        .returning();
      return { status: 'exists', order: updated ?? existing };
    } catch (error) {
      console.error('Order product name backfill failed:', error);
      return { status: 'exists', order: existing };
    }
  }

  let details: IncomingOrderInput;
  try {
    details = await fetchOrderDetails(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not fetch order details';
    return { status: 'failed', error: message };
  }

  try {
    const beforeWrite = Date.now();
    const stored = await insertCustomerOrder(customerId, details);
    if (!stored) {
      return { status: 'failed', error: 'Could not store order' };
    }
    try {
      await refreshCustomerSummary(customerId);
    } catch (error) {
      console.error('Refresh customer summary after order backfill failed:', error);
    }
    if (stored.created_at.getTime() + 1000 < beforeWrite) {
      return { status: 'exists', order: stored };
    }
    return { status: 'created', order: stored };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not store order';
    return { status: 'failed', error: message };
  }
}
