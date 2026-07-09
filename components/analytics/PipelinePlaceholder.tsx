'use client';

import React from 'react';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';

const COHORT_ITEMS = [
  { label: `Pending ${followupStageLabel(0)}`, count: 0, sublabel: 'leads in queue', color: '#1D4838' },
  { label: `Pending ${followupStageLabel(1)}`, count: 0, sublabel: 'leads in queue', color: '#134175' },
  { label: `Pending ${followupStageLabel(2)}`, count: 0, sublabel: 'leads in queue', color: '#E7580B' },
  { label: `Pending ${followupStageLabel(3)}`, count: 0, sublabel: 'leads in queue', color: '#8A2BE2' },
  { label: 'Alternate channel (e.g. WhatsApp)', count: 0, sublabel: 'placeholder', color: '#88CEEB' },
];

const ALERTS = [
  {
    type: 'red' as const,
    title: 'No actionable alerts',
    sub: 'Pipeline and adherence data not yet available.',
  },
];

const ADHERENCE_DATA = [0, 0, 0, 0, 0];

export function PipelinePlaceholder() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="rounded-[14px] border p-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border2)',
          }}
        >
          <div
            className="mb-4 font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}
          >
            Live cohort pipeline — leads pending each stage
          </div>
          {COHORT_ITEMS.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 border-b border-[var(--border)] py-2 last:border-0"
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="flex-1 text-sm" style={{ color: 'var(--text2)' }}>
                {s.label}
              </span>
              <div className="text-right">
                <div className="text-[13px] font-medium">{s.count} {s.sublabel}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-[14px] border p-4"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border2)',
          }}
        >
          <div
            className="mb-4 font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}
          >
            Adherence score distribution (1–5 scale)
          </div>
          <div className="flex h-[175px] items-end gap-1">
            {ADHERENCE_DATA.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded bg-[var(--surface2)] transition-all"
                style={{ height: `${(v / (Math.max(...ADHERENCE_DATA, 1) || 1)) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px]" style={{ color: 'var(--text3)' }}>
            <span>1 — low</span>
            <span>5 — high</span>
          </div>
        </div>
      </div>

      <div
        className="rounded-[14px] border p-4"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border2)',
        }}
      >
        <div
          className="mb-4 font-semibold"
          style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}
        >
          Actionable flags — requires attention today
        </div>
        {ALERTS.map((a, i) => (
          <div
            key={i}
            className="mb-2 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              background:
                a.type === 'red'
                  ? 'rgba(231,88,11,.07)'
                  : a.type === 'amber'
                    ? 'rgba(252,185,45,.1)'
                    : 'rgba(29,72,56,.07)',
            }}
          >
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  a.type === 'red' ? '#E7580B' : a.type === 'amber' ? '#FCB92D' : '#1D4838',
              }}
            />
            <div>
              <div className="font-medium" style={{ color: 'var(--text)' }}>
                {a.title}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text2)' }}>
                {a.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-[14px] border p-4"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border2)',
        }}
      >
        <div
          className="mb-4 font-semibold"
          style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}
        >
          Follow-up volume outlook — next 7 days (placeholder)
        </div>
        <div
          className="h-[200px] text-center text-sm"
          style={{ color: 'var(--text3)' }}
        >
          No forecast data available
        </div>
      </div>
    </div>
  );
}
