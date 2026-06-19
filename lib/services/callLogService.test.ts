import { dedupeCallHistoryRows, type CallHistoryDedupeRow } from './callLogService';

function row(
  partial: Partial<CallHistoryDedupeRow> & Pick<CallHistoryDedupeRow, 'id' | 'customerId' | 'outcome' | 'updatedAt'>
): CallHistoryDedupeRow {
  return {
    attemptId: partial.attemptId ?? null,
    ...partial,
  };
}

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`);
  }
}

const t0 = new Date('2026-06-19T10:00:00.000Z');
const t1 = new Date('2026-06-19T10:01:00.000Z');

const deduped = dedupeCallHistoryRows([
  row({ id: 'adhoc', customerId: 'c1', outcome: 'initiated', updatedAt: t0 }),
  row({ id: 'attempt', customerId: 'c1', outcome: 'no_answer', updatedAt: t1, attemptId: 'a1' }),
  row({ id: 'other', customerId: 'c2', outcome: 'no_answer', updatedAt: t0 }),
]);

assert('collapses adhoc + attempt duplicate for same customer', deduped.length === 2);
assert(
  'keeps attempt-linked row for duplicate cluster',
  deduped.some((r) => r.id === 'attempt') && !deduped.some((r) => r.id === 'adhoc')
);
assert('preserves unrelated calls', deduped.some((r) => r.id === 'other'));

const farApart = dedupeCallHistoryRows([
  row({ id: 'first', customerId: 'c1', outcome: 'no_answer', updatedAt: t0 }),
  row({ id: 'second', customerId: 'c1', outcome: 'no_answer', updatedAt: new Date('2026-06-19T12:00:00.000Z') }),
]);
assert('does not dedupe same customer calls far apart in time', farApart.length === 2);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
