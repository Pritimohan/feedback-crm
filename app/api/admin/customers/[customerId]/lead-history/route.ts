import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

export async function GET(_request: Request, context: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { customerId } = await context.params;
  const brand = await getCrmBrandFromCookie();
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.customer_id, customerId), leadMatchesCrmBrand(brand)))
    .orderBy(desc(leads.created_at));

  const activeByType = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.activity_status === 'active') {
      acc[row.lead_type] = (acc[row.lead_type] ?? 0) + 1;
    }
    return acc;
  }, {});

  return NextResponse.json({
    summary: {
      total: rows.length,
      active_by_type: activeByType,
    },
    data: rows,
  });
}
