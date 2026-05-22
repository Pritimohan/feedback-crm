import type { PoolSummary } from '@/lib/rebalance/rebalanceDistribution.types';
import type { RebalanceBucket } from '@/lib/rebalance/classifyFollowup';

export interface ClassifiedRowForSummary {
  ownerDtId: string | null;
  bucket: RebalanceBucket;
}

/** Count classified followups for UI stat cards (rows should already be UI-filtered). */
export function summarizeClassifiedRows(
  rows: ClassifiedRowForSummary[],
  activeDtIdSet: Set<string>
): PoolSummary {
  let totalReassignable = 0;
  let totalLocked = 0;
  let onInactiveDt = 0;

  for (const row of rows) {
    const owner = row.ownerDtId;
    if (!owner || !activeDtIdSet.has(owner)) {
      if (owner) onInactiveDt++;
      continue;
    }

    if (row.bucket === 'reassignable') totalReassignable++;
    else totalLocked++;
  }

  return {
    totalLeads: totalReassignable + totalLocked,
    totalReassignable,
    totalLocked,
    onInactiveDt,
  };
}
