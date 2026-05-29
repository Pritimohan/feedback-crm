import dotenv from 'dotenv';
import path from 'path';
import type { NightlyRedistributeBrandResult } from '@/lib/services/nightlyRedistributeService';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function printBrandDistribution(brandResult: NightlyRedistributeBrandResult) {
  const { brand, distributionByDt, totalEligible, followupsReassigned, message } = brandResult;

  console.log(`\n${'='.repeat(72)}`);
  console.log(`Brand: ${brand.toUpperCase()}  |  ${message}`);
  console.log(`${'='.repeat(72)}`);

  if (distributionByDt.length === 0) {
    console.log('(no active agents)');
    return;
  }

  const nameW = Math.max(10, ...distributionByDt.map((r) => r.dtName.length));
  const header = `${padEnd('Agent', nameW)}  ${padEnd('Before', 8)}  ${padEnd('After', 8)}  ${padEnd('Change', 8)}  FU0→  FU1+`;
  console.log(header);
  console.log('-'.repeat(header.length));

  let totalBefore = 0;
  let totalAfter = 0;

  for (const row of distributionByDt) {
    totalBefore += row.todayCallsBefore;
    totalAfter += row.todayCallsAfter;
    const changeStr =
      row.change === 0 ? '0' : row.change > 0 ? `+${row.change}` : String(row.change);
    console.log(
      `${padEnd(row.dtName, nameW)}  ${padEnd(String(row.todayCallsBefore), 8)}  ${padEnd(String(row.todayCallsAfter), 8)}  ${padEnd(changeStr, 8)}  ${padEnd(String(row.fu0TargetAfter), 4)}  ${row.fu1PlusToday}`
    );
  }

  console.log('-'.repeat(header.length));
  console.log(
    `${padEnd('TOTAL', nameW)}  ${padEnd(String(totalBefore), 8)}  ${padEnd(String(totalAfter), 8)}  ${padEnd(String(totalAfter - totalBefore), 8)}`
  );
  console.log(
    `\nFU0 eligible (today, followup 0): ${totalEligible}  |  Would move: ${followupsReassigned}`
  );
  console.log(
    '(Before/After = all pending calls due today per agent. FU0→ = target followup-0 count after rebalance. FU1+ = followup 1+ today calls, fixed. Attempts on FU0 are allowed.)'
  );
}

async function main() {
  const { redistributeNightlyStage0AllBrands } = await import(
    '@/lib/services/nightlyRedistributeService'
  );

  const result = await redistributeNightlyStage0AllBrands(true);

  console.log(`\nNightly stage-0 redistribution — DRY RUN`);
  console.log(`Scheduled at: ${result.scheduledAt}`);
  console.log(`Overall success: ${result.success}`);

  printBrandDistribution(result.fitty);
  printBrandDistribution(result.fitelo);

  if (process.argv.includes('--json')) {
    console.log('\n--- Full JSON ---');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nTip: pass --json to print the full API-shaped payload.');
  }
}

main().catch((error) => {
  console.error('[dry-run-nightly-redistribute-stage0] Failed:', error);
  process.exit(1);
});
