import assert from 'node:assert/strict';
import {
  formatFeedbackFormForDisplay,
  sanitizeFeedbackFormPayload,
  shouldShowFeedbackField,
  USAGE_DURATION_NOT_USING,
} from '../lib/feedback/feedbackFormSchema';

function run() {
  const sanitized = sanitizeFeedbackFormPayload({
    products_purchased: ['Fitty GLP Capsule', ''],
    hear_about_fitty: 'Amazon',
    recommend_likelihood: 8,
    satisfaction_score: 4,
    usage_duration: 'Less than 1 month',
    stop_using_reason: 'Should be removed',
    product_issues: 'Taste',
    product_issues_other: 'Should be removed',
    metadata_noise: 'ignored',
  });

  assert.deepEqual(sanitized.products_purchased, ['Fitty GLP Capsule']);
  assert.equal(sanitized.hear_about_fitty, 'Amazon');
  assert.equal(sanitized.recommend_likelihood, 8);
  assert.equal(sanitized.satisfaction_score, 4);
  assert.equal(sanitized.stop_using_reason, undefined);
  assert.equal(sanitized.product_issues_other, undefined);
  assert.equal((sanitized as Record<string, unknown>).metadata_noise, undefined);

  const notUsing = sanitizeFeedbackFormPayload({
    usage_duration: USAGE_DURATION_NOT_USING,
    stop_using_reason: 'Taste issue',
  });
  assert.equal(notUsing.stop_using_reason, 'Taste issue');

  const otherIssue = sanitizeFeedbackFormPayload({
    product_issues: 'Other',
    product_issues_other: 'Packaging seal broken',
  });
  assert.equal(otherIssue.product_issues_other, 'Packaging seal broken');

  const stopField = {
    key: 'stop_using_reason' as const,
    type: 'radio' as const,
    showWhen: { field: 'usage_duration' as const, equals: USAGE_DURATION_NOT_USING },
    options: ['Taste issue'],
  };

  assert.equal(
    shouldShowFeedbackField(stopField, { usage_duration: USAGE_DURATION_NOT_USING }),
    true
  );
  assert.equal(shouldShowFeedbackField(stopField, { usage_duration: '1–3 months' }), false);

  const display = formatFeedbackFormForDisplay({
    hear_about_fitty: 'Website',
    recommend_likelihood: 9,
  });
  assert.ok(display.some((row) => row.label.includes('hear about Fitty')));
  assert.ok(display.some((row) => row.value === '9'));

  console.log('Feedback form schema tests passed.');
}

run();
