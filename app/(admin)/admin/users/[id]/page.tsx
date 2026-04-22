'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Select, Space, Switch, Typography } from 'antd';
import { useParams, useRouter } from 'next/navigation';

const { Title, Paragraph } = Typography;

type EditForm = {
  name: string;
  email: string;
  role: 'admin' | 'dt';
  active_status: boolean;
  password?: string;
};

export default function EditAdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const messageApi = useMemo(() => message, [message]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<EditForm>();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/users/${id}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Failed to load user');
        form.setFieldsValue({
          name: body.data.name,
          email: body.data.email,
          role: body.data.role,
          active_status: body.data.active_status,
        });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };
    void fetchUser();
  }, [form, id, messageApi]);

  const onSubmit = async (values: EditForm) => {
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        role: values.role,
        active_status: values.active_status,
      };
      if (values.password?.trim()) payload.password = values.password;

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to update user');
      messageApi.success('User updated');
      router.push('/admin/users');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 0 }}>
          Edit User
        </Title>
        <Paragraph type="secondary">Update profile, role, status, or reset password.</Paragraph>
      </div>

      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Role is required' }]}>
            <Select
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'DT', value: 'dt' },
              ]}
            />
          </Form.Item>
          <Form.Item name="active_status" label="Active Status" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="password" label="Reset Password (optional)" rules={[{ min: 6, message: 'At least 6 characters' }]}>
            <Input.Password placeholder="Leave blank to keep current password" />
          </Form.Item>

          <Space>
            <Button onClick={() => router.push('/admin/users')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Changes
            </Button>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}
