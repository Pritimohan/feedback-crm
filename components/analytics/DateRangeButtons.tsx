'use client';

import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import type { AnalyticsFilterType } from '@/types/analytics';

interface DateRangeButtonsProps {
  value: AnalyticsFilterType;
  onChange: (v: AnalyticsFilterType) => void;
  customDateRange: [string, string] | null;
  onCustomDateRangeChange: (range: [string, string] | null) => void;
}

const OPTIONS: { value: AnalyticsFilterType; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Quarter' },
];

export function DateRangeButtons({
  value,
  onChange,
  customDateRange,
  onCustomDateRangeChange,
}: DateRangeButtonsProps) {
  const handleRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      onChange('custom');
      onCustomDateRangeChange([
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD'),
      ]);
    } else {
      onCustomDateRangeChange(null);
      if (value === 'custom') onChange('week');
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value && !customDateRange;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onCustomDateRangeChange(null);
                onChange(opt.value);
              }}
              className="rounded-[20px] border px-3.5 py-1.5 text-[11px] transition-colors"
              style={{
                borderColor: isActive ? 'var(--fg)' : 'var(--border2)',
                background: isActive ? 'var(--fg)' : 'var(--surface)',
                color: isActive ? 'var(--lime)' : 'var(--text2)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <DatePicker.RangePicker
        value={
          customDateRange
            ? [dayjs(customDateRange[0]), dayjs(customDateRange[1])]
            : null
        }
        onChange={handleRangeChange}
        format="DD MMM YYYY"
        size="small"
        allowClear
        placeholder={['Start', 'End']}
        className="analytics-date-range-picker"
        style={{
          borderRadius: 20,
          borderColor: value === 'custom' ? 'var(--fg)' : 'var(--border2)',
          fontSize: 11,
        }}
      />
    </div>
  );
}
