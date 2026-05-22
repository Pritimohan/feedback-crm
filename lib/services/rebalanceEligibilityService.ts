import { db } from '@/lib/db';
import { users, leads, leadLifecycles, leadLifecycleFollowups } from '@/lib/db/schema';
import { and, eq, lte, sql, isNotNull } from 'drizzle-orm';
import { getCrmBrandFromCookie, leadMatchesCrmBrand } from '@/lib/crmBrand';
import {
  classifyRebalanceFollowup,
  dueBucketFromScheduled,
  type RebalanceBucket,
  type DueBucket,
} from '@/lib/rebalance/classifyFollowup';
import type { RebalanceDtRow, RebalanceConfig, PoolSummary } from '@/lib/rebalance/rebalanceDistribution.types';
import { summarizeClassifiedRows } from '@/lib/rebalance/summarizePool';
import {
  buildStage0PlanFromPercentages,
  buildPlannedTargetsFromStage0Targets,
} from '@/lib/rebalance/rebalancePlanning';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export interface ClassifiedFollowupRow {
  followupId: string;
  leadId: string;
  followupNumber: number;
  ownerDtId: string | null;
  lifecycleStatus: string;
  leadActivityStatus: string;
  bucket: RebalanceBucket;
  dueBucket: DueBucket;
  currentDtId: string | null;
}

/** UI counts: active lifecycle + active lead + owner on an active agent. */
export function filterRowsForUiCounts(
  rows: ClassifiedFollowupRow[],
  activeDtIdSet: Set<string>
): ClassifiedFollowupRow[] {
  return rows.filter(
    (r) =>
      r.lifecycleStatus === 'active' &&
      r.leadActivityStatus === 'active' &&
      r.ownerDtId != null &&
      activeDtIdSet.has(r.ownerDtId)
  );
}

export interface RebalanceExecuteResult {
  success: boolean;
  message: string;
  leadsReassigned: number;
  followupsReassigned: number;
}

function aggregateCountsByDt(
  rows: ClassifiedFollowupRow[],
  activeDtIds: string[],
  dtNames: Map<string, string>
): RebalanceDtRow[] {
  const byDt = new Map<string, RebalanceDtRow>();
  for (const dtId of activeDtIds) {
    byDt.set(dtId, {
      dtId,
      dtName: dtNames.get(dtId) ?? dtId,
      reassignableTodaysDue: 0,
      nonReassignableTodaysDue: 0,
      reassignableOverdue: 0,
      nonReassignableOverdue: 0,
    });
  }

  for (const row of rows) {
    const owner = row.ownerDtId;
    if (!owner || !byDt.has(owner)) continue;
    const entry = byDt.get(owner)!;
    const isReassignable = row.bucket === 'reassignable';
    const isToday = row.dueBucket === 'today';
    if (isReassignable && isToday) entry.reassignableTodaysDue++;
    else if (isReassignable) entry.reassignableOverdue++;
    else if (isToday) entry.nonReassignableTodaysDue++;
    else entry.nonReassignableOverdue++;
  }

  return activeDtIds.map((id) => byDt.get(id)!);
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

export async function getActiveDietitians() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true)))
    .orderBy(users.id);
}

async function fetchClassifiedFollowups(brand: Awaited<ReturnType<typeof getCrmBrandFromCookie>>): Promise<ClassifiedFollowupRow[]> {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());

  const rows = await db
    .select({
      followupId: leadLifecycleFollowups.id,
      followupNumber: leadLifecycleFollowups.followup_number,
      attemptCount: leadLifecycleFollowups.attempt_count,
      scheduledDate: leadLifecycleFollowups.scheduled_date,
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
        lte(leadLifecycleFollowups.scheduled_date, dayEnd),
        isNotNull(leads.assigned_dt_id),
        leadMatchesCrmBrand(brand)
      )
    );

  return rows.map((r) => {
    const ownerDtId = r.leadAssignedDtId;
    const currentDtId = r.followupAssignedDtId ?? r.leadAssignedDtId;
    const bucket = classifyRebalanceFollowup({
      followupNumber: r.followupNumber,
      attemptCount: r.attemptCount,
      lifecycleStatus: r.lifecycleStatus,
      leadActivityStatus: r.leadActivityStatus,
    });
    return {
      followupId: r.followupId,
      leadId: r.leadId,
      followupNumber: r.followupNumber,
      ownerDtId,
      lifecycleStatus: r.lifecycleStatus,
      leadActivityStatus: r.leadActivityStatus,
      bucket,
      dueBucket: dueBucketFromScheduled(r.scheduledDate, dayStart, dayEnd),
      currentDtId,
    };
  });
}

