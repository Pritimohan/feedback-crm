import { followupUiLabel } from '@/lib/utils/followupUiLabel';

/** Same as DT UI: DB `followup_number` 0 → "Follow-up 1" (used in admin analytics APIs and charts). */
export function followupStageLabel(followupNumber: number): string {
  if (followupNumber < 0 || !Number.isFinite(followupNumber)) return '—';
  return followupUiLabel(followupNumber);
}

export const FOLLOWUP_STAGE_LABELS: Record<number, string> = {
  0: followupStageLabel(0),
  1: followupStageLabel(1),
  2: followupStageLabel(2),
};
