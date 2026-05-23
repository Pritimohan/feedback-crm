'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Select, Space, Tag, Typography } from 'antd';
import { ClockCircleOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { sortFeedbackActiveFollowupCalls } from '@/lib/dt/activeFollowupsCallPriority';
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
  calls?: FollowupRow[];
  dayBounds?: { dayStart: string; dayEnd: string };
}

type FollowupNumberFilterKey = 'all' | '0' | '1' | '2' | '3' | '4';
type AttemptFilterKey = 'all' | '0' | '1' | '2' | '3plus';

const FOLLOWUP_FILTER_OPTIONS: { label: string; value: FollowupNumberFilterKey }[] = [
  { label: 'All follow-ups', value: 'all' },
  { label: 'First call (0)', value: '0' },
  { label: 'Followup 1', value: '1' },
  { label: 'Followup 2', value: '2' },
  { label: 'Followup 3', value: '3' },
  { label: 'Followup 4', value: '4' },
];

const ATTEMPT_FILTER_OPTIONS: { label: string; value: AttemptFilterKey }[] = [
  { label: 'All attempts', value: 'all' },
  { label: '0 attempts', value: '0' },
  { label: '1 attempt', value: '1' },
  { label: '2 attempts', value: '2' },
  { label: '3+ attempts', value: '3plus' },
];

interface Props {
  refreshTrigger?: number;
  onFollowupClick: (row: FollowupRow) => void;
}

export default function FollowupList({ refreshTrigger, onFollowupClick }: Props) {
  const [calls, setCalls] = useState<FollowupRow[]>([]);
  const [dayBounds, setDayBounds] = useState<{ dayStart: Date; dayEnd: Date } | undefined>();
  const [loading, setLoading] = useState(true);
  const [followupFilter, setFollowupFilter] = useState<FollowupNumberFilterKey>('all');
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilterKey>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dt/followups/active');
        const json = (await res.json()) as ActiveResponse;
        if (json.calls?.length) {
          setCalls(json.calls);
        } else {
          setCalls([...(json.todayDue ?? []), ...(json.overdue ?? [])]);
        }
        if (json.dayBounds?.dayStart && json.dayBounds?.dayEnd) {
          setDayBounds({
            dayStart: new Date(json.dayBounds.dayStart),
            dayEnd: new Date(json.dayBounds.dayEnd),
          });
        } else {
          setDayBounds(undefined);
        }
      } catch {
        setCalls([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [refreshTrigger]);

  const filterByFollowupNumber = (items: FollowupRow[]) => {
    if (followupFilter === 'all') return items;
    const n = Number.parseInt(followupFilter, 10);
    return items.filter((item) => Number(item.followup.followup_number) === n);
  };

  const filterByAttemptCount = (items: FollowupRow[]) => {
    if (attemptFilter === 'all') return items;
    if (attemptFilter === '3plus') {
      return items.filter((item) => Number(item.followup.attempt_count) >= 3);
    }
    const n = Number.parseInt(attemptFilter, 10);
    return items.filter((item) => Number(item.followup.attempt_count) === n);
  };

  const filteredSortedCalls = useMemo(() => {
    const byFollowup = filterByFollowupNumber(calls);
    const filtered = filterByAttemptCount(byFollowup);
    const filtersActive = followupFilter !== 'all' || attemptFilter !== 'all';
    if (!filtersActive) {
      return filtered;
    }
    return sortFeedbackActiveFollowupCalls(filtered, {
      now: currentTime,
      dayBounds,
    });
  }, [calls, currentTime, followupFilter, attemptFilter, dayBounds]);

  const getFollowupBadge = (followupNumber: number) => {
    if (followupNumber === 0) {
      return (
        <Tag style={{ background: '#E4F4F3', color: '#445655', borderColor: '#CCE4E2' }}>
          {followupUiLabel(0)}
        </Tag>
      );
    }
    const palette = ['#134175', '#e7580b', '#1d4838'];
    const color = palette[(followupNumber - 1) % palette.length] ?? '#666660';
    return <Tag color={color}>{followupUiLabel(followupNumber)}</Tag>;
  };

  const renderFollowupItem = (item: FollowupRow) => (
    <div
      key={item.followup.id}
      onClick={() => onFollowupClick(item)}
      style={{
        cursor: 'pointer',
        padding: '16px',
        borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      }}
      className="hover:bg-[#f4f2ed] transition-colors"
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <UserOutlined />
            <Text strong>{item.customer.name}</Text>
          </Space>
          {getFollowupBadge(item.followup.followup_number)}
        </Space>

        <Space separator="|">
          <Text type="secondary">
            <PhoneOutlined /> {item.customer.phone}
          </Text>
          <Text type="secondary">Attempts: {item.followup.attempt_count}</Text>
          <Text type="secondary">Objective: {item.objective}</Text>
        </Space>

        <Text type="secondary" style={{ fontSize: '12px' }}>
          <ClockCircleOutlined /> Scheduled: {dayjs(item.followup.scheduled_date).format('MMM D, YYYY h:mm A')} (
          {dayjs(item.followup.scheduled_date).fromNow()})
        </Text>
      </Space>
    </div>
  );

  if (loading) {
    return <Card loading />;
  }

  const filtersActive = followupFilter !== 'all' || attemptFilter !== 'all';

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Space
        style={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}
        align="center"
      >
        <Space align="center" size={8}>
          <Text type="secondary">Follow-ups</Text>
          <Select
            value={followupFilter}
            onChange={(value) => setFollowupFilter(value as FollowupNumberFilterKey)}
            style={{ width: 200 }}
            options={FOLLOWUP_FILTER_OPTIONS}
            className="crm-select"
            popupClassName="crm-select-dropdown"
          />
        </Space>
        <Space align="center" size={8}>
          <Text type="secondary">Attempts</Text>
          <Select
            value={attemptFilter}
            onChange={(value) => setAttemptFilter(value as AttemptFilterKey)}
            style={{ width: 200 }}
            options={ATTEMPT_FILTER_OPTIONS}
            className="crm-select"
            popupClassName="crm-select-dropdown"
          />
        </Space>
      </Space>

      {filteredSortedCalls.length === 0 ? (
        <Card>
          <Empty
            description={filtersActive ? 'No calls match your filters' : 'No active follow-ups'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <Card
          title={
            <Space align="center">
              <PhoneOutlined style={{ color: '#134175' }} />
              <Text strong style={{ color: '#134175' }}>
                Calls ({filteredSortedCalls.length})
              </Text>
            </Space>
          }
          variant="outlined"
          style={{ borderColor: '#134175' }}
        >
          <div>{filteredSortedCalls.map(renderFollowupItem)}</div>
        </Card>
      )}
    </Space>
  );
}
