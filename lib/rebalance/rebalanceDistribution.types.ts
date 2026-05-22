export interface RebalanceDtRow {
  dtId: string;
  dtName: string;
  reassignableTodaysDue: number;
  nonReassignableTodaysDue: number;
  reassignableOverdue: number;
  nonReassignableOverdue: number;
}

export interface RebalanceConfig {
  label: string;
  description?: string;
  dts: RebalanceDtRow[];
}

export interface PoolSummary {
  totalLeads: number;
  totalReassignable: number;
  totalLocked: number;
  onInactiveDt: number;
}
