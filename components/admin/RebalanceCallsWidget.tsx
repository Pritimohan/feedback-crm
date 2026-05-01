'use client';

import { useState, useMemo } from 'react';
import { Button, Modal, Table, Tag, message, Alert, Space, Statistic, Row, Col, Card, InputNumber, Typography } from 'antd';
import { SyncOutlined, WarningOutlined, CheckCircleOutlined, SwapOutlined, PhoneOutlined, CalendarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
const { Text } = Typography;

interface Distribution { dtId: string; dtName: string; dtEmail?: string; todaysCalls: number; }
interface RebalancePreview { currentDistribution: Distribution[]; proposedDistribution: Distribution[]; activeDTs: { id: string; name: string; email: string }[]; totalTodaysCalls: number; customersToMove: number; }
interface RebalanceResult { success: boolean; message: string; customersReassigned: number; totalTodaysCalls: number; newDistribution: Distribution[]; }
interface RebalanceCallsWidgetProps { onRebalanceComplete?: () => void; }

function computePercentages(activeDTs: { id: string }[], adminInputs: Record<string, number | ''>): { pct: Record<string, number>; error: string | null } {
  const specified: { dtId: string; val: number }[] = []; const unspecified: string[] = [];
  for (const dt of activeDTs) { const v = adminInputs[dt.id]; if (v !== '' && v !== undefined && !Number.isNaN(v)) specified.push({ dtId: dt.id, val: v }); else unspecified.push(dt.id); }
  const specifiedSum = specified.reduce((s, x) => s + x.val, 0);
  if (specifiedSum > 100) return { pct: {}, error: `Specified percentages total ${specifiedSum.toFixed(1)}% (max 100%)` };
  if (specified.length === activeDTs.length && Math.abs(specifiedSum - 100) > 0.01) return { pct: {}, error: `All percentages specified must total 100% (got ${specifiedSum.toFixed(1)}%)` };
  const remainder = 100 - specifiedSum; const autoPct = unspecified.length > 0 ? remainder / unspecified.length : 0;
  const pct: Record<string, number> = {}; for (const { dtId, val } of specified) pct[dtId] = val; for (const dtId of unspecified) pct[dtId] = autoPct; return { pct, error: null };
}
function allocateByPercentages(total: number, activeDTs: { id: string }[], pct: Record<string, number>): Record<string, number> {
  const exact = activeDTs.map((dt) => ({ dtId: dt.id, exact: (total * (pct[dt.id] ?? 0)) / 100 })); const floor = exact.map((x) => Math.floor(x.exact));
  const remaining = total - floor.reduce((s, x) => s + x, 0); const frac = exact.map((x, i) => ({ i, frac: x.exact - Math.floor(x.exact) })); frac.sort((a, b) => b.frac - a.frac);
  for (let r = 0; r < remaining; r++) floor[frac[r].i]++; const out: Record<string, number> = {}; activeDTs.forEach((dt, i) => { out[dt.id] = floor[i]; }); return out;
}

export default function RebalanceCallsWidget({ onRebalanceComplete }: RebalanceCallsWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false); const [loading, setLoading] = useState(false); const [rebalancing, setRebalancing] = useState(false);
  const [preview, setPreview] = useState<RebalancePreview | null>(null); const [result, setResult] = useState<RebalanceResult | null>(null); const [percentages, setPercentages] = useState<Record<string, number | ''>>({});
  const fetchPreview = async () => { try { setLoading(true); setResult(null); const response = await fetch('/api/admin/rebalance'); if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch distribution preview'); const data = await response.json(); setPreview(data); setPercentages(Object.fromEntries(data.activeDTs.map((dt: { id: string }) => [dt.id, '']))); } catch (error) { message.error(error instanceof Error ? error.message : 'Failed to load distribution preview'); } finally { setLoading(false); } };
  const { pct: computedPct, error: pctError } = useMemo(() => (!preview ? { pct: {}, error: null } : computePercentages(preview.activeDTs, percentages)), [preview, percentages]);
  const isUsingCustomPercentages = useMemo(() => !!preview && preview.activeDTs.some((dt) => percentages[dt.id] !== '' && percentages[dt.id] !== undefined), [preview, percentages]);
  const effectiveProposedDistribution = useMemo(() => { if (!preview) return []; if (!isUsingCustomPercentages || pctError) return preview.proposedDistribution; const allocated = allocateByPercentages(preview.totalTodaysCalls, preview.activeDTs, computedPct); return preview.activeDTs.map((dt) => ({ dtId: dt.id, dtName: dt.name, dtEmail: dt.email, todaysCalls: allocated[dt.id] ?? 0 })); }, [preview, isUsingCustomPercentages, pctError, computedPct]);
  const effectiveCustomersToMove = useMemo(() => { if (!preview) return 0; const current = preview.currentDistribution.map((d) => ({ dtId: d.dtId, count: d.todaysCalls })); const proposed = effectiveProposedDistribution.map((d) => ({ dtId: d.dtId, count: d.todaysCalls })); let toMove = 0; for (const c of current) { const p = proposed.find((x) => x.dtId === c.dtId); if (p && c.count > p.count) toMove += c.count - p.count; } return toMove; }, [preview, effectiveProposedDistribution]);
  const handleRebalance = async () => { try { setRebalancing(true); const body = isUsingCustomPercentages && !pctError ? { percentages: Object.entries(computedPct).map(([dtId, percentage]) => ({ dtId, percentage })) } : undefined; const response = await fetch('/api/admin/rebalance', { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); if (!response.ok) throw new Error((await response.json()).error || 'Failed to rebalance'); const data = await response.json(); setResult(data); message.success(data.message); await fetchPreview(); onRebalanceComplete?.(); } catch (error) { message.error(error instanceof Error ? error.message : 'Failed to rebalance'); } finally { setRebalancing(false); } };
  const setPercentage = (dtId: string, value: number | '' | null) => setPercentages((prev) => ({ ...prev, [dtId]: value === null ? '' : value }));
  const resetToEqual = () => { if (!preview) return; setPercentages(Object.fromEntries(preview.activeDTs.map((dt) => [dt.id, '']))); };
  const columns: ColumnsType<Distribution & { proposed?: number; change?: number }> = [
    { title: 'Agent', dataIndex: 'dtName', key: 'dtName' },
    { title: <Space size="small"><span>Distribution %</span><Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={resetToEqual}>Reset to equal</Button></Space>, key: 'distributionPct', align: 'center', width: 140, render: (_: unknown, record) => { const dt = preview?.activeDTs.find((a) => a.id === record.dtId); if (!dt || !preview) return null; const isSpecified = percentages[dt.id] !== '' && percentages[dt.id] !== undefined; return <Space size="small" align="center"><InputNumber min={0} max={100} step={5} value={percentages[dt.id] === '' ? undefined : (percentages[dt.id] as number)} placeholder="auto" onChange={(v) => setPercentage(dt.id, v ?? '')} style={{ width: 80 }} addonAfter="%" />{Object.keys(computedPct).length > 0 && <Text type="secondary" style={{ fontSize: 12, fontWeight: isSpecified ? 600 : 400 }}>→ {computedPct[dt.id]?.toFixed(1)}%</Text>}</Space>; } },
    { title: 'Current', dataIndex: 'todaysCalls', key: 'current', align: 'center', render: (count: number) => <Tag color="#134175" icon={<PhoneOutlined />}>{count}</Tag> },
    { title: 'After Rebalance', dataIndex: 'proposed', key: 'proposed', align: 'center', render: (count: number) => <Tag color="#1d4838" icon={<PhoneOutlined />}>{count}</Tag> },
    { title: 'Change', dataIndex: 'change', key: 'change', align: 'center', render: (change: number) => change === 0 ? <Tag>No change</Tag> : <Tag color={change > 0 ? '#1d4838' : '#fcb92d'}>{change > 0 ? `+${change}` : change}</Tag> },
  ];
  const getTableData = () => !preview ? [] : preview.currentDistribution.map((curr) => { const prop = effectiveProposedDistribution.find((p) => p.dtId === curr.dtId); return { ...curr, proposed: prop?.todaysCalls || 0, change: (prop?.todaysCalls || 0) - curr.todaysCalls }; });
  const getDistributionDeviation = () => !preview || preview.currentDistribution.length === 0 ? 0 : Math.max(...preview.currentDistribution.map((d) => d.todaysCalls)) - Math.min(...preview.currentDistribution.map((d) => d.todaysCalls));
  const isBalanced = getDistributionDeviation() <= 1;
  const canExecute = !loading && !!preview && preview.activeDTs.length > 0 && preview.totalTodaysCalls > 0 && !pctError && (isUsingCustomPercentages || !isBalanced);

  return (
    <>
      <Button type="primary" icon={<SyncOutlined />} onClick={() => { setIsModalOpen(true); void fetchPreview(); }}>Rebalance Today&apos;s Calls</Button>
      <Modal title={<Space><SwapOutlined /><span>Rebalance Today&apos;s Calls</span><Tag color="#134175" icon={<CalendarOutlined />}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Tag></Space>} open={isModalOpen} onCancel={() => setIsModalOpen(false)} width={800} footer={[<Button key="cancel" onClick={() => setIsModalOpen(false)}>Close</Button>, <Button key="rebalance" type="primary" icon={<SyncOutlined spin={rebalancing} />} loading={rebalancing} onClick={() => void handleRebalance()} disabled={!canExecute}>Execute Rebalance</Button>]}>
        {loading ? <div style={{ textAlign: 'center', padding: '40px 0' }}><SyncOutlined spin style={{ fontSize: 32, color: '#1d4838' }} /><p style={{ marginTop: 16 }}>Loading today&apos;s call distribution...</p></div> : preview ? <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={16}><Col span={8}><Card size="small"><Statistic title="Today's Calls" value={preview.totalTodaysCalls} prefix={<PhoneOutlined />} valueStyle={{ color: '#134175' }} /></Card></Col><Col span={8}><Card size="small"><Statistic title="Active Agents" value={preview.activeDTs.length} /></Card></Col><Col span={8}><Card size="small"><Statistic title="Customers to Move" value={effectiveCustomersToMove} valueStyle={{ color: effectiveCustomersToMove > 0 ? '#fcb92d' : '#1d4838' }} /></Card></Col></Row>
          {preview.totalTodaysCalls === 0 ? <Alert message="No Calls Today" description="There are no pending calls scheduled for today." type="info" showIcon /> : !isUsingCustomPercentages && isBalanced ? <Alert message="Distribution is Balanced" description="Today's calls are already evenly distributed. No rebalancing needed." type="success" showIcon icon={<CheckCircleOutlined />} /> : isUsingCustomPercentages ? <Alert message="Custom Distribution" description="Specify percentage for one or more agents. Remaining % is split equally among others." type="info" showIcon /> : <Alert message="Uneven Distribution Detected" description={`There is a difference of ${getDistributionDeviation()} calls between the highest and lowest assigned agents. Rebalancing will distribute today's calls evenly.`} type="warning" showIcon icon={<WarningOutlined />} />}
          {pctError && <Alert message={pctError} type="error" showIcon />}
          {preview.totalTodaysCalls > 0 && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Set % for one or more agents; leave empty for equal split. Remaining % is auto-calculated.</Text>}
          <Table columns={columns} dataSource={getTableData()} rowKey="dtId" pagination={false} size="small" />
          <Alert message="Note" description="This will only redistribute customers with today's pending calls. Future followups will continue based on the new assignments." type="info" showIcon />
          {result && <Alert message="Rebalance Complete" description={result.message} type="success" showIcon />}
        </Space> : <Alert message="No Active Agents" description="There are no active agents to distribute calls to." type="error" showIcon />}
      </Modal>
    </>
  );
}
