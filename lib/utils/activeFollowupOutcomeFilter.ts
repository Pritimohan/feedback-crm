import {
  FEEDBACK_CONNECTED_CHOICES,
  REVIEW_CONNECTED_CHOICES,
} from '@/lib/lifecycle/leadLifecycleValidation';
import {
  formatAttemptOutcomeLabel,
  formatConnectedChoiceForDisplay,
} from '@/lib/utils/analyticsOutcomes';

export const ACTIVE_FOLLOWUP_OUTCOME_FILTER_OPTIONS = [
  { label: 'Issue with product', value: 'issue_with_product' },
  { label: 'Interested', value: 'interested' },
] as const;

export interface ActiveFollowupOutcomeRow {
  followup: {
    attempt_count: number;
  };
  lead: {
    last_connected_choice?: string | null;
    current_touch_status?: string | null;
  };
  last_attempt_outcome?: string | null;
}

/** Derive a single filter key for an active follow-up row. */
export function resolveActiveFollowupOutcomeFilterKey(row: ActiveFollowupOutcomeRow): string {
  const attempts = Number(row.followup.attempt_count) || 0;
  if (attempts > 0) {
    const last = (row.last_attempt_outcome ?? '').toLowerCase().trim();
    if (last) return last;
    return (row.lead.current_touch_status ?? 'unknown').toLowerCase().trim();
  }

  const choice = (row.lead.last_connected_choice ?? '').toLowerCase().trim();
  if (choice) return choice;

  return 'not_attempted';
}

export function matchesActiveFollowupOutcomeFilter(
  row: ActiveFollowupOutcomeRow,
  filterValue: string | null
): boolean {
  if (!filterValue) return true;
  return resolveActiveFollowupOutcomeFilterKey(row) === filterValue.toLowerCase().trim();
}

export function formatActiveFollowupOutcomeLabel(row: ActiveFollowupOutcomeRow): string {
  const key = resolveActiveFollowupOutcomeFilterKey(row);
  if (key === 'not_attempted') return 'Not yet called';
  if (
    REVIEW_CONNECTED_CHOICES.includes(key as (typeof REVIEW_CONNECTED_CHOICES)[number]) ||
    FEEDBACK_CONNECTED_CHOICES.includes(key as (typeof FEEDBACK_CONNECTED_CHOICES)[number])
  ) {
    return formatConnectedChoiceForDisplay(key);
  }
  return formatAttemptOutcomeLabel(key);
}
