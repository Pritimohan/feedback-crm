'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  Typography,
  Table,
  Input,
  Tag,
  Drawer,
  Space,
  Card,
  Timeline,
  App,
  Row,
  Col,
  Statistic,
  Spin,
  Tooltip,
  Select,
  theme,
  Dropdown,
  Button,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, PhoneOutlined, MailOutlined, DollarOutlined, ShoppingOutlined, EllipsisOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import FollowupModal from '@/components/dt/FollowupModal';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;
interface Customer { id: string; name: string; phone: string; email: string; leadType?: 'review' | 'nps' | null; currentLifecycleStage: string; currentFollowupStage?: number | null; ltvScore: string; lastOrderDate: string; createdAt: string; assignedDtId: string | null; latestProductName?: string | null; sku?: string | null; }
interface DT { id: string; name: string; email: string; }
interface Order { productName?: string | null; totalAmount?: string | null; quantity?: number | null; orderDate?: string | Date | null; deliveryStatus?: string | null; }
interface Interaction { timestamp: string; structuredData: Record<string, unknown> | null; outcome?: string | null; recordingUrl?: string | null; dt?: { name?: string | null } | null; followupNumber?: number | null; formData?: Record<string, unknown> | null; }
interface CustomerHistory { customer: Customer; orders: Order[]; interactions: Interaction[]; }

