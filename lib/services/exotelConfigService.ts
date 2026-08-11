import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { parseCrmBrand } from '@/lib/crmBrand.shared';
import {
  appSettings,
  EXOTEL_EXOPHONE_FITTY_SETTING_KEY,
  EXOTEL_EXOPHONE_FITELO_SETTING_KEY,
  exotelExophoneSettingKeyForBrand,
} from '@/lib/db/schema/appSettings';

/**
 * Clean Exophone for Exotel CallerId. Preserves leading 0 / +91 as entered —
 * Exotel virtual numbers are often landline-style (e.g. 079…) and must not be
 * forced through mobile +91 normalization.
 */
function cleanExophone(input: string): string {
  return input.replace(/[\s\-()]/g, '').trim();
}

const exophoneSchema = z
  .string()
  .trim()
  .min(1, 'Exophone is required')
  .transform(cleanExophone)
  .refine((value) => /^\+?\d{10,13}$/.test(value), {
    message: 'Enter a valid Exophone (10–13 digits, optional leading +)',
  });

export type BrandExotelConfig = {
  exophone: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

export type ExotelConfigByBrand = {
  fitty: BrandExotelConfig;
  fitelo: BrandExotelConfig;
};

const emptyBrandConfig = (): BrandExotelConfig => ({
  exophone: null,
  updatedAt: null,
  updatedBy: null,
});

export async function getExophoneForBrand(
  brand: CrmBrand | string | null | undefined
): Promise<string | null> {
  const normalized = parseCrmBrand(brand ?? null);
  const key = exotelExophoneSettingKeyForBrand(normalized);

  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  const value = row?.value?.trim();
  return value || null;
}

export async function getExotelConfig(): Promise<ExotelConfigByBrand> {
  const rows = await db
    .select({
      key: appSettings.key,
      value: appSettings.value,
      updatedAt: appSettings.updated_at,
      updatedBy: appSettings.updated_by,
    })
    .from(appSettings)
    .where(
      inArray(appSettings.key, [
        EXOTEL_EXOPHONE_FITTY_SETTING_KEY,
        EXOTEL_EXOPHONE_FITELO_SETTING_KEY,
      ])
    );

  const result: ExotelConfigByBrand = {
    fitty: emptyBrandConfig(),
    fitelo: emptyBrandConfig(),
  };

  for (const row of rows) {
    const entry: BrandExotelConfig = {
      exophone: row.value?.trim() || null,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
    if (row.key === EXOTEL_EXOPHONE_FITTY_SETTING_KEY) {
      result.fitty = entry;
    } else if (row.key === EXOTEL_EXOPHONE_FITELO_SETTING_KEY) {
      result.fitelo = entry;
    }
  }

  return result;
}

export async function saveExotelConfig(
  input: { fitty?: unknown; fitelo?: unknown },
  userId: string
): Promise<{ fitty: string; fitelo: string; updatedAt: Date }> {
  const fittyParsed = exophoneSchema.safeParse(input?.fitty);
  if (!fittyParsed.success) {
    throw new Error(
      fittyParsed.error.issues[0]?.message
        ? `Fitty: ${fittyParsed.error.issues[0].message}`
        : 'Invalid Fitty Exophone'
    );
  }

  const fiteloParsed = exophoneSchema.safeParse(input?.fitelo);
  if (!fiteloParsed.success) {
    throw new Error(
      fiteloParsed.error.issues[0]?.message
        ? `Fitelo: ${fiteloParsed.error.issues[0].message}`
        : 'Invalid Fitelo Exophone'
    );
  }

  const fitty = fittyParsed.data;
  const fitelo = fiteloParsed.data;
  const now = new Date();

  await db
    .insert(appSettings)
    .values({
      key: EXOTEL_EXOPHONE_FITTY_SETTING_KEY,
      value: fitty,
      updated_by: userId,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: fitty,
        updated_by: userId,
        updated_at: now,
      },
    });

  await db
    .insert(appSettings)
    .values({
      key: EXOTEL_EXOPHONE_FITELO_SETTING_KEY,
      value: fitelo,
      updated_by: userId,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: fitelo,
        updated_by: userId,
        updated_at: now,
      },
    });

  return { fitty, fitelo, updatedAt: now };
}
