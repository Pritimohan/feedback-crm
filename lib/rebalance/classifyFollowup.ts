export type DueBucket = 'today' | 'overdue';
export type RebalanceBucket = 'reassignable' | 'locked';

export interface ClassifyInput {
  followupNumber: number;
  attemptCount: number;
  lifecycleStatus: string;
  leadActivityStatus: string;
}

/** FU0 + zero attempts + active lifecycle + active lead → reassignable. */
export function classifyRebalanceFollowup(input: ClassifyInput): RebalanceBucket {
  if (input.lifecycleStatus !== 'active') return 'locked';
  if (input.leadActivityStatus !== 'active') return 'locked';
  if (input.followupNumber !== 0) return 'locked';
  if (input.attemptCount !== 0) return 'locked';
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
