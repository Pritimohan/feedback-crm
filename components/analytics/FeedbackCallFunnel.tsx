'use client';

import React from 'react';
import { FunnelProgressBar } from './FunnelProgressBar';
import type { FunnelSummary } from '@/types/analytics';

interface FeedbackCallFunnelProps {
  summary: FunnelSummary;
}

export function FeedbackCallFunnel({ summary }: FeedbackCallFunnelProps) {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const { totalLeads, attempted, connected, converted } = summary;
  const overallTotal = totalLeads || 1;

  const steps = [
    { label: 'Leads assigned', value: totalLeads, color: '#1D4838' },
    { label: 'Unique Attempts', value: attempted, color: '#2d6050' },
    { label: 'Connected', value: connected, color: '#134175' },
    { label: 'Reviewed (converted)', value: converted, color: '#D5F369' },
  ];

  const dropLabels: (string | null)[] = [
    totalLeads > 0 ? `${pct(attempted, totalLeads)}% unique customer-days` : null,
    attempted > 0 ? `${pct(connected, attempted)}% of attempted` : null,
    connected > 0 ? `${pct(converted, connected)}% of connected` : null,
    null,
  ];

  return (
    <div>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <FunnelProgressBar
            label={step.label}
            value={step.value}
            total={overallTotal}
            barColor={step.color}
          />
          {dropLabels[i] && (
            <div
              className="flex items-center gap-1.5 py-0.5 text-[10px]"
              style={{ color: 'var(--text3)' }}
            >
              <span className="flex-1 border-t border-[var(--border)]" />
              <span>{dropLabels[i]}</span>
              <span className="flex-1 border-t border-[var(--border)]" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
