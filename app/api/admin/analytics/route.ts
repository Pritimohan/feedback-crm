import { NextResponse, NextRequest } from 'next/server';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  leadLifecycleFollowups,
  leadLifecycleFollowupAttempts,
  leadLifecycles,
  leads,
  users,
} from '@/lib/db/schema';
import { and, eq, gt, gte, lt, lte, or, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AnalyticsData, AnalyticsSection, ConversionBreakdown } from '@/types/analytics';
import {
  getAnalyticsDateRange,
  type AnalyticsFilterType,
} from '@/lib/utils/analyticsDates';
import {
  parseConversionBreakdownRows,
  sumConversionBreakdown,
} from '@/lib/utils/analyticsOutcomes';
import {
  dedupedAttemptsCte,
  sqlBrandCond,
  sqlConnectedFollowupFilters,
} from '@/lib/analytics/uniqueAttemptsSql';

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

    const brandCond = sqlBrandCond(brand);

    async function getStageConversions(followupNumber: number): Promise<{
      converted: number;
      conversionBreakdown: ConversionBreakdown;
      totalConnected: number;
    }> {
      const connectedFollowupFilter = sqlConnectedFollowupFilters({
        startIso,
        endIso,
        brand,
        followupNumber,
      });

      const [conversionResult, totalConnectedResult] = await Promise.all([
        db.execute(sql`
          SELECT
            lf.payload->>'connected_choice' AS choice,
            COUNT(DISTINCT lf.id)::int AS cnt
          FROM lead_lifecycle_followups lf
          INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
          INNER JOIN leads l ON ol.lead_id = l.id
          INNER JOIN users u ON l.assigned_dt_id = u.id
          WHERE ${connectedFollowupFilter}
          GROUP BY lf.payload->>'connected_choice'
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT lf.id)::int AS cnt
          FROM lead_lifecycle_followups lf
          INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
          INNER JOIN leads l ON ol.lead_id = l.id
          INNER JOIN users u ON l.assigned_dt_id = u.id
          WHERE ${connectedFollowupFilter}
        `),
      ]);

      const rows = Array.isArray(conversionResult)
        ? conversionResult
        : (conversionResult as { rows?: unknown[] })?.rows ?? [];
      const conversionBreakdown = parseConversionBreakdownRows(
        rows as { choice?: string | null; cnt?: number }[]
      );

      const totalConnectedRows = Array.isArray(totalConnectedResult)
        ? totalConnectedResult
        : (totalConnectedResult as { rows?: unknown[] })?.rows ?? [];
      const totalConnectedSql = Number(
        (totalConnectedRows[0] as { cnt?: number } | undefined)?.cnt ?? 0
      );
      const breakdownSum = sumConversionBreakdown(conversionBreakdown);
      const totalConnected =
        totalConnectedSql > 0 ? totalConnectedSql : breakdownSum;

      return {
        converted: conversionBreakdown.reviewed,
        conversionBreakdown,
        totalConnected,
      };
    }

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

      const dedupeCteOpts = {
        startIso,
        endIso,
        brand,
        followupNumber,
        partition: 'lead' as const,
        withLeadPoolFilter: true,
      };

      const stageAttemptMetrics = await db.execute(sql`
        WITH ${dedupedAttemptsCte(dedupeCteOpts)}
        SELECT
          (SELECT COUNT(*)::int FROM attempts_deduped) AS attempted,
          (SELECT COUNT(*)::int FROM (
            SELECT lead_id, attempt_day_ist
            FROM attempts_base
            GROUP BY lead_id, attempt_day_ist
            HAVING BOOL_OR(LOWER(TRIM(outcome)) = 'connected')
          ) connected_lead_days) AS connected
      `);

      const stageMetricsRows = Array.isArray(stageAttemptMetrics)
        ? stageAttemptMetrics
        : (stageAttemptMetrics as { rows?: unknown[] })?.rows ?? [];
      const stageMetrics = stageMetricsRows[0] as { attempted?: number; connected?: number } | undefined;

      const attemptsResult = await db.execute(sql`
        WITH ${dedupedAttemptsCte(dedupeCteOpts)}
        SELECT LOWER(TRIM(outcome)) AS outcome, COUNT(*)::int AS cnt
        FROM attempts_deduped
        GROUP BY LOWER(TRIM(outcome))
      `);

      const attemptsRows = Array.isArray(attemptsResult)
        ? attemptsResult
        : (attemptsResult as { rows?: unknown[] })?.rows ?? [];

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
          WITH ${dedupedAttemptsCte(dedupeCteOpts)},
          attempts_with_context AS (
            SELECT
              d.id,
              d.outcome,
              (SELECT COUNT(*)::int FROM lead_lifecycle_followup_attempts fa2
               WHERE fa2.followup_id = d.followup_id
               AND fa2.attempt_date < d.attempt_date) AS prev_count,
              (SELECT fa3.outcome FROM lead_lifecycle_followup_attempts fa3
               WHERE fa3.followup_id = d.followup_id
               AND fa3.attempt_date < d.attempt_date
               ORDER BY fa3.attempt_date DESC LIMIT 1) AS prev_outcome
            FROM attempts_deduped d
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

      const attemptedCount = Number(stageMetrics?.attempted ?? 0);
      const connectedCount = Number(stageMetrics?.connected ?? 0);
      let callLaterCount = 0;
      let cnrBusyFailedWrongNumberCount = 0;

      for (const attempt of attemptsRows as { outcome?: string | null; cnt?: number }[]) {
        const count = Number(attempt.cnt ?? 0);
        const outcome = attempt.outcome?.toLowerCase() ?? '';

        switch (outcome) {
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

    const [
      counsellingBase,
      firstFollowupBase,
      secondFollowupBase,
      thirdFollowupBase,
      counsellingConv,
      firstFollowupConv,
      secondFollowupConv,
      thirdFollowupConv,
    ] = await Promise.all([
      getFollowupAnalytics(0),
      getFollowupAnalytics(1),
      getFollowupAnalytics(2),
      getFollowupAnalytics(3),
      getStageConversions(0),
      getStageConversions(1),
      getStageConversions(2),
      getStageConversions(3),
    ]);

    const mergeSection = (
      base: Omit<AnalyticsSection, 'converted' | 'conversionBreakdown'>,
      conv: {
        converted: number;
        conversionBreakdown: ConversionBreakdown;
        totalConnected: number;
      }
    ): AnalyticsSection => {
      const connected =
        conv.totalConnected > 0
          ? conv.totalConnected
          : sumConversionBreakdown(conv.conversionBreakdown);
      const leads = base.leads;
      return {
        ...base,
        connectedAttempts: base.connected,
        connected,
        connectedPercentage:
          leads > 0 ? parseFloat(((connected / leads) * 100).toFixed(2)) : 0,
        converted: conv.converted,
        conversionBreakdown: conv.conversionBreakdown,
      };
    };

    const counselling = mergeSection(counsellingBase, counsellingConv);
    const firstFollowup = mergeSection(firstFollowupBase, firstFollowupConv);
    const secondFollowup = mergeSection(secondFollowupBase, secondFollowupConv);
    const thirdFollowup = mergeSection(thirdFollowupBase, thirdFollowupConv);

    const activityWhere = and(
      eq(leadLifecycles.status, 'active'),
      activeLeadFilter,
      eq(users.role, 'dt'),
      eq(users.active_status, true),
      gte(leadLifecycleFollowupAttempts.attempt_date, startDate),
      lte(leadLifecycleFollowupAttempts.attempt_date, endDate)
    );

    const activityCteOpts = {
      startIso,
      endIso,
      brand,
      partition: 'customer' as const,
      withLeadPoolFilter: false,
    };

    const [attemptsResult, activityDedupedResult] = await Promise.all([
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
      db.execute(sql`
        WITH ${dedupedAttemptsCte(activityCteOpts)}
        SELECT
          (SELECT COUNT(*)::int FROM (
            SELECT DISTINCT customer_id, attempt_day_ist FROM attempts_base
          ) customer_days) AS unique_customers_called,
          (SELECT COUNT(*)::int FROM connected_customer_days) AS unique_customers_connected
      `),
    ]);

    const activityDedupedRows = Array.isArray(activityDedupedResult)
      ? activityDedupedResult
      : (activityDedupedResult as { rows?: unknown[] })?.rows ?? [];
    const activityDeduped = activityDedupedRows[0] as
      | { unique_customers_called?: number; unique_customers_connected?: number }
      | undefined;

    const activity = {
      attempts: attemptsResult[0]?.count ?? 0,
      uniqueCustomersCalled: Number(activityDeduped?.unique_customers_called ?? 0),
      uniqueCustomersConnected: Number(activityDeduped?.unique_customers_connected ?? 0),
    };

    const [distinctLeadsResult, distinctReviewedResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(DISTINCT l.id)::int AS cnt
        FROM lead_lifecycle_followups lf
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN users u ON l.assigned_dt_id = u.id
        WHERE ol.status = 'active'
          AND l.activity_status = 'active'
          AND l.assigned_dt_id IS NOT NULL
          AND u.role = 'dt'
          AND u.active_status = true
          ${brandCond}
          AND (
            (lf.attempt_count = 0 AND lf.scheduled_date >= ${startIso}::timestamp AND lf.scheduled_date <= ${endIso}::timestamp)
            OR (lf.attempt_count > 0 AND lf.first_attempt_date IS NOT NULL
                AND lf.first_attempt_date >= ${startIso}::timestamp AND lf.first_attempt_date <= ${endIso}::timestamp)
            OR (lf.attempt_count > 0 AND EXISTS (
              SELECT 1 FROM lead_lifecycle_followup_attempts fa
              WHERE fa.followup_id = lf.id
                AND fa.attempt_date >= ${startIso}::timestamp
                AND fa.attempt_date <= ${endIso}::timestamp
            ))
          )
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT lf.id)::int AS cnt
        FROM lead_lifecycle_followups lf
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN users u ON l.assigned_dt_id = u.id
        WHERE ${sqlConnectedFollowupFilters({ startIso, endIso, brand })}
          AND lf.payload->>'connected_choice' = 'reviewed'
      `),
    ]);

    const distinctLeadsRows = Array.isArray(distinctLeadsResult)
      ? distinctLeadsResult
      : (distinctLeadsResult as { rows?: unknown[] })?.rows ?? [];
    const distinctReviewedRows = Array.isArray(distinctReviewedResult)
      ? distinctReviewedResult
      : (distinctReviewedResult as { rows?: unknown[] })?.rows ?? [];

    const totalLeadsDistinct = Number(
      (distinctLeadsRows[0] as { cnt?: number } | undefined)?.cnt ?? 0
    );
    const convertedDistinct = Number(
      (distinctReviewedRows[0] as { cnt?: number } | undefined)?.cnt ?? 0
    );

    const funnelSummary = {
      totalLeads: totalLeadsDistinct,
      newLeads: counselling.leadBreakdown?.freshLead ?? 0,
      rescheduledLeads: counselling.leadBreakdown?.rescheduledLead ?? 0,
      attempted: activity.uniqueCustomersCalled,
      connected: activity.uniqueCustomersConnected,
      converted: convertedDistinct,
    };

    const analyticsData: AnalyticsData = {
      counselling,
      firstFollowup,
      secondFollowup,
      thirdFollowup,
      funnelSummary,
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
