import { NextRequest, NextResponse } from 'next/server';
import { redistributeNightlyStage0AllBrands } from '@/lib/services/nightlyRedistributeService';

/**
 * GET /api/cron/nightly-redistribute-stage0
 * Morning redistribution for today's FU0 (first-call) pending followups, both brands.
 * Eligibility: followup_number = 0 (first call; attempt_count may be > 0), active lifecycle + active lead,
 * scheduled today (IST), assigned DT required.
 * Allocation equalizes final total today load across agents.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    const result = await redistributeNightlyStage0AllBrands(dryRun);

    return NextResponse.json({
      success: result.success,
      scheduledAt: result.scheduledAt,
      scope: {
        brands: ['fitty', 'fitelo'],
        followupNumber: 0,
        firstCallsOnly: true,
      },
      filters: {
        followupNumber: 0,
        attemptCount: 'any (followup 0 only)',
        scheduledDate: 'today',
        lifecycleStatus: 'active',
        leadActivityStatus: 'active',
        followupStatus: 'pending',
        requiresAssignedDt: true,
        allocationBasis: 'equal_total_today_load',
      },
      dryRun: result.dryRun,
      fitty: result.fitty,
      fitelo: result.fitelo,
    });
  } catch (error) {
    console.error('[cron/nightly-redistribute-stage0] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run nightly stage-0 redistribution' },
      { status: 500 }
    );
  }
}
