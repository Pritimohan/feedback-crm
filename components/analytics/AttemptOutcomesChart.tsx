'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { OutcomeCountRow } from '@/types/analytics';

const OUTCOME_COLORS: Record<string, string> = {
  connected: '#1D4838',
  busy: '#FCB92D',
  no_answer: 'rgba(29,72,56,.35)',
  wrong_number: '#E7580B',
  not_interested: '#b54000',
};

interface AttemptOutcomesChartProps {
  data: OutcomeCountRow[];
}

export function AttemptOutcomesChart({ data }: AttemptOutcomesChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    ...d,
    shortLabel: d.label.length > 12 ? d.label.split(' ')[0] : d.label,
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  if (total === 0) {
    return (
      <div
        className="flex h-[200px] items-center justify-center text-sm"
        style={{ color: 'var(--text3)' }}
      >
        No call attempts in this period
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#888' }}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number | string, _name: string, props: { payload?: OutcomeCountRow & { pct?: number } }) => {
              const p = props?.payload;
              return [`${v} attempts (${p?.pct ?? 0}%)`, p?.label ?? 'Count'];
            }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border2)',
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Attempts">
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={OUTCOME_COLORS[entry.key] ?? '#1D4838'}
                opacity={entry.count === 0 ? 0.25 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
