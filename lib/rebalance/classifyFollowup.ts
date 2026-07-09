export type DueBucket = 'today' | 'overdue';
export type RebalanceBucket = 'reassignable' | 'locked';

export interface ClassifyInput {
  followupNumber: number;
  attemptCount: number;
  lifecycleStatus: string;
  leadActivityStatus: string;
}

/** FU0 + zero attempts + active lifecycle + active lead → reassignable (admin rebalance). */
export function classifyRebalanceFollowup(input: ClassifyInput): RebalanceBucket {
  if (input.lifecycleStatus !== 'active') return 'locked';
  if (input.leadActivityStatus !== 'active') return 'locked';
  if (input.followupNumber !== 0) return 'locked';
  if (input.attemptCount !== 0) return 'locked';
  return 'reassignable';
}

/** FU0 + active lifecycle + active lead → reassignable (nightly cron; attempts allowed). */
export function classifyNightlyStage0Followup(input: ClassifyInput): RebalanceBucket {
  if (input.lifecycleStatus !== 'active') return 'locked';
  if (input.leadActivityStatus !== 'active') return 'locked';
  if (input.followupNumber !== 0) return 'locked';
  return 'reassignable';
}

export function dueBucketFromScheduled(
  scheduledDate: Date,
  dayStart: Date,
  dayEnd: Date
): DueBucket {
  if (scheduledDate >= dayStart && scheduledDate <= dayEnd) return 'today';
  return 'overdue';
}
