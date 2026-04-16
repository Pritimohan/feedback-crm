import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getActiveFollowupsForDt } from '@/lib/services/leadLifecycleEngine';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await getActiveFollowupsForDt(session.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Get active followups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
