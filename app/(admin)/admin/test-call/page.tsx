'use client';

import { useEffect, useState } from 'react';
import { Typography, Card, Form, Input, Button, Alert, Space, Tag, Divider, App } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const STORAGE_KEY = 'fitty.agentPhone';
interface CallResult { success: boolean; callSid?: string; status?: string; error?: string; }

export default function TestCallPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) form.setFieldValue('agentPhone', stored);
  }, [form]);

  const handleSubmit = async (values: { agentPhone: string; customerPhone: string; customerId?: string }) => {
    setResult(null); setLoading(true);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, values.agentPhone.trim());
    try {
      const response = await fetch('/api/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentPhone: values.agentPhone.trim(), customerPhone: values.customerPhone.trim(), customerId: values.customerId?.trim() || undefined }) });
      const data = (await response.json()) as CallResult; setResult(data);
      if (data.success) message.success('Call initiated successfully'); else message.error(data.error || 'Failed to initiate call');
    } catch (err) { const errorMessage = err instanceof Error ? err.message : 'Network error'; setResult({ success: false, error: errorMessage }); message.error(errorMessage); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <Title level={2}>Test Call</Title>
      <Paragraph type="secondary">Manually enter phone numbers to test the Exotel call flow without pulling a real client from the database.</Paragraph>
      <Card>
        <Form form={form} layout="vertical" onFinish={(v) => void handleSubmit(v)} requiredMark={false}>
          <Form.Item label="From — Agent Phone" name="agentPhone" rules={[{ required: true, message: 'Enter the agent phone number' }]} extra="Your phone number. Saved locally for next time.">
            <Input placeholder="+91 9876543210" prefix={<PhoneOutlined />} allowClear />
          </Form.Item>
          <Form.Item label="To — Customer Phone" name="customerPhone" rules={[{ required: true, message: 'Enter the customer phone number' }]}><Input placeholder="+91 9876543210" prefix={<PhoneOutlined />} allowClear /></Form.Item>
          <Form.Item label="Customer ID (optional)" name="customerId" extra="Pass a real customer UUID to attach this call log to a record."><Input placeholder="Leave blank for an unlinked test call" allowClear /></Form.Item>
          <Form.Item style={{ marginBottom: 0 }}><Button type="primary" htmlType="submit" icon={<PhoneOutlined />} loading={loading} size="large">Initiate Test Call</Button></Form.Item>
        </Form>
        {result && (<><Divider /><Alert type={result.success ? 'success' : 'error'} message={result.success ? 'Call Initiated' : 'Call Failed'} description={result.success ? <Space direction="vertical" size={4}>{result.callSid && <Text>Call SID: <Text code copyable>{result.callSid}</Text></Text>}{result.status && <Text>Status: <Tag color="blue">{result.status}</Tag></Text>}</Space> : <Text type="danger">{result.error}</Text>} showIcon /></>)}
      </Card>
    </div>
  );
}
