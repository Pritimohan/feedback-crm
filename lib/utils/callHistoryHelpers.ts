import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export interface CallLog {
  id: string;
  customerName: string;
  customerPhone: string;
  outcome: string;
  /** Follow-up stage number (0–3), not dial attempt count. */
  followupStage: number;
  updatedAt: string;
  customerId: string;
  leadType?: string;
  durationSec?: number;
}

export interface GroupedCalls {
  date: string;
  dateLabel: string;
  calls: CallLog[];
}

export function groupCallsByDate(calls: CallLog[]): GroupedCalls[] {
  const grouped = new Map<string, CallLog[]>();

  const sortedCalls = [...calls].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  sortedCalls.forEach((call) => {
    const dateKey = dayjs(call.updatedAt).format('YYYY-MM-DD');
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(call);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([date, groupedCalls]) => ({
      date,
      dateLabel: formatDateLabel(date),
      calls: groupedCalls,
    }));
}

export function formatDateLabel(dateString: string): string {
  const date = dayjs(dateString);
  const today = dayjs().startOf('day');
  const yesterday = today.subtract(1, 'day');

  if (date.isSame(today, 'day')) return 'Today';
  if (date.isSame(yesterday, 'day')) return 'Yesterday';
  return date.format('DD MMM YYYY');
}

export function getTimeAgo(timestamp: string): string {
  return dayjs(timestamp).fromNow();
}

export function getCallStatusInfo(outcome: string): {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  const normalized = (outcome || '').toLowerCase();

  switch (normalized) {
    case 'connected':
      return {
        label: 'Connected',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      };
    case 'busy':
      return {
        label: 'Busy',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
      };
    case 'no_answer':
    case 'not_answered':
    case 'no-answer':
      return {
        label: 'No Answer',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
      };
    case 'wrong_number':
    case 'wrong-number':
      return {
        label: 'Wrong Number',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      };
    case 'cnr':
      return {
        label: 'CNR',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200',
      };
    case 'not_interested':
      return {
        label: 'Not Interested',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200',
      };
    default:
      return {
        label: 'No Answer',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
      };
  }
}

export function getCountryFlag(): string {
  return 'IN';
}
