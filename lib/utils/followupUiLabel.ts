/**
 * User-facing follow-up label: DB `followup_number` is 0-based.
 */
export function followupUiLabel(followupNumber: number): string {
  const n = Number.isFinite(followupNumber) && followupNumber >= 0 ? followupNumber : 0;
  if (n === 0) return 'First call';
  if (n === 1) return 'Followup 1';
  if (n === 2) return 'Followup 2';
  if (n === 3) return 'Followup 3';
  return `Followup ${n}`;
}
