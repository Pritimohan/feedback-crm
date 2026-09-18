'use client';

import { useEffect, useState, useCallback } from 'react';
import { Typography, Card, Table, Tag, Spin, message, Space, Row, Col, Statistic, Progress, Tooltip, Badge, Alert } from 'antd';
import { TeamOutlined, PhoneOutlined, CheckCircleOutlined, WarningOutlined, PieChartOutlined, CalendarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import RebalanceCallsWidget from '@/components/admin/RebalanceCallsWidget';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

const { Title, Text } = Typography;
interface DTDistribution { dtId: string; dtName: string; dtEmail: string; todaysDue: number; overdue: number; todaysCalls: number; percentage: number; }
interface DistributionStats { totalTodaysCalls: number; totalTodaysDue: number; totalOverdue: number; totalActiveDTs: number; avgCallsPerDT: number; maxCalls: number; minCalls: number; deviation: number; isBalanced: boolean; }

export default function CallDistributionPage() {
  const [distribution, setDistribution] = useState<DTDistribution[]>([]);
  const [stats, setStats] = useState<DistributionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDistribution = useCallback(async () => {
    try {
      setLoading(true);
      let data: Record<string, unknown>;
      const response = await fetch('/api/admin/rebalance');

      if (response.ok) {
        data = await response.json();
      } else {
        // Fallback to static DT load snapshot endpoint if rebalance API is unavailable.
        const snapshotRes = await fetch('/api/admin/distribution');
        if (!snapshotRes.ok) {
          throw new Error(await getErrorFromResponse(snapshotRes, 'Failed to fetch distribution data'));
        }
        const snapshotBody = await snapshotRes.json();
        const snapshotRows = Array.isArray(snapshotBody?.data) ? snapshotBody.data : [];
        data = {
          currentDistribution: snapshotRows.map(
            (row: { dtId: string; dtName: string; assignedCount: number }) => ({
              dtId: row.dtId,
              dtName: row.dtName,
              dtEmail: '',
              todaysDue: 0,
              overdue: 0,
              todaysCalls: Number(row.assignedCount ?? 0),
            })
          ),
          totalTodaysCalls: snapshotRows.reduce(
            (sum: number, row: { assignedCount: number }) => sum + Number(row.assignedCount ?? 0),
            0
          ),
          totalTodaysDue: 0,
          totalOverdue: 0,
          activeDTs: snapshotRows,
          loadSnapshot: snapshotRows,
        };
      }

      const rawDistribution = Array.isArray(data.currentDistribution) ? data.currentDistribution : [];
      const fallbackDistribution = Array.isArray(data.loadSnapshot)
        ? data.loadSnapshot.map(
            (dt: { dtId: string; dtName: string; assignedCount: number }) => ({
              dtId: dt.dtId,
              dtName: dt.dtName,
              dtEmail: '',
              todaysDue: 0,
              overdue: 0,
              todaysCalls: Number(dt.assignedCount ?? 0),
            })
          )
        : [];

      const baseDistribution =
        rawDistribution.length > 0 ? rawDistribution : fallbackDistribution;

      const totalTodaysCalls =
        Number(data.totalTodaysCalls ?? 0) ||
        baseDistribution.reduce((sum: number, dt: { todaysCalls?: number }) => sum + Number(dt.todaysCalls ?? 0), 0);
      const totalTodaysDue = Number(data.totalTodaysDue ?? 0);
      const totalOverdue = Number(data.totalOverdue ?? 0);

      const distributions: DTDistribution[] = baseDistribution.map(
        (dt: { dtId: string; dtName: string; dtEmail?: string; todaysDue?: number; overdue?: number; todaysCalls: number }) => ({
          dtId: dt.dtId,
          dtName: dt.dtName,
          dtEmail: dt.dtEmail ?? '',
          todaysDue: Number(dt.todaysDue ?? 0),
          overdue: Number(dt.overdue ?? 0),
          todaysCalls: Number(dt.todaysCalls ?? 0),
          percentage: totalTodaysCalls > 0 ? (Number(dt.todaysCalls ?? 0) / totalTodaysCalls) * 100 : 0,
        })
      );
      setDistribution(distributions);
      const counts = distributions.map((d: DTDistribution) => d.todaysCalls);
      const maxCalls = counts.length > 0 ? Math.max(...counts) : 0;
      const minCalls = counts.length > 0 ? Math.min(...counts) : 0;
      const avgCallsPerDT = distributions.length > 0 ? totalTodaysCalls / distributions.length : 0;
      const deviation = maxCalls - minCalls;
      const activeDTsCount = Array.isArray(data.activeDTs)
        ? data.activeDTs.length
        : distributions.length;
      setStats({
        totalTodaysCalls,
        totalTodaysDue,
        totalOverdue,
        totalActiveDTs: activeDTsCount,
        avgCallsPerDT: Math.round(avgCallsPerDT * 10) / 10,
        maxCalls,
        minCalls,
        deviation,
        isBalanced: deviation <= 1,
      });
    } catch (error) {
      console.error('Error fetching distribution:', error);
      message.error(toUserFacingMessage(error, 'Failed to load distribution data'));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchDistribution(); }, [fetchDistribution]);

  const columns: ColumnsType<DTDistribution> = [
    { title: 'Agent', key: 'dietitian', render: (_, record) => <Space><Badge status={record.todaysCalls > 0 ? 'processing' : 'default'} /><div><Text strong>{record.dtName}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.dtEmail}</Text></div></Space> },
    { title: "Today's Due", dataIndex: 'todaysDue', key: 'todaysDue', align: 'center', render: (count: number) => <Text strong style={{ fontSize: 16, color: count > 0 ? '#134175' : '#99998f' }}>{count}</Text> },
    { title: 'Overdue', dataIndex: 'overdue', key: 'overdue', align: 'center', render: (count: number) => <Text strong style={{ fontSize: 16, color: count > 0 ? '#e7580b' : '#99998f' }}>{count}</Text> },
    { title: 'Total', dataIndex: 'todaysCalls', key: 'todaysCalls', align: 'center', render: (count: number) => <Text strong style={{ fontSize: 16, color: count > 0 ? '#134175' : '#99998f' }}>{count}</Text> },
    { title: 'Distribution', key: 'percentage', width: 200, render: (_, record) => <Tooltip title={`${record.percentage.toFixed(1)}% of today&apos;s calls`}><Progress percent={Math.round(record.percentage)} size="small" strokeColor={record.percentage > 40 ? '#e7580b' : '#1d4838'} /></Tooltip> },
    { title: 'Status', key: 'status', align: 'center', render: (_, record) => !stats ? null : Math.abs(record.todaysCalls - stats.avgCallsPerDT) <= 1 ? <Tag icon={<CheckCircleOutlined />} style={{ background: '#E4F4F3', color: '#445655', borderColor: '#CCE4E2' }}>Balanced</Tag> : record.todaysCalls > stats.avgCallsPerDT ? <Tag color="warning" icon={<WarningOutlined />}>+{Math.round(record.todaysCalls - stats.avgCallsPerDT)} above avg</Tag> : <Tag color="processing" icon={<WarningOutlined />}>{Math.round(record.todaysCalls - stats.avgCallsPerDT)} below avg</Tag> },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /><p style={{ marginTop: 16 }}>Loading today&apos;s call distribution...</p></div>;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><Title level={2} style={{ margin: 0 }}><PieChartOutlined style={{ marginRight: 12 }} />Today&apos;s Call Distribution</Title><Text type="secondary"><CalendarOutlined style={{ marginRight: 6 }} />{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</Text></div>
        <Space><RebalanceCallsWidget onRebalanceComplete={fetchDistribution} /></Space>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Today's Due" value={stats?.totalTodaysDue || 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Overdue" value={stats?.totalOverdue || 0} prefix={<WarningOutlined />} valueStyle={{ color: (stats?.totalOverdue || 0) > 0 ? '#e7580b' : '#99998f' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Total Pending" value={stats?.totalTodaysCalls || 0} prefix={<PhoneOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Active Agents" value={stats?.totalActiveDTs || 0} prefix={<TeamOutlined />} /></Card></Col>
      </Row>
      {stats && (stats.isBalanced ? <Alert message="Call Distribution is Balanced" description={`Today&apos;s calls are evenly distributed with a maximum deviation of ${stats.deviation} calls between agents.`} type="success" showIcon icon={<CheckCircleOutlined />} /> : <Alert message="Uneven Call Distribution Detected" description={`There is a deviation of ${stats.deviation} calls (Max: ${stats.maxCalls}, Min: ${stats.minCalls}). Consider rebalancing for fair distribution.`} type="warning" showIcon icon={<WarningOutlined />} />)}
      <Card title={<Space><PhoneOutlined /><span>Today&apos;s Calls by Agent</span></Space>}><Table columns={columns} dataSource={distribution} rowKey="dtId" pagination={false} loading={loading} /></Card>
      <Card size="small" style={{ background: '#eeeae3' }}><Space direction="vertical" size="small"><Text strong>How Today&apos;s Call Distribution Works:</Text><Text type="secondary">• Shows pending followup calls scheduled for today (or overdue)</Text><Text type="secondary">• Rebalancing only redistributes today&apos;s pending calls, not all customers</Text><Text type="secondary">• Only active agents receive calls and appear in this distribution</Text></Space></Card>
    </Space>
  );
}
