import type { LifecycleStageConfig } from '@/lib/lifecycleDefaults';

function resizeAttemptSchedule(stage: LifecycleStageConfig, maxAttempts: number): number[] {
  const current = [...stage.attemptScheduleDaysFromAnchor];
  while (current.length < maxAttempts) {
    const prev = current[current.length - 1] ?? stage.initialScheduleDays;
    current.push(prev + 1);
  }
  return current.slice(0, maxAttempts);
}

export function applyMaxAttempts(
  stage: LifecycleStageConfig,
  maxAttempts: number
): LifecycleStageConfig {
  const schedule = resizeAttemptSchedule(stage, maxAttempts);
  for (let i = 1; i < schedule.length; i++) {
    if (schedule[i] < schedule[i - 1]) {
      schedule[i] = schedule[i - 1] + 1;
    }
  }
  return {
    ...stage,
    maxAttempts,
    attemptScheduleDaysFromAnchor: schedule,
  };
}

/** Derive uniform retry gap from schedule (first diff between consecutive entries). */
export function deriveRetryGapDays(stage: LifecycleStageConfig): number {
  const schedule = stage.attemptScheduleDaysFromAnchor;
  if (schedule.length < 2) return 1;
  const gap = schedule[1] - schedule[0];
  return gap >= 1 ? gap : 1;
}

/** Build a non-decreasing uniform schedule: [0, gap, 2*gap, ...] */
export function buildUniformSchedule(maxAttempts: number, gapDays: number): number[] {
  const gap = Math.max(1, gapDays);
  return Array.from({ length: maxAttempts }, (_, i) => i * gap);
}

export function applyUniformRetryGap(
  stage: LifecycleStageConfig,
  gapDays: number
): LifecycleStageConfig {
  const schedule = buildUniformSchedule(stage.maxAttempts, gapDays);
  return { ...stage, attemptScheduleDaysFromAnchor: schedule };
}
