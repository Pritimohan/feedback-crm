import assert from 'node:assert/strict';
import { resolveExotelExophone } from './exotelExophone';

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

console.log('exotelExophone tests');

withEnv(
  {
    EXOTEL_EXOPHONE_FITTY: '+911111111111',
    EXOTEL_EXOPHONE_FITELO: '+912222222222',
    EXOTEL_EXOPHONE: undefined,
  },
  () => {
    assert.equal(resolveExotelExophone('fitty'), '+911111111111');
    assert.equal(resolveExotelExophone('fitelo'), '+912222222222');
    assert.equal(resolveExotelExophone(null), '+911111111111');
    assert.equal(resolveExotelExophone('fitty', '+919999999999'), '+919999999999');
    console.log('  OK brand-specific env vars');
  }
);

withEnv(
  {
    EXOTEL_EXOPHONE_FITTY: undefined,
    EXOTEL_EXOPHONE_FITELO: '+912222222222',
    EXOTEL_EXOPHONE: '+910000000000',
  },
  () => {
    assert.equal(resolveExotelExophone('fitty'), '+910000000000');
    console.log('  OK fitty legacy fallback');
  }
);

withEnv(
  {
    EXOTEL_EXOPHONE_FITTY: undefined,
    EXOTEL_EXOPHONE_FITELO: undefined,
    EXOTEL_EXOPHONE: undefined,
  },
  () => {
    assert.throws(
      () => resolveExotelExophone('fitelo'),
      /EXOTEL_EXOPHONE_FITELO is not configured/
    );
    assert.throws(
      () => resolveExotelExophone('fitty'),
      /EXOTEL_EXOPHONE_FITTY \(or legacy EXOTEL_EXOPHONE\) is not configured/
    );
    console.log('  OK missing env errors');
  }
);

console.log('All exotelExophone tests passed');
