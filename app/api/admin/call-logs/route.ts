import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, exists, gte, lte } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, leads } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const brand = await getCrmBrandFromCookie();
  const sp = request.nextUrl.searchParams;
  const dtId = sp.get('dtId');
  const leadType = sp.get('leadType');
  const outcome = sp.get('outcome');
  const sid = sp.get('sid');
  const startAt = sp.get('startAt');
  const endAt = sp.get('endAt');

  const filters = [];
  if (dtId) filters.push(eq(callLogs.dt_id, dtId));
  if (leadType) filters.push(eq(callLogs.lead_type, leadType));
  if (outcome) filters.push(eq(callLogs.attempt_outcome, outcome));
  if (sid) filters.push(eq(callLogs.provider_call_sid, sid));
  if (startAt) filters.push(gte(callLogs.created_at, new Date(startAt)));
  if (endAt) filters.push(lte(callLogs.created_at, new Date(endAt)));

  filters.push(
    exists(
      db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, callLogs.lead_id), leadMatchesCrmBrand(brand)))
    )
  );

  const rows = await db
    .select()
    .from(callLogs)
    .where(and(...filters))
    .orderBy(desc(callLogs.created_at));

  return NextResponse.json({ data: rows });
}
