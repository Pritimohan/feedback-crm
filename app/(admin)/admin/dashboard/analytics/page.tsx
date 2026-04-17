'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Progress, Row, Space, Statistic, Table, Typography } from 'antd';

const { Title, Paragraph } = Typography;

type DashboardSummary = {
  customers: { total: number };
  leads: { active: number; deferred: number; inactive: number };
  calls: { totalToday: number; connectedToday: number; connectedRate: number };
  dt: { total: number; active: number };
  followups: { pending: number };
  distribution: Array<{ dtId: string; dtName: string; assignedCount: number }>;
};

export default function DashboardAnalyticsPage() {
  const { message } = App.useApp();
  const messageApi = useMemo(() => message, [message]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/dashboard/summary');
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Failed to load analytics');
        setSummary(body.data);
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [messageApi]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 0 }}>
          Dashboard Analytics
        </Title>
        <Paragraph type="secondary">Operational analytics for lead health, call outcomes, and DT capacity.</Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Statistic title="Total DT" value={summary?.dt.total ?? 0} />
            <Statistic title="Active DT" value={summary?.dt.active ?? 0} style={{ marginTop: 12 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Paragraph style={{ marginBottom: 8 }}>Connected Call Rate</Paragraph>
            <Progress percent={summary?.calls.connectedRate ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Statistic title="Active Leads" value={summary?.leads.active ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Statistic title="Deferred Leads" value={summary?.leads.deferred ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading}>
            <Statistic title="Inactive Leads" value={summary?.leads.inactive ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card title="DT Assignment Load (Least-load Distribution)" loading={loading}>
        <Table
          rowKey="dtId"
          dataSource={summary?.distribution ?? []}
          pagination={false}
          columns={[
            { title: 'DT Name', dataIndex: 'dtName', key: 'dtName' },
            { title: 'Assigned Leads', dataIndex: 'assignedCount', key: 'assignedCount' },
          ]}
        />
      </Card>
    </Space>
  );
}
