export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))];
  return `\uFEFF${lines.join('\n')}`;
}
