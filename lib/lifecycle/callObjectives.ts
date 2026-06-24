import type { LeadType } from './leadLifecycleValidation';
import {
  getDefaultLifecycleConfig,
  getTypeConfigFromBundle,
  type LifecycleConfigBundle,
} from '@/lib/lifecycleDefaults';

const FALLBACK_OBJECTIVES: Record<LeadType, Record<number, string>> = {
  review: {
    0: 'Collect first review feedback',
    1: 'Nudge review completion',
    2: 'Final review reminder — close review cycle',
  },
  nps: {
    0: 'Collect NPS baseline',
    1: 'Follow up NPS response',
    2: 'Close NPS conversation — final closure',
  },
  feedback: {
    0: 'Collect product feedback',
  },
};

export function getCallObjective(
  leadType: LeadType,
  followupNumber: number,
  bundle?: LifecycleConfigBundle
): string {
  const config = bundle ?? getDefaultLifecycleConfig();
  const typeConfig = getTypeConfigFromBundle(config, leadType);
  const stage = typeConfig.stages.find((s) => s.followupNumber === followupNumber);
  if (stage?.label) return stage.label;
  return FALLBACK_OBJECTIVES[leadType]?.[followupNumber] ?? 'General follow-up';
}
