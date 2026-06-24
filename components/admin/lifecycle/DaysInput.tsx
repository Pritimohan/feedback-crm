'use client';

import { InputNumber, Space, Typography } from 'antd';

const { Text } = Typography;

type DaysInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  width?: number;
};

export function DaysInput({
  value,
  onChange,
  min = 1,
  max = 60,
  suffix = 'Days',
  width = 80,
}: DaysInputProps) {
  return (
    <Space>
      <InputNumber
        min={min}
        max={max}
        value={value}
        onChange={(v) => {
          if (v != null) onChange(v);
        }}
        style={{ width }}
      />
      <Text type="secondary">{suffix}</Text>
    </Space>
  );
}
