'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Select, Space, Tag, Typography, App } from 'antd';
import { ClockCircleOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  filterVisibleActiveFollowups,
  sortFeedbackActiveFollowupCalls,
} from '@/lib/dt/activeFollowupsCallPriority';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';
import {
  ACTIVE_FOLLOWUP_OUTCOME_FILTER_OPTIONS,
  formatActiveFollowupOutcomeLabel,
  matchesActiveFollowupOutcomeFilter,
} from '@/lib/utils/activeFollowupOutcomeFilter';
import {
  MARKETPLACE_FILTER_OPTIONS,
  matchesMarketplaceFilter,
} from '@/lib/utils/marketplaceSources';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface FollowupRow {
  followup: {
    id: string;
    followup_number: number;
    scheduled_date: string;
    attempt_count: number;
    updated_at?: string | null;
    payload?: unknown;
  };
  lead: {
    id: string;
    activity_status: string;
    source?: string | null;
    last_connected_choice?: string | null;
    current_touch_status?: string | null;
  };
  last_attempt_outcome?: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  objective: string;
  available_connected_choices: (
    | 'reviewed'
    | 'issue_with_product'
    | 'interested'
    | 'didnt_reviewed'
    | 'feedbacked'
    | 'didnt_feedback'
  )[];
}

interface ActiveResponse {
  overdue: FollowupRow[];
  todayDue: FollowupRow[];
  calls?: FollowupRow[];
  dayBounds?: { dayStart: string; dayEnd: string };
}

type FollowupNumberFilterKey = 0 | 1 | 2 | 3 | 4;
type AttemptFilterKey = 0 | 1 | 2 | '3plus';
type OutcomeFilterKey = string;

const FOLLOWUP_FILTER_OPTIONS: { label: string; value: FollowupNumberFilterKey }[] = [
  { label: 'First call (0)', value: 0 },
  { label: 'Followup 1', value: 1 },
  { label: 'Followup 2', value: 2 },
  { label: 'Followup 3', value: 3 },
  { label: 'Followup 4', value: 4 },
];

const ATTEMPT_FILTER_OPTIONS: { label: string; value: AttemptFilterKey }[] = [
  { label: '0 attempts', value: 0 },
  { label: '1 attempt', value: 1 },
  { label: '2 attempts', value: 2 },
  { label: '3+ attempts', value: '3plus' },
];

interface Props {
  refreshTrigger?: number;
  onFollowupClick: (row: FollowupRow) => void;
}

