import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';

export async function GET(_request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { customerId } = await context.params;
  const [row] = await db
    .select({ customerId: customers.id, flagType: customers.flag_type })
    .from(customers)
    .where(eq(customers.id, customerId));
  return NextResponse.json({ data: row ?? null });
}

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { customerId } = await context.params;
  const body = await request.json();
  if (!body?.flagType) return NextResponse.json({ error: 'flagType is required' }, { status: 400 });

  const [row] = await db
    .update(customers)
    .set({
      flag_type: body.flagType,
      updated_at: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  await refreshCustomerSummary(customerId);
  return NextResponse.json({ data: row }, { status: 201 });
}
