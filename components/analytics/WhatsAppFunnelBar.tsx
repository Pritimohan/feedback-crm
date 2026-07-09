'use client';

import React from 'react';

interface WhatsAppFunnelBarProps {
  unreachableCount: number;
}

const STAGES = [
  { label: 'Unreachable (3 attempts)', value: 0, color: '#E7580B' },
  { label: 'WhatsApp flow triggered', value: 0, color: '#FCB92D' },
  { label: 'Message delivered', value: 0, color: '#134175' },
  { label: 'Re-engaged via WhatsApp', value: 0, color: '#1D4838' },
];

export function WhatsAppFunnelBar({ unreachableCount }: WhatsAppFunnelBarProps) {
  const maxVal = unreachableCount || 1;

  const stagesWithValues = STAGES.map((s, i) => ({
    ...s,
    value: i === 0 ? unreachableCount : 0,
  }));

  return (
    <div>
      {stagesWithValues.map((s) => {
        const pct = maxVal > 0 ? Math.round((s.value / maxVal) * 100) : 0;
        return (
          <div key={s.label} className="mb-2">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                {s.label}
              </span>
              <span className="text-sm font-medium" style={{ color: s.color }}>
                {s.value}
              </span>
            </div>
            <div
              className="h-1.5 rounded-[3px]"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-[3px] transition-[width] duration-500"
                style={{ width: `${pct}%`, background: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
