import {
  emptyConversionBreakdown,
  parseConversionBreakdownRows,
  sumConversionBreakdown,
} from './analyticsOutcomes';

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

console.log('analyticsOutcomes tests');

const sample = {
  reviewed: 1,
  issue_with_product: 1,
  interested: 31,
  didnt_reviewed: 0,
  unknown: 0,
};
assert('sum matches stage tooltip example', sumConversionBreakdown(sample) === 33);

const fromRows = parseConversionBreakdownRows([
  { choice: 'reviewed', cnt: 1 },
  { choice: 'issue_with_product', cnt: 1 },
  { choice: 'interested', cnt: 31 },
  { choice: null, cnt: 2 },
]);
assert('null choice → unknown', fromRows.unknown === 2);
assert('sum includes unknown', sumConversionBreakdown(fromRows) === 35);

assert('empty sum is 0', sumConversionBreakdown(emptyConversionBreakdown()) === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
