'use client';

import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Tooltip } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';
import type { ButtonProps } from 'antd';
import type { CrmBrand } from '@/lib/crmBrand.shared';

interface CallButtonProps {
  customerPhone: string;
  customerId?: string;
  brand?: CrmBrand;
  agentPhone?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  buttonProps?: ButtonProps;
}

const STORAGE_KEY = 'feedbackCRM.agentPhone';

export default function CallButton({
  customerPhone,
  customerId,
  brand,
  agentPhone,
  buttonRef,
  buttonProps,
}: CallButtonProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [cachedAgentPhone, setCachedAgentPhone] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalValue, setModalValue] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setCachedAgentPhone(stored);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (cachedAgentPhone) {
      setModalValue(cachedAgentPhone);
    }
  }, [modalOpen, cachedAgentPhone]);

  const persistAgentPhone = (value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, value);
    setCachedAgentPhone(value);
  };

  const triggerCall = async (agentPhoneValue: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPhone: agentPhoneValue,
          customerPhone,
          customerId,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to initiate call');
      }

      message.success('Call initiated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate call';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setModalOpen(true);
  };

  const stopRowClickPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleModalOk = async () => {
    const trimmed = modalValue.trim();
    if (!trimmed) {
      message.error('Please enter your phone number');
      return;
    }
    persistAgentPhone(trimmed);
    setModalOpen(false);
    setModalValue('');
    await triggerCall(trimmed);
  };

  return (
    <>
      <Tooltip title="Call customer">
        <Button
          ref={buttonRef as React.LegacyRef<HTMLButtonElement> | undefined}
          type="primary"
          size="small"
          icon={<PhoneOutlined />}
          loading={loading}
          onMouseDown={stopRowClickPropagation}
          onPointerDown={stopRowClickPropagation}
          onKeyDown={stopRowClickPropagation}
          onClick={handleClick}
          {...buttonProps}
        />
      </Tooltip>

      <Modal
        title="Enter your phone number to make the call"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText="Save & Call"
        confirmLoading={loading}
      >
        <Input
          placeholder="Your phone number (e.g., +91 9876543210)"
          value={modalValue}
          onChange={(e) => setModalValue(e.target.value)}
        />
        {cachedAgentPhone && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
            Saved number: {cachedAgentPhone}
          </div>
        )}
      </Modal>
    </>
  );
}
