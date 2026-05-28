import {
  FITTELO_RETRY_DAYS_AFTER_DAILY_CAP,
  INITIAL_FOLLOWUP_CUTOFF_HOUR,
  MAX_ATTEMPTS_PER_DAY,
  NEXT_DAY_RETRY_HOUR,
  RETRY_AFTER_HOURS,
  REVIEW_MAX_ATTEMPTS,
} from '@/lib/utils/lifecycleConstants';

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
  if (scheduled.getHours() >= INITIAL_FOLLOWUP_CUTOFF_HOUR) {
    scheduled.setDate(scheduled.getDate() + 1);
    scheduled.setHours(NEXT_DAY_RETRY_HOUR, 0, 0, 0);
  }
  return scheduled;
}

/** First follow-up always the next calendar day at {@link NEXT_DAY_RETRY_HOUR} (warranty / dietplan APIs). */
export function scheduleInitialFollowupNextCalendarDay(anchorDate: Date): Date {
  const scheduled = new Date(anchorDate);
  scheduled.setDate(scheduled.getDate() + 1);
  scheduled.setHours(NEXT_DAY_RETRY_HOUR, 0, 0, 0);
  return scheduled;
}

const INTERESTED_NEXT_FOLLOWUP_DAYS = 3;

function getFittyNextFollowupOffsetDays(_currentFollowupNumber: number): number {
  return INTERESTED_NEXT_FOLLOWUP_DAYS;
}

export function scheduleNextFollowupFromConnected(params: {
  referenceDate: Date;
  brand?: string | null;
  currentFollowupNumber?: number;
}): Date {
  const { referenceDate, brand, currentFollowupNumber } = params;
  const scheduled = new Date(referenceDate);
  const offsetDays =
    (brand === 'fitty' || brand === 'fitelo') && typeof currentFollowupNumber === 'number'
      ? getFittyNextFollowupOffsetDays(currentFollowupNumber)
      : DEFAULT_LEAD_LIFECYCLE_TEMPLATE.nextFollowupOffsetDays;
  scheduled.setDate(scheduled.getDate() + offsetDays);
  return scheduled;
}

export function computeRetrySchedule(params: {
  now: Date;
  attemptsToday: number;
  brand?: string | null;
}): Date {
  const { now, attemptsToday, brand } = params;

  if (attemptsToday >= MAX_ATTEMPTS_PER_DAY) {
    const nextDay = new Date(now);
    const dayOffset = brand === 'fitelo' ? FITTELO_RETRY_DAYS_AFTER_DAILY_CAP : 1;
    nextDay.setDate(nextDay.getDate() + dayOffset);
    nextDay.setHours(NEXT_DAY_RETRY_HOUR, 0, 0, 0);
    return nextDay;
  }

  const retry = new Date(now);
  retry.setHours(retry.getHours() + RETRY_AFTER_HOURS);
  return retry;
}
