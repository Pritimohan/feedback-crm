import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { leads } from './leads';
import { lifecycleConfigSettings } from './lifecycleConfigSettings';

export const leadLifecycles = pgTable(
  'lead_lifecycles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lead_id: uuid('lead_id')
      .references(() => leads.id)
      .notNull(),
    lifecycle_type: varchar('lifecycle_type', { length: 50 }).notNull().default('feedback_default'),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    started_at: timestamp('started_at').notNull().defaultNow(),
    completed_at: timestamp('completed_at'),
    inactive_after_at: timestamp('inactive_after_at'),
    remarks: text('remarks'),
    metadata: jsonb('metadata'),
    lifecycle_config_version_id: uuid('lifecycle_config_version_id').references(
      () => lifecycleConfigSettings.id
    ),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    leadIdx: index('lead_lifecycles_lead_idx').on(table.lead_id),
    lifecycleTypeIdx: index('lead_lifecycles_type_idx').on(table.lifecycle_type),
    statusIdx: index('lead_lifecycles_status_idx').on(table.status),
    startedAtIdx: index('lead_lifecycles_started_at_idx').on(table.started_at),
    activeLifecycleUniqueIdx: uniqueIndex('lead_lifecycles_active_per_lead_idx')
      .on(table.lead_id)
      .where(sql`${table.status} = 'active'`),
  })
);

export type LeadLifecycle = typeof leadLifecycles.$inferSelect;
export type NewLeadLifecycle = typeof leadLifecycles.$inferInsert;
