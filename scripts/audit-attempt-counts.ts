/**
 * Read-only audit: compare lead_lifecycle_followup_attempts vs call_logs linkage.
 *
 * Usage: npx tsx scripts/audit-attempt-counts.ts [startDate] [endDate]
 * Dates in YYYY-MM-DD (IST). Defaults to last 7 days.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { ANALYTICS_TIMEZONE } from '../lib/utils/analyticsDates';

dayjs.extend(utc);
dayjs.extend(timezone);

async function main() {
  const tz = ANALYTICS_TIMEZONE;
  const endArg = process.argv[3];
  const startArg = process.argv[2];
  const endDay = endArg ? dayjs.tz(endArg, tz) : dayjs().tz(tz);
  const startDay = startArg ? dayjs.tz(startArg, tz) : endDay.subtract(6, 'day');
  const startIso = startDay.startOf('day').toISOString();
  const endIso = endDay.endOf('day').toISOString();

  console.log(`Audit attempt counts: ${startDay.format('YYYY-MM-DD')} → ${endDay.format('YYYY-MM-DD')} (${tz})\n`);

  const [attemptsWithoutLogs, logsWithoutAttemptId, dailyMismatch, attributionDelta] =
    await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM lead_lifecycle_followup_attempts fa
        LEFT JOIN call_logs cl ON cl.attempt_id = fa.id
        WHERE cl.id IS NULL
          AND fa.attempt_date >= ${startIso}::timestamp
          AND fa.attempt_date <= ${endIso}::timestamp
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM call_logs cl
        WHERE cl.attempt_id IS NULL
          AND cl.created_at >= ${startIso}::timestamp
          AND cl.created_at <= ${endIso}::timestamp
      `),
      db.execute(sql`
        SELECT
          date_trunc('day', fa.attempt_date AT TIME ZONE ${tz})::date AS day_ist,
          COUNT(fa.id)::int AS attempt_rows,
          COUNT(cl.id) FILTER (WHERE cl.attempt_id IS NOT NULL)::int AS linked_log_rows
        FROM lead_lifecycle_followup_attempts fa
        LEFT JOIN call_logs cl ON cl.attempt_id = fa.id
        WHERE fa.attempt_date >= ${startIso}::timestamp
          AND fa.attempt_date <= ${endIso}::timestamp
        GROUP BY 1
        ORDER BY 1
      `),
      db.execute(sql`
        SELECT
          u_dial.name AS dialing_agent,
          u_assign.name AS assigned_agent,
          COUNT(*)::int AS cnt
        FROM lead_lifecycle_followup_attempts fa
        INNER JOIN lead_lifecycle_followups lf ON fa.followup_id = lf.id
        INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
        INNER JOIN leads l ON ol.lead_id = l.id
        INNER JOIN users u_dial ON fa.dt_id = u_dial.id
        LEFT JOIN users u_assign ON l.assigned_dt_id = u_assign.id
        WHERE fa.dt_id IS DISTINCT FROM l.assigned_dt_id
          AND fa.attempt_date >= ${startIso}::timestamp
          AND fa.attempt_date <= ${endIso}::timestamp
        GROUP BY u_dial.name, u_assign.name
        ORDER BY cnt DESC
        LIMIT 20
      `),
    ]);

  const row = (r: unknown) => {
    const rows = Array.isArray(r) ? r : (r as { rows?: unknown[] })?.rows ?? [];
    return rows;
  };

  const attemptsNoLog = Number((row(attemptsWithoutLogs)[0] as { cnt?: number })?.cnt ?? 0);
  const logsNoAttempt = Number((row(logsWithoutAttemptId)[0] as { cnt?: number })?.cnt ?? 0);

  console.log('Summary');
  console.log(`  Attempt rows without call_logs link: ${attemptsNoLog}`);
  console.log(`  call_logs rows without attempt_id:   ${logsNoAttempt}`);

  console.log('\nDaily attempts vs linked logs');
  for (const d of row(dailyMismatch) as { day_ist?: string; attempt_rows?: number; linked_log_rows?: number }[]) {
    const day = d.day_ist ?? '?';
    const attempts = Number(d.attempt_rows ?? 0);
    const linked = Number(d.linked_log_rows ?? 0);
    const flag = attempts !== linked ? '  ← mismatch' : '';
    console.log(`  ${day}: attempts=${attempts}, linked_logs=${linked}${flag}`);
  }

  console.log('\nDialing agent ≠ assigned agent (top 20 pairs)');
  const attrRows = row(attributionDelta) as {
    dialing_agent?: string;
    assigned_agent?: string;
    cnt?: number;
  }[];
  if (attrRows.length === 0) {
    console.log('  (none)');
  } else {
    for (const a of attrRows) {
      console.log(
        `  ${a.dialing_agent ?? '?'} dialed, ${a.assigned_agent ?? 'unassigned'} assigned: ${a.cnt ?? 0}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
