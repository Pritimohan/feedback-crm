import type { ConversionBreakdown } from '@/types/analytics';

const ATTEMPT_OUTCOME_LABELS: Record<string, string> = {
  connected: 'Connected',
  busy: 'Busy',
  no_answer: 'No Answer',
  wrong_number: 'Wrong Number',
  not_interested: 'Not Interested',
};

/** Outcomes hidden from the dispositions chart (call_later rolls into busy). */
export const EXCLUDED_ATTEMPT_OUTCOME_KEYS = new Set([
  'call_later',
  'cnr',
  'failed',
  'unreachable',
  'whatsapp',
  'moved_to_whatsapp',
  'initiated',
]);

/** Attempt outcomes shown in analytics (fixed order). */
export const ATTEMPT_OUTCOME_KEYS = [
  'connected',
  'busy',
  'no_answer',
  'wrong_number',
  'not_interested',
] as const;

export function isExcludedAttemptOutcome(key: string): boolean {
  return EXCLUDED_ATTEMPT_OUTCOME_KEYS.has(key.toLowerCase().trim());
}

/** Map stored outcomes to chart keys (e.g. legacy call_later → busy). */
export function normalizeAttemptOutcomeForChart(key: string): string | null {
  const k = key.toLowerCase().trim();
  if (!k) return null;
  if (k === 'call_later') return 'busy';
  if (isExcludedAttemptOutcome(k)) return null;
  return k;
}

/** Per-outcome label for charts (no grouping). */
export function formatAttemptOutcomeLabel(outcome: string | null | undefined): string {
  const key = (outcome ?? '').toLowerCase().trim();
  if (!key) return 'Unknown';
  if (ATTEMPT_OUTCOME_LABELS[key]) return ATTEMPT_OUTCOME_LABELS[key];
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize raw attempt outcomes for table badges (may group for compact display). */
export function formatOutcomeForDisplay(outcome: string | null | undefined): string {
  return formatAttemptOutcomeLabel(outcome);
}

export function formatConnectedChoiceForDisplay(choice: string | null | undefined): string {
  const c = (choice ?? '').toLowerCase();
  if (c === 'reviewed') return 'Reviewed';
  if (c === 'issue_with_product') return 'Issue with product';
  if (c === 'interested') return 'Interested';
  if (c === 'didnt_reviewed' || c === 'dont_reviewed') return "Didn't review";
  return choice?.replace(/_/g, ' ') || '—';
}

export const CONNECTED_CHOICE_KEYS = [
  'reviewed',
  'issue_with_product',
  'interested',
  'didnt_reviewed',
] as const;

export function emptyConversionBreakdown(): ConversionBreakdown {
  return {
    reviewed: 0,
    issue_with_product: 0,
    interested: 0,
    didnt_reviewed: 0,
  };
}

export function parseConversionBreakdownRows(
  rows: { choice?: string | null; cnt?: number }[]
): ConversionBreakdown {
  const breakdown = emptyConversionBreakdown();
  for (const row of rows) {
    const choice = (row.choice ?? '').toLowerCase();
    const cnt = Number(row.cnt ?? 0);
    if (choice === 'reviewed') breakdown.reviewed = cnt;
    else if (choice === 'issue_with_product') breakdown.issue_with_product = cnt;
    else if (choice === 'interested') breakdown.interested = cnt;
    else if (choice === 'didnt_reviewed' || choice === 'dont_reviewed')
      breakdown.didnt_reviewed += cnt;
  }
  return breakdown;
}

export function isConnectedOutcome(outcome: string | null | undefined): boolean {
  return (outcome ?? '').toLowerCase() === 'connected';
}
