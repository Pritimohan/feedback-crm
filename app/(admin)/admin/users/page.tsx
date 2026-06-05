'use client';

import { useEffect, useState } from 'react';
import { Typography, Card, Table, Tag, Spin, message, Button, Space, Modal, Form, Input, Select, Switch, Tabs, Drawer, Row, Col, Statistic, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, DeleteOutlined, UserAddOutlined, CrownOutlined, TeamOutlined, EyeOutlined, SettingOutlined, MoreOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useCrmBrand } from '@/components/providers/BrandProvider';
import { DtBrandProfileModal } from '@/components/admin/DtBrandProfileModal';
import { LeadTypePills, brandDisplayName, type LeadTypeValue } from '@/components/admin/LeadTypePills';

const { Title } = Typography;

type BrandProfile = {
  brand: 'fitty' | 'fitelo';
  is_active: boolean;
  eligible_lead_types: LeadTypeValue[];
};

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'dt';
  active_status: boolean;
  created_at: string;
  updated_at: string;
  brand_profile: BrandProfile | null;
}

export default function UsersPage() {
  const { brand } = useCrmBrand();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [form] = Form.useForm();

  useEffect(() => {
    void fetchUsers();
  }, [brand]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?brand=${brand}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setAllUsers(data.data ?? []);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = activeTab === 'all' ? allUsers : allUsers.filter((u) => u.role === activeTab);

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setIsDetailDrawerOpen(true);
  };

  const handleConfigure = (user: User) => {
    setSelectedUser(user);
    setIsConfigureOpen(true);
  };

  const handleAddUser = async (values: { name: string; email: string; password: string; role: 'admin' | 'dt'; active_status: boolean }) => {
    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to add user');
      message.success(`${values.role === 'admin' ? 'Admin' : 'Agent'} added successfully`);
      setIsAddModalOpen(false);
      form.resetFields();
      void fetchUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete user');
      message.success(`${userName} removed successfully`);
      void fetchUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const confirmRemoveUser = (user: User) => {
    Modal.confirm({
      title: 'Remove User',
      content: `Are you sure you want to remove ${user.name}?`,
      okText: 'Yes, Remove',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: () => handleDeleteUser(user.id, user.name),
    });
  };

  const getUserActionItems = (user: User): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    if (user.role === 'dt') {
      items.push({
        key: 'configure',
        label: 'Configure',
        icon: <SettingOutlined />,
      });
    }
    items.push({
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
    });
    items.push({ type: 'divider' });
    items.push({
      key: 'remove',
      label: 'Remove',
      icon: <DeleteOutlined />,
      danger: true,
    });
    return items;
  };

  const handleUserAction = (user: User, key: string) => {
    if (key === 'configure') handleConfigure(user);
    else if (key === 'view') handleViewDetails(user);
    else if (key === 'remove') confirmRemoveUser(user);
  };

  const handleToggleGlobalStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_status: !currentStatus }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update status');
      message.success('Account status updated');
      void fetchUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const handleToggleBrandStatus = async (user: User, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/brand-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, is_active: !currentStatus }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update brand status');
      message.success('Brand status updated');
      void fetchUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update brand status');
    }
  };

  const isAgentsView = activeTab === 'dt' || activeTab === 'all';

  const columns: ColumnsType<User> = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: '18%' },
    { title: 'Email', dataIndex: 'email', key: 'email', width: '22%' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: '10%',
      render: (role: string) => (
        <Tag color={role === 'admin' ? '#1d4838' : '#134175'} icon={role === 'admin' ? <CrownOutlined /> : <TeamOutlined />}>
          {role === 'admin' ? 'Admin' : 'Agent'}
        </Tag>
      ),
    },
    ...(isAgentsView
      ? [
          {
            title: 'Lead Types',
            key: 'lead_types',
            width: '18%',
            render: (_: unknown, record: User) =>
              record.role === 'dt' ? (
                <LeadTypePills leadTypes={record.brand_profile?.eligible_lead_types ?? ['review']} />
              ) : (
                '—'
              ),
          } as ColumnsType<User>[number],
        ]
      : []),
    {
      title: activeTab === 'dt' ? 'Brand Status' : 'Status',
      key: 'status',
      width: '12%',
      render: (_: unknown, record: User) => {
        if (record.role === 'dt' && (activeTab === 'dt' || activeTab === 'all')) {
          const brandActive = record.brand_profile?.is_active ?? true;
          return (
            <Switch
              checked={brandActive}
              onChange={() => void handleToggleBrandStatus(record, brandActive)}
              checkedChildren="Active"
              unCheckedChildren="Inactive"
            />
          );
        }
        return (
          <Switch
            checked={record.active_status}
            onChange={() => void handleToggleGlobalStatus(record.id, record.active_status)}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
          />
        );
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '12%',
      render: (date: string) => new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '8%',
      align: 'center',
      render: (_, record) => (
        <Dropdown
          menu={{
            items: getUserActionItems(record),
            onClick: ({ key }) => handleUserAction(record, key),
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="User actions" />
        </Dropdown>
      ),
    },
  ];

  const adminCount = allUsers.filter((u) => u.role === 'admin').length;
  const dtCount = allUsers.filter((u) => u.role === 'dt').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <UserAddOutlined style={{ marginRight: 12 }} />
          User Management
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>
          Add User
        </Button>
      </div>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'all', label: `All Users (${allUsers.length})` },
            { key: 'admin', label: <span><CrownOutlined style={{ marginRight: 4 }} />Admins ({adminCount})</span> },
            { key: 'dt', label: <span><TeamOutlined style={{ marginRight: 4 }} />Agents ({dtCount})</span> },
          ]}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : (
          <Table columns={columns} dataSource={filteredUsers} rowKey="id" pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} users` }} />
        )}
      </Card>

      <Modal title={<Space><UserAddOutlined />Add New User</Space>} open={isAddModalOpen} onCancel={() => { setIsAddModalOpen(false); form.resetFields(); }} footer={null} width={480}>
        <Form form={form} layout="vertical" onFinish={(v) => void handleAddUser(v)} initialValues={{ role: 'admin', active_status: true }} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter the name' }]}><Input placeholder="Enter full name" /></Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, message: 'Please enter the email' }, { type: 'email', message: 'Please enter a valid email' }]}><Input placeholder="Enter email address" /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter a password' }, { min: 6, message: 'Password must be at least 6 characters' }]}><Input.Password placeholder="Enter password" /></Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select options={[{ value: 'admin', label: <><CrownOutlined /> Admin</> }, { value: 'dt', label: <><TeamOutlined /> Agent</> }]} />
          </Form.Item>
          <Form.Item name="active_status" label="Account Active (blocks login when off)" valuePropName="checked"><Switch checkedChildren="Active" unCheckedChildren="Inactive" /></Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setIsAddModalOpen(false); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Create User</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <DtBrandProfileModal
        open={isConfigureOpen}
        userId={selectedUser?.id ?? null}
        userName={selectedUser?.name ?? ''}
        currentBrand={brand}
        onClose={() => { setIsConfigureOpen(false); setSelectedUser(null); }}
        onSaved={() => { void fetchUsers(); setIsConfigureOpen(false); setSelectedUser(null); }}
      />

      <Drawer title={selectedUser?.name} placement="right" width={720} onClose={() => { setIsDetailDrawerOpen(false); setSelectedUser(null); }} open={isDetailDrawerOpen}>
        {selectedUser && (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div><strong>Email:</strong> {selectedUser.email}</div>
              <div><strong>Role:</strong> <Tag color={selectedUser.role === 'admin' ? '#1d4838' : '#134175'}>{selectedUser.role === 'admin' ? 'Admin' : 'Agent'}</Tag></div>
              <div><strong>Account status (blocks login):</strong> <Tag color={selectedUser.active_status ? '#1d4838' : '#e7580b'}>{selectedUser.active_status ? 'Active' : 'Inactive'}</Tag></div>
              {selectedUser.role === 'dt' && (
                <>
                  <div><strong>{brandDisplayName(brand)} brand status:</strong> <Tag color={selectedUser.brand_profile?.is_active ? '#1d4838' : '#e7580b'}>{selectedUser.brand_profile?.is_active ? 'Active' : 'Inactive'}</Tag></div>
                  <div><strong>{brandDisplayName(brand)} lead types:</strong> <LeadTypePills leadTypes={selectedUser.brand_profile?.eligible_lead_types ?? ['review']} /></div>
                </>
              )}
              <Row gutter={16}>
                <Col span={12}><Statistic title="Joined" value={new Date(selectedUser.created_at).toLocaleDateString('en-IN')} /></Col>
                <Col span={12}><Statistic title="Last Updated" value={new Date(selectedUser.updated_at).toLocaleDateString('en-IN')} /></Col>
              </Row>
            </Space>
          </Card>
        )}
      </Drawer>
    </div>
  );
}
