'use client';

import { App, Button, Card, Form, Input, Select, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

const { Title, Paragraph } = Typography;

type CreateForm = {
  name: string;
  email: string;
  role: 'admin' | 'dt';
  password: string;
};

export default function NewAdminUserPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateForm>();
  const router = useRouter();

  const onSubmit = async (values: CreateForm) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        throw new Error(await getErrorFromResponse(res, 'Failed to create user'));
      }
      message.success('User created');
      router.push('/admin/users');
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to create user'));
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 0 }}>
          Create User
        </Title>
        <Paragraph type="secondary">Add a new admin or DT user account.</Paragraph>
      </div>

      <Card>
        <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter full name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Role is required' }]}>
            <Select
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'DT', value: 'dt' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'At least 6 characters' }]}
          >
            <Input.Password placeholder="Set a password" />
          </Form.Item>

          <Space>
            <Button onClick={() => router.push('/admin/users')}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}
