import {
  getDefaultLifecycleConfig,
  getTypeConfigFromBundle,
  type LeadTypeId,
  type LifecycleConfigBundle,
} from '@/lib/lifecycleDefaults';

/** Inclusive highest `followup_number` stored for a lifecycle (0-based stages: 0, 1, …, MAX). */
export const MAX_FOLLOWUP_NUMBER = 3;

/** Number of follow-up stages (e.g. 4 stages: numbers 0..3). */
export const FOLLOWUP_STAGE_COUNT = MAX_FOLLOWUP_NUMBER + 1;

export function getMaxFollowupNumber(
  leadType: LeadTypeId,
  bundle?: LifecycleConfigBundle
): number {
  const config = bundle ?? getDefaultLifecycleConfig();
  return getTypeConfigFromBundle(config, leadType).lastFollowupNumber;
}
