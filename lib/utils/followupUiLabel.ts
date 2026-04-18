/**
 * User-facing follow-up label: DB `followup_number` is 0-based (0 → "Follow-up 1").
 */
export function followupUiLabel(followupNumber: number): string {
  const n = Number.isFinite(followupNumber) && followupNumber >= 0 ? followupNumber : 0;
  return `Follow-up ${n + 1}`;
}
