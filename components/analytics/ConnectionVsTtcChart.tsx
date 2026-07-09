'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { DietitianAnalyticsRow } from '@/types/analytics';

interface ConnectionVsTtcChartProps {
  dietitians: DietitianAnalyticsRow[];
}

export function ConnectionVsTtcChart({ dietitians }: ConnectionVsTtcChartProps) {
  const data = dietitians
    .filter((d) => d.attempted > 0)
    .map((d) => ({
      x: d.tToCallHours || 0,
      y: d.connPct,
      name: d.dtName.split(' ')[0] ?? d.dtName,
    }));

  if (data.length === 0) {
    return (
      <div
        className="flex h-[200px] items-center justify-center text-sm"
        style={{ color: 'var(--text3)' }}
      >
        No data for this period
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
          <XAxis
            dataKey="x"
            type="number"
            name="Hours to first call"
            tick={{ fontSize: 10, fill: '#888' }}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Connection rate %"
            tick={{ fontSize: 10, fill: '#888' }}
            domain={[0, 100]}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload?.[0]) {
                const p = payload[0].payload as { name: string; x: number; y: number };
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border2)',
                    }}
                  >
                    {p.name}: {p.x}h → {p.y}%
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter data={data} fill="#1D4838" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
