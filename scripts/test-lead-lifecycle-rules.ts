import assert from 'node:assert/strict';
import {
  computeRetrySchedule,
  scheduleInitialFollowup,
  scheduleInitialFollowupNextCalendarDay,
  scheduleNextFollowupFromConnected,
} from '../lib/lifecycle/leadLifecycleSchedule';
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

  const fiteloRetryAfterSecondAttemptSameDay = computeRetrySchedule({
    now,
    attemptsToday: 2,
    brand: 'fitelo',
  });
  assert.equal(
    fiteloRetryAfterSecondAttemptSameDay.getDate(),
    new Date('2026-01-03T10:00:00.000Z').getDate()
  );
  assert.equal(fiteloRetryAfterSecondAttemptSameDay.getHours(), 9);

  const beforeCutoffInitialFollowup = scheduleInitialFollowup(new Date(2026, 0, 1, 18, 59, 0, 0));
  assert.equal(beforeCutoffInitialFollowup.getFullYear(), 2026);
  assert.equal(beforeCutoffInitialFollowup.getMonth(), 0);
  assert.equal(beforeCutoffInitialFollowup.getDate(), 1);
  assert.equal(beforeCutoffInitialFollowup.getHours(), 18);
  assert.equal(beforeCutoffInitialFollowup.getMinutes(), 59);

  const atCutoffInitialFollowup = scheduleInitialFollowup(new Date(2026, 0, 1, 19, 0, 0, 0));
  assert.equal(atCutoffInitialFollowup.getFullYear(), 2026);
  assert.equal(atCutoffInitialFollowup.getMonth(), 0);
  assert.equal(atCutoffInitialFollowup.getDate(), 2);
  assert.equal(atCutoffInitialFollowup.getHours(), 9);
  assert.equal(atCutoffInitialFollowup.getMinutes(), 0);

  const afterCutoffInitialFollowup = scheduleInitialFollowup(new Date(2026, 0, 1, 20, 30, 0, 0));
  assert.equal(afterCutoffInitialFollowup.getFullYear(), 2026);
  assert.equal(afterCutoffInitialFollowup.getMonth(), 0);
  assert.equal(afterCutoffInitialFollowup.getDate(), 2);
  assert.equal(afterCutoffInitialFollowup.getHours(), 9);
  assert.equal(afterCutoffInitialFollowup.getMinutes(), 0);

  const nextDayMorning = scheduleInitialFollowupNextCalendarDay(new Date(2026, 4, 15, 10, 0, 0, 0));
  assert.equal(nextDayMorning.getFullYear(), 2026);
  assert.equal(nextDayMorning.getMonth(), 4);
  assert.equal(nextDayMorning.getDate(), 16);
  assert.equal(nextDayMorning.getHours(), 9);
  assert.equal(nextDayMorning.getMinutes(), 0);

  const nextDayAfterEveningAnchor = scheduleInitialFollowupNextCalendarDay(
    new Date(2026, 4, 15, 20, 30, 0, 0)
  );
  assert.equal(nextDayAfterEveningAnchor.getFullYear(), 2026);
  assert.equal(nextDayAfterEveningAnchor.getMonth(), 4);
  assert.equal(nextDayAfterEveningAnchor.getDate(), 16);
  assert.equal(nextDayAfterEveningAnchor.getHours(), 9);
  assert.equal(nextDayAfterEveningAnchor.getMinutes(), 0);

  const fittyStage0Next = scheduleNextFollowupFromConnected({
    referenceDate: now,
    brand: 'fitty',
    currentFollowupNumber: 0,
  });
  assert.equal(fittyStage0Next.getTime(), new Date('2026-01-04T10:00:00.000Z').getTime());

  const fittyStage1Next = scheduleNextFollowupFromConnected({
    referenceDate: now,
    brand: 'fitty',
    currentFollowupNumber: 1,
  });
  assert.equal(fittyStage1Next.getTime(), new Date('2026-01-03T10:00:00.000Z').getTime());

  const fittyStage2Next = scheduleNextFollowupFromConnected({
    referenceDate: now,
    brand: 'fitty',
    currentFollowupNumber: 2,
  });
  assert.equal(fittyStage2Next.getTime(), new Date('2026-01-03T10:00:00.000Z').getTime());

  const nonFittyNext = scheduleNextFollowupFromConnected({
    referenceDate: now,
    brand: 'fitelo',
    currentFollowupNumber: 0,
  });
  assert.equal(nonFittyNext.getTime(), new Date('2026-01-02T10:00:00.000Z').getTime());

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
  assert.equal(canChooseInterested(2), true);
  assert.equal(canChooseInterested(3), false);

  const choicesFinalStage = getConnectedChoicesForStage(3);
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
