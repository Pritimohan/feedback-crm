/**
 * Run: npm run test:followup-priority
 */
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PENDING_RETRY_SCHEDULE_5H } from '../lifecycle/fiveHourRetryFollowup';
import {
  buildSortedActiveFollowupCalls,
  filterVisibleActiveFollowups,
  isDueFiveHourRetryFollowup,
  shouldHideFutureFiveHourRetry,
  sortFeedbackActiveFollowupCalls,
  sortFeedbackCallBucket,
  type FeedbackActiveFollowupRow,
} from './activeFollowupsCallPriority';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Kolkata';
const dayStart = dayjs.tz('2026-05-13', 'YYYY-MM-DD', TZ).startOf('day').toDate();
const dayEnd = dayjs.tz('2026-05-13', 'YYYY-MM-DD', TZ).endOf('day').toDate();
const bounds = { dayStart, dayEnd };
const refNow = dayjs.tz('2026-05-13 12:00', 'YYYY-MM-DD HH:mm', TZ).toDate();

function row(
  id: string,
  fn: number,
  scheduled: string,
  attempts: number,
  extras?: { payload?: Record<string, unknown>; updated_at?: string }
): FeedbackActiveFollowupRow {
  return {
    followup: {
      id,
      followup_number: fn,
      scheduled_date: scheduled,
      attempt_count: attempts,
      ...extras,
    },
  };
}

function row5h(
  id: string,
  scheduled: string,
  updatedAt: string
): FeedbackActiveFollowupRow {
  return row(id, 0, scheduled, 1, {
    updated_at: updatedAt,
    payload: { pending_retry_schedule: PENDING_RETRY_SCHEDULE_5H },
  });
}

// Today bucket: first call before followup 1 (even if FU1 is more recent)
{
  const today = [
    row('fu1', 1, '2026-05-13T18:00:00.000Z', 0),
    row('first', 0, '2026-05-13T08:00:00.000Z', 0),
  ];
  const s = sortFeedbackCallBucket(today, 'today');
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['first', 'fu1']
  );
}

// Today bucket: most recent first call before older first call
{
  const today = [
    row('older', 0, '2026-05-13T08:00:00.000Z', 0),
    row('recent', 0, '2026-05-13T16:00:00.000Z', 0),
  ];
  const s = sortFeedbackCallBucket(today, 'today');
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['recent', 'older']
  );
}

// Overdue followup 1 does NOT jump above overdue first call (same bucket)
{
  const overdue = [
    row('fu1', 1, '2026-05-12T18:00:00.000Z', 0),
    row('first', 0, '2026-05-12T08:00:00.000Z', 0),
  ];
  const s = sortFeedbackCallBucket(overdue, 'overdue');
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['first', 'fu1']
  );
}

// Full list: today band before overdue; recent followup today after first calls today
{
  const today = [
    row('fu1Today', 1, '2026-05-13T18:00:00.000Z', 0),
    row('firstToday', 0, '2026-05-13T10:00:00.000Z', 0),
  ];
  const overdue = [row('firstOverdue', 0, '2026-05-12T10:00:00.000Z', 0)];
  const s = buildSortedActiveFollowupCalls(today, overdue, refNow);
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['firstToday', 'fu1Today', 'firstOverdue']
  );
}

// Due +5h retry scheduled today on top; future today 5h hidden; prior-day 5h excluded from highlight
{
  const retryDue = row5h('retryDue', '2026-05-13T06:00:00.000Z', '2026-05-13T01:00:00.000Z');
  const retryLater = row5h('retryLater', '2026-05-13T08:30:00.000Z', '2026-05-13T03:30:00.000Z');
  const retryYesterday = row5h('retryYesterday', '2026-05-12T06:00:00.000Z', '2026-05-12T01:00:00.000Z');
  const firstToday = row('firstToday', 0, '2026-05-13T04:00:00.000Z', 0);
  assert.equal(isDueFiveHourRetryFollowup(retryDue, refNow, bounds), true);
  assert.equal(isDueFiveHourRetryFollowup(retryLater, refNow, bounds), false);
  assert.equal(isDueFiveHourRetryFollowup(retryYesterday, refNow, bounds), false);
  assert.equal(shouldHideFutureFiveHourRetry(retryLater, refNow, bounds), true);
  assert.equal(shouldHideFutureFiveHourRetry(retryDue, refNow, bounds), false);
  const visible = filterVisibleActiveFollowups(
    [firstToday, retryLater, retryDue, retryYesterday],
    refNow,
    bounds
  );
  assert.deepEqual(
    visible.map((x) => x.followup.id),
    ['firstToday', 'retryDue', 'retryYesterday']
  );
  const s = buildSortedActiveFollowupCalls(visible, [], refNow);
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['retryDue', 'firstToday', 'retryYesterday']
  );
}

// buildSorted: att0 ladder then att1 in today band
{
  const today = [
    row('firstAtt1', 0, '2026-05-13T16:00:00.000Z', 1),
    row('fu1Att0', 1, '2026-05-13T14:00:00.000Z', 0),
    row('firstAtt0', 0, '2026-05-13T09:00:00.000Z', 0),
  ];
  const s = buildSortedActiveFollowupCalls(today, [], refNow);
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['firstAtt0', 'fu1Att0', 'firstAtt1']
  );
}

// flat re-sort with _sortQueue tags preserves API bands
{
  const tagged = buildSortedActiveFollowupCalls(
    [row('t1', 0, '2026-05-13T10:00:00.000Z', 0)],
    [row('o1', 1, '2026-05-12T10:00:00.000Z', 0)],
    refNow
  );
  const s = sortFeedbackActiveFollowupCalls(tagged, { dayBounds: bounds, now: refNow });
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['t1', 'o1']
  );
}

// JSON string numbers
{
  const apiRow = (id: string, fn: string, att: string, scheduled: string) => ({
    followup: {
      id,
      followup_number: fn as unknown as number,
      attempt_count: att as unknown as number,
      scheduled_date: scheduled,
    },
  });
  const s = sortFeedbackCallBucket(
    [
      apiRow('fu1', '1', '0', '2026-05-13T18:00:00.000Z'),
      apiRow('first', '0', '0', '2026-05-13T08:00:00.000Z'),
    ],
    'today'
  );
  assert.deepEqual(
    s.map((x) => x.followup.id),
    ['first', 'fu1']
  );
}

console.log('All feedback follow-up priority tests passed.');
