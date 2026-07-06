import { NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { fetchCustomerListRows } from '@/lib/services/customerListService';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brand = await getCrmBrandFromCookie();
    const customers = await fetchCustomerListRows({
      brand,
      restrictToDtId: session.role === 'admin' ? undefined : session.id,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get DT customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
