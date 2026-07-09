import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { leadDbBrandMatchesCrmFilter } from '@/lib/crmBrand.shared';
import { getSession } from '@/lib/auth/session';
import { isNonConnectedOutcome } from '@/lib/lifecycle/leadLifecycleValidation';
import { recordFollowupAttemptOutcome } from '@/lib/services/leadLifecycleEngine';
import { getLeadFollowupDetails } from '@/lib/services/leadFollowupQueryService';
import { isSundayInSchedulingTz } from '@/lib/utils/schedulingDates';
import { logOutcomeSaveEvent } from '@/lib/utils/outcomeSaveLog';

interface OutcomeBody {
  outcome: string;
  notes?: string;
  preferred_scheduled_date?: string;
}

function parsePreferredScheduledDate(raw: string): Date | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function POST(request: NextRequest, context: { params: Promise<{ followupId: string }> }) {
  const startedAt = Date.now();
  let followupId: string | undefined;
  let outcome: string | undefined;
  let dtId: string | undefined;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { followupId: resolvedFollowupId } = await context.params;
    followupId = resolvedFollowupId;
    dtId = session.id;
    const brand = await getCrmBrandFromCookie();
    const existing = await getLeadFollowupDetails(followupId);
    if (!existing || !leadDbBrandMatchesCrmFilter(existing.lead.brand, brand)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as OutcomeBody;
    outcome = body.outcome;

    if (!isNonConnectedOutcome(body.outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
    }

    let preferredScheduledDate: Date | undefined;
    if (body.preferred_scheduled_date != null && body.preferred_scheduled_date !== '') {
      if (body.outcome !== 'busy') {
        return NextResponse.json(
          { error: 'preferred_scheduled_date is only allowed for busy outcome' },
          { status: 400 }
        );
      }

      const parsed = parsePreferredScheduledDate(body.preferred_scheduled_date);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid preferred_scheduled_date' }, { status: 400 });
      }

      const now = new Date();
      if (parsed.getTime() < now.getTime() - 60_000) {
        return NextResponse.json({ error: 'preferred_scheduled_date must not be in the past' }, { status: 400 });
      }

      if (isSundayInSchedulingTz(parsed)) {
        return NextResponse.json({ error: 'Cannot schedule on Sunday' }, { status: 400 });
      }

      preferredScheduledDate = parsed;
    }

    const result = await recordFollowupAttemptOutcome({
      followupId,
      dtId: session.id,
      outcome: body.outcome,
      notes: body.notes,
      preferredScheduledDate,
    });

    logOutcomeSaveEvent({
      action: 'followup_outcome',
      followupId,
      dtId,
      outcome: body.outcome,
      status: 'success',
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isConflict = errorMessage === 'Followup is not pending';

    logOutcomeSaveEvent({
      action: 'followup_outcome',
      followupId: followupId ?? 'unknown',
      dtId,
      outcome,
      status: isConflict ? 'conflict' : 'error',
      reason: isConflict ? 'duplicate_or_race' : undefined,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    });

    console.error('Record followup outcome error:', error);
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
