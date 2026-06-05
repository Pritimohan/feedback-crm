/**
 * Run: npx tsx lib/services/run-dt-brand-profile-tests.ts
 */
import assert from 'node:assert/strict';
import {
  validateEligibleLeadTypes,
  pickEligibleTargetDt,
  DEFAULT_ELIGIBLE_LEAD_TYPES,
} from '@/lib/services/dtBrandProfileService';
import { filterRowsForUiCounts } from '@/lib/services/rebalanceEligibilityService';
import type { ClassifiedFollowupRow } from '@/lib/services/rebalanceEligibilityService';
import type { LeadType } from '@/lib/lifecycle/leadLifecycleValidation';

function testValidateEligibleLeadTypesAcceptsReview() {
  const types = validateEligibleLeadTypes(['review']);
  assert.deepEqual(types, ['review']);
}

function testValidateEligibleLeadTypesDedupes() {
  const types = validateEligibleLeadTypes(['review', 'review', 'feedback']);
  assert.deepEqual(types, ['review', 'feedback']);
}

function testValidateEligibleLeadTypesRejectsEmpty() {
  assert.throws(() => validateEligibleLeadTypes([]), /At least one lead type/);
}

function testValidateEligibleLeadTypesRejectsInvalid() {
  assert.throws(() => validateEligibleLeadTypes(['review', 'invalid']), /Invalid lead type/);
}

function testDefaultEligibleLeadTypesIsReviewOnly() {
  assert.deepEqual(DEFAULT_ELIGIBLE_LEAD_TYPES, ['review']);
}

function testPickEligibleTargetDtPrefersEligiblePreferred() {
  const map = new Map<LeadType, Set<string>>([
    ['review', new Set(['a', 'b'])],
    ['feedback', new Set(['b'])],
  ]);
  assert.equal(pickEligibleTargetDt('a', 'review', ['a', 'b'], map), 'a');
}

function testPickEligibleTargetDtFallsBackWhenPreferredIneligible() {
  const map = new Map<LeadType, Set<string>>([
    ['feedback', new Set(['b'])],
  ]);
  assert.equal(pickEligibleTargetDt('a', 'feedback', ['a', 'b'], map), 'b');
}

function testPickEligibleTargetDtReturnsNullWhenNoEligible() {
  const map = new Map<LeadType, Set<string>>([['feedback', new Set(['c'])]]);
  assert.equal(pickEligibleTargetDt('a', 'feedback', ['a', 'b'], map), null);
}

function testFilterRowsForUiCountsRequiresLeadTypeEligibility() {
  const active = new Set(['a', 'b']);
  const eligible = new Map<LeadType, Set<string>>([
    ['review', new Set(['a'])],
    ['feedback', new Set(['b'])],
  ]);
  const rows: ClassifiedFollowupRow[] = [
    {
      followupId: '1',
      leadId: 'l1',
      leadType: 'review',
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
      leadType: 'feedback',
      followupNumber: 0,
      ownerDtId: 'a',
      lifecycleStatus: 'active',
      leadActivityStatus: 'active',
      bucket: 'reassignable',
      dueBucket: 'today',
      currentDtId: 'a',
    },
  ];
  const ui = filterRowsForUiCounts(rows, active, eligible);
  assert.equal(ui.length, 1);
  assert.equal(ui[0].leadType, 'review');
}

const tests = [
  testValidateEligibleLeadTypesAcceptsReview,
  testValidateEligibleLeadTypesDedupes,
  testValidateEligibleLeadTypesRejectsEmpty,
  testValidateEligibleLeadTypesRejectsInvalid,
  testDefaultEligibleLeadTypesIsReviewOnly,
  testPickEligibleTargetDtPrefersEligiblePreferred,
  testPickEligibleTargetDtFallsBackWhenPreferredIneligible,
  testPickEligibleTargetDtReturnsNullWhenNoEligible,
  testFilterRowsForUiCountsRequiresLeadTypeEligibility,
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
console.log(`All ${tests.length} dt brand profile tests passed.`);