export async function getRebalancePreviewData() {
  const brand = await getCrmBrandFromCookie();
  const activeDTs = await getActiveDietitians();
  const activeDtIds = activeDTs.map((d) => d.id);
  const activeDtIdSet = new Set(activeDtIds);
  const dtNames = new Map(activeDTs.map((d) => [d.id, d.name]));

  const classified = await fetchClassifiedFollowups(brand);
  const uiRows = filterRowsForUiCounts(classified, activeDtIdSet);
  const dts = aggregateCountsByDt(uiRows, activeDtIds, dtNames);
  const poolSummary = summarizeClassifiedRows(uiRows, activeDtIdSet);

  const rebalanceConfig: RebalanceConfig = {
    label: "Today's Calls",
    description:
      'Pending followups due today or overdue. Only FU0 with zero attempts in the active pipeline can be redistributed.',
    dts,
  };

  return {
    activeDTs,
    rebalanceConfig,
    poolSummary,
    classified,
    uiRows,
  };
}

async function executeRebalance(
  activeDtIds: string[],
  percentages: Map<string, number>,
  classified: ClassifiedFollowupRow[]
): Promise<{ leadsReassigned: number; followupsReassigned: number }> {
  const locked = classified.filter((r) => r.bucket === 'locked');
  const eligible = dedupeEligibleByLead(classified.filter((r) => r.bucket === 'reassignable'));

  const nonEligibleByDt = new Map<string, number>();
  for (const dtId of activeDtIds) nonEligibleByDt.set(dtId, 0);
  for (const row of locked) {
    if (row.ownerDtId && nonEligibleByDt.has(row.ownerDtId)) {
      nonEligibleByDt.set(row.ownerDtId, (nonEligibleByDt.get(row.ownerDtId) ?? 0) + 1);
    }
  }

  const { targetStage0ByDt } = buildStage0PlanFromPercentages(
    activeDtIds,
    nonEligibleByDt,
    eligible.length,
    percentages
  );

  const { plannedTargets } = buildPlannedTargetsFromStage0Targets(
    activeDtIds,
    eligible,
    targetStage0ByDt
  );

  let leadsReassigned = 0;
  let followupsReassigned = 0;
  const now = new Date();

  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i];
    const targetDtId = plannedTargets[i];
    const current = row.currentDtId;
    if (!targetDtId || current === targetDtId) continue;

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

    leadsReassigned++;
    followupsReassigned++;
  }

  return { leadsReassigned, followupsReassigned };
}

export async function rebalanceByPercentages(
  percentagesInput: { dtId: string; percentage: number }[]
): Promise<RebalanceExecuteResult> {
  const activeDTs = await getActiveDietitians();
  if (activeDTs.length === 0) {
    return {
      success: false,
      message: 'No active agents found',
      leadsReassigned: 0,
      followupsReassigned: 0,
    };
  }

  const activeDtIds = activeDTs.map((d) => d.id);
  const dtIdSet = new Set(activeDtIds);
  const sum = percentagesInput.reduce((s, p) => s + p.percentage, 0);
  if (Math.abs(sum - 100) > 0.01) {
    return {
      success: false,
      message: `Percentages must total 100% (got ${sum.toFixed(1)}%)`,
      leadsReassigned: 0,
      followupsReassigned: 0,
    };
  }
  for (const p of percentagesInput) {
    if (!dtIdSet.has(p.dtId)) {
      return {
        success: false,
        message: `Invalid agent id: ${p.dtId}`,
        leadsReassigned: 0,
        followupsReassigned: 0,
      };
    }
  }

  const brand = await getCrmBrandFromCookie();
  const classified = await fetchClassifiedFollowups(brand);
  const percentages = new Map(percentagesInput.map((p) => [p.dtId, p.percentage]));

  const { leadsReassigned, followupsReassigned } = await executeRebalance(
    activeDtIds,
    percentages,
    classified
  );

  return {
    success: true,
    message: `Rebalanced ${leadsReassigned} lead(s) and ${followupsReassigned} followup(s).`,
    leadsReassigned,
    followupsReassigned,
  };
}
