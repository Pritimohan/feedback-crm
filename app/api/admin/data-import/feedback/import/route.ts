import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import type { CreateCustomerInput } from '@/lib/services/customerCreateService';
import { importFeedbackLeads } from '@/lib/services/feedbackImportService';

interface ImportBody {
  rows?: Array<{
    rowNumber: number;
    data: CreateCustomerInput;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await request.json()) as ImportBody;
    const rows = body.rows ?? [];

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
    }

    const importRows = rows
      .filter((row) => row.data?.phone && row.data?.name && row.data?.brand)
      .map((row) => ({
        rowNumber: row.rowNumber,
        input: row.data,
      }));

    if (!importRows.length) {
      return NextResponse.json({ error: 'No valid rows to import' }, { status: 400 });
    }

    const result = await importFeedbackLeads(importRows);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Feedback import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import feedback leads' },
      { status: 500 }
    );
  }
}
