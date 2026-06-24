import { pgTable, uuid, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const lifecycleConfigSettings = pgTable(
  'lifecycle_config_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: integer('version').notNull(),
    config: jsonb('config').notNull(),
    is_active: boolean('is_active').notNull().default(false),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    activeIdx: index('lifecycle_config_settings_active_idx').on(table.is_active),
    versionIdx: index('lifecycle_config_settings_version_idx').on(table.version),
  })
);

export type LifecycleConfigSetting = typeof lifecycleConfigSettings.$inferSelect;
export type NewLifecycleConfigSetting = typeof lifecycleConfigSettings.$inferInsert;
