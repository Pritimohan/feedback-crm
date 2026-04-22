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
import type { DietitianAnalyticsRow } from '@/types/analytics';

interface ConnectedByDietitianChartProps {
  dietitians: DietitianAnalyticsRow[];
  onSelectDietitian?: (dt: { dtId: string; dtName: string }) => void;
  selectedDtId?: string | null;
}

export function ConnectedByDietitianChart({
  dietitians,
  onSelectDietitian,
  selectedDtId,
}: ConnectedByDietitianChartProps) {
  const maxConn = Math.max(...dietitians.map((d) => d.connected), 1);
  const data = dietitians.map((d) => ({
    dtId: d.dtId,
    dtName: d.dtName,
    name: d.dtName.split(' ')[0] ?? d.dtName,
    connected: d.connected,
    isTop: d.connected === maxConn && d.connected > 0,
    isSelected: Boolean(selectedDtId && d.dtId === selectedDtId),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
          <XAxis
            dataKey="name"
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
            formatter={(v: number | string) => [String(v), 'Connected']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border2)',
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="connected"
            fill="#1D4838"
            radius={[4, 4, 0, 0]}
            name="Connected"
            onClick={(_state, index) => {
              if (!onSelectDietitian || index == null || index < 0) return;
              const p = data[index];
              if (!p?.dtId) return;
              onSelectDietitian({ dtId: p.dtId, dtName: p.dtName });
            }}
            style={{ cursor: onSelectDietitian ? 'pointer' : 'default' }}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isTop ? '#D5F369' : '#1D4838'}
                opacity={entry.isSelected ? 0.65 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
