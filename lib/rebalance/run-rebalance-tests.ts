/**
 * Run: npm run test:rebalance
 */
import assert from 'node:assert/strict';
import {
  classifyRebalanceFollowup,
  dueBucketFromScheduled,
} from './classifyFollowup';
import { allocateByPercentagesMap } from './allocateByPercentages';
import {
  buildPlannedTargetsFromStage0Targets,
  buildStage0PlanFromPercentages,
} from './rebalancePlanning';
import { computeAfterDistribution } from './computeRebalancePreview';
import { summarizeClassifiedRows } from './summarizePool';
import { filterRowsForUiCounts } from '@/lib/services/rebalanceEligibilityService';
import type { ClassifiedFollowupRow } from '@/lib/services/rebalanceEligibilityService';

function testClassifyReassignableFu0NoAttempts() {
  const bucket = classifyRebalanceFollowup({
    followupNumber: 0,
    attemptCount: 0,
    lifecycleStatus: 'active',
    leadActivityStatus: 'active',
  });
  assert.equal(bucket, 'reassignable');
}

function testClassifyLockedWithAttempts() {
  const bucket = classifyRebalanceFollowup({
    followupNumber: 0,
    attemptCount: 1,
    lifecycleStatus: 'active',
    leadActivityStatus: 'active',
  });
  assert.equal(bucket, 'locked');
}

function testClassifyLockedNonStageZero() {
  const bucket = classifyRebalanceFollowup({
    followupNumber: 2,
    attemptCount: 0,
    lifecycleStatus: 'active',
    leadActivityStatus: 'active',
  });
  assert.equal(bucket, 'locked');
}

function testClassifyLockedInactiveLifecycle() {
  const bucket = classifyRebalanceFollowup({
    followupNumber: 0,
    attemptCount: 0,
    lifecycleStatus: 'inactive',
    leadActivityStatus: 'active',
  });
  assert.equal(bucket, 'locked');
}

function testClassifyLockedInactiveLead() {
  const bucket = classifyRebalanceFollowup({
    followupNumber: 0,
    attemptCount: 0,
    lifecycleStatus: 'active',
    leadActivityStatus: 'inactive',
  });
  assert.equal(bucket, 'locked');
}

function testDueBucketToday() {
  const dayStart = new Date('2026-05-15T00:00:00+05:30');
  const dayEnd = new Date('2026-05-15T23:59:59+05:30');
  const scheduled = new Date('2026-05-15T12:00:00+05:30');
  assert.equal(dueBucketFromScheduled(scheduled, dayStart, dayEnd), 'today');
}

function testAllocateByPercentagesSumsToTotal() {
  const activeDtIds = ['a', 'b', 'c'];
  const percentages = new Map([
    ['a', 10],
    ['b', 30],
    ['c', 60],
  ]);
  const out = allocateByPercentagesMap(100, activeDtIds, percentages);
  const sum = [...out.values()].reduce((s, n) => s + n, 0);
  assert.equal(sum, 100);
  assert.equal(out.get('a'), 10);
  assert.equal(out.get('b'), 30);
  assert.equal(out.get('c'), 60);
}

function testBuildStage0PlanFromPercentages() {
  const activeDtIds = ['a', 'b', 'c'];
  const nonEligible = new Map([
    ['a', 5],
    ['b', 10],
    ['c', 3],
  ]);
  const percentages = new Map([
    ['a', 25],
    ['b', 25],
    ['c', 50],
  ]);
  const { targetStage0ByDt, projectedLoads } = buildStage0PlanFromPercentages(
    activeDtIds,
    nonEligible,
    20,
    percentages
  );
  const targetSum = [...targetStage0ByDt.values()].reduce((s, n) => s + n, 0);
  assert.equal(targetSum, 20);
  assert.equal(projectedLoads.get('a'), 5 + (targetStage0ByDt.get('a') ?? 0));
}

