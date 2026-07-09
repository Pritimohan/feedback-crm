/**
 * Lifecycle config unit tests — run with: npm run test:lifecycle-config
 */
import { getDefaultLifecycleConfig } from '@/lib/lifecycleDefaults';
import {
  parseLifecycleConfigBundle,
  lifecycleConfigBundleSchema,
} from '@/lib/schemas/lifecycleConfigSchema';
import {
  computeInitialFollowupSchedule,
  computeConnectedAdvanceSchedule,
  computeScheduledDateForAttempt,
  getRetryGapDays,
} from '@/lib/services/lifecycleConfigService';
import {
  INITIAL_FOLLOWUP_CUTOFF_HOUR,
  NEXT_DAY_RETRY_HOUR,
  RETRY_AFTER_DAYS,
  REVIEW_MAX_ATTEMPTS,
} from '@/lib/utils/lifecycleConstants';
import {
  ensureBusinessDayScheduledDate,
  isSundayInSchedulingTz,
} from '@/lib/utils/schedulingDates';
import {
  scheduleInitialFollowup,
  scheduleInitialFollowupNextCalendarDay,
  scheduleNextFollowupFromConnected,
  computeRetrySchedule,
} from '@/lib/lifecycle/leadLifecycleSchedule';
import { getMaxFollowupNumber } from '@/lib/lifecycle/followupStageBounds';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  OK: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (expected ${expected}, got ${actual})`);
}

console.log('\n=== Lifecycle config tests ===\n');

const defaults = getDefaultLifecycleConfig();

console.log('-- Defaults match legacy constants --');
assertEq(defaults.global.retryAfterDays, RETRY_AFTER_DAYS, 'retryAfterDays');
assertEq(defaults.global.nextDayRetryHour, NEXT_DAY_RETRY_HOUR, 'nextDayRetryHour');
assertEq(defaults.global.initialFollowupCutoffHour, INITIAL_FOLLOWUP_CUTOFF_HOUR, 'cutoff hour');
assertEq(defaults.review.stages[0].maxAttempts, REVIEW_MAX_ATTEMPTS, 'review stage0 maxAttempts');
assertEq(defaults.feedback.lastFollowupNumber, 0, 'feedback lastFollowupNumber');
assertEq(defaults.review.lastFollowupNumber, 3, 'review lastFollowupNumber');
assertEq(getMaxFollowupNumber('feedback', defaults), 0, 'getMaxFollowupNumber feedback');
assertEq(getMaxFollowupNumber('review', defaults), 3, 'getMaxFollowupNumber review');

console.log('\n-- Schema validation --');
parseLifecycleConfigBundle(defaults);
assert(defaults.review.stages.length === 4, 'parsed review stages');

const invalid = lifecycleConfigBundleSchema.safeParse({
  ...defaults,
  review: {
    ...defaults.review,
    stages: [
      {
        ...defaults.review.stages[0],
        maxAttempts: 3,
        attemptScheduleDaysFromAnchor: [1, 2],
      },
    ],
  },
});
assert(!invalid.success, 'rejects mismatched attempt array length');

console.log('\n-- Scheduling math --');
const stage0 = defaults.review.stages[0];

const beforeCutoff = computeInitialFollowupSchedule({
  anchorDate: new Date(2026, 0, 1, 18, 59, 0, 0),
  global: defaults.global,
});
assertEq(beforeCutoff.getDate(), 1, 'before cutoff same day');

const atCutoff = computeInitialFollowupSchedule({
  anchorDate: new Date(2026, 0, 1, 19, 0, 0, 0),
  global: defaults.global,
});
assertEq(atCutoff.getDate(), 2, 'at cutoff next day');
assertEq(atCutoff.getHours(), 9, 'at cutoff 9am');

const nextCal = scheduleInitialFollowupNextCalendarDay(new Date(2026, 0, 1, 10, 0, 0));
assertEq(nextCal.getDate(), 2, 'next calendar day schedule');
assertEq(nextCal.getHours(), 9, 'next calendar day 9am');

const now = new Date('2026-01-01T10:00:00.000Z');
const retry = computeRetrySchedule({ now, nextAttemptCount: 2, lastAttemptDate: now });
assertEq(retry.getHours(), 9, 'retry at 9am');

const fittyAdvance = scheduleNextFollowupFromConnected({
  referenceDate: new Date(2026, 0, 1, 10, 0, 0),
  brand: 'fitty',
  bundle: defaults,
});
assertEq(fittyAdvance.getDate(), 4, 'fitty connected +3 days');

const defaultAdvance = scheduleNextFollowupFromConnected({
  referenceDate: new Date(2026, 0, 1, 10, 0, 0),
  brand: null,
  bundle: defaults,
  stageDaysAfterPriorConnection: 1,
});
assertEq(defaultAdvance.getDate(), 2, 'default connected +1 day');

const retryScheduled = computeScheduledDateForAttempt({
  stage: stage0,
  global: defaults.global,
  nextAttemptCount: 2,
  anchorDate: now,
  lastAttemptDate: now,
});
assertEq(getRetryGapDays(stage0, 2), RETRY_AFTER_DAYS, 'retry gap from stage');
assert(retryScheduled.getHours() === 9, 'retry scheduled at 9am');

console.log('\n-- Busy reschedule scheduling --');
const preferredSlot = new Date(2026, 5, 15, 14, 0, 0, 0);
const resolvedPreferred = ensureBusinessDayScheduledDate(preferredSlot);
assertEq(resolvedPreferred.getDate(), 15, 'weekday preferred date unchanged');
assertEq(resolvedPreferred.getHours(), 14, 'weekday preferred time preserved');

const sundayIst = new Date('2026-06-28T08:30:00.000Z');
assert(isSundayInSchedulingTz(sundayIst), 'Sunday detected in IST');
const mondayFromSunday = ensureBusinessDayScheduledDate(sundayIst);
assert(!isSundayInSchedulingTz(mondayFromSunday), 'ensureBusinessDay moves off Sunday');
assert(
  ensureBusinessDayScheduledDate(new Date('2026-06-29T08:30:00.000Z')).getTime() ===
    new Date('2026-06-29T08:30:00.000Z').getTime(),
  'Monday unchanged'
);

const autoRetryBusy = computeScheduledDateForAttempt({
  stage: stage0,
  global: defaults.global,
  nextAttemptCount: 2,
  anchorDate: now,
  lastAttemptDate: now,
});
assertEq(autoRetryBusy.getHours(), 9, 'busy cancel path uses retry schedule at 9am');
assert(getRetryGapDays(stage0, 2) === RETRY_AFTER_DAYS, 'busy cancel uses configured retry gap');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
