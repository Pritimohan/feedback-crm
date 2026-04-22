import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const data = await getDtLoadDistribution();
  return NextResponse.json({ data });
}
