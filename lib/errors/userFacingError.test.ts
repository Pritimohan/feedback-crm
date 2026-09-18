import assert from 'node:assert/strict';
import {
  extractErrorFromBody,
  extractMessageFromXml,
  toUserFacingMessage,
} from './userFacingError';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<TwilioResponse>
  <RestException>
    <Status>400</Status>
    <Message>Could not find the CallerId from which this call can be made</Message>
  </RestException>
</TwilioResponse>`;

function main() {
  console.log('userFacingError tests');

  assert.equal(
    extractMessageFromXml(SAMPLE_XML),
    'Could not find the CallerId from which this call can be made'
  );
  assert.equal(extractMessageFromXml('no xml here'), undefined);

  assert.equal(
    extractErrorFromBody({ error: SAMPLE_XML }),
    'Could not find the CallerId from which this call can be made'
  );
  assert.equal(
    extractErrorFromBody({
      RestException: { Message: 'Could not find the CallerId from which this call can be made' },
    }),
    'Could not find the CallerId from which this call can be made'
  );
  assert.equal(extractErrorFromBody({ error: 'Phone required' }), 'Phone required');
  assert.equal(extractErrorFromBody({ message: 'Nope' }), 'Nope');
  assert.equal(extractErrorFromBody({}), undefined);

  const mapped = toUserFacingMessage(new Error(SAMPLE_XML), 'Failed to initiate call');
  assert.match(mapped, /CallerId/i);
  assert.match(mapped, /Admin → Config → Calling/);
  assert.doesNotMatch(mapped, /<\?xml/);

  assert.equal(
    toUserFacingMessage(new Error('Something custom from API'), 'fallback'),
    'Something custom from API'
  );
  assert.equal(toUserFacingMessage(null, 'fallback'), 'fallback');
  assert.equal(toUserFacingMessage({}, 'fallback'), 'fallback');

  assert.equal(
    toUserFacingMessage(
      new Error(
        'Exotel call failed (400 Bad Request): Could not find the CallerId from which this call can be made'
      ),
      'fallback'
    ).includes('Admin → Config → Calling'),
    true
  );

  assert.equal(
    toUserFacingMessage(new Error('Unauthorized'), 'fallback'),
    'Unauthorized'
  );

  console.log('All userFacingError tests passed');
}

main();
