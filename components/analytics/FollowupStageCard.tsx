'use client';

import React from 'react';

interface FollowupStageCardProps {
  name: string;
  objective: string;
  mainPct: number;
  target: number;
  statLabel: string;
  attempted: number;
  connected: number;
  converted: number;
  onTarget: boolean;
  color: string;
  showConverted: boolean;
}

export function FollowupStageCard({
  name,
  objective,
  mainPct,
  target,
  statLabel,
  attempted,
  connected,
  converted,
  onTarget,
  color,
  showConverted,
}: FollowupStageCardProps) {
  const connPct = attempted > 0 ? Math.round((connected / attempted) * 100) : 0;

  return (
    <div
      className="overflow-hidden rounded-[14px]"
      style={{ border: '0.5px solid var(--border2)' }}
    >
      <div className="px-3.5 py-3" style={{ background: color }}>
        <div className="text-[11px] font-semibold text-white/95">{name}</div>
        <div className="mt-0.5 text-[10px] text-white/55">{objective}</div>
        <div className="mt-2 text-2xl font-medium text-white">{mainPct}%</div>
        <div className="text-[10px] text-white/50">
          {statLabel} · target {target}%
        </div>
      </div>
      <div className="bg-[var(--surface)] px-3.5 py-3">
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span style={{ color: 'var(--text2)' }}>Attempted</span>
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {attempted}
          </span>
        </div>
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span style={{ color: 'var(--text2)' }}>Connected</span>
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {connected} ({connPct}%)
          </span>
        </div>
        {showConverted && (
          <div className="mb-1.5 flex justify-between text-[11px]">
            <span style={{ color: 'var(--text2)' }}>Converted</span>
            <span className="font-medium" style={{ color }}>
              {converted}
            </span>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-[10px]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              background: onTarget ? '#1D4838' : '#E7580B',
            }}
          />
          <span
            style={{
              color: onTarget ? '#1D4838' : '#E7580B',
            }}
          >
            {onTarget ? 'On target' : 'Below target'}
          </span>
        </div>
      </div>
    </div>
  );
}
