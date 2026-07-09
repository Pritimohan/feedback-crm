/**
 * Export all leads ever marked "Issue with product" to a CSV file.
 *
 * Usage:
 *   npm run export:issue-with-product
 *   npm run export:issue-with-product -- --brand fitelo
 *   npm run export:issue-with-product -- --brand fitty
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

const CSV_HEADERS = [
  'Client Name',
  'Phone',
  'Variant',
  'Date of Purchase',
  'Current DT Name',
  'Issue Description',
] as const;

type BrandFilter = 'fitty' | 'fitelo' | null;

function parseArgs(): { brand: BrandFilter } {
  const argv = process.argv;
  const brandIdx = argv.indexOf('--brand');
  if (brandIdx === -1 || !argv[brandIdx + 1]) {
    return { brand: null };
  }

  const brand = argv[brandIdx + 1].toLowerCase().trim();
  if (brand !== 'fitty' && brand !== 'fitelo') {
    throw new Error('--brand must be "fitty" or "fitelo"');
  }

  return { brand };
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function brandCondition(brand: BrandFilter) {
  if (brand === 'fitelo') return sql`AND l.brand = 'fitelo'`;
  if (brand === 'fitty') return sql`AND (l.brand = 'fitty' OR l.brand IS NULL)`;
  return sql``;
}

async function main() {
  const { brand } = parseArgs();
  const { db } = await import('../lib/db');

  const result = await db.execute(sql`
    SELECT DISTINCT ON (l.id)
      c.name   AS client_name,
      c.phone  AS phone,
      l.variant,
      l.purchase_date,
      u.name   AS current_dt_name,
      lf.payload->>'issue_description' AS issue_description
    FROM lead_lifecycle_followups lf
    INNER JOIN lead_lifecycles ol ON lf.lifecycle_id = ol.id
    INNER JOIN leads l ON ol.lead_id = l.id
    INNER JOIN customers c ON l.customer_id = c.id
    LEFT JOIN users u ON l.assigned_dt_id = u.id
    WHERE lf.status = 'connected'
      AND lf.payload->>'connected_choice' = 'issue_with_product'
      ${brandCondition(brand)}
    ORDER BY l.id, lf.connected_date DESC NULLS LAST
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];

  const csvLines = [
    CSV_HEADERS.join(','),
    ...(rows as Record<string, unknown>[]).map((row) =>
      [
        escapeCsv(String(row.client_name ?? '')),
        escapeCsv(String(row.phone ?? '')),
        escapeCsv(String(row.variant ?? '')),
        escapeCsv(String(row.purchase_date ?? '')),
        escapeCsv(String(row.current_dt_name ?? '')),
        escapeCsv(String(row.issue_description ?? '')),
      ].join(',')
    ),
  ];

  const exportDir = join(process.cwd(), 'export');
  mkdirSync(exportDir, { recursive: true });

  const filename = `issue-with-product-clients-${formatTimestamp(new Date())}.csv`;
  const outputPath = join(exportDir, filename);
  writeFileSync(outputPath, csvLines.join('\n'), 'utf8');

  const brandLabel = brand ?? 'all brands';
  console.log(`Exported ${rows.length} row(s) (${brandLabel}) to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
