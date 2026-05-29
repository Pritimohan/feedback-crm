'use client';

import React, { useMemo } from 'react';
import { Card, Divider, Drawer, Empty, List, Space, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import type { AgentReviewedRow, AnalyticsFilterType } from '@/types/analytics';

const { Text, Title } = Typography;

export interface AgentReviewedDrawerProps {
  open: boolean;
  onClose: () => void;
  agent: { dtId: string; dtName: string } | null;
  reviewed: AgentReviewedRow[];
  loading?: boolean;
  filterType: AnalyticsFilterType;
  customDateRange: [string, string] | null;
  dateRangeLabel?: string | null;
}

type Group = { day: string; items: AgentReviewedRow[] };

export function AgentReviewedDrawer({
  open,
  onClose,
  agent,
  reviewed,
  loading,
  dateRangeLabel,
}: AgentReviewedDrawerProps) {
  const grouped = useMemo<Group[]>(() => {
    const map = new Map<string, AgentReviewedRow[]>();
    for (const r of reviewed) {
      const day = (r.connectedAt || '').slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    const days = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return days.map((d) => ({ day: d, items: map.get(d) ?? [] }));
  }, [reviewed]);

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ margin: 0 }}>
            Reviewed conversions • {agent?.dtName ?? '—'}
          </Title>
          {dateRangeLabel && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dateRangeLabel}
            </Text>
          )}
        </Space>
      }
      placement="right"
      width={720}
      open={open}
      onClose={onClose}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
          <Spin />
        </div>
      ) : reviewed.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No reviewed conversions in this date range."
        />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {grouped.map((g) => (
            <div key={g.day}>
              <Divider
                style={{
                  margin: '0 0 12px 0',
                  color: 'var(--text2)',
                  fontSize: 12,
                }}
              >
                {g.day ? dayjs(g.day).format('DD MMM YYYY') : '—'}
              </Divider>
              <List
                dataSource={g.items}
                rowKey={(o) => o.attemptId}
                renderItem={(o) => (
                  <List.Item style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <Card
                      size="small"
                      style={{
                        width: '100%',
                        borderRadius: 12,
                        borderColor: 'var(--border2)',
                        background: 'var(--surface2)',
                        boxShadow: '0 1px 0 rgba(0,0,0,.02)',
                      }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Text strong style={{ fontSize: 14, color: 'var(--text)' }}>
                          {o.customerName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {o.phone || '—'}
                        </Text>
                        <Space wrap style={{ marginTop: 2 }}>
                          <Text style={{ fontSize: 12, color: 'var(--text2)' }}>{o.stage}</Text>
                          <span
                            className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              background: 'rgba(213,243,105,.35)',
                              color: '#1D4838',
                            }}
                          >
                            Reviewed
                          </span>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {o.connectedAt
                              ? dayjs(o.connectedAt).format('DD MMM YYYY, HH:mm')
                              : '—'}
                          </Text>
                        </Space>
                      </Space>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          ))}
        </Space>
      )}
    </Drawer>
  );
}
