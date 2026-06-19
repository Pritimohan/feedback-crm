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

export interface StageComparisonRow {
  name: string;
  attempted: number;
  connected: number;
  reviewed: number;
  issue_with_product: number;
  interested: number;
  didnt_reviewed: number;
  unknown?: number;
}

interface StageComparisonChartProps {
  data: StageComparisonRow[];
}

const SERIES_META: {
  key: keyof Omit<StageComparisonRow, 'name'>;
  label: string;
  fill: string;
  description?: string;
}[] = [
  { key: 'attempted', label: 'Unique Attempts', fill: 'rgba(29,72,56,.18)' },
  {
    key: 'connected',
    label: 'Connected',
    fill: '#1D4838',
    description: 'Marked connected in CRM (sum of outcomes below)',
  },
  { key: 'reviewed', label: 'Reviewed', fill: '#D5F369' },
  { key: 'issue_with_product', label: 'Issue', fill: '#FCB92D' },
  { key: 'interested', label: 'Interested', fill: '#134175' },
  { key: 'didnt_reviewed', label: "Didn't review", fill: '#E7580B' },
  { key: 'unknown', label: 'Unknown', fill: '#9CA3AF' },
];

export function StageComparisonChart({ data }: StageComparisonChartProps) {
  return (
    <div className="h-[240px] w-full">
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
            cursor={{ fill: 'rgba(29, 72, 56, 0.06)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as StageComparisonRow | undefined;
              return (
                <div
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--border2)',
                    background: '#ffffff',
                    padding: '10px 12px',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                    maxWidth: 280,
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#1D4838' }}>
                    {row?.name ?? label}
                  </p>
                  {SERIES_META.filter((series) => {
                    if (series.key !== 'unknown') return true;
                    return (row?.unknown ?? 0) > 0;
                  }).map((series) => (
                    <p
                      key={series.key}
                      style={{
                        margin: '4px 0 0',
                        color: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      title={series.description}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: series.fill,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, color: '#1D4838' }}>{series.label}:</span>
                      <span>{row?.[series.key] ?? 0}</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {SERIES_META.filter((series) => series.key !== 'unknown').map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={series.fill}
              radius={[3, 3, 0, 0]}
              name={series.label}
            />
          ))}
          {data.some((row) => (row.unknown ?? 0) > 0) ? (
            <Bar
              key="unknown"
              dataKey="unknown"
              fill="#9CA3AF"
              radius={[3, 3, 0, 0]}
              name="Unknown"
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
