import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs, customers, leads } from '@/lib/db/schema';
import { dedupeCallHistoryRows } from '@/lib/services/callLogService';

function parseDateBoundary(dateString: string | null, endOfDay = false): Date | null {
  if (!dateString) return null;
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const parsed = new Date(`${dateString}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'dt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const startDate = parseDateBoundary(sp.get('startDate'));
  const endDate = parseDateBoundary(sp.get('endDate'), true);
  const brand = await getCrmBrandFromCookie();

  const filters = [eq(callLogs.dt_id, session.id), leadMatchesCrmBrand(brand)];
  if (startDate) filters.push(gte(callLogs.created_at, startDate));
  if (endDate) filters.push(lte(callLogs.created_at, endDate));

  const rows = await db
    .select({
      id: callLogs.id,
      customerId: callLogs.customer_id,
      customerName: customers.name,
      customerPhone: callLogs.customer_number,
      outcome: callLogs.attempt_outcome,
      followupNumber: callLogs.followup_number,
      leadType: callLogs.lead_type,
      durationSec: callLogs.provider_duration_sec,
      updatedAt: callLogs.updated_at,
      createdAt: callLogs.created_at,
      providerStatusRaw: callLogs.provider_status_raw,
      attemptId: callLogs.attempt_id,
    })
    .from(callLogs)
    .innerJoin(leads, eq(callLogs.lead_id, leads.id))
    .leftJoin(customers, eq(callLogs.customer_id, customers.id))
    .where(and(...filters))
    .orderBy(desc(callLogs.updated_at));

  const dedupedRows = dedupeCallHistoryRows(
    rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt ?? row.createdAt,
    }))
  );

  const callHistory = dedupedRows.map((row) => ({
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName ?? 'Unknown Customer',
    customerPhone: row.customerPhone ?? '',
    outcome: row.outcome || row.providerStatusRaw || 'no_answer',
    followupStage: row.followupNumber ?? 0,
    leadType: row.leadType ?? '',
    durationSec: row.durationSec ?? 0,
    updatedAt: row.updatedAt?.toISOString() ?? row.createdAt.toISOString(),
  }));

  return NextResponse.json({ callHistory });
}
