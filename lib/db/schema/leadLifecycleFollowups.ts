import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { leadLifecycles } from './leadLifecycles';
import { users } from './users';

export const leadLifecycleFollowups = pgTable(
  'lead_lifecycle_followups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lifecycle_id: uuid('lifecycle_id')
      .references(() => leadLifecycles.id)
      .notNull(),
    followup_number: integer('followup_number').notNull().default(0),
    assigned_dt_id: uuid('assigned_dt_id').references(() => users.id),
    scheduled_date: timestamp('scheduled_date').notNull(),
    connected_date: timestamp('connected_date'),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    attempt_count: integer('attempt_count').notNull().default(0),
    first_attempt_date: timestamp('first_attempt_date'),
    max_attempts: integer('max_attempts').notNull().default(4),
    payload: jsonb('payload'),
    remarks: text('remarks'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    lifecycleIdx: index('lead_lifecycle_followups_lifecycle_idx').on(table.lifecycle_id),
    assignedDtIdx: index('lead_lifecycle_followups_assigned_dt_idx').on(table.assigned_dt_id),
    stageIdx: index('lead_lifecycle_followups_stage_idx').on(table.followup_number),
    scheduledDateIdx: index('lead_lifecycle_followups_scheduled_date_idx').on(table.scheduled_date),
    statusIdx: index('lead_lifecycle_followups_status_idx').on(table.status),
  })
);

export type LeadLifecycleFollowup = typeof leadLifecycleFollowups.$inferSelect;
export type NewLeadLifecycleFollowup = typeof leadLifecycleFollowups.$inferInsert;
