'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  App, Button, Modal, Table, Tag, Alert, Space, Statistic,
  Row, Col, Card, InputNumber, Typography, Collapse, Tooltip, message,
} from 'antd';
import {
  SyncOutlined, SwapOutlined, CalendarOutlined, LockOutlined,
  InfoCircleOutlined, CheckCircleOutlined, WarningOutlined,
  DownOutlined, UpOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getReassignableTotal,
  getLockedTotal,
  getCurrentTotal,
} from '@/lib/rebalance/buildRebalanceDistribution';
import { computeAfterDistribution } from '@/lib/rebalance/computeRebalancePreview';
import type { RebalanceDtRow, RebalanceConfig, PoolSummary } from '@/lib/rebalance/rebalanceDistribution.types';

const { Text, Paragraph } = Typography;

interface RebalancePreview {
  rebalanceConfig: RebalanceConfig;
  poolSummary: PoolSummary;
}

interface RebalanceCallsWidgetProps {
  onRebalanceComplete?: () => void;
}

export default function RebalanceCallsWidget({ onRebalanceComplete }: RebalanceCallsWidgetProps) {
  const { modal } = App.useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [preview, setPreview] = useState<RebalancePreview | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, number | null>>({});

  const activeConfig = preview?.rebalanceConfig;
  const activeDTs = activeConfig?.dts ?? [];
  const poolSummary = preview?.poolSummary;

  const fetchPreview = useCallback(async () => {
    try {
      setLoading(true);
      setResult(null);
      const response = await fetch('/api/admin/rebalance');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch distribution preview');
      }
      const data = await response.json();
      if (!data.rebalanceConfig) {
        throw new Error('Invalid rebalance preview response');
      }
      setPreview({
        rebalanceConfig: data.rebalanceConfig,
        poolSummary: data.poolSummary ?? {
          totalLeads: 0,
          totalReassignable: 0,
          totalLocked: 0,
          onInactiveDt: 0,
        },
      });
      const initial: RebalanceDtRow[] = data.rebalanceConfig.dts ?? [];
      setPercentages(Object.fromEntries(initial.map((dt: RebalanceDtRow) => [dt.dtId, null])));
      setExpandedRows([]);
    } catch (error) {
      console.error('Error fetching preview:', error);
      message.error(error instanceof Error ? error.message : 'Failed to load distribution preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    fetchPreview();
  };

  const totalLeads = poolSummary?.totalLeads ?? 0;
  const totalReassignablePool = poolSummary?.totalReassignable ?? 0;
  const totalLockedLeads = poolSummary?.totalLocked ?? 0;

  const percentageSum = useMemo(
    () => activeDTs.reduce((s, dt) => s + (percentages[dt.dtId] ?? 0), 0),
    [activeDTs, percentages]
  );
  const allFilled = activeDTs.length > 0 && activeDTs.every((dt) => percentages[dt.dtId] !== null);
  const isValid = allFilled && Math.abs(percentageSum - 100) < 0.01;
  const canExecute =
    !loading && !!preview && totalReassignablePool > 0 && isValid && !result;

  const afterDistribution = useMemo(() => {
    if (!preview) return [];
    return computeAfterDistribution(activeDTs, percentages, {
      totalReassignable: poolSummary?.totalReassignable,
    });
  }, [preview, activeDTs, percentages, poolSummary?.totalReassignable]);

  const handleRebalance = async () => {
    if (!isValid || !activeConfig) return;
    try {
      setRebalancing(true);
      const response = await fetch('/api/admin/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentages: activeDTs.map((dt) => ({
            dtId: dt.dtId,
            percentage: percentages[dt.dtId] ?? 0,
          })),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rebalance');
      }
      const data = await response.json();
      setResult({ success: true, message: data.message });
      message.success(data.message);
      await fetchPreview();
      onRebalanceComplete?.();
    } catch (error) {
      console.error('Error rebalancing:', error);
      message.error(error instanceof Error ? error.message : 'Failed to rebalance');
      throw error;
    } finally {
      setRebalancing(false);
    }
  };

  const requestExecuteRebalance = () => {
    if (!canExecute || !activeConfig) return;
    modal.confirm({
      title: 'Execute rebalance?',
      okText: 'Yes, rebalance',
      cancelText: 'Go back',
      okType: 'primary',
      centered: true,
      content: (
        <Space direction="vertical" size="small">
          <Text>
            You are about to redistribute <strong>{totalReassignablePool}</strong> reassignable
            lead{totalReassignablePool === 1 ? '' : 's'} across agents using your percentage split.
          </Text>
          <Text type="secondary">
            Locked leads ({totalLockedLeads}) will stay with their current agent.
          </Text>
          <Text strong>Are you sure you want to proceed?</Text>
        </Space>
      ),
      onOk: () => handleRebalance(),
    });
  };

  const toggleRow = (dtId: string) =>
    setExpandedRows((prev) =>
      prev.includes(dtId) ? prev.filter((id) => id !== dtId) : [...prev, dtId]
    );

  const handleClose = () => {
    setIsModalOpen(false);
    setResult(null);
  };

  const requestClose = () => {
    if (rebalancing) {
      modal.confirm({
        title: 'Rebalance in progress',
        okText: 'Yes, close',
        cancelText: 'Keep waiting',
        okType: 'primary',
        centered: true,
        content: (
          <Text>
            Reassignment is still running. Closing now will not undo changes already saved to the
            database. Are you sure you want to close?
          </Text>
        ),
        onOk: handleClose,
      });
      return;
    }
    handleClose();
  };

  const examplePool = totalReassignablePool || 320;
  const exampleLocked =
    totalLockedLeads > 0
      ? Math.round(totalLockedLeads / Math.max(activeDTs.length, 1))
      : 30;
  const exampleShare = Math.round(examplePool * 0.1);

  const columns: ColumnsType<RebalanceDtRow> = [
    {
      title: 'Agent',
      dataIndex: 'dtName',
      key: 'dtName',
      width: 130,
    },
    {
      title: 'Current Total',
      key: 'currentTotal',
      align: 'center',
      width: 130,
      render: (_: unknown, record: RebalanceDtRow) => (
        <Text strong>{getCurrentTotal(record)}</Text>
      ),
    },
    {
      title: (
        <Space size={4}>
          <span>% Share</span>
          <Tooltip title="Percentages apply to the total reassignable pool (FU0, zero attempts, active lifecycle and lead). Locked leads stay with leads.assigned_dt_id.">
            <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'pointer' }} />
          </Tooltip>
        </Space>
      ),
      key: 'pct',
      align: 'center',
      width: 180,
      render: (_: unknown, record: RebalanceDtRow) => (
        <InputNumber
          min={0}
          max={100}
          step={5}
          value={percentages[record.dtId] ?? undefined}
          placeholder="—"
          onChange={(v) =>
            setPercentages((prev) => ({ ...prev, [record.dtId]: v }))
          }
          style={{ width: 100 }}
          addonAfter="%"
        />
      ),
    },
    {
      title: 'After Reassignment Total',
      key: 'afterTotal',
      align: 'center',
      width: 180,
      render: (_: unknown, record: RebalanceDtRow) => {
        const after = afterDistribution.find((d) => d.dtId === record.dtId)!;
        const hasInput = percentages[record.dtId] !== null;
        if (!hasInput || after?.afterTotal === null) return <Text type="secondary">—</Text>;
        const change = after.afterTotal - after.currentTotal;
        return (
          <Space direction="vertical" size={2} style={{ alignItems: 'center' }}>
            <Text strong style={{ color: '#1d4838' }}>{after.afterTotal}</Text>
            <Tag
              color={change > 0 ? 'green' : change < 0 ? 'orange' : 'default'}
              style={{ margin: 0, fontSize: 11 }}
            >
              {change > 0 ? `+${change}` : change === 0 ? '±0' : change}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'expand',
      align: 'center' as const,
      width: 48,
      render: (_: unknown, record: RebalanceDtRow) => (
        <Button
          type="text"
          size="small"
          icon={expandedRows.includes(record.dtId) ? <UpOutlined /> : <DownOutlined />}
          onClick={() => toggleRow(record.dtId)}
        />
      ),
    },
  ];

  const expandedRowRender = (record: RebalanceDtRow) => {
    const after = afterDistribution.find((d) => d.dtId === record.dtId)!;
    const hasInput = percentages[record.dtId] !== null;

    return (
      <div style={{ padding: '8px 16px', background: '#fafafa' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 140 }} />
              <th
                style={{
                  textAlign: 'center',
                  padding: '4px 8px',
                  color: '#555',
                  fontWeight: 600,
                  borderBottom: '1px solid #e8e8e8',
                  borderRight: '1px solid #e8e8e8',
                }}
              >
                Current
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '4px 8px',
                  color: '#555',
                  fontWeight: 600,
                  borderBottom: '1px solid #e8e8e8',
                }}
              >
                After Reassignment
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '5px 8px' }}>
                <Tag color="blue">Reassignable</Tag>
              </td>
              <td style={{ textAlign: 'center', padding: '5px 8px' }}>{after.reassignableTotal}</td>
              <td style={{ textAlign: 'center', padding: '5px 8px' }}>
                {hasInput && after.redistTotal !== null ? (
                  <Text style={{ color: '#1d4838' }}>{after.redistTotal}</Text>
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '5px 8px' }}>
                <Tag color="default">
                  <LockOutlined /> Locked
                </Tag>
              </td>
              <td
                style={{
                  textAlign: 'center',
                  padding: '5px 8px',
                  color: '#888',
                  borderRight: '1px solid #e8e8e8',
                }}
              >
                {after.lockedTotal}
              </td>
              <td style={{ textAlign: 'center', padding: '5px 8px', color: '#888' }}>
                {after.lockedTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Button type="primary" icon={<SyncOutlined />} onClick={handleOpenModal}>
        Rebalance Today&apos;s Calls
      </Button>

      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>Rebalance Today&apos;s Calls</span>
            <Tag color="#134175" icon={<CalendarOutlined />}>
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Tag>
          </Space>
        }
        open={isModalOpen}
        onCancel={requestClose}
        maskClosable={!rebalancing}
        width={980}
        footer={[
          <Button key="cancel" onClick={requestClose} disabled={loading}>
            Close
          </Button>,
          <Button
            key="rebalance"
            type="primary"
            icon={<SyncOutlined spin={rebalancing} />}
            loading={rebalancing}
            onClick={requestExecuteRebalance}
            disabled={!canExecute}
          >
            Execute Rebalance
          </Button>,
        ]}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SyncOutlined spin style={{ fontSize: 32, color: '#1d4838' }} />
            <p style={{ marginTop: 16 }}>Loading today&apos;s call distribution...</p>
          </div>
        ) : !preview || !activeConfig ? (
          <Alert
            message="No Active Agents"
            description="There are no active agents to distribute calls to."
            type="error"
            showIcon
          />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Collapse
              size="small"
              items={[
                {
                  key: 'how',
                  label: (
                    <Space>
                      <InfoCircleOutlined />
                      <span>How does rebalancing work?</span>
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Paragraph style={{ margin: 0 }}>
                        <Tag color="blue" style={{ margin: '0 2px' }}>
                          Reassignable
                        </Tag>
                        : pending followup stage 0 (counselling), zero attempts, active lifecycle,
                        and active lead.
                      </Paragraph>
                      <Paragraph style={{ margin: 0 }}>
                        <Tag color="default" style={{ margin: '0 2px' }}>
                          <LockOutlined /> Locked
                        </Tag>
                        : FU1+ or any followup with attempts, or inactive lifecycle/lead (active
                        pipeline only). Owner is <Text code>leads.assigned_dt_id</Text> and never
                        moves on rebalance.
                      </Paragraph>
                      <Paragraph style={{ margin: 0 }}>
                        The <strong>% you enter per agent</strong> is applied to the{' '}
                        <strong>total reassignable pool</strong> across all agents shown — not to
                        each agent&apos;s own current leads.
                      </Paragraph>
                      <div
                        style={{
                          background: '#f6f8fa',
                          padding: '10px 14px',
                          borderRadius: 6,
                          borderLeft: '3px solid #134175',
                        }}
                      >
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>
                          Example — Agent A at 10%
                        </Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                        >
                          The 10% applies to the total reassignable pool. Locked leads stay with
                          the same agent.
                        </Text>
                        <table
                          style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}
                        >
                          <tbody>
                            <tr>
                              <td style={{ padding: '2px 8px 2px 0', color: '#555' }}>
                                Total reassignable pool
                              </td>
                              <td style={{ padding: '2px 8px' }}>
                                <strong>{examplePool}</strong> leads
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '2px 8px 2px 0', color: '#555' }}>
                                Agent&apos;s share (10%)
                              </td>
                              <td style={{ padding: '2px 8px' }}>
                                10% × {examplePool} = <strong>{exampleShare}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '2px 8px 2px 0', color: '#555' }}>
                                Locked leads (unchanged)
                              </td>
                              <td style={{ padding: '2px 8px' }}>
                                <strong>{exampleLocked}</strong> leads
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: '6px 8px 2px 0',
                                  color: '#555',
                                  fontWeight: 600,
                                  borderTop: '1px solid #e0e0e0',
                                }}
                              >
                                Final total
                              </td>
                              <td
                                style={{
                                  padding: '6px 8px 2px',
                                  borderTop: '1px solid #e0e0e0',
                                }}
                              >
                                {exampleShare} + {exampleLocked} ={' '}
                                <strong>{exampleShare + exampleLocked}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Space>
                  ),
                },
              ]}
            />

            {activeDTs.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="No pending leads today"
                description="There are no pending leads in the active pipeline for today."
              />
            ) : (
              <>
                <Row gutter={12}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={
                          <Tooltip title="Active pipeline only: pending followups on an active lifecycle and active lead, assigned to an active agent.">
                            <Text style={{ fontSize: 12 }}>Total Leads</Text>
                          </Tooltip>
                        }
                        value={totalLeads}
                        valueStyle={{ color: '#134175', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={
                          <Tooltip title="FU0, zero attempts, active lifecycle and lead — eligible for redistribution.">
                            <Text style={{ fontSize: 12 }}>Reassignable Leads</Text>
                          </Tooltip>
                        }
                        value={totalReassignablePool}
                        valueStyle={{ color: '#134175', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ borderColor: '#91caff' }}>
                      <Statistic
                        title={
                          <Tooltip title="FU1+, attempted followups, or inactive lifecycle/lead — stay on assigned_dt_id.">
                            <Text style={{ fontSize: 12 }}>Locked Leads</Text>
                          </Tooltip>
                        }
                        value={totalLockedLeads}
                        valueStyle={{ color: '#0958d9', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ borderColor: '#91caff' }}>
                      <Statistic
                        title={<Text style={{ fontSize: 12 }}>Active Agents</Text>}
                        value={activeDTs.length}
                        valueStyle={{ color: '#0958d9', fontSize: 20 }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Alert
                  type={!allFilled ? 'info' : isValid ? 'success' : 'error'}
                  showIcon
                  icon={
                    isValid ? (
                      <CheckCircleOutlined />
                    ) : allFilled ? (
                      <WarningOutlined />
                    ) : (
                      <InfoCircleOutlined />
                    )
                  }
                  message={
                    !allFilled
                      ? `Enter a % for each agent — all must add up to 100%. (Current total: ${percentageSum.toFixed(1)}%)`
                      : isValid
                        ? 'All percentages add up to 100% — ready to execute.'
                        : `Percentages total ${percentageSum.toFixed(1)}% — must be exactly 100%.`
                  }
                />

                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Click <DownOutlined /> on any row to see the split of reassignable and locked
                    leads.
                  </Text>
                  <Table
                    columns={columns}
                    dataSource={activeDTs}
                    rowKey="dtId"
                    pagination={false}
                    size="small"
                    bordered
                    expandable={{
                      expandedRowKeys: expandedRows,
                      expandedRowRender,
                      showExpandColumn: false,
                    }}
                  />
                </div>

                <Space size="large">
                  <Space size={4}>
                    <Tag color="blue" style={{ margin: 0 }}>
                      Reassignable
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Enters the redistribution pool
                    </Text>
                  </Space>
                  <Space size={4}>
                    <Tag color="default" style={{ margin: 0 }}>
                      <LockOutlined /> Locked
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Always stays with current agent
                    </Text>
                  </Space>
                </Space>
              </>
            )}

            {result && (
              <Alert
                message="Rebalance Complete"
                description={result.message}
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />
            )}
          </Space>
        )}
      </Modal>
    </>
  );
}
