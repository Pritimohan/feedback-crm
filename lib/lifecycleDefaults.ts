/**
 * Default lifecycle configuration — mirrors hardcoded behavior in lifecycleConstants.ts
 * and leadLifecycleSchedule.ts before admin overrides.
 */

import {
  INITIAL_FOLLOWUP_CUTOFF_HOUR,
  NEXT_DAY_RETRY_HOUR,
  RETRY_AFTER_DAYS,
  REVIEW_MAX_ATTEMPTS,
} from '@/lib/utils/lifecycleConstants';

export type LeadTypeId = 'nps' | 'review' | 'feedback';

export type ScheduleAnchor = 'lifecycle_start';

export type LifecycleStageConfig = {
  followupNumber: number;
  label: string;
  maxAttempts: number;
  initialScheduleDays: number;
  attemptScheduleDaysFromAnchor: number[];
  daysAfterPriorConnection?: number;
};

export type LifecycleTypeConfig = {
  leadType: LeadTypeId;
  lastFollowupNumber: number;
  stages: LifecycleStageConfig[];
  scheduleAnchor: ScheduleAnchor;
};

export type LifecycleGlobalSettings = {
  retryAfterDays: number;
  nextDayRetryHour: number;
  initialFollowupCutoffHour: number;
  firstFollowupOffsetDays: number;
  brandConnectedAdvanceDays: {
    fitty: number;
    fitelo: number;
    default: number;
  };
};

export type LifecycleConfigBundle = {
  global: LifecycleGlobalSettings;
  nps: LifecycleTypeConfig;
  review: LifecycleTypeConfig;
  feedback: LifecycleTypeConfig;
};

function buildUniformRetrySchedule(maxAttempts: number, gapDays: number): number[] {
  return Array.from({ length: maxAttempts }, (_, i) => i * gapDays);
}

function buildMultiStageConfig(
  leadType: 'nps' | 'review',
  stageLabels: string[]
): LifecycleTypeConfig {
  const lastFollowupNumber = stageLabels.length - 1;
  const stages: LifecycleStageConfig[] = stageLabels.map((label, followupNumber) => ({
    followupNumber,
    label,
    maxAttempts: REVIEW_MAX_ATTEMPTS,
    initialScheduleDays: 0,
    attemptScheduleDaysFromAnchor: buildUniformRetrySchedule(REVIEW_MAX_ATTEMPTS, RETRY_AFTER_DAYS),
    ...(followupNumber > 0 ? { daysAfterPriorConnection: 1 } : {}),
  }));

  return {
    leadType,
    lastFollowupNumber,
    scheduleAnchor: 'lifecycle_start',
    stages,
  };
}

function buildFeedbackConfig(): LifecycleTypeConfig {
  return {
    leadType: 'feedback',
    lastFollowupNumber: 0,
    scheduleAnchor: 'lifecycle_start',
    stages: [
      {
        followupNumber: 0,
        label: 'Collect product feedback',
        maxAttempts: REVIEW_MAX_ATTEMPTS,
        initialScheduleDays: 0,
        attemptScheduleDaysFromAnchor: buildUniformRetrySchedule(REVIEW_MAX_ATTEMPTS, RETRY_AFTER_DAYS),
      },
    ],
  };
}

export function getDefaultLifecycleConfig(): LifecycleConfigBundle {
  const reviewStages = [
    'Collect first review feedback',
    'Nudge review completion',
    'Final review reminder — close review cycle',
    'General follow-up',
  ];
  const npsStages = [
    'Collect NPS baseline',
    'Follow up NPS response',
    'Close NPS conversation — final closure',
    'General follow-up',
  ];

  return {
    global: {
      retryAfterDays: RETRY_AFTER_DAYS,
      nextDayRetryHour: NEXT_DAY_RETRY_HOUR,
      initialFollowupCutoffHour: INITIAL_FOLLOWUP_CUTOFF_HOUR,
      firstFollowupOffsetDays: 0,
      brandConnectedAdvanceDays: {
        fitty: 3,
        fitelo: 3,
        default: 1,
      },
    },
    review: buildMultiStageConfig('review', reviewStages),
    nps: buildMultiStageConfig('nps', npsStages),
    feedback: buildFeedbackConfig(),
  };
}

export function getTypeConfigFromBundle(
  bundle: LifecycleConfigBundle,
  leadType: LeadTypeId
): LifecycleTypeConfig {
  return bundle[leadType];
}

export function getConnectedAdvanceDays(
  global: LifecycleGlobalSettings,
  brand?: string | null
): number {
  if (brand === 'fitty') return global.brandConnectedAdvanceDays.fitty;
  if (brand === 'fitelo') return global.brandConnectedAdvanceDays.fitelo;
  return global.brandConnectedAdvanceDays.default;
}
