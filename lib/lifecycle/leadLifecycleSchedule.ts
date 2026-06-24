import {
  computeConnectedAdvanceSchedule,
  computeInitialFollowupSchedule,
  computeScheduledDateForAttempt,
  getDefaultLifecycleConfigBundle,
} from '@/lib/services/lifecycleConfigService';
import type { LifecycleConfigBundle, LifecycleGlobalSettings } from '@/lib/lifecycleDefaults';
import {
  INITIAL_FOLLOWUP_CUTOFF_HOUR,
  NEXT_DAY_RETRY_HOUR,
  RETRY_AFTER_DAYS,
  REVIEW_MAX_ATTEMPTS,
} from '@/lib/utils/lifecycleConstants';

export interface LifecycleTemplate {
  key: string;
  version: number;
  firstFollowupOffsetDays: number;
  nextFollowupOffsetDays: number;
  maxAttemptsByLeadType: Record<'nps' | 'review' | 'feedback', number>;
}

const defaultBundle = getDefaultLifecycleConfigBundle();

export const DEFAULT_LEAD_LIFECYCLE_TEMPLATE: LifecycleTemplate = {
  key: 'review_followup',
  version: 1,
  firstFollowupOffsetDays: defaultBundle.global.firstFollowupOffsetDays,
  nextFollowupOffsetDays: defaultBundle.global.brandConnectedAdvanceDays.default,
  maxAttemptsByLeadType: {
    nps: REVIEW_MAX_ATTEMPTS,
    review: REVIEW_MAX_ATTEMPTS,
    feedback: REVIEW_MAX_ATTEMPTS,
  },
};

function getGlobal(bundle?: LifecycleConfigBundle): LifecycleGlobalSettings {
  return bundle?.global ?? defaultBundle.global;
}

export function scheduleInitialFollowup(anchorDate: Date, bundle?: LifecycleConfigBundle): Date {
  return computeInitialFollowupSchedule({
    anchorDate,
    global: getGlobal(bundle),
  });
}

/** First follow-up always the next calendar day at configured retry hour (warranty / dietplan APIs). */
export function scheduleInitialFollowupNextCalendarDay(
  anchorDate: Date,
  bundle?: LifecycleConfigBundle
): Date {
  return computeInitialFollowupSchedule({
    anchorDate,
    global: getGlobal(bundle),
    scheduleNextCalendarDay: true,
  });
}

export function scheduleNextFollowupFromConnected(params: {
  referenceDate: Date;
  brand?: string | null;
  currentFollowupNumber?: number;
  bundle?: LifecycleConfigBundle;
  stageDaysAfterPriorConnection?: number;
}): Date {
  const { referenceDate, brand, bundle, stageDaysAfterPriorConnection } = params;
  return computeConnectedAdvanceSchedule({
    referenceDate,
    global: getGlobal(bundle),
    brand,
    stageDaysAfterPriorConnection,
  });
}

export function computeRetrySchedule(params: {
  now: Date;
  attemptsToday?: number;
  brand?: string | null;
  bundle?: LifecycleConfigBundle;
  stageMaxAttempts?: number;
  nextAttemptCount?: number;
  lastAttemptDate?: Date;
}): Date {
  const { now, bundle, stageMaxAttempts = REVIEW_MAX_ATTEMPTS, nextAttemptCount = 2 } = params;
  const config = bundle ?? defaultBundle;
  const gap = config.global.retryAfterDays;
  const stage = {
    followupNumber: 0,
    label: '',
    maxAttempts: stageMaxAttempts,
    initialScheduleDays: 0,
    attemptScheduleDaysFromAnchor: Array.from(
      { length: stageMaxAttempts },
      (_, i) => i * gap
    ),
  };

  return computeScheduledDateForAttempt({
    stage,
    global: config.global,
    nextAttemptCount,
    anchorDate: now,
    lastAttemptDate: params.lastAttemptDate ?? now,
  });
}

// Re-export constants for backward compatibility
export { RETRY_AFTER_DAYS, NEXT_DAY_RETRY_HOUR, INITIAL_FOLLOWUP_CUTOFF_HOUR };
