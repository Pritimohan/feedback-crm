import assert from 'node:assert/strict';
import { resolveExotelExophone } from './exotelExophone';

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void | Promise<void>
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

const noDb = async () => null;

async function main() {
  console.log('exotelExophone tests');

  await withEnv(
    {
      EXOTEL_EXOPHONE_FITTY: '+911111111111',
      EXOTEL_EXOPHONE_FITELO: '+912222222222',
      EXOTEL_EXOPHONE: undefined,
    },
    async () => {
      assert.equal(await resolveExotelExophone('fitty', undefined, noDb), '+911111111111');
      assert.equal(await resolveExotelExophone('fitelo', undefined, noDb), '+912222222222');
      assert.equal(await resolveExotelExophone(null, undefined, noDb), '+911111111111');
      assert.equal(
        await resolveExotelExophone('fitty', '+919999999999', noDb),
        '+919999999999'
      );
      console.log('  OK brand-specific env vars');
    }
  );

  await withEnv(
    {
      EXOTEL_EXOPHONE_FITTY: undefined,
      EXOTEL_EXOPHONE_FITELO: '+912222222222',
      EXOTEL_EXOPHONE: '+910000000000',
    },
    async () => {
      assert.equal(await resolveExotelExophone('fitty', undefined, noDb), '+910000000000');
      console.log('  OK fitty legacy fallback');
    }
  );

  await withEnv(
    {
      EXOTEL_EXOPHONE_FITTY: undefined,
      EXOTEL_EXOPHONE_FITELO: undefined,
      EXOTEL_EXOPHONE: undefined,
    },
    async () => {
      await assert.rejects(
        () => resolveExotelExophone('fitelo', undefined, noDb),
        /Exophone is not configured for fitelo/
      );
      await assert.rejects(
        () => resolveExotelExophone('fitty', undefined, noDb),
        /Exophone is not configured for fitty/
      );
      console.log('  OK missing config errors');
    }
  );

  await withEnv(
    {
      EXOTEL_EXOPHONE_FITTY: '+911111111111',
      EXOTEL_EXOPHONE_FITELO: '+912222222222',
      EXOTEL_EXOPHONE: undefined,
    },
    async () => {
      const dbLookup = async (brand: string | null | undefined) =>
        brand === 'fitelo' ? '+913333333333' : '+914444444444';

      assert.equal(
        await resolveExotelExophone('fitty', undefined, dbLookup),
        '+914444444444'
      );
      assert.equal(
        await resolveExotelExophone('fitelo', undefined, dbLookup),
        '+913333333333'
      );
      assert.equal(
        await resolveExotelExophone('fitty', '+919999999999', dbLookup),
        '+919999999999'
      );
      console.log('  OK DB over env precedence');
    }
  );

  console.log('All exotelExophone tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
