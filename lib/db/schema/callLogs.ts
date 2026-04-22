import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { leads } from './leads';
import { leadLifecycles } from './leadLifecycles';
import { leadLifecycleFollowups } from './leadLifecycleFollowups';
import { leadLifecycleFollowupAttempts } from './leadLifecycleFollowupAttempts';
import { users } from './users';

export const callLogs = pgTable(
  'call_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').references(() => customers.id).notNull(),
    lead_id: uuid('lead_id').references(() => leads.id).notNull(),
    lifecycle_id: uuid('lifecycle_id').references(() => leadLifecycles.id),
    followup_id: uuid('followup_id').references(() => leadLifecycleFollowups.id),
    attempt_id: uuid('attempt_id').references(() => leadLifecycleFollowupAttempts.id),
    dt_id: uuid('dt_id').references(() => users.id).notNull(),

    provider: varchar('provider', { length: 40 }).notNull().default('exotel'),
    provider_call_sid: varchar('provider_call_sid', { length: 255 }),
    provider_parent_sid: varchar('provider_parent_sid', { length: 255 }),
    provider_status_raw: varchar('provider_status_raw', { length: 100 }),
    provider_recording_url: text('provider_recording_url'),
    provider_start_at: timestamp('provider_start_at'),
    provider_end_at: timestamp('provider_end_at'),
    provider_duration_sec: integer('provider_duration_sec'),
    provider_ring_sec: integer('provider_ring_sec'),
    provider_talk_sec: integer('provider_talk_sec'),

    dt_number: varchar('dt_number', { length: 25 }),
    customer_number: varchar('customer_number', { length: 25 }),
    exotel_number: varchar('exotel_number', { length: 25 }),

    attempt_outcome: varchar('attempt_outcome', { length: 50 }).notNull(),
    attempt_notes: text('attempt_notes'),
    scheduled_date_at_attempt: timestamp('scheduled_date_at_attempt'),
    was_overdue: boolean('was_overdue').notNull().default(false),
    lead_type: varchar('lead_type', { length: 50 }).notNull(),
    followup_number: integer('followup_number').notNull().default(0),

    ingest_source: varchar('ingest_source', { length: 40 }).notNull().default('attempt_api'),
    ingest_status: varchar('ingest_status', { length: 40 }).notNull().default('partial'),
    raw_payload: jsonb('raw_payload'),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    attemptUniqueIdx: uniqueIndex('call_logs_attempt_unique_idx').on(table.attempt_id),
    providerSidIdx: index('call_logs_provider_sid_idx').on(table.provider_call_sid),
    outcomeCreatedIdx: index('call_logs_outcome_created_idx').on(table.attempt_outcome, table.created_at),
    dtCreatedIdx: index('call_logs_dt_created_idx').on(table.dt_id, table.created_at),
    customerCreatedIdx: index('call_logs_customer_created_idx').on(table.customer_id, table.created_at),
    leadStageCreatedIdx: index('call_logs_lead_stage_created_idx').on(table.lead_type, table.followup_number, table.created_at),
  })
);

export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
