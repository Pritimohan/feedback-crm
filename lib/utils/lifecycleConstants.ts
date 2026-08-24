export const MAX_ATTEMPTS_DEFAULT = 4;
export const REVIEW_MAX_ATTEMPTS = 4;
/** Calendar days after a non-terminal busy/no-answer attempt before the next retry is due. */
export const RETRY_AFTER_DAYS = 3;
export const NEXT_DAY_RETRY_HOUR = 9;
export const INITIAL_FOLLOWUP_CUTOFF_HOUR = 19;
/** Calendar days after a new feedback lead is created before the first call is due (at nextDayRetryHour). */
export const FEEDBACK_FIRST_CALL_DELAY_DAYS = 3;

/** Time slots for busy reschedule (hour values for start of slot). */
export const BUSY_RESCHEDULE_SLOTS = [
  { label: '10-11 AM', hour: 10, minute: 0 },
  { label: '11-12 PM', hour: 11, minute: 0 },
  { label: '2-3 PM', hour: 14, minute: 0 },
  { label: '3-4 PM', hour: 15, minute: 0 },
  { label: '4-5 PM', hour: 16, minute: 0 },
  { label: '5-6 PM', hour: 17, minute: 0 },
] as const;
