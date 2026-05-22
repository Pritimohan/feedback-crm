import type { RebalanceDtRow } from '@/lib/rebalance/rebalanceDistribution.types';

export const getReassignableTotal = (dt: RebalanceDtRow) =>
  dt.reassignableTodaysDue + dt.reassignableOverdue;

export const getLockedTotal = (dt: RebalanceDtRow) =>
  dt.nonReassignableTodaysDue + dt.nonReassignableOverdue;

export const getCurrentTotal = (dt: RebalanceDtRow) =>
  getReassignableTotal(dt) + getLockedTotal(dt);
