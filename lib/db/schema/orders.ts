import { decimal, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { customers } from './customers';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id')
      .references(() => customers.id)
      .notNull(),
    shopify_order_id: varchar('shopify_order_id', { length: 255 }),
    sku: varchar('sku', { length: 255 }),
    product_name: varchar('product_name', { length: 255 }),
    quantity: integer('quantity').notNull().default(1),
    channel: varchar('channel', { length: 80 }).notNull().default('unknown'),
    order_date: timestamp('order_date').notNull().defaultNow(),
    delivery_date: timestamp('delivery_date'),
    delivery_status: varchar('delivery_status', { length: 50 }).notNull().default('pending'),
    total_amount: decimal('total_amount', { precision: 12, scale: 2 }),
    pack_size: integer('pack_size').default(1),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerOrderDateIdx: index('orders_customer_order_date_idx').on(table.customer_id, table.order_date),
    skuIdx: index('orders_sku_idx').on(table.sku),
    channelIdx: index('orders_channel_idx').on(table.channel),
    deliveryStatusIdx: index('orders_delivery_status_idx').on(table.delivery_status),
    shopifyOrderIdx: index('orders_shopify_order_idx').on(table.shopify_order_id),
  })
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
