import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_by: uuid('updated_by').references(() => users.id),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

/** Setting keys for Exotel virtual numbers used as CallerId on outbound calls. */
export const EXOTEL_EXOPHONE_FITTY_SETTING_KEY = 'exotel_exophone_fitty';
export const EXOTEL_EXOPHONE_FITELO_SETTING_KEY = 'exotel_exophone_fitelo';

export function exotelExophoneSettingKeyForBrand(
  brand: 'fitty' | 'fitelo'
): string {
  return brand === 'fitelo'
    ? EXOTEL_EXOPHONE_FITELO_SETTING_KEY
    : EXOTEL_EXOPHONE_FITTY_SETTING_KEY;
}
