import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  FEEDBACK_IMPORT_MAX_FILE_BYTES,
  parseFeedbackImportSheet,
} from '@/lib/services/feedbackImportService';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await request.formData();
    const upload = formData.get('file');
    if (!(upload instanceof File)) {
      return NextResponse.json({ error: 'Excel file is required' }, { status: 400 });
    }

    const fileName = upload.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Only .xlsx and .xls files are supported' }, { status: 400 });
    }

    if (upload.size > FEEDBACK_IMPORT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File size must be 5MB or less' }, { status: 400 });
    }

    const buffer = Buffer.from(await upload.arrayBuffer());
    const preview = parseFeedbackImportSheet(buffer);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('Feedback import preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to preview import file' },
      { status: 400 }
    );
  }
}
