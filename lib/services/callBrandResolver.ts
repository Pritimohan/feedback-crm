import { and, desc, eq } from 'drizzle-orm';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { parseCrmBrand, type CrmBrand } from '@/lib/crmBrand.shared';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

export async function resolveCallBrand(customerId?: string | null): Promise<CrmBrand> {
  if (customerId) {
    const [activeLead] = await db
      .select({ brand: leads.brand })
      .from(leads)
      .where(and(eq(leads.customer_id, customerId), eq(leads.activity_status, 'active')))
      .orderBy(desc(leads.updated_at))
      .limit(1);

    if (activeLead) {
      return parseCrmBrand(activeLead.brand);
    }
  }

  return getCrmBrandFromCookie();
}
