'use client';

import type { CSSProperties } from 'react';
import { Tag } from 'antd';

export type LeadTypeValue = 'review' | 'nps' | 'feedback';

const LEAD_TYPE_LABELS: Record<LeadTypeValue, string> = {
  review: 'Review',
  nps: 'NPS',
  feedback: 'Feedback',
};

const LEAD_TYPE_PILL_STYLES: Record<LeadTypeValue, { background: string; color: string; border: string }> = {
  review: { background: '#e8f3ef', color: '#1d4838', border: '#b8d9cc' },
  nps: { background: '#e8f0f8', color: '#134175', border: '#b8cfe8' },
  feedback: { background: '#fdeee6', color: '#c44f0a', border: '#f5c4a8' },
};

export const LEAD_TYPE_OPTIONS = (Object.keys(LEAD_TYPE_LABELS) as LeadTypeValue[]).map((value) => ({
  value,
  label: LEAD_TYPE_LABELS[value],
}));

const pillBaseStyle: CSSProperties = {
  borderRadius: 999,
  paddingInline: 12,
  paddingBlock: 2,
  margin: 0,
  border: '1px solid',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
};

export function LeadTypePills({ leadTypes }: { leadTypes: LeadTypeValue[] }) {
  if (!leadTypes.length) {
    return <Tag style={{ ...pillBaseStyle, borderRadius: 999 }}>None</Tag>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {leadTypes.map((type) => {
        const pill = LEAD_TYPE_PILL_STYLES[type];
        return (
          <Tag
            key={type}
            bordered={false}
            style={{
              ...pillBaseStyle,
              background: pill.background,
              color: pill.color,
              borderColor: pill.border,
            }}
          >
            {LEAD_TYPE_LABELS[type]}
          </Tag>
        );
      })}
    </div>
  );
}

export function brandDisplayName(brand: 'fitty' | 'fitelo'): string {
  return brand === 'fitelo' ? 'Fitelo' : 'Fitty';
}
