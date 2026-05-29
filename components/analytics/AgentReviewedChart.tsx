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

interface AgentReviewedChartProps {
  agents: DietitianAnalyticsRow[];
  onSelectAgent?: (dt: { dtId: string; dtName: string }) => void;
  selectedDtId?: string | null;
}

export function AgentReviewedChart({
  agents,
  onSelectAgent,
  selectedDtId,
}: AgentReviewedChartProps) {
  const maxReviewed = Math.max(...agents.map((d) => d.reviewed), 1);
  const data = agents
    .filter((d) => d.reviewed > 0 || d.connected > 0)
    .map((d) => ({
      dtId: d.dtId,
      dtName: d.dtName,
      name: d.dtName.split(' ')[0] ?? d.dtName,
      reviewed: d.reviewed,
      conversionPct: d.conversionPct,
      isTop: d.reviewed === maxReviewed && d.reviewed > 0,
      isSelected: Boolean(selectedDtId && d.dtId === selectedDtId),
    }));

  if (data.length === 0) {
    return (
      <div
        className="flex h-[200px] items-center justify-center text-sm"
        style={{ color: 'var(--text3)' }}
      >
        No reviewed outcomes in this period
      </div>
    );
  }

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
            formatter={(v: number | string, _name: string, props: { payload?: { conversionPct?: number } }) => {
              const pct = props?.payload?.conversionPct ?? 0;
              return [`${v} reviewed (${pct}% conv.)`, 'Reviewed'];
            }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border2)',
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="reviewed"
            fill="#D5F369"
            radius={[4, 4, 0, 0]}
            name="Reviewed"
            onClick={(_state, index) => {
              if (!onSelectAgent || index == null || index < 0) return;
              const p = data[index];
              if (!p?.dtId) return;
              onSelectAgent({ dtId: p.dtId, dtName: p.dtName });
            }}
            style={{ cursor: onSelectAgent ? 'pointer' : 'default' }}
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
