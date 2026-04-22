import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { leadLifecycleFollowups } from './leadLifecycleFollowups';
import { users } from './users';

export const leadLifecycleFollowupAttempts = pgTable(
  'lead_lifecycle_followup_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followup_id: uuid('followup_id')
      .references(() => leadLifecycleFollowups.id)
      .notNull(),
    dt_id: uuid('dt_id')
      .references(() => users.id)
      .notNull(),
    attempt_date: timestamp('attempt_date').notNull(),
    outcome: varchar('outcome', { length: 50 }).notNull(),
    notes: text('notes'),
    was_overdue: boolean('was_overdue').notNull().default(false),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    followupIdx: index('lead_lifecycle_followup_attempts_followup_idx').on(table.followup_id),
    dtIdx: index('lead_lifecycle_followup_attempts_dt_idx').on(table.dt_id),
    attemptDateIdx: index('lead_lifecycle_followup_attempts_date_idx').on(table.attempt_date),
  })
);

export type LeadLifecycleFollowupAttempt = typeof leadLifecycleFollowupAttempts.$inferSelect;
export type NewLeadLifecycleFollowupAttempt = typeof leadLifecycleFollowupAttempts.$inferInsert;