function testPlannedTargetsPreserveOwnership() {
  const activeDtIds = ['a', 'b'];
  const eligible = [
    { currentDtId: 'a' },
    { currentDtId: 'a' },
    { currentDtId: 'b' },
  ];
  const target = new Map([
    ['a', 2],
    ['b', 1],
  ]);
  const { plannedTargets, allocatedByDt } = buildPlannedTargetsFromStage0Targets(
    activeDtIds,
    eligible,
    target
  );
  assert.equal(plannedTargets.length, 3);
  assert.equal(allocatedByDt.get('a'), 2);
  assert.equal(allocatedByDt.get('b'), 1);
}

function testComputeAfterDistribution() {
  const tableRows = [
    {
      dtId: 'a',
      dtName: 'A',
      reassignableTodaysDue: 5,
      nonReassignableTodaysDue: 0,
      reassignableOverdue: 0,
      nonReassignableOverdue: 2,
    },
    {
      dtId: 'b',
      dtName: 'B',
      reassignableTodaysDue: 5,
      nonReassignableTodaysDue: 0,
      reassignableOverdue: 0,
      nonReassignableOverdue: 1,
    },
  ];

  const after = computeAfterDistribution(tableRows, { a: 50, b: 50 });

  const redistSum = after.reduce((s, r) => s + (r.redistTotal ?? 0), 0);
  assert.equal(redistSum, 10);
  assert.equal(after.find((r) => r.dtId === 'a')?.redistTotal, 5);
  assert.equal(after.find((r) => r.dtId === 'a')?.afterTotal, 5 + 2);
}

function testSummarizeClassifiedRows() {
  const active = new Set(['a', 'b']);
  const rows = [
    { ownerDtId: 'a', bucket: 'reassignable' as const },
    { ownerDtId: 'a', bucket: 'locked' as const },
    { ownerDtId: 'b', bucket: 'reassignable' as const },
    { ownerDtId: 'inactive', bucket: 'reassignable' as const },
    { ownerDtId: null, bucket: 'locked' as const },
  ];
  const s = summarizeClassifiedRows(rows, active);
  assert.equal(s.totalLeads, 3);
  assert.equal(s.totalReassignable, 2);
  assert.equal(s.totalLocked, 1);
}

function testFilterRowsForUiCounts() {
  const active = new Set(['a']);
  const rows: ClassifiedFollowupRow[] = [
    {
      followupId: '1',
      leadId: 'l1',
      followupNumber: 0,
      ownerDtId: 'a',
      lifecycleStatus: 'active',
      leadActivityStatus: 'active',
      bucket: 'reassignable',
      dueBucket: 'today',
      currentDtId: 'a',
    },
    {
      followupId: '2',
      leadId: 'l2',
      followupNumber: 0,
      ownerDtId: 'a',
      lifecycleStatus: 'inactive',
      leadActivityStatus: 'active',
      bucket: 'locked',
      dueBucket: 'today',
      currentDtId: 'a',
    },
  ];
  const ui = filterRowsForUiCounts(rows, active);
  assert.equal(ui.length, 1);
  assert.equal(ui[0].followupId, '1');
}

function testSummarizeInvariantTotalEqualsParts() {
  const active = new Set(['a']);
  const rows = [
    { ownerDtId: 'a', bucket: 'reassignable' as const },
    { ownerDtId: 'a', bucket: 'locked' as const },
    { ownerDtId: 'a', bucket: 'locked' as const },
  ];
  const s = summarizeClassifiedRows(rows, active);
  assert.equal(s.totalLeads, s.totalReassignable + s.totalLocked);
  assert.equal(s.totalLeads, 3);
}

const tests = [
  testClassifyReassignableFu0NoAttempts,
  testClassifyLockedWithAttempts,
  testClassifyLockedNonStageZero,
  testClassifyLockedInactiveLifecycle,
  testClassifyLockedInactiveLead,
  testDueBucketToday,
  testAllocateByPercentagesSumsToTotal,
  testBuildStage0PlanFromPercentages,
  testPlannedTargetsPreserveOwnership,
  testComputeAfterDistribution,
  testSummarizeClassifiedRows,
  testFilterRowsForUiCounts,
  testSummarizeInvariantTotalEqualsParts,
];

let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`OK ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${t.name}`, e);
  }
}

if (failed > 0) process.exit(1);
console.log(`All ${tests.length} rebalance tests passed.`);
