import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { callLogs } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const rows = await db
    .select()
    .from(callLogs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(callLogs.created_at));

  return NextResponse.json({ data: rows });
}
