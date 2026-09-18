'use client';

import { useEffect, useState } from 'react';
import { Modal, Form, Input, Space, Button, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

type EditForm = {
  name: string;
  email: string;
  password?: string;
};

interface EditUserModalProps {
  open: boolean;
  userId: string | null;
  userName: string;
  initialValues?: { name: string; email: string };
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserModal({
  open,
  userId,
  userName,
  initialValues,
  onClose,
  onSaved,
}: EditUserModalProps) {
  const [form] = Form.useForm<EditForm>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        email: initialValues.email,
        password: undefined,
      });
    }
  }, [open, initialValues, form]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSave = async (values: EditForm) => {
    if (!userId) return;

    try {
      setSubmitting(true);
      const payload: Record<string, string> = {
        name: values.name,
        email: values.email,
      };
      if (values.password?.trim()) {
        payload.password = values.password;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to update user'));
      }

      message.success('User updated successfully');
      form.resetFields();
      onSaved();
      onClose();
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to update user'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          Edit {userName}
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter the name' }]}>
          <Input placeholder="Enter full name" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email Address"
          rules={[
            { required: true, message: 'Please enter the email' },
            { type: 'email', message: 'Please enter a valid email' },
          ]}
        >
          <Input placeholder="Enter email address" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Reset Password (optional)"
          rules={[{ min: 6, message: 'Password must be at least 6 characters' }]}
        >
          <Input.Password placeholder="Leave blank to keep current password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save Changes
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
