import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { customers } from './customers';
import { sql } from 'drizzle-orm';

export const leadTypeEnum = pgEnum('lead_type', ['nps', 'review']);
export const leadActivityStatusEnum = pgEnum('lead_activity_status', ['active', 'inactive', 'deferred']);
export const connectedChoiceEnum = pgEnum('lead_connected_choice', [
  'reviewed',
  'issue_with_product',
  'interested',
  'dont_reviewed',
]);
export const leadBrandEnum = pgEnum('lead_brand', ['fitty', 'fitelo']);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id')
      .references(() => customers.id)
      .notNull(),
    lead_type: leadTypeEnum('lead_type').notNull().default('review'),
    activity_status: leadActivityStatusEnum('activity_status').notNull().default('active'),
    assigned_dt_id: uuid('assigned_dt_id').references(() => users.id),
    active_lifecycle_id: uuid('active_lifecycle_id'),
    brand: leadBrandEnum('brand'),
    remarks: text('remarks'),
    metadata: jsonb('metadata'),
    current_followup_number: integer('current_followup_number').notNull().default(0),
    current_touch_status: varchar('current_touch_status', { length: 50 }),
    last_connected_choice: connectedChoiceEnum('last_connected_choice'),
    is_testimonial: boolean('is_testimonial').notNull().default(false),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index('leads_customer_idx').on(table.customer_id),
    assignedDtIdx: index('leads_assigned_dt_idx').on(table.assigned_dt_id),
    activeLifecycleIdx: index('leads_active_lifecycle_idx').on(table.active_lifecycle_id),
    leadTypeIdx: index('leads_lead_type_idx').on(table.lead_type),
    activityStatusIdx: index('leads_activity_status_idx').on(table.activity_status),
    activeLeadPerTypeIdx: uniqueIndex('leads_active_customer_type_idx')
      .on(table.customer_id, table.lead_type)
      .where(sql`${table.activity_status} = 'active'`),
  })
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
