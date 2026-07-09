import { escapeCsv, buildCsv } from '@/lib/utils/csv';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testEscapeCsv() {
  assert(escapeCsv('plain') === 'plain', 'plain text unchanged');
  assert(escapeCsv('a,b') === '"a,b"', 'comma quoted');
  assert(escapeCsv('say "hi"') === '"say ""hi"""', 'quotes escaped');
  assert(escapeCsv('line\nbreak') === '"line\nbreak"', 'newline quoted');
}

function testBuildCsv() {
  const csv = buildCsv(['name', 'note'], [['Alice', 'hello'], ['Bob', 'a,b']]);
  assert(csv.startsWith('\uFEFF'), 'includes UTF-8 BOM');
  assert(csv.includes('name,note'), 'header row present');
  assert(csv.includes('"a,b"'), 'cell values escaped in rows');
}

testEscapeCsv();
testBuildCsv();
console.log('csv.test.ts: all tests passed');
