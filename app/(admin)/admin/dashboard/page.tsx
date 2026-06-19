'use client';

import { useEffect, useState } from 'react';
import { Typography, Row, Col, Card, Statistic, Spin, message, Empty } from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

interface DashboardStats {
  totalCustomers: number;
  callsToday: number;
  tasksCompleted: number;
  reorderRate: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard statistics');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      message.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <Title level={2}>Dashboard Overview</Title>
        <Card style={{ marginTop: 24 }}>
          <Empty description="Failed to load dashboard data" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>Dashboard Overview</Title>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Customers" value={stats.totalCustomers} prefix={<UserOutlined />} valueStyle={{ color: '#134175' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Attempts Today" value={stats.callsToday} prefix={<PhoneOutlined />} valueStyle={{ color: '#1d4838' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tasks Completed Today"
              value={stats.tasksCompleted}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#88ceeb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Reorder Rate" value={stats.reorderRate} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: '#134175' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
