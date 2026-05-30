import { isFiveHourRetryFollowup } from '@/lib/lifecycle/fiveHourRetryFollowup';
import { getAnalyticsDayBoundsForInstant } from '@/lib/utils/analyticsDates';

/** Minimal row shape for feedback DT active follow-up sorting. */
export interface FeedbackActiveFollowupRow {
  followup: {
    id: string;
    scheduled_date: Date | string;
    followup_number: number;
    attempt_count: number;
    updated_at?: Date | string | null;
    payload?: unknown;
  };
  /** Set by API so client re-sort keeps todayDue before overdue (no IST re-bucket drift). */
  _sortQueue?: 'today' | 'overdue';
}

export type FeedbackFollowupDayBounds = { dayStart: Date; dayEnd: Date };
export type FeedbackSortQueue = 'today' | 'overdue';

export function getTodayBoundsForFeedbackFollowups(now: Date = new Date()): FeedbackFollowupDayBounds {
  const { startDate, endDate } = getAnalyticsDayBoundsForInstant(now);
  return { dayStart: startDate, dayEnd: endDate };
}

function scheduledMs(row: FeedbackActiveFollowupRow): number {
  const t = new Date(row.followup.scheduled_date).getTime();
  return Number.isFinite(t) ? t : 0;
}

function attemptCount(row: FeedbackActiveFollowupRow): number {
  const n = Number(row.followup.attempt_count);
  return Number.isFinite(n) ? n : 0;
}

function followupNumber(row: FeedbackActiveFollowupRow): number {
  const n = Number(row.followup.followup_number);
  return Number.isFinite(n) ? n : 0;
}

/** Scheduled time has arrived (or passed). */
export function isFollowupDueForCall(
  row: FeedbackActiveFollowupRow,
  now: Date = new Date()
): boolean {
  const t = scheduledMs(row);
  return t > 0 && t <= now.getTime();
}

/**
 * Today's (IST) +5h retry not yet at scheduled time — hidden from Active Follow-ups until due.
 */
export function shouldHideFutureFiveHourRetry(
  row: FeedbackActiveFollowupRow,
  now: Date = new Date(),
  dayBounds?: FeedbackFollowupDayBounds
): boolean {
  const { dayStart, dayEnd } = dayBounds ?? getTodayBoundsForFeedbackFollowups(now);
  return (
    isFiveHourRetryFollowup(row.followup) &&
    isScheduledTodayIst(row, dayStart, dayEnd) &&
    scheduledMs(row) > now.getTime()
  );
}

export function filterVisibleActiveFollowups<T extends FeedbackActiveFollowupRow>(
  items: T[],
  now: Date = new Date(),
  dayBounds?: FeedbackFollowupDayBounds
): T[] {
  return items.filter((row) => !shouldHideFutureFiveHourRetry(row, now, dayBounds));
}

/**
 * Today's (IST) +5h busy/no-answer retry whose scheduled time has arrived.
 * Overdue from prior days are excluded.
 */
export function isDueFiveHourRetryFollowup(
  row: FeedbackActiveFollowupRow,
  now: Date = new Date(),
  dayBounds?: FeedbackFollowupDayBounds
): boolean {
  const { dayStart, dayEnd } = dayBounds ?? getTodayBoundsForFeedbackFollowups(now);
  return (
    isFiveHourRetryFollowup(row.followup) &&
    isFollowupDueForCall(row, now) &&
    isScheduledTodayIst(row, dayStart, dayEnd)
  );
}

export function isScheduledTodayIst(
  row: FeedbackActiveFollowupRow,
  dayStart: Date,
  dayEnd: Date
): boolean {
  const t = scheduledMs(row);
  return t >= dayStart.getTime() && t <= dayEnd.getTime();
}

function queueRank(row: FeedbackActiveFollowupRow, dayStart: Date, dayEnd: Date): 0 | 1 {
  if (row._sortQueue === 'today') return 0;
  if (row._sortQueue === 'overdue') return 1;
  return isScheduledTodayIst(row, dayStart, dayEnd) ? 0 : 1;
}