export default function FollowupList({ refreshTrigger, onFollowupClick }: Props) {
  const { message } = App.useApp();
  const [calls, setCalls] = useState<FollowupRow[]>([]);
  const [dayBounds, setDayBounds] = useState<{ dayStart: Date; dayEnd: Date } | undefined>();
  const [loading, setLoading] = useState(true);
  const [followupFilter, setFollowupFilter] = useState<FollowupNumberFilterKey | null>(null);
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilterKey | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterKey | null>(null);
  const [marketplaceFilter, setMarketplaceFilter] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dt/followups/active');
        if (!res.ok) {
          throw new Error(await getErrorFromResponse(res, 'Failed to load follow-ups'));
        }
        const json = (await res.json()) as ActiveResponse;
        const raw =
          Array.isArray(json.calls) && json.calls.length > 0
            ? json.calls
            : [...(json.todayDue ?? []), ...(json.overdue ?? [])];
        const bounds =
          json.dayBounds?.dayStart && json.dayBounds?.dayEnd
            ? {
                dayStart: new Date(json.dayBounds.dayStart),
                dayEnd: new Date(json.dayBounds.dayEnd),
              }
            : undefined;
        setDayBounds(bounds);
        setCalls(
          sortFeedbackActiveFollowupCalls(raw, { dayBounds: bounds, now: new Date() })
        );
      } catch (error) {
        message.error(toUserFacingMessage(error, 'Failed to load follow-ups'));
        setCalls([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [refreshTrigger, message]);

  const filterByFollowupNumber = (items: FollowupRow[]) => {
    if (followupFilter === null) return items;
    return items.filter((item) => Number(item.followup.followup_number) === followupFilter);
  };

  const filterByAttemptCount = (items: FollowupRow[]) => {
    if (attemptFilter === null) return items;
    if (attemptFilter === '3plus') {
      return items.filter((item) => Number(item.followup.attempt_count) >= 3);
    }
    return items.filter((item) => Number(item.followup.attempt_count) === attemptFilter);
  };

  const filterByOutcome = (items: FollowupRow[]) => {
    if (!outcomeFilter) return items;
    return items.filter((item) => matchesActiveFollowupOutcomeFilter(item, outcomeFilter));
  };

  const filterByMarketplace = (items: FollowupRow[]) => {
    if (!marketplaceFilter) return items;
    return items.filter((item) => matchesMarketplaceFilter(item.lead.source, marketplaceFilter));
  };

  const filteredSortedCalls = useMemo(() => {
    const visible = filterVisibleActiveFollowups(calls, currentTime, dayBounds);
    const byFollowup = filterByFollowupNumber(visible);
    const byAttempt = filterByAttemptCount(byFollowup);
    const byOutcome = filterByOutcome(byAttempt);
    const filtered = filterByMarketplace(byOutcome);
    return sortFeedbackActiveFollowupCalls(filtered, {
      now: currentTime,
      dayBounds,
    });
  }, [calls, currentTime, followupFilter, attemptFilter, outcomeFilter, marketplaceFilter, dayBounds]);

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

  const renderFollowupItem = (item: FollowupRow) => {
    return (
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
          <Space align="center" size={8}>
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
          <Text type="secondary">Last outcome: {formatActiveFollowupOutcomeLabel(item)}</Text>
          <Text type="secondary">Objective: {item.objective}</Text>
        </Space>

        <Text type="secondary" style={{ fontSize: '12px' }}>
          <ClockCircleOutlined /> Scheduled: {dayjs(item.followup.scheduled_date).format('MMM D, YYYY h:mm A')} (
          {dayjs(item.followup.scheduled_date).fromNow()})
        </Text>
      </Space>
    </div>
    );
  };

  if (loading) {
    return <Card loading />;
  }

  const filtersActive =
    marketplaceFilter !== null ||
    followupFilter !== null ||
    attemptFilter !== null ||
    outcomeFilter !== null;

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Space
        style={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}
        align="center"
      >
        <Select
          placeholder="Filter by Marketplace"
          allowClear
          value={marketplaceFilter}
          onChange={(value) => setMarketplaceFilter(value ?? null)}
          style={{ width: 200 }}
          options={[...MARKETPLACE_FILTER_OPTIONS]}
          className="crm-select"
          popupClassName="crm-select-dropdown"
        />
        <Select
          placeholder="Filter by follow-up stage"
          allowClear
          value={followupFilter}
          onChange={(value) => setFollowupFilter((value ?? null) as FollowupNumberFilterKey | null)}
          style={{ width: 200 }}
          options={FOLLOWUP_FILTER_OPTIONS}
          className="crm-select"
          popupClassName="crm-select-dropdown"
        />
        <Select
          placeholder="Filter by attempts"
          allowClear
          value={attemptFilter}
          onChange={(value) => setAttemptFilter((value ?? null) as AttemptFilterKey | null)}
          style={{ width: 200 }}
          options={ATTEMPT_FILTER_OPTIONS}
          className="crm-select"
          popupClassName="crm-select-dropdown"
        />
        <Select
          placeholder="Filter by call outcome"
          allowClear
          value={outcomeFilter}
          onChange={(value) => setOutcomeFilter(value ?? null)}
          style={{ width: 220 }}
          options={[...ACTIVE_FOLLOWUP_OUTCOME_FILTER_OPTIONS]}
          className="crm-select"
          popupClassName="crm-select-dropdown"
        />
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
