import { NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import {
  buildSortedActiveFollowupCalls,
  getTodayBoundsForFeedbackFollowups,
} from '@/lib/dt/activeFollowupsCallPriority';
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

    const brand = await getCrmBrandFromCookie();
    const now = new Date();
    const result = await getActiveFollowupsForDt(session.id, now, brand);
    const calls = buildSortedActiveFollowupCalls(result.todayDue, result.overdue, now);
    const dayBounds = getTodayBoundsForFeedbackFollowups(now);

    return NextResponse.json({
      ...result,
      calls,
      dayBounds,
    });
  } catch (error) {
    console.error('Get active followups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
