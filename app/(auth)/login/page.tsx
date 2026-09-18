'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Form, Input, App, Typography, Spin } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

const { Title, Text } = Typography;

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || null;
  const { message } = App.useApp();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });

      if (!response.ok) {
        message.error(await getErrorFromResponse(response, 'Login failed'));
        return;
      }

      const data = await response.json();

      message.success('Login successful!');
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        if (data.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (data.role === 'dt') {
          router.push('/dt/followups');
        } else {
          router.push('/login');
        }
      }
      router.refresh();
    } catch (error) {
      message.error(toUserFacingMessage(error, 'An error occurred during login'));
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="text-center mb-8">
        <Title level={2} style={{ margin: 0, color: '#1d4838' }}>
          Feedback CRM
        </Title>
        <Text type="secondary">Sign in to your account</Text>
      </div>

      <Form
        name="login"
        onFinish={onFinish}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please input your email!' },
            { type: 'email', message: 'Please enter a valid email!' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="Email address"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Password"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
          >
            Sign In
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spin size="large" />}>
      <LoginForm />
    </Suspense>
  );
}
