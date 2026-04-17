'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Input, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  flagType: string | null;
  currentLifecycleStage: string;
  currentFollowupStage: number | null;
  leadType: string | null;
  ltvScore: string;
  lastOrderDate: string | null;
};

export default function DashboardCustomersPage() {
  const { message } = App.useApp();
  const messageApi = useMemo(() => message, [message]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [filtered, setFiltered] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/customers');
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Failed to load customers');
        const list = body.customers ?? [];
        setRows(list);
        setFiltered(list);
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [messageApi]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    let next = [...rows];
    if (q) {
      next = next.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.phone.includes(search) ||
          (row.email ? row.email.toLowerCase().includes(q) : false)
      );
    }
    if (stage) {
      next = next.filter((row) => row.currentLifecycleStage === stage);
    }
    setFiltered(next);
  }, [rows, search, stage]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 0 }}>
          Dashboard Customers
        </Title>
        <Paragraph type="secondary">All customers with lifecycle, LTV, and follow-up context.</Paragraph>
      </div>

      <Space wrap>
        <Input.Search
          allowClear
          placeholder="Search by name, phone, email"
          style={{ width: 280 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Lifecycle Stage"
          style={{ width: 220 }}
          value={stage}
          onChange={(value) => setStage(value)}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Deferred', value: 'deferred' },
            { label: 'Inactive', value: 'inactive' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name' },
          { title: 'Phone', dataIndex: 'phone', key: 'phone' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          {
            title: 'Lifecycle',
            dataIndex: 'currentLifecycleStage',
            key: 'currentLifecycleStage',
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: 'Follow-up #',
            dataIndex: 'currentFollowupStage',
            key: 'currentFollowupStage',
            render: (v: number | null) => (v === null ? '-' : v),
          },
          {
            title: 'LTV',
            dataIndex: 'ltvScore',
            key: 'ltvScore',
            render: (v: string) => `₹${Number(v || '0').toFixed(0)}`,
          },
          {
            title: 'Last Order',
            dataIndex: 'lastOrderDate',
            key: 'lastOrderDate',
            render: (v: string | null) => (v ? dayjs(v).format('MMM D, YYYY') : '-'),
          },
          {
            title: 'Flag',
            dataIndex: 'flagType',
            key: 'flagType',
            render: (v: string | null) => (v ? <Tag color="purple">{v}</Tag> : '-'),
          },
        ]}
      />
    </Space>
  );
}
