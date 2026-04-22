'use client';

import React from 'react';

interface FunnelProgressBarProps {
  label: string;
  value: number;
  total: number;
  barColor: string;
}

export function FunnelProgressBar({
  label,
  value,
  total,
  barColor,
}: FunnelProgressBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
          {label}
        </span>
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {value}
          </span>
          <span className="ml-1 text-[10px]" style={{ color: 'var(--text3)' }}>
            {pct}%
          </span>
        </div>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-[3px]"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-[3px] transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: barColor,
          }}
        />
      </div>
    </div>
  );
}
