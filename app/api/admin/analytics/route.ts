import { NextResponse, NextRequest } from 'next/server';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  leadLifecycleFollowups,
  leadLifecycleFollowupAttempts,
  leadLifecycles,
  leads,
  customers,
  users,
} from '@/lib/db/schema';
import { and, eq, gt, gte, lt, lte, or, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AnalyticsData } from '@/types/analytics';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';

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
    const activeLeadFilter = and(
      eq(leads.activity_status, 'active'),
      isNotNull(leads.assigned_dt_id),
      leadMatchesCrmBrand(brand)
    );

    const searchParams = request.nextUrl.searchParams;
    const filterType = (searchParams.get('filter') || 'today') as AnalyticsFilterType;
    const startDateParam = searchParams.get('startDate') ?? undefined;
    const endDateParam = searchParams.get('endDate') ?? undefined;

    const { startDate, endDate } = getAnalyticsDateRange(
      filterType,
      startDateParam,
      endDateParam
    );

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const leadPoolCondition = or(
      and(
        eq(leadLifecycleFollowups.attempt_count, 0),
        gte(leadLifecycleFollowups.scheduled_date, startDate),
        lte(leadLifecycleFollowups.scheduled_date, endDate)
      ),
      and(
        gt(leadLifecycleFollowups.attempt_count, 0),
        isNotNull(leadLifecycleFollowups.first_attempt_date),
        gte(leadLifecycleFollowups.first_attempt_date, startDate),
        lte(leadLifecycleFollowups.first_attempt_date, endDate)
      ),
      and(
        gt(leadLifecycleFollowups.attempt_count, 0),
        sql<boolean>`EXISTS (
          SELECT 1
          FROM lead_lifecycle_followup_attempts fa
          WHERE fa.followup_id = ${leadLifecycleFollowups.id}
            AND fa.attempt_date >= ${startIso}::timestamp
            AND fa.attempt_date <= ${endIso}::timestamp
        )`
      )
    );

    const baseJoin = and(
      eq(leadLifecycles.status, 'active'),
      activeLeadFilter,
      eq(users.role, 'dt'),
      eq(users.active_status, true)
    );

    async function getFollowupAnalytics(followupNumber: number) {
      const leadsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadLifecycleFollowups)
        .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
        .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
        .innerJoin(users, eq(leads.assigned_dt_id, users.id))
        .where(
          and(
            eq(leadLifecycleFollowups.followup_number, followupNumber),
            baseJoin,
            leadPoolCondition
          )
        );
      const leadsCount = leadsResult[0]?.count || 0;

      const freshLeadsWhere =
        followupNumber === 0
          ? and(
              eq(leadLifecycleFollowups.followup_number, followupNumber),
              baseJoin,
              leadPoolCondition,
              eq(leadLifecycleFollowups.attempt_count, 0)
            )
          : and(
              eq(leadLifecycleFollowups.followup_number, followupNumber),
              baseJoin,
              leadPoolCondition,
              or(
                isNull(leadLifecycleFollowups.first_attempt_date),
                gte(leadLifecycleFollowups.first_attempt_date, startDate)
              )
            );

      const freshLeadsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadLifecycleFollowups)
        .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
        .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
        .innerJoin(users, eq(leads.assigned_dt_id, users.id))
        .where(freshLeadsWhere);
      const freshLeadCount = freshLeadsResult[0]?.count || 0;

      const rescheduledLeadsWhere =
        followupNumber === 0
          ? and(
              eq(leadLifecycleFollowups.followup_number, followupNumber),
              baseJoin,
              leadPoolCondition,
              gt(leadLifecycleFollowups.attempt_count, 0)
            )
          : and(
              eq(leadLifecycleFollowups.followup_number, followupNumber),
              baseJoin,
              leadPoolCondition,
              isNotNull(leadLifecycleFollowups.first_attempt_date),
              lt(leadLifecycleFollowups.first_attempt_date, startDate)
            );

      const rescheduledLeadsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadLifecycleFollowups)
        .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
        .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
        .innerJoin(users, eq(leads.assigned_dt_id, users.id))
        .where(rescheduledLeadsWhere);
      const rescheduledLeadCount = rescheduledLeadsResult[0]?.count || 0;

      const leadBreakdown = {
        freshLead: freshLeadCount,
        rescheduledLead: rescheduledLeadCount,
      };

      const attempts = await db
        .select({
          outcome: leadLifecycleFollowupAttempts.outcome,
          count: sql<number>`count(*)::int`,
        })
        .from(leadLifecycleFollowupAttempts)
        .innerJoin(
          leadLifecycleFollowups,
          eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
        )
        .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
        .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
        .innerJoin(users, eq(leads.assigned_dt_id, users.id))
        .where(
          and(
            eq(leadLifecycleFollowups.followup_number, followupNumber),
            baseJoin,
            leadPoolCondition,
            gte(leadLifecycleFollowupAttempts.attempt_date, startDate),
            lte(leadLifecycleFollowupAttempts.attempt_date, endDate)
          )
        )
        .groupBy(leadLifecycleFollowupAttempts.outcome);

      const startStr = startIso;
      const endStr = endIso;

      const callAttemptBreakdown = {
        freshLead: 0,
        rescheduledLead: 0,
      };

      const connectedBreakdown = { freshLead: 0, rescheduledLead: 0 };
      const callLaterBreakdown = { freshLead: 0, rescheduledLead: 0 };
      const failedBreakdown = { freshLead: 0, rescheduledLead: 0 };

      try {
        const breakdownResult = await db.execute(sql`
          WITH attempts_with_context AS (
            SELECT
              fa.id,
              fa.outcome,
              (SELECT COUNT(*)::int FROM lead_lifecycle_followup_attempts fa2
               WHERE fa2.followup_id = fa.followup_id
               AND fa2.attempt_date < fa.attempt_date) AS prev_count,
              (SELECT fa3.outcome FROM lead_lifecycle_followup_attempts fa3
               WHERE fa3.followup_id = fa.followup_id
               AND fa3.attempt_date < fa.attempt_date
               ORDER BY fa3.attempt_date DESC LIMIT 1) AS prev_outcome
            FROM lead_lifecycle_followup_attempts fa
            INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
            INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
            INNER JOIN leads l ON ol.lead_id = l.id
            INNER JOIN users u ON l.assigned_dt_id = u.id
            WHERE lf.followup_number = ${followupNumber}
              AND ol.status = 'active'
              AND l.activity_status = 'active'
              AND l.assigned_dt_id IS NOT NULL
              AND u.role = 'dt'
              AND u.active_status = true
              ${
                brand === 'fitelo'
                  ? sql`AND l.brand = 'fitelo'`
                  : sql`AND (l.brand = 'fitty' OR l.brand IS NULL)`
              }
              AND fa.attempt_date >= ${startStr}
              AND fa.attempt_date <= ${endStr}
              AND (
                (lf.attempt_count = 0 AND lf.scheduled_date >= ${startStr} AND lf.scheduled_date <= ${endStr})
                OR
                (lf.attempt_count > 0 AND lf.first_attempt_date IS NOT NULL
                 AND lf.first_attempt_date >= ${startStr} AND lf.first_attempt_date <= ${endStr})
                OR
                (lf.attempt_count > 0 AND EXISTS (
                  SELECT 1 FROM lead_lifecycle_followup_attempts fa_in_range
                  WHERE fa_in_range.followup_id = lf.id
                    AND fa_in_range.attempt_date >= ${startStr}
                    AND fa_in_range.attempt_date <= ${endStr}
                ))
              )
          ),
          with_lead_type AS (
            SELECT
              outcome,
              CASE
                WHEN prev_count = 0 THEN 'fresh'
                WHEN LOWER(prev_outcome) IN ('call_later','busy') THEN 'booked'
                ELSE 'not_connected'
              END AS lead_type
            FROM attempts_with_context
          )
          SELECT
            lead_type,
            CASE
              WHEN LOWER(outcome) = 'connected' THEN 'connected'
              WHEN LOWER(outcome) IN ('call_later','busy') THEN 'call_later'
              ELSE 'failed'
            END AS outcome_group,
            COUNT(*)::int AS cnt
          FROM with_lead_type
          GROUP BY 1, 2
        `);

        const breakdownRows = Array.isArray(breakdownResult)
          ? breakdownResult
          : (breakdownResult as { rows?: unknown[] })?.rows ?? [];
        for (const row of breakdownRows) {
          const r = row as { lead_type?: string; outcome_group?: string; cnt?: number } | null;
          const cnt = Number(r?.cnt ?? 0);
          const lt = r?.lead_type;
          const og = r?.outcome_group;

          if (og === 'connected') {
            if (lt === 'fresh') connectedBreakdown.freshLead = cnt;
            else if (lt === 'booked' || lt === 'not_connected') connectedBreakdown.rescheduledLead += cnt;
          } else if (og === 'call_later') {
            if (lt === 'fresh') callLaterBreakdown.freshLead = cnt;
            else if (lt === 'booked' || lt === 'not_connected') callLaterBreakdown.rescheduledLead += cnt;
          } else if (og === 'failed') {
            if (lt === 'fresh') failedBreakdown.freshLead = cnt;
            else if (lt === 'booked' || lt === 'not_connected') failedBreakdown.rescheduledLead += cnt;
          }
        }

        callAttemptBreakdown.freshLead =
          connectedBreakdown.freshLead + callLaterBreakdown.freshLead + failedBreakdown.freshLead;
        callAttemptBreakdown.rescheduledLead =
          connectedBreakdown.rescheduledLead +
          callLaterBreakdown.rescheduledLead +
          failedBreakdown.rescheduledLead;
      } catch (breakdownErr) {
        console.warn('[Analytics] Call attempt breakdown query failed:', breakdownErr);
      }

      let attemptedCount = 0;
      let connectedCount = 0;
      let callLaterCount = 0;
      let cnrBusyFailedWrongNumberCount = 0;

      for (const attempt of attempts) {
        const count = attempt.count || 0;
        attemptedCount += count;

        switch (attempt.outcome?.toLowerCase()) {
          case 'connected':
            connectedCount += count;
            break;
          case 'call_later':
          case 'busy':
            callLaterCount += count;
            break;
          case 'cnr':
          case 'failed':
          case 'wrong_number':
          case 'no_answer':
          case 'unreachable':
          case 'not_interested':
            cnrBusyFailedWrongNumberCount += count;
            break;
        }
      }

      const connectedPercentage =
        leadsCount > 0 ? parseFloat(((connectedCount / leadsCount) * 100).toFixed(2)) : 0;

      return {
        leads: leadsCount,
        leadBreakdown,
        attempted: attemptedCount,
        callAttemptBreakdown,
        connected: connectedCount,
        connectedBreakdown,
        callLater: callLaterCount,
        callLaterBreakdown,
        cnrBusyFailedWrongNumber: cnrBusyFailedWrongNumberCount,
        failedBreakdown,
        connectedPercentage,
      };
    }

    const [counselling, firstFollowup, secondFollowup, thirdFollowup] = await Promise.all([
      getFollowupAnalytics(0),
      getFollowupAnalytics(1),
      getFollowupAnalytics(2),
      getFollowupAnalytics(3),
    ]);

    const activityWhere = and(
      eq(leadLifecycles.status, 'active'),
      activeLeadFilter,
      eq(users.role, 'dt'),
      eq(users.active_status, true),
      gte(leadLifecycleFollowupAttempts.attempt_date, startDate),
      lte(leadLifecycleFollowupAttempts.attempt_date, endDate)
    );

    const [attemptsResult, uniqueCustomersCalledResult, uniqueCustomersConnectedResult, uniqueLeadsTouchedResult] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(leadLifecycleFollowupAttempts)
          .innerJoin(
            leadLifecycleFollowups,
            eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
          )
          .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
          .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
          .innerJoin(users, eq(leads.assigned_dt_id, users.id))
          .where(activityWhere),
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})::int` })
          .from(leadLifecycleFollowupAttempts)
          .innerJoin(
            leadLifecycleFollowups,
            eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
          )
          .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
          .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
          .innerJoin(customers, eq(leads.customer_id, customers.id))
          .innerJoin(users, eq(leads.assigned_dt_id, users.id))
          .where(activityWhere),
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})::int` })
          .from(leadLifecycleFollowupAttempts)
          .innerJoin(
            leadLifecycleFollowups,
            eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
          )
          .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
          .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
          .innerJoin(customers, eq(leads.customer_id, customers.id))
          .innerJoin(users, eq(leads.assigned_dt_id, users.id))
          .where(
            and(
              activityWhere,
              eq(leadLifecycleFollowupAttempts.outcome, 'connected')
            )
          ),
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${leads.id})::int` })
          .from(leadLifecycleFollowupAttempts)
          .innerJoin(
            leadLifecycleFollowups,
            eq(leadLifecycleFollowupAttempts.followup_id, leadLifecycleFollowups.id)
          )
          .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
          .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
          .innerJoin(users, eq(leads.assigned_dt_id, users.id))
          .where(activityWhere),
      ]);

    const activity = {
      attempts: attemptsResult[0]?.count ?? 0,
      uniqueCustomersCalled: uniqueCustomersCalledResult[0]?.count ?? 0,
      uniqueCustomersConnected: uniqueCustomersConnectedResult[0]?.count ?? 0,
      uniqueLeadsTouched: uniqueLeadsTouchedResult[0]?.count ?? 0,
    };

    const analyticsData: AnalyticsData = {
      counselling,
      firstFollowup,
      secondFollowup,
      thirdFollowup,
      activity,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
