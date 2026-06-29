import {
  ensureBusinessDayScheduledDate,
  isDtSchedulingPickerDateDisabled,
  isSundayInSchedulingTz,
} from './schedulingDates';
import dayjs from 'dayjs';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`);
  }
}

console.log('schedulingDates tests');

const sundayIst = new Date('2026-06-28T08:30:00.000Z');
assert('Sunday detected in IST', isSundayInSchedulingTz(sundayIst));

const mondayFromSunday = ensureBusinessDayScheduledDate(sundayIst);
assert('Sunday shifts to Monday', !isSundayInSchedulingTz(mondayFromSunday));
assert(
  'Sunday shift preserves time-of-day',
  dayjs(mondayFromSunday).hour() === dayjs(sundayIst).hour()
);

const weekday = new Date('2026-06-29T08:30:00.000Z');
assert(
  'Weekday unchanged',
  ensureBusinessDayScheduledDate(weekday).getTime() === weekday.getTime()
);

const todayStart = dayjs().startOf('day');
const yesterday = todayStart.subtract(1, 'day');
assert('Picker disables past dates', isDtSchedulingPickerDateDisabled(yesterday, todayStart));

const nextSunday = todayStart.add(7 - todayStart.day(), 'day');
if (nextSunday.day() === 0) {
  assert('Picker disables Sundays', isDtSchedulingPickerDateDisabled(nextSunday, todayStart));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
