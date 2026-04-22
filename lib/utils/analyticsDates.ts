import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(quarterOfYear);

const ANALYTICS_TIMEZONE = process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata';

export type AnalyticsFilterType =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'quarter'
  | 'custom';

/**
 * Get start and end of day in analytics timezone for consistent date boundaries.
 * Uses Asia/Kolkata (IST) by default - set ANALYTICS_TIMEZONE env to override.
 */
export function getAnalyticsDateRange(
  filterType: AnalyticsFilterType,
  startDateParam?: string,
  endDateParam?: string
): { startDate: Date; endDate: Date } {
  const tz = ANALYTICS_TIMEZONE;

  try {
    if (filterType === 'today') {
      const startDate = dayjs().tz(tz).startOf('day').toDate();
      const endDate = dayjs().tz(tz).endOf('day').toDate();
      return { startDate, endDate };
    }

    if (filterType === 'yesterday') {
      const startDate = dayjs().tz(tz).subtract(1, 'day').startOf('day').toDate();
      const endDate = dayjs().tz(tz).subtract(1, 'day').endOf('day').toDate();
      return { startDate, endDate };
    }

    if (filterType === 'week') {
      const startDate = dayjs().tz(tz).startOf('week').toDate();
      const endDate = dayjs().tz(tz).endOf('week').toDate();
      return { startDate, endDate };
    }

    if (filterType === 'month') {
      const startDate = dayjs().tz(tz).startOf('month').toDate();
      const endDate = dayjs().tz(tz).endOf('month').toDate();
      return { startDate, endDate };
    }

    if (filterType === 'quarter') {
      const startDate = dayjs().tz(tz).startOf('quarter').toDate();
      const endDate = dayjs().tz(tz).endOf('quarter').toDate();
      return { startDate, endDate };
    }

    if (filterType === 'custom' && startDateParam && endDateParam) {
      const startDate = dayjs.tz(startDateParam, tz).startOf('day').toDate();
      const endDate = dayjs.tz(endDateParam, tz).endOf('day').toDate();
      return { startDate, endDate };
    }
  } catch {
    // Fallback if timezone plugin fails - use local time
  }

  const startDate = dayjs().startOf('day').toDate();
  const endDate = dayjs().endOf('day').toDate();
  return { startDate, endDate };
}
