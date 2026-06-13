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
  Tooltip,
  Button,
  Select,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import FollowupModal from '@/components/dt/FollowupModal';
import {
  formatFeedbackFormForDisplay,
  sanitizeFeedbackFormPayload,
} from '@/lib/feedback/feedbackFormSchema';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';
import {
  MARKETPLACE_FILTER_OPTIONS,
  matchesMarketplaceFilter,
} from '@/lib/utils/marketplaceSources';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  leadType?: 'review' | 'nps' | 'feedback' | null;
  currentLifecycleStage: string;
  currentFollowupStage?: number | null;
  ltvScore: string;
  lastOrderDate: string | null;
  createdAt: string;
  latestProductName?: string | null;
  sku?: string | null;
  source?: string | null;
  variant?: string | null;
  brand?: 'fitty' | 'fitelo' | null;
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
    recordingUrl?: string | null;
    formData?: Record<string, unknown> | null;
    structuredData?: Record<string, unknown> | null;
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
  const [selectedLeadType, setSelectedLeadType] = useState<'review' | 'nps' | 'feedback' | null>(null);
  const [selectedLifecycleStage, setSelectedLifecycleStage] = useState<string | null>(null);
  const [selectedFollowupStage, setSelectedFollowupStage] = useState<number | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
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
      applyFilters(nextRows, searchText, selectedLeadType, selectedLifecycleStage, selectedFollowupStage, selectedMarketplace);
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
    nextLeadType: 'review' | 'nps' | 'feedback' | null,
    nextLifecycleStage: string | null,
    nextFollowupStage: number | null,
    nextMarketplace: string | null
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

    if (nextLeadType) {
      filtered = filtered.filter((customer) => customer.leadType === nextLeadType);
    }

    if (nextLifecycleStage) {
      filtered = filtered.filter((customer) => customer.currentLifecycleStage === nextLifecycleStage);
    }

    if (nextFollowupStage !== null) {
      filtered = filtered.filter((customer) => customer.currentFollowupStage === nextFollowupStage);
    }

    if (nextMarketplace) {
      filtered = filtered.filter((customer) => matchesMarketplaceFilter(customer.source, nextMarketplace));
    }

    setFilteredCustomers(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    applyFilters(customers, value, selectedLeadType, selectedLifecycleStage, selectedFollowupStage, selectedMarketplace);
  };

  const handleLeadTypeFilter = (value: 'review' | 'nps' | 'feedback' | null) => {
    const nextValue = value ?? null;
    setSelectedLeadType(nextValue);
    applyFilters(customers, searchText, nextValue, selectedLifecycleStage, selectedFollowupStage, selectedMarketplace);
  };

  const handleMarketplaceFilter = (value: string | null) => {
    const nextValue = value ?? null;
    setSelectedMarketplace(nextValue);
    applyFilters(customers, searchText, selectedLeadType, selectedLifecycleStage, selectedFollowupStage, nextValue);
  };

  const handleLifecycleFilter = (value: string | null) => {
    const nextValue = value ?? null;
    setSelectedLifecycleStage(nextValue);
    applyFilters(customers, searchText, selectedLeadType, nextValue, selectedFollowupStage, selectedMarketplace);
  };

  const handleFollowupFilter = (value: number | null) => {
    const nextValue = value ?? null;
    setSelectedFollowupStage(nextValue);
    applyFilters(customers, searchText, selectedLeadType, selectedLifecycleStage, nextValue, selectedMarketplace);
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
          <Text>
            <PhoneOutlined /> {record.phone}
          </Text>
          {record.email ? (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <MailOutlined /> {record.email}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => {
        const menuItems: MenuProps['items'] = [
          {
            key: 'open_form',
            label: 'Open Form',
          },
        ];

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'open_form') {
                  void openPendingFollowup(record.id);
                }
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
    {
      title: 'Lifecycle Stage',
      dataIndex: 'currentLifecycleStage',
      key: 'currentLifecycleStage',
      render: (stage: string) => (
        <Tag color={getLifecycleColor(stage)}>{stage ? stage.replace('_', ' ').toUpperCase() : 'UNKNOWN'}</Tag>
      ),
    },
    {
      title: 'Follow-up stage',
      dataIndex: 'currentFollowupStage',
      key: 'currentFollowupStage',
      render: (stage: number | null | undefined) => {
        if (stage === null || stage === undefined) return <Text type="secondary">-</Text>;
        return <Tag color="#134175">{followupUiLabel(stage)}</Tag>;
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
          placeholder="Filter by Lead Type"
          allowClear
          style={{ width: 200 }}
          value={selectedLeadType}
          onChange={handleLeadTypeFilter}
          options={[
            { label: 'Review', value: 'review' },
            { label: 'NPS', value: 'nps' },
            { label: 'Feedback', value: 'feedback' },
          ]}
        />
        <Select
          placeholder="Filter by Marketplace"
          allowClear
          style={{ width: 200 }}
          value={selectedMarketplace}
          onChange={handleMarketplaceFilter}
          options={[...MARKETPLACE_FILTER_OPTIONS]}
        />
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
          placeholder="Filter by follow-up stage"
          allowClear
          style={{ width: 240 }}
          value={selectedFollowupStage}
          onChange={handleFollowupFilter}
          options={[
            { label: followupUiLabel(0), value: 0 },
            { label: followupUiLabel(1), value: 1 },
            { label: followupUiLabel(2), value: 2 },
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

            <Card title="Interaction History">
              <Timeline
                items={[...customerHistory.interactions]
                  .filter((i) => (i.outcome || '').toLowerCase() !== 'initiated')
                  .sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())
                  .map((interaction) => {
                    const productName = (() => {
                      const brand = customerHistory.customer.brand;
                      if (brand === 'fitty') return 'GLP';
                      if (brand === 'fitelo') return 'Smart Scale';
                      return customerHistory.customer.latestProductName?.trim() || customerHistory.customer.sku?.trim() || '';
                    })();
                    const variant = customerHistory.customer.variant?.trim() || '';
                    const source = customerHistory.customer.source?.trim() || '';
                    const formEntries = Object.entries(interaction.formData || {}).filter(([, value]) => {
                      // Hide internal lifecycle metadata / noise
                      // (these come from lead_lifecycle_followups.payload)
                      // and are not meant for Customer 360 display.
                      // Note: key-based filtering is handled below.
                      if (value === null || value === undefined) return false;
                      if (typeof value === 'string' && value.trim() === '') return false;
                      if (Array.isArray(value) && value.length === 0) return false;
                      if (typeof value === 'boolean' && value === false) return false;
                      return true;
                    });
                    const feedbackFormRows =
                      interaction.formData?.feedback_form &&
                      typeof interaction.formData.feedback_form === 'object'
                        ? formatFeedbackFormForDisplay(
                            sanitizeFeedbackFormPayload(interaction.formData.feedback_form)
                          )
                        : [];

                    const filteredFormEntries = formEntries.filter(([key]) => {
                      const k = key.trim().toLowerCase();
                      return (
                        k !== 'objective' &&
                        k !== 'escalated' &&
                        k !== 'feedback_form' &&
                        k !== 'connected_choice' &&
                        k !== 'issue_advanced_once'
                      );
                    });

                    return {
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
                      {productName || variant || source ? (
                        <Space size={6} wrap style={{ marginTop: 4 }}>
                          {productName ? <Tag color="#134175">Product: {productName}</Tag> : null}
                          {variant ? <Tag color="#e7580b">Variant: {variant}</Tag> : null}
                          {source ? <Tag color="#1d4838">Source: {source}</Tag> : null}
                        </Space>
                      ) : null}
                          {interaction.outcome === 'connected' &&
                          (filteredFormEntries.length > 0 || feedbackFormRows.length > 0) ? (
                            <div style={{ marginTop: 4, lineHeight: 1.6 }}>
                              {feedbackFormRows.map((row) => (
                                <div key={row.label} style={{ marginBottom: 2 }}>
                                  <Text type="secondary" style={{ fontSize: 13 }}>
                                    • {row.label}:
                                  </Text>
                                  <Text style={{ fontSize: 13 }}> {row.value}</Text>
                                </div>
                              ))}
                              {filteredFormEntries.map(([key, value]) => {
                                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase());
                                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                                return (
                                  <span key={key} style={{ marginRight: 8 }}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                      • {label}:
                                    </Text>
                                    <Text style={{ fontSize: 13 }}> {displayValue}</Text>
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </Space>
                      ),
                      color: interaction.outcome === 'connected' ? '#1d4838' : '#666660',
                    };
                  })}
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
