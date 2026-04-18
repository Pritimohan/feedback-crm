import type { LeadType } from './leadLifecycleValidation';

const OBJECTIVES: Record<LeadType, Record<number, string>> = {
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
};

export function getCallObjective(leadType: LeadType, followupNumber: number): string {
  return OBJECTIVES[leadType]?.[followupNumber] ?? 'General follow-up';
}
