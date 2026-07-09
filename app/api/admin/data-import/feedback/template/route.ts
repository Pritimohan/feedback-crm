import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildFeedbackImportTemplateBuffer } from '@/lib/services/feedbackImportService';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const buffer = buildFeedbackImportTemplateBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="feedback-leads-import-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('Feedback import template error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate template' },
      { status: 500 }
    );
  }
}
