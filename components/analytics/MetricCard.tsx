'use client';

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  dotColor: string;
}

export function MetricCard({ label, value, subtitle, dotColor }: MetricCardProps) {
  return (
    <div
      className="relative rounded-[10px] p-3"
      style={{ background: 'var(--surface2)' }}
    >
      <div
        className="absolute right-3 top-3 h-[7px] w-[7px] rounded-full"
        style={{ background: dotColor }}
      />
      <div
        className="mb-1 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text3)' }}
      >
        {label}
      </div>
      <div
        className="text-[22px] font-medium"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[10px]"
        style={{ color: 'var(--text2)' }}
      >
        {subtitle}
      </div>
    </div>
  );
}
