import { MAX_ATTEMPTS_PER_DAY, NEXT_DAY_RETRY_HOUR, RETRY_AFTER_HOURS, REVIEW_MAX_ATTEMPTS } from '@/lib/utils/lifecycleConstants';

export interface LifecycleTemplate {
  key: string;
  version: number;
  firstFollowupOffsetDays: number;
  nextFollowupOffsetDays: number;
  maxAttemptsByLeadType: Record<'nps' | 'review', number>;
}

export const DEFAULT_LEAD_LIFECYCLE_TEMPLATE: LifecycleTemplate = {
  key: 'review_followup',
  version: 1,
  firstFollowupOffsetDays: 0,
  nextFollowupOffsetDays: 1,
  maxAttemptsByLeadType: {
    nps: REVIEW_MAX_ATTEMPTS,
    review: REVIEW_MAX_ATTEMPTS,
  },
};

export function scheduleInitialFollowup(anchorDate: Date): Date {
  const scheduled = new Date(anchorDate);
  scheduled.setDate(scheduled.getDate() + DEFAULT_LEAD_LIFECYCLE_TEMPLATE.firstFollowupOffsetDays);
  return scheduled;
}

export function scheduleNextFollowupFromConnected(referenceDate: Date): Date {
  const scheduled = new Date(referenceDate);
  scheduled.setDate(scheduled.getDate() + DEFAULT_LEAD_LIFECYCLE_TEMPLATE.nextFollowupOffsetDays);
  return scheduled;
}

export function computeRetrySchedule(params: { now: Date; attemptsToday: number }): Date {
  const { now, attemptsToday } = params;

  if (attemptsToday >= MAX_ATTEMPTS_PER_DAY) {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(NEXT_DAY_RETRY_HOUR, 0, 0, 0);
    return nextDay;
  }

  const retry = new Date(now);
  retry.setHours(retry.getHours() + RETRY_AFTER_HOURS);
  return retry;
}
