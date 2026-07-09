import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Same timezone as analytics / business calendar (IST by default). */
export const SCHEDULING_TIMEZONE = process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata';

export function isSundayInSchedulingTz(date: Date): boolean {
  return dayjs(date).tz(SCHEDULING_TIMEZONE).day() === 0;
}

/**
 * If the date falls on Sunday in the scheduling timezone, shift to Monday
 * (preserving time-of-day). Otherwise return the input unchanged.
 */
export function ensureBusinessDayScheduledDate(date: Date): Date {
  const d = dayjs(date).tz(SCHEDULING_TIMEZONE);
  if (d.day() !== 0) {
    return date;
  }
  return d.add(1, 'day').toDate();
}

/** Ant Design DatePicker: disable past dates and Sundays. */
export function isDtSchedulingPickerDateDisabled(
  current: dayjs.Dayjs | null,
  todayStart: dayjs.Dayjs
): boolean {
  if (!current) return false;
  if (current.isBefore(todayStart, 'day')) return true;
  return isSundayInSchedulingTz(current.toDate());
}
