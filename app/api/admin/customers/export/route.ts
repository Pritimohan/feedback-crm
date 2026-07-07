import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { fetchCustomerListRows } from '@/lib/services/customerListService';
import { fetchInteractionsForCustomers } from '@/lib/services/customerInteractionService';
import {
  applyCustomerListFilters,
  parseCustomerListFilters,
} from '@/lib/utils/customerListFilters';
import {
  buildCustomerExportRows,
  CUSTOMER_EXPORT_CSV_HEADERS,
  groupInteractionsByCustomer,
} from '@/lib/utils/customerExportRows';
import { buildCsv } from '@/lib/utils/csv';

function formatExportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brand = await getCrmBrandFromCookie();
    const filters = parseCustomerListFilters(request.nextUrl.searchParams);
    const allCustomers = await fetchCustomerListRows({ brand });
    const filteredCustomers = applyCustomerListFilters(allCustomers, filters);
    const customerIds = filteredCustomers.map((customer) => customer.id);
    const interactions = await fetchInteractionsForCustomers(customerIds, brand);
    const interactionsByCustomer = groupInteractionsByCustomer(interactions);
    const rows = buildCustomerExportRows(filteredCustomers, interactionsByCustomer);
    const csvBody = buildCsv([...CUSTOMER_EXPORT_CSV_HEADERS], rows);
    const timestamp = formatExportTimestamp(new Date());

    return new NextResponse(csvBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-export-${brand}-${timestamp}.csv"`,
        'X-Export-Row-Count': String(rows.length),
      },
    });
  } catch (error) {
    console.error('Customer export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
