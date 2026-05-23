import { getAnalyticsDayBoundsForInstant } from '@/lib/utils/analyticsDates';

/** Minimal row shape for feedback DT active follow-up sorting. */
export interface FeedbackActiveFollowupRow {
  followup: {
    id: string;
    scheduled_date: Date | string;
    followup_number: number;
    attempt_count: number;
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

/** Most recent scheduled first within the same attempt + follow-up stage. */
function scheduleTimeTieBreak<T extends FeedbackActiveFollowupRow>(a: T, b: T): number {
  return scheduledMs(b) - scheduledMs(a);
}

/**
 * Sort one queue (todayDue or overdue): attempt → follow-up stage → recent schedule first.
 * Does not mix today/overdue — call twice and concat (fitty-style per-band ordering).
 */
export function sortFeedbackCallBucket<T extends FeedbackActiveFollowupRow>(
  items: T[],
  queue: FeedbackSortQueue
): T[] {
  return [...items].sort((a, b) => {
    const acA = attemptCount(a);
    const acB = attemptCount(b);
    if (acA !== acB) return acA - acB;

    const fnA = followupNumber(a);
    const fnB = followupNumber(b);
    if (fnA !== fnB) return fnA - fnB;

    const tt = scheduleTimeTieBreak(a, b);
    if (tt !== 0) return tt;

    return String(a.followup.id).localeCompare(String(b.followup.id));
  }).map((row) => ({ ...row, _sortQueue: queue }));
}

/** Build full list: all IST-today rows first, then overdue; each band sorted by attempt → stage → recency. */
export function buildSortedActiveFollowupCalls<T extends FeedbackActiveFollowupRow>(
  todayDue: T[],
  overdue: T[],
  _now?: Date
): T[] {
  void _now;
  return [
    ...sortFeedbackCallBucket(todayDue, 'today'),
    ...sortFeedbackCallBucket(overdue, 'overdue'),
  ];
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
