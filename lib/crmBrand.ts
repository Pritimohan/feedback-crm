import { cookies } from 'next/headers';
import { eq, isNull, or, type SQL } from 'drizzle-orm';
import { leads } from '@/lib/db/schema';
import { FEEDBACK_CRM_BRAND_COOKIE, type CrmBrand, parseCrmBrand } from '@/lib/crmBrand.shared';

export {
  FEEDBACK_CRM_BRAND_COOKIE,
  type CrmBrand,
  parseCrmBrand,
  leadDbBrandMatchesCrmFilter,
} from '@/lib/crmBrand.shared';

export async function getCrmBrandFromCookie(): Promise<CrmBrand> {
  const c = await cookies();
  return parseCrmBrand(c.get(FEEDBACK_CRM_BRAND_COOKIE)?.value);
}

/** Drizzle condition on the `leads` table. Null brand = legacy Fitty. */
export function leadMatchesCrmBrand(brand: CrmBrand): SQL {
  if (brand === 'fitelo') {
    return eq(leads.brand, 'fitelo');
  }
  return or(eq(leads.brand, 'fitty'), isNull(leads.brand))!;
}
