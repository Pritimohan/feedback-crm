import { boolean, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { leadBrandEnum, leadTypeEnum } from './leads';
import { users } from './users';

export const userBrandProfiles = pgTable(
  'user_brand_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    brand: leadBrandEnum('brand').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    eligible_lead_types: leadTypeEnum('eligible_lead_types').array().notNull().default(['review']),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userBrandUnique: uniqueIndex('user_brand_profiles_user_brand_idx').on(table.user_id, table.brand),
    brandActiveIdx: index('idx_user_brand_profiles_brand_active').on(table.brand, table.is_active),
  })
);

export type UserBrandProfile = typeof userBrandProfiles.$inferSelect;
export type NewUserBrandProfile = typeof userBrandProfiles.$inferInsert;
