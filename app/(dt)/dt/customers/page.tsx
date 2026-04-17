'use client';

import { useEffect, useState } from 'react';
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
  Tooltip,
  Button,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  DollarOutlined,
  ShoppingOutlined,
  FormOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import CallButton from '@/components/dt/CallButton';
import FollowupModal from '@/components/dt/FollowupModal';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  leadType?: 'pre_purchase' | 'post_purchase';
  currentLifecycleStage: string;
  currentFollowupStage?: number | null;
  ltvScore: string;
  lastOrderDate: string | null;
  createdAt: string;
  latestProductName?: string | null;
  sku?: string | null;
}

interface CustomerHistory {
  customer: Customer;
  orders: Array<{
    id: string;
    productName: string | null;
    quantity: number;
    totalAmount: string | null;
    orderDate: string;
    deliveryStatus: string;
  }>;
  interactions: Array<{
    id: string;
    outcome: string;
    notes: string | null;
    timestamp: string;
    followupNumber: number;
    dt: { name: string } | null;
  }>;
}

function getLifecycleColor(stage: string) {
  switch (stage) {
    case 'active':
      return '#1d4838';
    case 'deferred':
      return '#e7580b';
    case 'inactive':
      return '#666660';
    default:
      return '#134175';
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedLifecycleStage, setSelectedLifecycleStage] = useState<string | null>(null);
  const [selectedFollowupStage, setSelectedFollowupStage] = useState<number | null>(null);
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);
  const [followupModalVisible, setFollowupModalVisible] = useState(false);
  const [openingFollowupForCustomerId, setOpeningFollowupForCustomerId] = useState<string | null>(null);
  const { message } = App.useApp();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dt/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      const nextRows = (data.customers || []) as Customer[];
      setCustomers(nextRows);
      applyFilters(nextRows, searchText, selectedLifecycleStage, selectedFollowupStage);
    } catch (error) {
      console.error('Error fetching customers:', error);
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const applyFilters = (
    sourceRows: Customer[],
    nextSearchText: string,
    nextLifecycleStage: string | null,
    nextFollowupStage: number | null
  ) => {
    let filtered = [...sourceRows];
    const text = nextSearchText.trim().toLowerCase();

    if (text) {
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(text) ||
          customer.phone.includes(nextSearchText) ||
          (customer.email && customer.email.toLowerCase().includes(text))
      );
    }

    if (nextLifecycleStage) {
      filtered = filtered.filter((customer) => customer.currentLifecycleStage === nextLifecycleStage);
    }

    if (nextFollowupStage !== null) {
      filtered = filtered.filter((customer) => customer.currentFollowupStage === nextFollowupStage);
    }

    setFilteredCustomers(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    applyFilters(customers, value, selectedLifecycleStage, selectedFollowupStage);
  };

  const handleLifecycleFilter = (value: string | null) => {
    const nextValue = value ?? null;
    setSelectedLifecycleStage(nextValue);
    applyFilters(customers, searchText, nextValue, selectedFollowupStage);
  };

  const handleFollowupFilter = (value: number | null) => {
    const nextValue = value ?? null;
    setSelectedFollowupStage(nextValue);
    applyFilters(customers, searchText, selectedLifecycleStage, nextValue);
  };

  const handleRowClick = async (customerId: string) => {
    try {
      setDrawerVisible(true);
      setHistoryLoading(true);
      const response = await fetch(`/api/dt/customers/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer history');
      const data = (await response.json()) as CustomerHistory;
      setCustomerHistory(data);
    } catch (error) {
      console.error('Error fetching customer history:', error);
      message.error('Failed to load customer details');
    } finally {
      setHistoryLoading(false);
    }
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

  const columns: ColumnsType<Customer> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          <strong>{name}</strong>
        </Space>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text>
              <PhoneOutlined /> {record.phone}
            </Text>
            <CallButton customerPhone={record.phone} customerId={record.id} />
            <Tooltip title="Open follow-up form">
              <Button
                size="small"
                icon={<FormOutlined />}
                loading={openingFollowupForCustomerId === record.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void openPendingFollowup(record.id);
                }}
              />
            </Tooltip>
          </Space>
          {record.email ? (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <MailOutlined /> {record.email}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Lifecycle Stage',
      dataIndex: 'currentLifecycleStage',
      key: 'currentLifecycleStage',
      render: (stage: string) => (
        <Tag color={getLifecycleColor(stage)}>{stage ? stage.replace('_', ' ').toUpperCase() : 'UNKNOWN'}</Tag>
      ),
    },
    {
      title: 'Followup Stage',
      dataIndex: 'currentFollowupStage',
      key: 'currentFollowupStage',
      render: (stage: number | null | undefined) => {
        if (stage === null || stage === undefined) return <Text type="secondary">-</Text>;
        return <Tag color="#134175">{`Follow-up ${stage}`}</Tag>;
      },
    },
    {
      title: 'Product',
      key: 'product',
      width: 220,
      render: (_, record) => {
        const content = record.latestProductName || record.sku || '-';
        return (
          <Tooltip title={record.latestProductName || record.sku}>
            <Text type={record.latestProductName ? undefined : 'secondary'} style={{ fontSize: '12px' }}>
              {content}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'LTV',
      dataIndex: 'ltvScore',
      key: 'ltvScore',
      render: (ltv: string) => `₹${parseFloat(ltv || '0').toFixed(0)}`,
    },
    {
      title: 'Last Order',
      dataIndex: 'lastOrderDate',
      key: 'lastOrderDate',
      render: (date: string | null) => {
        if (!date) return 'No orders';
        const d = dayjs(date);
        return d.isValid() ? d.format('MMM D, YYYY') : 'No orders';
      },
    },
  ];

  return (
    <div>
      <Title level={2}>My Customers</Title>
      <Paragraph type="secondary">View and manage all your assigned customers</Paragraph>

      <Search
        placeholder="Search by name, phone, or email"
        onSearch={handleSearch}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by Lifecycle Stage"
          allowClear
          style={{ width: 220 }}
          value={selectedLifecycleStage}
          onChange={handleLifecycleFilter}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'Deferred', value: 'deferred' },
          ]}
        />
        <Select
          placeholder="Filter by Follow-up Number"
          allowClear
          style={{ width: 240 }}
          value={selectedFollowupStage}
          onChange={handleFollowupFilter}
          options={[
            { label: 'Follow-up 0', value: 0 },
            { label: 'Follow-up 1', value: 1 },
            { label: 'Follow-up 2', value: 2 },
            { label: 'Follow-up 3', value: 3 },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={filteredCustomers}
        loading={loading}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => {
            void handleRowClick(record.id);
          },
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `Total ${total} customers`,
        }}
      />

      <Drawer
        title="Customer 360 View"
        placement="right"
        size={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={historyLoading}
      >
        {customerHistory ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Title level={4}>{customerHistory.customer.name}</Title>
                <Text>
                  <PhoneOutlined /> {customerHistory.customer.phone}
                </Text>
                {customerHistory.customer.email ? (
                  <Text>
                    <MailOutlined /> {customerHistory.customer.email}
                  </Text>
                ) : null}
                <Tag color={getLifecycleColor(customerHistory.customer.currentLifecycleStage)}>
                  {customerHistory.customer.currentLifecycleStage
                    ? customerHistory.customer.currentLifecycleStage.replace('_', ' ').toUpperCase()
                    : 'UNKNOWN'}
                </Tag>
              </Space>
            </Card>

            <Row gutter={16}>
              <Col span={12}>
                <Card>
                  <Statistic title="Total Orders" value={customerHistory.orders.length} prefix={<ShoppingOutlined />} />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="LTV"
                    value={parseFloat(customerHistory.customer.ltvScore || '0')}
                    prefix={<DollarOutlined />}
                    precision={0}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="Order History">
              <Timeline
                items={customerHistory.orders.map((order) => ({
                  content: (
                    <Space direction="vertical" size={0}>
                      {order.productName ? <Text strong style={{ fontSize: 14 }}>{order.productName}</Text> : null}
                      <Text>
                        ₹{parseFloat(order.totalAmount || '0').toFixed(0)} • Qty: {order.quantity}
                      </Text>
                      <Text type="secondary">{dayjs(order.orderDate).format('MMM D, YYYY')}</Text>
                      <Tag color={order.deliveryStatus === 'delivered' ? 'green' : 'orange'}>{order.deliveryStatus}</Tag>
                    </Space>
                  ),
                  color: order.deliveryStatus === 'delivered' ? '#1d4838' : '#134175',
                }))}
              />
            </Card>

            <Card title="Interaction History">
              <Timeline
                items={customerHistory.interactions.map((interaction) => ({
                  content: (
                    <Space direction="vertical" size={0}>
                      <Text strong>{interaction.outcome === 'connected' ? '✓ Call Connected' : `× ${interaction.outcome}`}</Text>
                      <Text type="secondary">{dayjs(interaction.timestamp).format('MMM D, YYYY h:mm A')}</Text>
                      <Text type="secondary">by {interaction.dt?.name || 'Unknown DT'}</Text>
                      {interaction.notes ? (
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          • Notes: {interaction.notes}
                        </Text>
                      ) : null}
                    </Space>
                  ),
                  color: interaction.outcome === 'connected' ? '#1d4838' : '#666660',
                }))}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <FollowupModal
        followupId={selectedFollowupId}
        visible={followupModalVisible}
        onClose={() => {
          setFollowupModalVisible(false);
          setSelectedFollowupId(null);
        }}
        onSuccess={() => {
          void fetchCustomers();
        }}
      />
    </div>
  );
}
