import assert from 'node:assert/strict';
import { computeRetrySchedule } from '../lib/lifecycle/leadLifecycleSchedule';
import {
  canChooseInterested,
  computeConnectedTransition,
  computeNonConnectedTransition,
  getConnectedChoicesForStage,
  validateConnectedChoicePayload,
} from '../lib/lifecycle/leadLifecycleValidation';

function run() {
  const now = new Date('2026-01-01T10:00:00.000Z');

  const retryAfterFirstAttempt = computeRetrySchedule({ now, attemptsToday: 1 });
  assert.equal(retryAfterFirstAttempt.getTime(), new Date('2026-01-01T15:00:00.000Z').getTime());

  const retryNextDayAfterSecondAttempt = computeRetrySchedule({ now, attemptsToday: 2 });
  assert.equal(retryNextDayAfterSecondAttempt.getDate(), new Date('2026-01-02T10:00:00.000Z').getDate());
  assert.equal(retryNextDayAfterSecondAttempt.getHours(), 9);

  const busyTerminal = computeNonConnectedTransition({
    outcome: 'busy',
    attemptCountAfter: 4,
    maxAttempts: 4,
  });
  assert.equal(busyTerminal.nextActivityStatus, 'inactive');
  assert.equal(busyTerminal.nextTouchStatus, 'busy');
  assert.equal(busyTerminal.terminal, true);

  const noAnswerTerminal = computeNonConnectedTransition({
    outcome: 'no_answer',
    attemptCountAfter: 4,
    maxAttempts: 4,
  });
  assert.equal(noAnswerTerminal.nextTouchStatus, 'cnr');

  const wrongNumberDeferred = computeNonConnectedTransition({
    outcome: 'wrong_number',
    attemptCountAfter: 1,
    maxAttempts: 4,
  });
  assert.equal(wrongNumberDeferred.nextActivityStatus, 'deferred');

  assert.equal(canChooseInterested(0), true);
  assert.equal(canChooseInterested(1), true);
  assert.equal(canChooseInterested(2), false);

  const choicesFinalStage = getConnectedChoicesForStage(2);
  assert.ok(!choicesFinalStage.includes('interested'));

  const interestedTransition = computeConnectedTransition('interested');
  assert.equal(interestedTransition.nextActivityStatus, 'active');
  assert.equal(interestedTransition.advanceStage, true);

  const issuePayloadValidation = validateConnectedChoicePayload({
    choice: 'issue_with_product',
    followupNumber: 1,
    payload: {},
  });
  assert.equal(issuePayloadValidation.valid, false);

  const validIssuePayloadValidation = validateConnectedChoicePayload({
    choice: 'issue_with_product',
    followupNumber: 1,
    payload: { issue_description: 'Delayed delivery and wrong taste' },
  });
  assert.equal(validIssuePayloadValidation.valid, true);

  console.log('Lead lifecycle rules tests passed.');
}

run();
