import assert from 'node:assert/strict';
import {
  buildFeedbackImportTemplateBuffer,
  parseFeedbackImportSheet,
  validateFeedbackImportRow,
} from '../lib/services/feedbackImportService';

function run() {
  const valid = validateFeedbackImportRow(
    {
      phone: '9876543210',
      name: 'Jane Doe',
      brand: 'fitty',
      metadata: '{"order_id":"ORD-1"}',
    },
    2
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.phone, '+919876543210');
  assert.equal(valid.data?.brand, 'fitty');
  assert.deepEqual(valid.data?.metadata, { order_id: 'ORD-1' });

  const missingPhone = validateFeedbackImportRow({ name: 'Jane', brand: 'fitty' }, 3);
  assert.equal(missingPhone.valid, false);
  assert.ok(missingPhone.errors.includes('phone is required'));

  const badBrand = validateFeedbackImportRow(
    { phone: '9876543210', name: 'Jane', brand: 'unknown' },
    4
  );
  assert.equal(badBrand.valid, false);
  assert.ok(badBrand.errors.some((e) => e.includes('brand')));

  const badPhone = validateFeedbackImportRow(
    { phone: '123', name: 'Jane', brand: 'fitelo' },
    5
  );
  assert.equal(badPhone.valid, false);
  assert.ok(badPhone.errors.some((e) => e.includes('phone')));

  const badMetadata = validateFeedbackImportRow(
    { phone: '9876543210', name: 'Jane', brand: 'fitty', metadata: 'not-json' },
    6
  );
  assert.equal(badMetadata.valid, false);
  assert.ok(badMetadata.errors.some((e) => e.includes('metadata')));

  const templateBuffer = buildFeedbackImportTemplateBuffer();
  assert.ok(templateBuffer.length > 0);

  const parsed = parseFeedbackImportSheet(templateBuffer);
  assert.equal(parsed.summary.total, 1);
  assert.equal(parsed.summary.valid, 1);
  assert.equal(parsed.summary.invalid, 0);

  assert.throws(
    () => parseFeedbackImportSheet(Buffer.from('not excel')),
    (err: unknown) => err instanceof Error
  );

  console.log('Feedback import tests passed.');
}

run();
