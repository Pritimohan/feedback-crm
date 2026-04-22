'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Empty, Space, Tag, Typography } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface FollowupRow {
  followup: {
    id: string;
    followup_number: number;
    scheduled_date: string;
    attempt_count: number;
  };
  lead: {
    id: string;
    activity_status: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  objective: string;
  available_connected_choices: ('reviewed' | 'issue_with_product' | 'interested' | 'dont_reviewed')[];
}

interface ActiveResponse {
  overdue: FollowupRow[];
  todayDue: FollowupRow[];
}

interface Props {
  refreshTrigger?: number;
  onFollowupClick: (row: FollowupRow) => void;
}

export default function FollowupList({ refreshTrigger, onFollowupClick }: Props) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overdue' | 'dueToday'>('dueToday');
  const [overdue, setOverdue] = useState<FollowupRow[]>([]);
  const [dueToday, setDueToday] = useState<FollowupRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dt/followups/active');
        const json = (await res.json()) as ActiveResponse;
        setOverdue(json.overdue || []);
        setDueToday(json.todayDue || []);
      } catch {
        setOverdue([]);
        setDueToday([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [refreshTrigger]);

  const total = overdue.length + dueToday.length;

  const pillButtonStyle = (isActive: boolean, activeBg: string, activeText: string) => ({
    padding: '6px 16px',
    borderRadius: '9999px',
    border: `1px solid ${isActive ? 'transparent' : 'rgba(0,0,0,0.12)'}`,
    backgroundColor: isActive ? activeBg : '#ffffff',
    color: isActive ? activeText : '#666660',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  });

  const items = activeTab === 'overdue' ? overdue : dueToday;

  if (loading) return <Card loading />;

  if (total === 0) {
    return (
      <Card>
        <Empty description="No active follow-ups" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ gap: 8 }}>
        <button onClick={() => setActiveTab('overdue')} style={pillButtonStyle(activeTab === 'overdue', '#e7580b', '#fff')}>
          Overdue <Badge count={overdue.length} style={{ backgroundColor: '#fff', color: '#e7580b' }} />
        </button>
        <button onClick={() => setActiveTab('dueToday')} style={pillButtonStyle(activeTab === 'dueToday', '#fcb92d', '#1a1a1a')}>
          Due Today <Badge count={dueToday.length} style={{ backgroundColor: '#fff', color: '#fcb92d' }} />
        </button>
      </Space>

      <Card
        title={
          <Space>
            {activeTab === 'overdue' ? (
              <ExclamationCircleOutlined style={{ color: '#e7580b' }} />
            ) : (
              <ClockCircleOutlined style={{ color: '#fcb92d' }} />
            )}
            <Text strong style={{ color: activeTab === 'overdue' ? '#e7580b' : '#fcb92d' }}>
              {activeTab === 'overdue' ? `Overdue (${overdue.length})` : `Due Today (${dueToday.length})`}
            </Text>
          </Space>
        }
        variant="outlined"
        style={{ borderColor: activeTab === 'overdue' ? '#e7580b' : '#fcb92d' }}
      >
        {items.length === 0 ? (
          <Empty
            description={`No ${activeTab === 'overdue' ? 'overdue' : 'due today'} follow-ups`}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          items.map((item) => (
            <div
              key={item.followup.id}
              onClick={() => onFollowupClick(item)}
              style={{ cursor: 'pointer', padding: 16, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <UserOutlined />
                    <Text strong>{item.customer.name}</Text>
                  </Space>
                  <Tag color={item.followup.followup_number === 0 ? 'green' : 'blue'}>
                    {followupUiLabel(item.followup.followup_number)}
                  </Tag>
                </Space>

                <Space separator="|">
                  <Text type="secondary">
                    <PhoneOutlined /> {item.customer.phone}
                  </Text>
                  <Text type="secondary">Attempts: {item.followup.attempt_count}</Text>
                  <Text type="secondary">Objective: {item.objective}</Text>
                </Space>

                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> Scheduled: {dayjs(item.followup.scheduled_date).format('MMM D, YYYY h:mm A')} (
                  {dayjs(item.followup.scheduled_date).fromNow()})
                </Text>
              </Space>
            </div>
          ))
        )}
      </Card>
    </Space>
  );
}
