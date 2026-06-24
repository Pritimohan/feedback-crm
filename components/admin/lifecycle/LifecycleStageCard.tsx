'use client';

import { useState } from 'react';
import { Card, Form, Select, Space, Tag } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { LifecycleStageConfig } from '@/lib/lifecycleDefaults';
import {
  applyMaxAttempts,
  applyUniformRetryGap,
  deriveRetryGapDays,
} from './lifecycleScheduleAdapters';
import { DaysInput } from './DaysInput';

const { Option } = Select;

const CARD_STYLE: React.CSSProperties = {
  marginBottom: 16,
  border: '1px solid #d9d9d9',
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: 16,
};

type LifecycleStageCardProps = {
  stage: LifecycleStageConfig;
  defaultExpanded?: boolean;
  onChange: (patch: Partial<LifecycleStageConfig>) => void;
};

export function LifecycleStageCard({
  stage,
  defaultExpanded = false,
  onChange,
}: LifecycleStageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleMaxAttemptsChange = (value: number) => {
    onChange(applyMaxAttempts(stage, value));
  };

  const handleRetryGapChange = (gapDays: number) => {
    onChange(applyUniformRetryGap(stage, gapDays));
  };

  return (
    <Card size="small" style={CARD_STYLE}>
      <div style={HEADER_STYLE} onClick={() => setExpanded((e) => !e)}>
        {expanded ? <DownOutlined /> : <RightOutlined />}
        <span style={{ marginLeft: 8 }}>{stage.label}</span>
        <Tag style={{ marginLeft: 8 }}>{stage.maxAttempts} attempts</Tag>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item label="Max Attempts" style={{ marginBottom: 8 }}>
              <Select
                value={stage.maxAttempts}
                onChange={handleMaxAttemptsChange}
                style={{ width: 120 }}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Option key={n} value={n}>
                    {n}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="Time Between Attempts" style={{ marginBottom: 8 }}>
              <DaysInput
                value={deriveRetryGapDays(stage)}
                onChange={handleRetryGapChange}
                min={1}
                max={60}
              />
            </Form.Item>
          </Space>
        </div>
      )}
    </Card>
  );
}
