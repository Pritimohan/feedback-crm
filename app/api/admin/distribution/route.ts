import { NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { getDtLoadDistribution } from '@/lib/services/callDistributionService';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const brand = await getCrmBrandFromCookie();
  const data = await getDtLoadDistribution(undefined, brand);
  return NextResponse.json({ data });
}
