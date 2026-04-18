'use client';

import React from 'react';

interface StageTypeCardProps {
  label: string;
  obj: string;
  att: number;
  conn: number;
  sale: number;
  color: string;
}

export function StageTypeCard({
  label,
  obj,
  att,
  conn,
  sale,
  color,
}: StageTypeCardProps) {
  const connPct = att > 0 ? Math.round((conn / att) * 100) : 0;
  const salePct = conn > 0 && sale > 0 ? Math.round((sale / conn) * 100) : 0;

  return (
    <div
      className="mb-2.5 rounded-lg px-3 py-2"
      style={{ background: 'var(--surface2)' }}
    >
      <div className="mb-1 flex justify-between">
        <span className="text-[11px] font-medium" style={{ color }}>
          {label}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
          {obj}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5 text-[11px]">
        <span style={{ color: 'var(--text2)' }}>
          Att: <strong style={{ color: 'var(--text)' }}>{att}</strong>
        </span>
        <span style={{ color: 'var(--text2)' }}>
          Conn: <strong style={{ color: 'var(--text)' }}>{conn}</strong> ({connPct}%)
        </span>
        {sale > 0 && (
          <span style={{ color: 'var(--text2)' }}>
            Sales: <strong style={{ color }}>{sale} ({salePct}%)</strong>
          </span>
        )}
      </div>
    </div>
  );
}
