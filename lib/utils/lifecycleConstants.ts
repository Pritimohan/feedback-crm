export const MAX_ATTEMPTS_DEFAULT = 4;
export const REVIEW_MAX_ATTEMPTS = 4;
export const RETRY_AFTER_HOURS = 5;
export const MAX_ATTEMPTS_PER_DAY = 2;
/** Calendar days after `now` when Fitelo hits MAX_ATTEMPTS_PER_DAY same-day busy/no-answer (e.g. 5th → 7th at NEXT_DAY_RETRY_HOUR). */
export const FITTELO_RETRY_DAYS_AFTER_DAILY_CAP = 2;
export const NEXT_DAY_RETRY_HOUR = 9;
export const INITIAL_FOLLOWUP_CUTOFF_HOUR = 19;
