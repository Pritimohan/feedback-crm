'use client';

import React from 'react';
import { FunnelProgressBar } from './FunnelProgressBar';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

interface OverallCallFunnelProps {
  totalLeads: number;
  newLeads: number;
  rescheduledLeads: number;
}

export function OverallCallFunnel({
  totalLeads,
  newLeads,
  rescheduledLeads,
}: OverallCallFunnelProps) {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const steps: FunnelStep[] = [
    { label: 'Leads assigned', value: totalLeads, color: '#1D4838' },
    { label: `New leads (${followupUiLabel(0)}, 0 attempts)`, value: newLeads, color: '#2d6050' },
    {
      label: `Rescheduled leads (not ${followupUiLabel(0)} with 0 attempts)`,
      value: rescheduledLeads,
      color: '#134175',
    },
  ];

  const dropLabels = [
    totalLeads > 0 ? `${pct(newLeads, totalLeads)}% new (${followupUiLabel(0)})` : null,
    totalLeads > 0 ? `${pct(rescheduledLeads, totalLeads)}% not new` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <FunnelProgressBar
            label={step.label}
            value={step.value}
            total={totalLeads || 1}
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
