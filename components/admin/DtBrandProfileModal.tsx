'use client';

import { useEffect, useState } from 'react';
import { Modal, Form, Select, Switch, Space, Button, message, Tabs } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import {
  LEAD_TYPE_OPTIONS,
  brandDisplayName,
  type LeadTypeValue,
} from '@/components/admin/LeadTypePills';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

type BrandProfile = {
  brand: CrmBrand;
  is_active: boolean;
  eligible_lead_types: LeadTypeValue[];
};

interface DtBrandProfileModalProps {
  open: boolean;
  userId: string | null;
  userName: string;
  currentBrand: CrmBrand;
  initialProfile?: BrandProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

async function fetchBrandProfile(userId: string, brand: CrmBrand): Promise<BrandProfile | null> {
  const response = await fetch(`/api/admin/users/${userId}/brand-profile?brand=${brand}`);
  if (!response.ok) return null;
  const json = await response.json();
  return json.data as BrandProfile;
}

function BrandProfileForm({
  userId,
  brand,
  onSaved,
}: {
  userId: string;
  brand: CrmBrand;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const profile = await fetchBrandProfile(userId, brand);
      if (cancelled) return;
      form.setFieldsValue({
        is_active: profile?.is_active ?? true,
        eligible_lead_types: profile?.eligible_lead_types ?? ['review'],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, brand, form]);

  const handleSave = async (values: { is_active: boolean; eligible_lead_types: LeadTypeValue[] }) => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/admin/users/${userId}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          is_active: values.is_active,
          eligible_lead_types: values.eligible_lead_types,
        }),
      });
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to save'));
      }
      message.success(`${brandDisplayName(brand)} profile updated`);
      onSaved();
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to save profile'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)} disabled={loading}>
      <Form.Item name="is_active" label="Brand Active Status" valuePropName="checked">
        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
      </Form.Item>
      <Form.Item
        name="eligible_lead_types"
        label="Eligible Lead Types"
        rules={[{ required: true, message: 'Select at least one lead type' }]}
      >
        <Select
          mode="multiple"
          placeholder="Select lead types"
          options={LEAD_TYPE_OPTIONS}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Save {brandDisplayName(brand)}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

export function DtBrandProfileModal({
  open,
  userId,
  userName,
  currentBrand,
  onClose,
  onSaved,
}: DtBrandProfileModalProps) {
  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          Configure {userName}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Tabs
        defaultActiveKey={currentBrand}
        items={[
          {
            key: 'fitty',
            label: 'Fitty',
            children: userId ? <BrandProfileForm userId={userId} brand="fitty" onSaved={onSaved} /> : null,
          },
          {
            key: 'fitelo',
            label: 'Fitelo',
            children: userId ? <BrandProfileForm userId={userId} brand="fitelo" onSaved={onSaved} /> : null,
          },
        ]}
      />
    </Modal>
  );
}
