import type { CrmBrand } from '@/lib/crmBrand.shared';
import { parseCrmBrand } from '@/lib/crmBrand.shared';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function resolveExotelExophone(
  brand: CrmBrand | string | null | undefined,
  explicitCallerId?: string
): string {
  const explicit = explicitCallerId?.trim();
  if (explicit) return explicit;

  const normalizedBrand = parseCrmBrand(brand ?? null);

  if (normalizedBrand === 'fitelo') {
    const fitelo = readEnv('EXOTEL_EXOPHONE_FITELO');
    if (fitelo) return fitelo;
    throw new Error('EXOTEL_EXOPHONE_FITELO is not configured');
  }

  const fitty = readEnv('EXOTEL_EXOPHONE_FITTY');
  if (fitty) return fitty;

  const legacy = readEnv('EXOTEL_EXOPHONE');
  if (legacy) return legacy;

  throw new Error('EXOTEL_EXOPHONE_FITTY (or legacy EXOTEL_EXOPHONE) is not configured');
}
