'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface StageData {
  name: string;
  attempted: number;
  connected: number;
  converted: number;
}

interface StageComparisonChartProps {
  data: StageData[];
}

export function StageComparisonChart({ data }: StageComparisonChartProps) {
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
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border2)',
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="attempted"
            fill="rgba(29,72,56,.18)"
            radius={[3, 3, 0, 0]}
            name="Attempted"
          />
          <Bar
            dataKey="connected"
            fill="#1D4838"
            radius={[3, 3, 0, 0]}
            name="Connected"
          />
          <Bar
            dataKey="converted"
            fill="#D5F369"
            radius={[3, 3, 0, 0]}
            name="Converted"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