export default function AllCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dietitians, setDietitians] = useState<Map<string, DT>>(new Map());
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDietitianId, setSelectedDietitianId] = useState<string | null>(null);
  const [selectedLifecycleStage, setSelectedLifecycleStage] = useState<string | null>(null);
  const [selectedFollowupStage, setSelectedFollowupStage] = useState<number | null>(null);
  const [selectedLeadType, setSelectedLeadType] = useState<'review' | 'nps' | null>('review');
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);
  const [followupModalVisible, setFollowupModalVisible] = useState(false);
  const [openingFollowupForCustomerId, setOpeningFollowupForCustomerId] = useState<string | null>(null);
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const FOLLOWUP_STAGE_OPTIONS = [
    { label: followupUiLabel(0), value: 0 },
    { label: followupUiLabel(1), value: 1 },
    { label: followupUiLabel(2), value: 2 },
  ];
  const LIFECYCLE_FILTER_OPTIONS = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Deferred', value: 'deferred' },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const customersResponse = await fetch('/api/dt/customers');
      if (!customersResponse.ok) throw new Error('Failed to fetch customers');
      const customersData = await customersResponse.json();
      const dtsResponse = await fetch('/api/admin/dietitians');
      if (!dtsResponse.ok) throw new Error('Failed to fetch agents');
      const dtsData = await dtsResponse.json();
      const dtMap = new Map<string, DT>(); dtsData.forEach((dt: DT) => { dtMap.set(dt.id, dt); });
      const nextCustomers = customersData.customers || [];
      setCustomers(nextCustomers);
      setFilteredCustomers(selectedLeadType ? nextCustomers.filter((c: Customer) => c.leadType === selectedLeadType) : nextCustomers);
      setDietitians(dtMap);
    } catch (error) {
      console.error('Error fetching data:', error); message.error('Failed to load data');
    } finally { setLoading(false); }
  }, [message, selectedLeadType]);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const applyFilters = (search: string, dtId: string | null, stage: string | null, followupStage: number | null, leadType: 'review' | 'nps' | null) => {
    let filtered = customers;
    if (search) filtered = filtered.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase()) || customer.phone.includes(search) || (customer.email && customer.email.toLowerCase().includes(search.toLowerCase())));
    if (dtId) filtered = filtered.filter((customer) => customer.assignedDtId === dtId);
    if (stage) filtered = filtered.filter((customer) => customer.currentLifecycleStage === stage);
    if (followupStage !== null) filtered = filtered.filter((customer) => customer.currentFollowupStage === followupStage);
    if (leadType) filtered = filtered.filter((customer) => customer.leadType === leadType);
    setFilteredCustomers(filtered);
  };

  const handleRowClick = async (customerId: string) => {
    try { setDrawerVisible(true); setHistoryLoading(true); const response = await fetch(`/api/dt/customers/${customerId}`); if (!response.ok) throw new Error('Failed to fetch customer history'); setCustomerHistory(await response.json()); }
    catch (error) { console.error('Error fetching customer history:', error); message.error('Failed to load customer details'); }
    finally { setHistoryLoading(false); }
  };

  const openPendingFollowup = async (customerId: string) => {
    try {
      setOpeningFollowupForCustomerId(customerId);
      const response = await fetch(`/api/dt/customers/${customerId}/pending-followup`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to fetch pending follow-up');
      }
      if (!result?.followupId) {
        message.info('No pending follow-up for this customer.');
        return;
      }
      setSelectedFollowupId(result.followupId);
      setFollowupModalVisible(true);
    } catch (error) {
      console.error('Error opening pending follow-up:', error);
      message.error(error instanceof Error ? error.message : 'Failed to open follow-up');
    } finally {
      setOpeningFollowupForCustomerId(null);
    }
  };
  const getLifecycleColor = (stage: string) => stage === 'active' ? '#1d4838' : stage === 'deferred' ? '#d48806' : 'default';

  const columns: ColumnsType<Customer> = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (name: string) => <Space><UserOutlined /><strong>{name}</strong></Space> },
    { title: 'Contact', key: 'contact', render: (_, record) => <Space direction="vertical" size={0}><Text><PhoneOutlined /> {record.phone}</Text>{record.email && <Text type="secondary" style={{ fontSize: '12px' }}><MailOutlined /> {record.email}</Text>}</Space> },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => {
        const menuItems: MenuProps['items'] = [{ key: 'open_form', label: 'Open Form' }];
        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'open_form') void openPendingFollowup(record.id);
              },
            }}
            trigger={['click']}
          >
            <Button
              size="small"
              icon={<EllipsisOutlined />}
              loading={openingFollowupForCustomerId === record.id}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </Dropdown>
        );
      },
    },
    { title: 'Assigned To', dataIndex: 'assignedDtId', key: 'assignedDtId', render: (dtId: string) => { const dt = dietitians.get(dtId); return dt ? <Text>{dt.name}</Text> : <Text type="secondary">Unassigned</Text>; } },
    { title: 'Product', key: 'product', width: 220, render: (_, record) => { const content = record.latestProductName || record.sku || '-'; return <Tooltip title={record.latestProductName || record.sku}><Text type={record.latestProductName ? undefined : 'secondary'} style={{ fontSize: '12px' }}>{content}</Text></Tooltip>; } },
    { title: 'Lifecycle Stage', key: 'lifecycleDisplay', render: (_: unknown, record: Customer) => { const stage = record.currentLifecycleStage; if (!stage) return <Text type="secondary">UNKNOWN</Text>; return <Tag color={getLifecycleColor(stage)}>{stage.replace('_', ' ').toUpperCase()}</Tag>; } },
    { title: 'Follow-up stage', dataIndex: 'currentFollowupStage', key: 'currentFollowupStage', render: (stage: number | null | undefined) => { if (stage === null || stage === undefined) return <Text type="secondary">-</Text>; return <Tag color="#134175">{followupUiLabel(stage)}</Tag>; } },
    { title: 'LTV', dataIndex: 'ltvScore', key: 'ltvScore', render: (ltv: string) => `₹${parseFloat(ltv || '0').toFixed(0)}` },
    { title: 'Last Order', dataIndex: 'lastOrderDate', key: 'lastOrderDate', render: (date: string | Date | null) => (!date ? 'No orders' : dayjs(date).format('MMM D, YYYY')) },
  ];

  return (
    <div>
      <Title level={2}>All Customers</Title>
      <Paragraph type="secondary">View and manage all customers across all agents</Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <Search placeholder="Search by name, phone, or email" onSearch={(v) => { setSearchText(v); applyFilters(v, selectedDietitianId, selectedLifecycleStage, selectedFollowupStage, selectedLeadType); }} onChange={(e) => { const v = e.target.value; setSearchText(v); applyFilters(v, selectedDietitianId, selectedLifecycleStage, selectedFollowupStage, selectedLeadType); }} style={{ width: 300 }} allowClear />
        <Select placeholder="Filter by Lead Type" allowClear style={{ width: 200 }} onChange={(v) => { const next = v ?? null; setSelectedLeadType(next); setSelectedLifecycleStage(null); applyFilters(searchText, selectedDietitianId, null, selectedFollowupStage, next); }} value={selectedLeadType} options={[{ label: 'Review', value: 'review' }, { label: 'NPS', value: 'nps' }]} />
        <Select placeholder="Filter by Agent" allowClear style={{ width: 200 }} onChange={(v) => { const next = v ?? null; setSelectedDietitianId(next); applyFilters(searchText, next, selectedLifecycleStage, selectedFollowupStage, selectedLeadType); }} value={selectedDietitianId} options={[...Array.from(dietitians.values()).map((dt) => ({ label: dt.name, value: dt.id }))]} />
        <Select placeholder="Filter by Lifecycle Stage" allowClear style={{ width: 180 }} onChange={(v) => { const next = v ?? null; setSelectedLifecycleStage(next); applyFilters(searchText, selectedDietitianId, next, selectedFollowupStage, selectedLeadType); }} value={selectedLifecycleStage} options={LIFECYCLE_FILTER_OPTIONS} />
        <Select placeholder="Filter by follow-up stage" allowClear style={{ width: 200 }} onChange={(v) => { const next = v ?? null; setSelectedFollowupStage(next); applyFilters(searchText, selectedDietitianId, selectedLifecycleStage, next, selectedLeadType); }} value={selectedFollowupStage} options={FOLLOWUP_STAGE_OPTIONS} />
      </Space>
      <Table columns={columns} dataSource={filteredCustomers} loading={loading} rowKey="id" onRow={(record) => ({ onClick: () => void handleRowClick(record.id), style: { cursor: 'pointer' } })} pagination={{ pageSize: 20, showTotal: (total) => `Total ${total} customers` }} />
      <Drawer title="Customer 360 View" placement="right" size={720} open={drawerVisible} onClose={() => setDrawerVisible(false)}>
        {historyLoading ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div> : customerHistory && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card><Space direction="vertical" size="small" style={{ width: '100%' }}><Title level={4}>{customerHistory.customer.name}</Title><Text><PhoneOutlined /> {customerHistory.customer.phone}</Text>{customerHistory.customer.email && <Text><MailOutlined /> {customerHistory.customer.email}</Text>}</Space></Card>
            <Row gutter={16}><Col span={12}><Card><Statistic title="Total Orders" value={customerHistory.orders.length} prefix={<ShoppingOutlined />} /></Card></Col><Col span={12}><Card><Statistic title="LTV" value={parseFloat(customerHistory.customer.ltvScore || '0')} prefix={<DollarOutlined />} precision={0} /></Card></Col></Row>
            <Card title="Weight Progress"><Text type="secondary">Weight trend widget not available in this build.</Text></Card>
            <Card title="Order History"><Timeline items={customerHistory.orders.map((orderRaw) => { const order = orderRaw; return { content: <Space direction="vertical" size={0}>{order.productName && <Text strong style={{ fontSize: 14 }}>{order.productName}</Text>}<Text>₹{parseFloat(order.totalAmount || '0').toFixed(0)} • Qty: {order.quantity ?? '-'}</Text><Text type="secondary">{dayjs(order.orderDate).format('MMM D, YYYY')}</Text><Tag color={order.deliveryStatus === 'delivered' ? '#1d4838' : '#e7580b'}>{order.deliveryStatus}</Tag></Space>, color: order.deliveryStatus === 'delivered' ? '#1d4838' : '#134175' }; })} /></Card>
            <Card title="Interaction History"><Timeline items={customerHistory.interactions.map((interaction) => { const formEntries = Object.entries(interaction.formData || {}).filter(([, value]) => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)); return { content: <Space direction="vertical" size={0}><Space size={12} wrap><Text strong>{interaction.outcome === 'connected' ? '✓ Call Connected' : `× ${interaction.outcome}`}</Text>{interaction.outcome === 'connected' && interaction.recordingUrl && <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: token.colorFillTertiary, border: `1px solid ${token.colorBorderSecondary}` }}><Text type="secondary" style={{ fontSize: 12, margin: 0 }}>Recording</Text><audio controls preload="none" src={interaction.recordingUrl} style={{ height: 28, maxWidth: 260, verticalAlign: 'middle' }} /></div>}</Space><Text type="secondary">{dayjs(interaction.timestamp).format('MMM D, YYYY h:mm A')}</Text><Text type="secondary">by {interaction.dt?.name || 'Unknown DT'}</Text>{interaction.outcome === 'connected' && formEntries.length > 0 && <div style={{ marginTop: 4, lineHeight: 1.6 }}>{formEntries.map(([key, value]) => { const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase()); const displayValue = Array.isArray(value) ? value.join(', ') : String(value); return <span key={key} style={{ marginRight: 8 }}><Text type="secondary" style={{ fontSize: 13 }}>• {label}:</Text><Text style={{ fontSize: 13 }}> {displayValue}</Text></span>; })}</div>}</Space>, color: interaction.outcome === 'connected' ? '#1d4838' : '#666660' }; })} /></Card>
          </Space>
        )}
      </Drawer>
      <FollowupModal
        followupId={selectedFollowupId}
        visible={followupModalVisible}
        onClose={() => {
          setFollowupModalVisible(false);
          setSelectedFollowupId(null);
        }}
        onSuccess={() => {
          void fetchData();
        }}
      />
    </div>
  );
}
