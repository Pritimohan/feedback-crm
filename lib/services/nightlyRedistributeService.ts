import { db } from '@/lib/db';
import { leads, leadLifecycles, leadLifecycleFollowups } from '@/lib/db/schema';
import { and, eq, gte, lte, sql, isNotNull } from 'drizzle-orm';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { classifyNightlyStage0Followup } from '@/lib/rebalance/classifyFollowup';
import {
  buildEqualTotalStage0Plan,
  buildPlannedTargetsFromStage0Targets,
} from '@/lib/rebalance/rebalancePlanning';
import { getAnalyticsDayBoundsForInstant } from '@/lib/utils/analyticsDates';
import {
  getActiveDietitians,
  type ClassifiedFollowupRow,
} from '@/lib/services/rebalanceEligibilityService';

const CRON_BRANDS: CrmBrand[] = ['fitty', 'fitelo'];

export interface DtTodayCallsRow {
  dtId: string;
  totalTodayCalls: number;
}

/** Per-agent before/after today call counts (human-readable rebalance preview). */
export interface DtDistributionSummaryRow {
  dtId: string;
  dtName: string;
  todayCallsBefore: number;
  todayCallsAfter: number;
  change: number;
  fu0EligibleBefore: number;
  fu1PlusToday: number;
  fu0TargetAfter: number;
}

export interface NightlyRedistributeBrandResult {
  success: boolean;
  brand: CrmBrand;
  totalEligible: number;
  leadsReassigned: number;
  followupsReassigned: number;
  message: string;
  distributionByDt: DtDistributionSummaryRow[];
  startingLoadByDt: Array<{ dtId: string; todayTotalCalls: number }>;
  eligibleStage0ByDtBefore: Array<{ dtId: string; stage0Calls: number }>;
  nonEligibleByDt: Array<{ dtId: string; calls: number }>;
  targetStage0ByDt: Array<{ dtId: string; stage0Calls: number }>;
  allocatedByDt: Array<{ dtId: string; allocated: number }>;
  projectedFinalLoadByDt: Array<{ dtId: string; todayTotalCalls: number }>;
}

function buildDistributionSummary(
  activeDTs: Array<{ id: string; name: string }>,
  startingLoads: Map<string, number>,
  projectedLoads: Map<string, number>,
  eligibleStage0Before: Map<string, number>,
  nonEligibleByDt: Map<string, number>,
  targetStage0ByDt: Map<string, number>
): DtDistributionSummaryRow[] {
  return activeDTs.map((dt) => {
    const before = startingLoads.get(dt.id) ?? 0;
    const after = projectedLoads.get(dt.id) ?? 0;
    return {
      dtId: dt.id,
      dtName: dt.name,
      todayCallsBefore: before,
      todayCallsAfter: after,
      change: after - before,
      fu0EligibleBefore: eligibleStage0Before.get(dt.id) ?? 0,
      fu1PlusToday: nonEligibleByDt.get(dt.id) ?? 0,
      fu0TargetAfter: targetStage0ByDt.get(dt.id) ?? 0,
    };
  });
}

function dedupeEligibleByLead(rows: ClassifiedFollowupRow[]): ClassifiedFollowupRow[] {
  const seen = new Set<string>();
  const out: ClassifiedFollowupRow[] = [];
  for (const row of rows) {
    if (seen.has(row.leadId)) continue;
    seen.add(row.leadId);
    out.push(row);
  }
  return out;
}

