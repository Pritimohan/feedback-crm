import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { leadDbBrandMatchesCrmFilter } from '@/lib/crmBrand.shared';
import { getSession } from '@/lib/auth/session';
import { isNonConnectedOutcome } from '@/lib/lifecycle/leadLifecycleValidation';
import { recordFollowupAttemptOutcome } from '@/lib/services/leadLifecycleEngine';
import { getLeadFollowupDetails } from '@/lib/services/leadFollowupQueryService';

interface OutcomeBody {
  outcome: string;
  notes?: string;
}

export async function POST(request: NextRequest, context: { params: Promise<{ followupId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { followupId } = await context.params;
    const brand = await getCrmBrandFromCookie();
    const existing = await getLeadFollowupDetails(followupId);
    if (!existing || !leadDbBrandMatchesCrmFilter(existing.lead.brand, brand)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as OutcomeBody;

    if (!isNonConnectedOutcome(body.outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
    }

    const result = await recordFollowupAttemptOutcome({
      followupId,
      dtId: session.id,
      outcome: body.outcome,
      notes: body.notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Record followup outcome error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 400 }
    );
  }
}
