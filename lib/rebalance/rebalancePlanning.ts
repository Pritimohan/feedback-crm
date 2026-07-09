import { allocateByPercentagesMap } from '@/lib/rebalance/allocateByPercentages';

export interface WeightedStage0Plan {
  targetStage0ByDt: Map<string, number>;
  allocatedByDt: Map<string, number>;
  projectedLoads: Map<string, number>;
}

export function buildStage0PlanFromPercentages(
  activeDtIds: string[],
  nonEligibleByDt: Map<string, number>,
  totalEligible: number,
  percentages: Map<string, number>
): WeightedStage0Plan {
  const targetStage0ByDt = allocateByPercentagesMap(totalEligible, activeDtIds, percentages);
  const allocatedByDt = new Map<string, number>();
  const projectedLoads = new Map<string, number>();

  for (const dtId of activeDtIds) {
    allocatedByDt.set(dtId, 0);
    const locked = nonEligibleByDt.get(dtId) ?? 0;
    const stage0 = targetStage0ByDt.get(dtId) ?? 0;
    projectedLoads.set(dtId, locked + stage0);
  }

  return { targetStage0ByDt, allocatedByDt, projectedLoads };
}

/** Equalize final total today load: stage-0 pool fills gap to per-DT final targets. */
export function buildEqualTotalStage0Plan(
  activeDtIds: string[],
  nonEligibleByDt: Map<string, number>,
  totalEligible: number
): WeightedStage0Plan {
  const targetStage0ByDt = new Map<string, number>();
  const allocatedByDt = new Map<string, number>();
  const projectedLoads = new Map<string, number>();
  for (const dtId of activeDtIds) {
    targetStage0ByDt.set(dtId, 0);
    allocatedByDt.set(dtId, 0);
    projectedLoads.set(dtId, nonEligibleByDt.get(dtId) ?? 0);
  }

  if (activeDtIds.length === 0 || totalEligible <= 0) {
    return { targetStage0ByDt, allocatedByDt, projectedLoads };
  }

  const totalFixed = activeDtIds.reduce((sum, dtId) => sum + (nonEligibleByDt.get(dtId) ?? 0), 0);
  const totalFinal = totalFixed + totalEligible;
  const dtCount = activeDtIds.length;
  const base = Math.floor(totalFinal / dtCount);
  let extra = totalFinal % dtCount;

  const sortedByFixedAsc = [...activeDtIds].sort((a, b) => {
    const diff = (nonEligibleByDt.get(a) ?? 0) - (nonEligibleByDt.get(b) ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  const finalTargetByDt = new Map<string, number>();
  for (const dtId of sortedByFixedAsc) {
    const finalTarget = base + (extra > 0 ? 1 : 0);
    finalTargetByDt.set(dtId, finalTarget);
    if (extra > 0) extra--;
  }

  for (const dtId of activeDtIds) {
    const finalTarget = finalTargetByDt.get(dtId) ?? base;
    const fixed = nonEligibleByDt.get(dtId) ?? 0;
    targetStage0ByDt.set(dtId, Math.max(finalTarget - fixed, 0));
  }

  const stage0Sum = activeDtIds.reduce((sum, dtId) => sum + (targetStage0ByDt.get(dtId) ?? 0), 0);
  let delta = totalEligible - stage0Sum;
  let idx = 0;
  while (delta !== 0 && sortedByFixedAsc.length > 0) {
    const dtId = sortedByFixedAsc[idx % sortedByFixedAsc.length];
    const current = targetStage0ByDt.get(dtId) ?? 0;
    if (delta > 0) {
      targetStage0ByDt.set(dtId, current + 1);
      delta--;
    } else if (current > 0) {
      targetStage0ByDt.set(dtId, current - 1);
      delta++;
    }
    idx++;
  }

  for (const dtId of activeDtIds) {
    projectedLoads.set(dtId, (nonEligibleByDt.get(dtId) ?? 0) + (targetStage0ByDt.get(dtId) ?? 0));
  }

  return { targetStage0ByDt, allocatedByDt, projectedLoads };
}

export function buildPlannedTargetsFromStage0Targets(
  activeDtIds: string[],
  eligibleRows: Array<{ currentDtId: string | null }>,
  targetStage0ByDt: Map<string, number>
): { plannedTargets: string[]; allocatedByDt: Map<string, number> } {
  const remainingByDt = new Map<string, number>();
  const allocatedByDt = new Map<string, number>();
  for (const dtId of activeDtIds) {
    remainingByDt.set(dtId, targetStage0ByDt.get(dtId) ?? 0);
    allocatedByDt.set(dtId, 0);
  }

  const plannedTargets = new Array<string>(eligibleRows.length);
  const unassignedIndexes: number[] = [];

  for (let i = 0; i < eligibleRows.length; i++) {
    const row = eligibleRows[i];
    const current = row.currentDtId;
    if (!current || !remainingByDt.has(current) || (remainingByDt.get(current) ?? 0) <= 0) {
      unassignedIndexes.push(i);
      continue;
    }

    plannedTargets[i] = current;
    remainingByDt.set(current, (remainingByDt.get(current) ?? 0) - 1);
    allocatedByDt.set(current, (allocatedByDt.get(current) ?? 0) + 1);
  }

  for (const idx of unassignedIndexes) {
    let chosen = activeDtIds[0];
    for (const dtId of activeDtIds) {
      const chosenRemaining = remainingByDt.get(chosen) ?? 0;
      const candidateRemaining = remainingByDt.get(dtId) ?? 0;
      if (candidateRemaining > chosenRemaining) {
        chosen = dtId;
        continue;
      }
      if (candidateRemaining < chosenRemaining) continue;
      if (dtId.localeCompare(chosen) < 0) chosen = dtId;
    }

    plannedTargets[idx] = chosen;
    remainingByDt.set(chosen, Math.max(0, (remainingByDt.get(chosen) ?? 0) - 1));
    allocatedByDt.set(chosen, (allocatedByDt.get(chosen) ?? 0) + 1);
  }

  return { plannedTargets, allocatedByDt };
}