export async function getTodayPendingCallsPerDt(brand: CrmBrand): Promise<DtTodayCallsRow[]> {
  const { startDate: dayStart, endDate: dayEnd } = getAnalyticsDayBoundsForInstant();

  const ownerDt = sql<string>`coalesce(${leadLifecycleFollowups.assigned_dt_id}, ${leads.assigned_dt_id})`;

  const rows = await db
    .select({
      dtId: ownerDt,
      totalTodayCalls: sql<number>`count(*)::int`,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .where(
      and(
        eq(leadLifecycleFollowups.status, 'pending'),
        gte(leadLifecycleFollowups.scheduled_date, dayStart),
        lte(leadLifecycleFollowups.scheduled_date, dayEnd),
        isNotNull(leads.assigned_dt_id),
        leadMatchesCrmBrand(brand)
      )
    )
    .groupBy(ownerDt);

  return rows
    .filter((r) => r.dtId != null)
    .map((r) => ({
      dtId: r.dtId as string,
      totalTodayCalls: Number(r.totalTodayCalls),
    }));
}

export async function fetchCronEligibleStage0(brand: CrmBrand): Promise<ClassifiedFollowupRow[]> {
  const { startDate: dayStart, endDate: dayEnd } = getAnalyticsDayBoundsForInstant();

  const rows = await db
    .select({
      followupId: leadLifecycleFollowups.id,
      followupNumber: leadLifecycleFollowups.followup_number,
      attemptCount: leadLifecycleFollowups.attempt_count,
      followupAssignedDtId: leadLifecycleFollowups.assigned_dt_id,
      lifecycleStatus: leadLifecycles.status,
      leadId: leads.id,
      leadAssignedDtId: leads.assigned_dt_id,
      leadActivityStatus: leads.activity_status,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .where(
      and(
        eq(leadLifecycleFollowups.status, 'pending'),
        gte(leadLifecycleFollowups.scheduled_date, dayStart),
        lte(leadLifecycleFollowups.scheduled_date, dayEnd),
        isNotNull(leads.assigned_dt_id),
        leadMatchesCrmBrand(brand)
      )
    )
    .orderBy(leadLifecycleFollowups.scheduled_date, leadLifecycleFollowups.id);

  const classified: ClassifiedFollowupRow[] = [];
  for (const r of rows) {
    const bucket = classifyNightlyStage0Followup({
      followupNumber: r.followupNumber,
      attemptCount: r.attemptCount,
      lifecycleStatus: r.lifecycleStatus,
      leadActivityStatus: r.leadActivityStatus,
    });
    if (bucket !== 'reassignable') continue;

    classified.push({
      followupId: r.followupId,
      leadId: r.leadId,
      followupNumber: r.followupNumber,
      ownerDtId: r.leadAssignedDtId,
      lifecycleStatus: r.lifecycleStatus,
      leadActivityStatus: r.leadActivityStatus,
      bucket,
      dueBucket: 'today',
      currentDtId: r.followupAssignedDtId ?? r.leadAssignedDtId,
    });
  }

  return dedupeEligibleByLead(classified);
}

export async function redistributeNightlyStage0ForBrand(
  brand: CrmBrand,
  dryRun: boolean = false
): Promise<NightlyRedistributeBrandResult> {
  const emptyStats = (message: string, success = false): NightlyRedistributeBrandResult => ({
    success,
    brand,
    totalEligible: 0,
    leadsReassigned: 0,
    followupsReassigned: 0,
    message,
    distributionByDt: [],
    startingLoadByDt: [],
    eligibleStage0ByDtBefore: [],
    nonEligibleByDt: [],
    targetStage0ByDt: [],
    allocatedByDt: [],
    projectedFinalLoadByDt: [],
  });

  try {
    const activeDTs = await getActiveDietitians();
    if (activeDTs.length === 0) {
      return emptyStats('No active agents found');
    }

    const activeDtIds = activeDTs.map((dt) => dt.id);
    const todayLoads = await getTodayPendingCallsPerDt(brand);
    const startingLoads = new Map<string, number>();
    for (const dtId of activeDtIds) startingLoads.set(dtId, 0);
    for (const row of todayLoads) {
      if (startingLoads.has(row.dtId)) {
        startingLoads.set(row.dtId, row.totalTodayCalls);
      }
    }

    const eligible = await fetchCronEligibleStage0(brand);

    const eligibleStage0ByDtBeforeMap = new Map<string, number>();
    for (const dtId of activeDtIds) eligibleStage0ByDtBeforeMap.set(dtId, 0);
    for (const row of eligible) {
      const ownerDt = row.currentDtId;
      if (ownerDt && eligibleStage0ByDtBeforeMap.has(ownerDt)) {
        eligibleStage0ByDtBeforeMap.set(
          ownerDt,
          (eligibleStage0ByDtBeforeMap.get(ownerDt) ?? 0) + 1
        );
      }
    }

    const nonEligibleByDtMap = new Map<string, number>();
    for (const dtId of activeDtIds) {
      const total = startingLoads.get(dtId) ?? 0;
      const eligibleStage0 = eligibleStage0ByDtBeforeMap.get(dtId) ?? 0;
      nonEligibleByDtMap.set(dtId, Math.max(total - eligibleStage0, 0));
    }

    const { targetStage0ByDt, projectedLoads } = buildEqualTotalStage0Plan(
      activeDtIds,
      nonEligibleByDtMap,
      eligible.length
    );
    const { plannedTargets, allocatedByDt } = buildPlannedTargetsFromStage0Targets(
      activeDtIds,
      eligible,
      targetStage0ByDt
    );

    if (eligible.length === 0) {
      return {
        success: true,
        brand,
        totalEligible: 0,
        leadsReassigned: 0,
        followupsReassigned: 0,
        message: `No eligible today stage-0 followups (${brand})`,
        distributionByDt: buildDistributionSummary(
          activeDTs,
          startingLoads,
          startingLoads,
          eligibleStage0ByDtBeforeMap,
          nonEligibleByDtMap,
          targetStage0ByDt
        ),
        startingLoadByDt: activeDtIds.map((dtId) => ({
          dtId,
          todayTotalCalls: startingLoads.get(dtId) ?? 0,
        })),
        eligibleStage0ByDtBefore: activeDtIds.map((dtId) => ({
          dtId,
          stage0Calls: 0,
        })),
        nonEligibleByDt: activeDtIds.map((dtId) => ({
          dtId,
          calls: nonEligibleByDtMap.get(dtId) ?? 0,
        })),
        targetStage0ByDt: activeDtIds.map((dtId) => ({
          dtId,
          stage0Calls: 0,
        })),
        allocatedByDt: activeDtIds.map((dtId) => ({ dtId, allocated: 0 })),
        projectedFinalLoadByDt: activeDtIds.map((dtId) => ({
          dtId,
          todayTotalCalls: startingLoads.get(dtId) ?? 0,
        })),
      };
    }

    let leadsReassigned = 0;
    let followupsReassigned = 0;
    const now = new Date();

    for (let i = 0; i < eligible.length; i++) {
      const row = eligible[i];
      const targetDtId = plannedTargets[i];
      const current = row.currentDtId;
      if (!targetDtId || current === targetDtId) continue;

      if (!dryRun) {
        await db.transaction(async (tx) => {
          await tx
            .update(leads)
            .set({ assigned_dt_id: targetDtId, updated_at: now })
            .where(eq(leads.id, row.leadId));

          await tx
            .update(leadLifecycleFollowups)
            .set({ assigned_dt_id: targetDtId, updated_at: now })
            .where(eq(leadLifecycleFollowups.id, row.followupId));
        });
      }

      leadsReassigned++;
      followupsReassigned++;
    }

    return {
      success: true,
      brand,
      totalEligible: eligible.length,
      leadsReassigned,
      followupsReassigned,
      message: dryRun
        ? `Dry run complete (${brand}, today stage-0). ${followupsReassigned} followup(s) would be moved.`
        : `Morning redistribution complete (${brand}, today stage-0). ${followupsReassigned} followup(s) moved.`,
      distributionByDt: buildDistributionSummary(
        activeDTs,
        startingLoads,
        projectedLoads,
        eligibleStage0ByDtBeforeMap,
        nonEligibleByDtMap,
        targetStage0ByDt
      ),
      startingLoadByDt: activeDtIds.map((dtId) => ({
        dtId,
        todayTotalCalls: startingLoads.get(dtId) ?? 0,
      })),
      eligibleStage0ByDtBefore: activeDtIds.map((dtId) => ({
        dtId,
        stage0Calls: eligibleStage0ByDtBeforeMap.get(dtId) ?? 0,
      })),
      nonEligibleByDt: activeDtIds.map((dtId) => ({
        dtId,
        calls: nonEligibleByDtMap.get(dtId) ?? 0,
      })),
      targetStage0ByDt: activeDtIds.map((dtId) => ({
        dtId,
        stage0Calls: targetStage0ByDt.get(dtId) ?? 0,
      })),
      allocatedByDt: activeDtIds.map((dtId) => ({
        dtId,
        allocated: allocatedByDt.get(dtId) ?? 0,
      })),
      projectedFinalLoadByDt: activeDtIds.map((dtId) => ({
        dtId,
        todayTotalCalls: projectedLoads.get(dtId) ?? 0,
      })),
    };
  } catch (error) {
    console.error(`[nightlyRedistributeService] redistributeNightlyStage0ForBrand(${brand}) error:`, error);
    return emptyStats(`Error redistributing today stage-0 followups (${brand})`);
  }
}

export async function redistributeNightlyStage0AllBrands(dryRun: boolean = false): Promise<{
  success: boolean;
  scheduledAt: string;
  dryRun: boolean;
  fitty: NightlyRedistributeBrandResult;
  fitelo: NightlyRedistributeBrandResult;
}> {
  const fitty = await redistributeNightlyStage0ForBrand('fitty', dryRun);
  const fitelo = await redistributeNightlyStage0ForBrand('fitelo', dryRun);

  return {
    success: fitty.success && fitelo.success,
    scheduledAt: new Date().toISOString(),
    dryRun,
    fitty,
    fitelo,
  };
}

export { CRON_BRANDS };