/** Due-now band: longest-waiting (earliest schedule) first, then standard tie-breakers. */
function compareDueCallsNow<T extends FeedbackActiveFollowupRow>(a: T, b: T): number {
  const ta = scheduledMs(a);
  const tb = scheduledMs(b);
  if (ta !== tb) return ta - tb;
  return compareFeedbackCallsWithinQueue(a, b);
}

/** Within-queue compare: attempt → follow-up stage → schedule time → id (same for today and overdue). */
function compareFeedbackCallsWithinQueue<T extends FeedbackActiveFollowupRow>(a: T, b: T): number {
  const acA = attemptCount(a);
  const acB = attemptCount(b);
  if (acA !== acB) return acA - acB;

  const fnA = followupNumber(a);
  const fnB = followupNumber(b);
  if (fnA !== fnB) return fnA - fnB;

  const ta = scheduledMs(a);
  const tb = scheduledMs(b);
  if (ta !== tb) return tb - ta;

  return String(a.followup.id).localeCompare(String(b.followup.id));
}

/**
 * Sort one queue (todayDue or overdue): attempt → follow-up stage → most recent schedule first.
 * Today and overdue use the same comparator; only the band order differs (today before overdue).
 */
export function sortFeedbackCallBucket<T extends FeedbackActiveFollowupRow>(
  items: T[],
  queue: FeedbackSortQueue
): T[] {
  return [...items]
    .sort(compareFeedbackCallsWithinQueue)
    .map((row) => ({ ...row, _sortQueue: queue }));
}

/**
 * Build full list: due +5h retries on top, then IST-today, then overdue.
 * Future +5h retries stay in normal order until scheduled time (then top + blink in UI).
 */
export function buildSortedActiveFollowupCalls<T extends FeedbackActiveFollowupRow>(
  todayDue: T[],
  overdue: T[],
  now: Date = new Date()
): T[] {
  const queued = [
    ...sortFeedbackCallBucket(todayDue, 'today'),
    ...sortFeedbackCallBucket(overdue, 'overdue'),
  ];

  const dueFiveHour: T[] = [];
  const rest: T[] = [];
  for (const row of queued) {
    if (isDueFiveHourRetryFollowup(row, now)) {
      dueFiveHour.push(row);
    } else {
      rest.push(row);
    }
  }

  dueFiveHour.sort(compareDueCallsNow);
  return [...dueFiveHour, ...rest];
}

/**
 * Sort a flat merged list (e.g. after UI filters). Respects `_sortQueue` when present.
 */
export function sortFeedbackActiveFollowupCalls<T extends FeedbackActiveFollowupRow>(
  items: T[],
  options?: {
    now?: Date;
    dayBounds?: FeedbackFollowupDayBounds;
  }
): T[] {
  const now = options?.now ?? new Date();
  const { dayStart, dayEnd } = options?.dayBounds ?? getTodayBoundsForFeedbackFollowups(now);

  const todayItems: T[] = [];
  const overdueItems: T[] = [];

  for (const item of items) {
    if (queueRank(item, dayStart, dayEnd) === 0) {
      todayItems.push(item);
    } else {
      overdueItems.push(item);
    }
  }

  return buildSortedActiveFollowupCalls(todayItems, overdueItems, now);
}

/** Same IST today vs overdue split used by the active-followups API. */
export function splitFeedbackFollowupsByIstDay<T extends FeedbackActiveFollowupRow>(
  items: T[],
  now: Date = new Date()
): { todayDue: T[]; overdue: T[] } {
  const { dayStart, dayEnd } = getTodayBoundsForFeedbackFollowups(now);
  const todayDue: T[] = [];
  const overdue: T[] = [];
  for (const item of items) {
    if (isScheduledTodayIst(item, dayStart, dayEnd)) {
      todayDue.push(item);
    } else {
      overdue.push(item);
    }
  }
  return { todayDue, overdue };
}
