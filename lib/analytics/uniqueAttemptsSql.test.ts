import {
  countConnectedCustomerDays,
  countConnectedLeadDays,
  countUniqueCustomerDays,
  countUniqueLeadDays,
  dedupeLastAttemptPerCustomerDay,
  type AttemptRowForDedupe,
} from './uniqueAttemptsSql';

function row(
  partial: Partial<AttemptRowForDedupe> & Pick<AttemptRowForDedupe, 'customerId' | 'attemptDay' | 'outcome' | 'attemptAt'>
): AttemptRowForDedupe {
  return {
    leadId: partial.leadId ?? partial.customerId,
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

console.log('uniqueAttemptsSql tests');

// Same customer, 2 attempts same day → 1 unique customer-day
{
  const rows: AttemptRowForDedupe[] = [
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'busy', attemptAt: '2026-05-29T10:00:00Z' }),
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'no_answer', attemptAt: '2026-05-29T14:00:00Z' }),
  ];
  assert('same day double dial → 1 attempted', countUniqueCustomerDays(rows) === 1);
  const deduped = dedupeLastAttemptPerCustomerDay(rows);
  assert('last attempt wins for disposition', deduped.length === 1 && deduped[0].outcome === 'no_answer');
}

// Busy then connected same day → connected = 1 (any-connected)
{
  const rows: AttemptRowForDedupe[] = [
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'busy', attemptAt: '2026-05-29T10:00:00Z' }),
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'connected', attemptAt: '2026-05-29T15:00:00Z' }),
  ];
  assert('any connected same day', countConnectedCustomerDays(rows) === 1);
}

// Mon + Tue → 2 customer-days
{
  const rows: AttemptRowForDedupe[] = [
    row({ customerId: 'c1', attemptDay: '2026-05-26', outcome: 'busy', attemptAt: '2026-05-26T10:00:00Z' }),
    row({ customerId: 'c1', attemptDay: '2026-05-27', outcome: 'busy', attemptAt: '2026-05-27T10:00:00Z' }),
  ];
  assert('multi-day same customer → 2 attempted', countUniqueCustomerDays(rows) === 2);
}

// Two agents, same customer same day → 2 per-agent partitions
{
  const rows: AttemptRowForDedupe[] = [
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'busy', attemptAt: '2026-05-29T10:00:00Z', dtId: 'dt1' }),
    row({ customerId: 'c1', attemptDay: '2026-05-29', outcome: 'busy', attemptAt: '2026-05-29T11:00:00Z', dtId: 'dt2' }),
  ];
  assert('per-agent customer-days', countUniqueCustomerDays(rows) === 2);
  assert('global without dtId still 1', countUniqueCustomerDays(rows.map((r) => ({ ...r, dtId: undefined }))) === 1);
}

// Lead-day stage dedupe
{
  const rows: AttemptRowForDedupe[] = [
    row({ customerId: 'c1', leadId: 'l1', attemptDay: '2026-05-29', outcome: 'connected', attemptAt: '2026-05-29T09:00:00Z' }),
    row({ customerId: 'c1', leadId: 'l1', attemptDay: '2026-05-29', outcome: 'busy', attemptAt: '2026-05-29T12:00:00Z' }),
  ];
  assert('lead-day attempted', countUniqueLeadDays(rows) === 1);
  assert('lead-day any connected', countConnectedLeadDays(rows) === 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
