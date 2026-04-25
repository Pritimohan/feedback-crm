'use client';

import React from 'react';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';

const ITEMS = [
  { stage: followupStageLabel(0), product: 'First feedback touch — rapport + context', color: '#1D4838' },
  { stage: followupStageLabel(1), product: 'NPS / review reminder — light nudge', color: '#134175' },
  {
    stage: followupStageLabel(2),
    product: 'Final cadence — resolution, check-in, or testimonial ask',
    color: '#E7580B',
  },
  {
    stage: followupStageLabel(3),
    product: 'Last attempt — final close-out and wrap-up',
    color: '#8A2BE2',
  },
];

export function ProductFocusList() {
  return (
    <div>
      {ITEMS.map((p) => (
        <div
          key={p.stage}
          className="flex items-center gap-2.5 border-b border-[var(--border)] py-2 last:border-0"
        >
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="flex-1 text-sm" style={{ color: 'var(--text2)' }}>
            {p.stage}
          </span>
          <span
            className="max-w-[180px] text-right text-[11px]"
            style={{ color: 'var(--text2)' }}
          >
            {p.product}
          </span>
        </div>
      ))}
    </div>
  );
}
