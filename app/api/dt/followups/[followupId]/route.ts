import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getLeadFollowupDetails } from '@/lib/services/leadFollowupQueryService';

export async function GET(_request: Request, context: { params: Promise<{ followupId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { followupId } = await context.params;
    const data = await getLeadFollowupDetails(followupId);
    if (!data) {
      return NextResponse.json({ error: 'Followup not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get followup details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
