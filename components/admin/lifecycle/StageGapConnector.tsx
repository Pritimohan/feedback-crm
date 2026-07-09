'use client';

import { Form } from 'antd';
import { DaysInput } from './DaysInput';

const CONNECTOR_LINE_STYLE: React.CSSProperties = {
  width: 2,
  height: 60,
  background: '#d9d9d9',
  marginRight: 16,
  position: 'relative',
};

const CONNECTOR_DOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: '#d9d9d9',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#999',
  marginBottom: 8,
};

type StageGapConnectorProps = {
  days: number;
  onChange: (days: number) => void;
};

export function StageGapConnector({ days, onChange }: StageGapConnectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
      <div style={CONNECTOR_LINE_STYLE}>
        <div style={CONNECTOR_DOT_STYLE} />
      </div>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={LABEL_STYLE}>Time to next stage after connected</div>
        <Form.Item style={{ marginBottom: 0 }}>
          <DaysInput value={days} onChange={onChange} min={1} max={60} />
        </Form.Item>
      </div>
    </div>
  );
}
