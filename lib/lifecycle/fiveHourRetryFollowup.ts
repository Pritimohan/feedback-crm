import { RETRY_AFTER_HOURS } from '@/lib/utils/lifecycleConstants';

export const PENDING_RETRY_SCHEDULE_5H = '5h' as const;

export type FollowupFiveHourRetryFields = {
  attempt_count: number;
  scheduled_date: Date | string;
  updated_at?: Date | string | null;
  payload?: unknown;
};

/** Busy/no-answer same-day retry rescheduled +{@link RETRY_AFTER_HOURS}h (not next-day 9am). */
export function isFiveHourRetryFollowup(followup: FollowupFiveHourRetryFields): boolean {
  if (Number(followup.attempt_count) < 1) return false;

  const payload = followup.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if ((payload as Record<string, unknown>).pending_retry_schedule === PENDING_RETRY_SCHEDULE_5H) {
      return true;
    }
  }

  const updatedAt = followup.updated_at ? new Date(followup.updated_at).getTime() : NaN;
  const scheduled = new Date(followup.scheduled_date).getTime();
  if (!Number.isFinite(updatedAt) || !Number.isFinite(scheduled)) return false;

  const expectedMs = updatedAt + RETRY_AFTER_HOURS * 60 * 60 * 1000;
  return Math.abs(scheduled - expectedMs) <= 2 * 60 * 1000;
}

export function mergeFollowupPayloadForFiveHourRetry(
  existing: unknown,
  scheduledDate: Date
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    pending_retry_schedule: PENDING_RETRY_SCHEDULE_5H,
    five_hour_retry_scheduled_at: scheduledDate.toISOString(),
  };
}
