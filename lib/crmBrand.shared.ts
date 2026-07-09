export const FEEDBACK_CRM_BRAND_COOKIE = 'feedback_crm_brand';

export type CrmBrand = 'fitty' | 'fitelo';

export function parseCrmBrand(value: string | undefined | null): CrmBrand {
  if (value === 'fitelo') return 'fitelo';
  return 'fitty';
}

export function serializeBrandCookie(brand: CrmBrand): string {
  return `${FEEDBACK_CRM_BRAND_COOKIE}=${brand}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function readBrandFromBrowserCookie(): CrmBrand {
  if (typeof document === 'undefined') return 'fitty';
  const parts = document.cookie.split(';').map((p) => p.trim());
  const pair = parts.find((p) => p.startsWith(`${FEEDBACK_CRM_BRAND_COOKIE}=`));
  const raw = pair?.slice(FEEDBACK_CRM_BRAND_COOKIE.length + 1);
  return parseCrmBrand(raw ? decodeURIComponent(raw) : null);
}

export function leadDbBrandMatchesCrmFilter(dbBrand: string | null | undefined, crmBrand: CrmBrand): boolean {
  if (crmBrand === 'fitelo') return dbBrand === 'fitelo';
  return dbBrand === 'fitty' || dbBrand == null;
}
