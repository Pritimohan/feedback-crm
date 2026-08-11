'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Text } = Typography;

type BrandExotelResponse = {
  exophone: string;
  updatedAt: string | null;
};

type ExotelConfigResponse = {
  fitty: BrandExotelResponse;
  fitelo: BrandExotelResponse;
};

type FormValues = {
  fitty: string;
  fitelo: string;
};

const exophoneRules = [
  { required: true, message: 'Phone number is required' },
  {
    pattern: /^\+?[\d\s\-()]{10,20}$/,
    message: 'Enter a valid phone number',
  },
];

export default function ExotelConfigForm() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<{
    fitty: string | null;
    fitelo: string | null;
  }>({ fitty: null, fitelo: null });

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/config/exotel');
      const data = (await response.json()) as ExotelConfigResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load Exotel config');
      }

      form.setFieldsValue({
        fitty: data.fitty?.exophone || '',
        fitelo: data.fitelo?.exophone || '',
      });
      setUpdatedAt({
        fitty: data.fitty?.updatedAt ?? null,
        fitelo: data.fitelo?.updatedAt ?? null,
      });
    } catch (error) {
      console.error('[ExotelConfigForm] load', error);
      message.error(
        error instanceof Error ? error.message : 'Failed to load Exotel config'
      );
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async (values: FormValues) => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/config/exotel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fitty: values.fitty,
          fitelo: values.fitelo,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save phone numbers');
      }

      form.setFieldsValue({
        fitty: data.fitty,
        fitelo: data.fitelo,
      });
      const savedAt =
        typeof data.updatedAt === 'string'
          ? data.updatedAt
          : data.updatedAt
            ? new Date(data.updatedAt).toISOString()
            : new Date().toISOString();
      setUpdatedAt({ fitty: savedAt, fitelo: savedAt });
      message.success('Phone numbers saved');
    } catch (error) {
      console.error('[ExotelConfigForm] save', error);
      message.error(
        error instanceof Error ? error.message : 'Failed to save phone numbers'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="Calling phone numbers"
        description="Set the phone number used for outgoing calls for each brand. Calls won’t go through until a number is saved."
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        style={{ maxWidth: 480 }}
      >
        <Form.Item
          name="fitty"
          label="Fitty phone number"
          rules={exophoneRules}
          extra={
            updatedAt.fitty
              ? `Last updated ${new Date(updatedAt.fitty).toLocaleString()}`
              : 'Not set yet — Example: 079XXXXXXXX'
          }
        >
          <Input placeholder="079XXXXXXXX" allowClear />
        </Form.Item>

        <Form.Item
          name="fitelo"
          label="Fitelo phone number"
          rules={exophoneRules}
          extra={
            updatedAt.fitelo
              ? `Last updated ${new Date(updatedAt.fitelo).toLocaleString()}`
              : 'Not set yet — Example: 079XXXXXXXX'
          }
        >
          <Input placeholder="079XXXXXXXX" allowClear />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
            >
              Save
            </Button>
            {!updatedAt.fitty && !updatedAt.fitelo ? (
              <Text type="secondary">Not set yet</Text>
            ) : null}
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
