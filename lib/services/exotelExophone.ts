import type { CrmBrand } from '@/lib/crmBrand.shared';
import { parseCrmBrand } from '@/lib/crmBrand.shared';
import { getExophoneForBrand } from '@/lib/services/exotelConfigService';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolveFromEnv(brand: CrmBrand): string {
  if (brand === 'fitelo') {
    const fitelo = readEnv('EXOTEL_EXOPHONE_FITELO');
    if (fitelo) return fitelo;
    throw new Error(
      'Exophone is not configured for fitelo. Set it in Admin → Config → Calling.'
    );
  }

  const fitty = readEnv('EXOTEL_EXOPHONE_FITTY');
  if (fitty) return fitty;

  const legacy = readEnv('EXOTEL_EXOPHONE');
  if (legacy) return legacy;

  throw new Error(
    'Exophone is not configured for fitty. Set it in Admin → Config → Calling.'
  );
}

export type ExophoneDbLookup = (
  brand: CrmBrand | string | null | undefined
) => Promise<string | null>;

/**
 * Resolve Exotel CallerId for a brand.
 * Order: explicit callerId → DB app_settings → env fallback.
 */
export async function resolveExotelExophone(
  brand: CrmBrand | string | null | undefined,
  explicitCallerId?: string,
  dbLookup: ExophoneDbLookup = getExophoneForBrand
): Promise<string> {
  const explicit = explicitCallerId?.trim();
  if (explicit) return explicit;

  const normalizedBrand = parseCrmBrand(brand ?? null);

  const fromDb = await dbLookup(normalizedBrand);
  if (fromDb?.trim()) return fromDb.trim();

  return resolveFromEnv(normalizedBrand);
}
