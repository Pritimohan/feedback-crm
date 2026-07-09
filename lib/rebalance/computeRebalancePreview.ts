import { allocateByPercentagesMap } from '@/lib/rebalance/allocateByPercentages';
import {
  getReassignableTotal,
  getLockedTotal,
  getCurrentTotal,
} from '@/lib/rebalance/buildRebalanceDistribution';
import type { RebalanceDtRow } from '@/lib/rebalance/rebalanceDistribution.types';

export interface AfterDistributionRow extends RebalanceDtRow {
  currentTotal: number;
  reassignableTotal: number;
  lockedTotal: number;
  redistTotal: number | null;
  afterTotal: number | null;
}

function buildPercentageMap(
  tableRows: RebalanceDtRow[],
  percentages: Record<string, number | null>
): Map<string, number> | null {
  for (const dt of tableRows) {
    if (percentages[dt.dtId] === null || percentages[dt.dtId] === undefined) {
      return null;
    }
  }
  return new Map(tableRows.map((dt) => [dt.dtId, percentages[dt.dtId] as number]));
}

function rowsFromAllocation(
  tableRows: RebalanceDtRow[],
  alloc: Map<string, number>
): AfterDistributionRow[] {
  return tableRows.map((dt) => {
    const lockedTotal = getLockedTotal(dt);
    const redistTotal = alloc.get(dt.dtId) ?? 0;
    return {
      ...dt,
      currentTotal: getCurrentTotal(dt),
      reassignableTotal: getReassignableTotal(dt),
      lockedTotal,
      redistTotal,
      afterTotal: redistTotal + lockedTotal,
    };
  });
}

function rowsWithoutAllocation(tableRows: RebalanceDtRow[]): AfterDistributionRow[] {
  return tableRows.map((dt) => ({
    ...dt,
    currentTotal: getCurrentTotal(dt),
    reassignableTotal: getReassignableTotal(dt),
    lockedTotal: getLockedTotal(dt),
    redistTotal: null,
    afterTotal: null,
  }));
}

export function computeAfterDistribution(
  tableRows: RebalanceDtRow[],
  percentages: Record<string, number | null>,
  poolSizes?: { totalReassignable?: number }
): AfterDistributionRow[] {
  if (tableRows.length === 0) return [];

  const pctMap = buildPercentageMap(tableRows, percentages);
  if (!pctMap) return rowsWithoutAllocation(tableRows);

  const activeDtIds = tableRows.map((d) => d.dtId);
  const pool =
    poolSizes?.totalReassignable ??
    tableRows.reduce((s, d) => s + getReassignableTotal(d), 0);
  const alloc = allocateByPercentagesMap(pool, activeDtIds, pctMap);
  return rowsFromAllocation(tableRows, alloc);
}
