'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type {
  AnalyticsData,
  AnalyticsFilterType,
  DietitianAnalyticsRow,
  TransactionRow,
} from '@/types/analytics';
import {
  MetricCard,
  DateRangeButtons,
  OverallCallFunnel,
  StageTypeCard,
  TransactionTable,
  FollowupStageCard,
  StageComparisonChart,
  ProductFocusList,
  WhatsAppFunnelBar,
  DietitianTable,
  PipelinePlaceholder,
  ConnectedByDietitianChart,
  ConnectionVsTtcChart,
  DietitianAttemptsDrawer,
} from '@/components/analytics';
import type { DietitianAttemptRow } from '@/components/analytics/DietitianAttemptsDrawer';
import './analytics-page.css';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';

type TabKey = 'funnel' | 'followup' | 'dietitian' | 'pipeline';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('funnel');
  const [filterType, setFilterType] = useState<AnalyticsFilterType>('week');
  const [customDateRange, setCustomDateRange] = useState<[string, string] | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [dietitianData, setDietitianData] = useState<DietitianAnalyticsRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [status, setstatus] =useState(true)

  const [selectedDietitian, setSelectedDietitian] = useState<{
    dtId: string;
    dtName: string;
  } | null>(null);
  const [dtAttemptsOpen, setDtAttemptsOpen] = useState(false);
  const [dtAttemptsLoading, setDtAttemptsLoading] = useState(false);
  const [dtAttempts, setDtAttempts] = useState<DietitianAttemptRow[]>([]);

  const dateRangeLabel =
    filterType === 'custom' && customDateRange
      ? `${customDateRange[0]} → ${customDateRange[1]}`
      : filterType === 'today'
        ? 'Today'
        : filterType === 'yesterday'
          ? 'Yesterday'
          : filterType === 'week'
            ? 'This Week'
            : filterType === 'month'
              ? 'This Month'
              : filterType === 'quarter'
                ? 'Quarter'
                : null;

  const fetchAnalytics = useCallback(async () => {
    if (filterType === 'custom' && !customDateRange) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('filter', filterType);
      if (filterType === 'custom' && customDateRange) {
        params.set('startDate', customDateRange[0]);
        params.set('endDate', customDateRange[1]);
      }

      const workloadParams =
        filterType === 'today' || filterType === 'yesterday'
          ? new URLSearchParams({ filter: filterType })
          : new URLSearchParams();

      const [analyticsRes, dietitianRes, transactionsRes, dtWorkloadRes] = await Promise.all([
        fetch(`/api/admin/analytics?${params}`),
        fetch(`/api/admin/analytics/dietitians?${params}`),
        fetch(`/api/admin/analytics/transactions?${params}`),
        fetch(`/api/admin/analytics/dietitians-workload?${workloadParams}`),
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
      if (!dietitianRes.ok) throw new Error('Failed to fetch agent analytics');
      if (!transactionsRes.ok) throw new Error('Failed to fetch transactions');
      if (!dtWorkloadRes.ok) throw new Error('Failed to fetch agent workload');

      const [analyticsJson, dietitianJson, transactionsJson, dtWorkloadJson] = await Promise.all([
        analyticsRes.json(),
        dietitianRes.json(),
        transactionsRes.json(),
        dtWorkloadRes.json(),
      ]);

      setAnalyticsData(analyticsJson as AnalyticsData);
      type WorkloadRow = {
        dtId: string;
        todayDue: number;
        overdue: number;
        newDueToday?: number;
        rescheduledDueToday?: number;
        rescheduledDueTodayByStage?: { counselling: number; fu1: number; fu2: number; fu3: number };
        overdueDueToday?: number;
        overdueByStage?: { counselling: number; fu1: number; fu2: number; fu3: number };
        overdueAttempted?: number;
        overdueAttemptedByStage?: { counselling: number; fu1: number; fu2: number; fu3: number };
        callsAttempted?: number;
        callsConnected?: number;
      };
      const workloadList = (dtWorkloadJson as { dietitians?: WorkloadRow[] }).dietitians ?? [];
      const workloadByDtId = new Map<
        string,
        {
          todayDue: number;
          overdue: number;
          newDueToday: number;
          rescheduledDueToday: number;
          rescheduledDueTodayByStage: WorkloadRow['rescheduledDueTodayByStage'];
          overdueDueToday: number;
          overdueByStage: WorkloadRow['overdueByStage'];
          overdueAttempted: number;
          overdueAttemptedByStage: WorkloadRow['overdueAttemptedByStage'];
          callsAttempted?: number;
          callsConnected?: number;
        }
      >(
        workloadList.map((d) => [
          d.dtId,
          {
            todayDue: d.todayDue,
            overdue: d.overdue,
            newDueToday: d.newDueToday ?? 0,
            rescheduledDueToday: d.rescheduledDueToday ?? 0,
            rescheduledDueTodayByStage: d.rescheduledDueTodayByStage,
            overdueDueToday: d.overdueDueToday ?? 0,
            overdueByStage: d.overdueByStage,
            overdueAttempted: d.overdueAttempted ?? 0,
            overdueAttemptedByStage: d.overdueAttemptedByStage,
            callsAttempted: d.callsAttempted,
            callsConnected: d.callsConnected,
          },
        ])
      );
      const dietitians = (dietitianJson as { dietitians: DietitianAnalyticsRow[] }).dietitians ?? [];
      const useSnapshotData = filterType === 'today' || filterType === 'yesterday';
      const useSnapshotAttempts = filterType === 'yesterday';
      setDietitianData(
        dietitians.map((d) => {
          const w = workloadByDtId.get(d.dtId);
          const attempted =
            useSnapshotAttempts && w?.callsAttempted != null ? w.callsAttempted : d.attempted;
          const connected =
            useSnapshotAttempts && w?.callsConnected != null ? w.callsConnected : d.connected;
          const connPct = attempted > 0 ? Math.round((connected / attempted) * 100) : d.connPct;
          return {
            ...d,
            todayDue: w?.todayDue ?? 0,
            overdue: w?.overdue ?? 0,
            newDueToday: useSnapshotData ? (w?.newDueToday ?? 0) : (d.newLeads ?? 0),
            rescheduledDueToday: useSnapshotData ? (w?.rescheduledDueToday ?? 0) : (d.rescheduledLeads ?? 0),
            rescheduledDueTodayByStage: useSnapshotData ? w?.rescheduledDueTodayByStage : undefined,
            overdueDueToday: useSnapshotData ? (w?.overdueDueToday ?? 0) : 0,
            overdueAttempted: useSnapshotData ? (w?.overdueAttempted ?? 0) : 0,
            attempted,
            connected,
            connPct,
          };
        })
      );
      setTransactions((transactionsJson as { transactions: TransactionRow[] }).transactions ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filterType, customDateRange, messageApi]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const fetchDietitianAttempts = useCallback(
    async (dt: { dtId: string; dtName: string }) => {
      if (filterType === 'custom' && !customDateRange) return;
      try {
        setSelectedDietitian(dt);
        setDtAttemptsOpen(true);
        setDtAttemptsLoading(true);
        setDtAttempts([]);

        const params = new URLSearchParams();
        params.set('filter', filterType);
        if (filterType === 'custom' && customDateRange) {
          params.set('startDate', customDateRange[0]);
          params.set('endDate', customDateRange[1]);
        }

        const res = await fetch(`/api/admin/analytics/dietitians/${dt.dtId}/attempts?${params}`);
        if (!res.ok) throw new Error('Failed to fetch attempts');
        const json = (await res.json()) as { attempts?: DietitianAttemptRow[] };
        setDtAttempts(Array.isArray(json.attempts) ? json.attempts : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch attempts';
        messageApi.error(msg);
      } finally {
        setDtAttemptsLoading(false);
      }
    },
    [filterType, customDateRange, messageApi]
  );

  const c = analyticsData?.counselling ?? null;
  const f1 = analyticsData?.firstFollowup ?? null;
  const f2 = analyticsData?.secondFollowup ?? null;
  const f3 = analyticsData?.thirdFollowup ?? null;

  const totalRescheduledLeads = dietitianData.reduce(
    (s, d) => s + (d.rescheduledDueToday ?? 0),
    0
  );
  const totalNewLeads = dietitianData.reduce((s, d) => s + (d.newDueToday ?? 0), 0);
  /** Distinct leads in pool for the selected range (not sum of new + rescheduled followup rows). */
  const totalLeads = dietitianData.reduce((s, d) => s + (d.leads ?? 0), 0);
  const totalAttempted =
    (c?.attempted ?? 0) + (f1?.attempted ?? 0) + (f2?.attempted ?? 0) + (f3?.attempted ?? 0);
  const totalConnected =
    (c?.connected ?? 0) + (f1?.connected ?? 0) + (f2?.connected ?? 0) + (f3?.connected ?? 0);
  const totalCounselled = c?.connected ?? 0;
  const uniqueAttempted = analyticsData?.activity?.uniqueCustomersCalled ?? 0;
  const uniqueConnected = analyticsData?.activity?.uniqueCustomersConnected ?? 0;
  const uniqueLeadsTouched = analyticsData?.activity?.uniqueLeadsTouched ?? 0;
  const unreachableCount = totalAttempted - totalConnected;

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const funnelKpis = [
    {
      label: 'Total Leads',
      value: totalLeads,
      subtitle: 'distinct leads in pool',
      dot: '#D5F369',
    },
    {
      label: 'Attempted',
      value: uniqueAttempted,
      subtitle: `${pct(uniqueAttempted, totalLeads || 1)}% of leads`,
      dot: '#FCB92D',
    },
    {
      label: 'Connected',
      value: uniqueConnected,
      subtitle: `${pct(uniqueConnected, uniqueAttempted || 1)}% of attempted`,
      dot: '#1D4838',
    },
    {
      label: `${followupStageLabel(0)} · connected`,
      value: totalCounselled,
      subtitle: `${pct(totalCounselled, totalConnected || 1)}% of connected`,
      dot: '#134175',
    },
    {
      label: 'Leads touched',
      value: uniqueLeadsTouched,
      subtitle: analyticsData?.dateRange
        ? `${analyticsData.dateRange.startDate} to ${analyticsData.dateRange.endDate}`
        : filterType === 'custom' && customDateRange
          ? `${customDateRange[0]} to ${customDateRange[1]}`
          : `this ${filterType}`,
      dot: '#88CEEB',
    },
  ];

  const stageTypeData = [
    {
      label: followupStageLabel(0),
      obj: 'Onboarding',
      att: c?.attempted ?? 0,
      conn: c?.connected ?? 0,
      sale: 0,
      color: '#1D4838',
    },
    {
      label: followupStageLabel(1),
      obj: 'Soft push',
      att: f1?.attempted ?? 0,
      conn: f1?.connected ?? 0,
      sale: 0,
      color: '#134175',
    },
    {
      label: followupStageLabel(2),
      obj: 'Final cadence',
      att: f2?.attempted ?? 0,
      conn: f2?.connected ?? 0,
      sale: 0,
      color: '#E7580B',
    },
    {
      label: followupStageLabel(3),
      obj: 'Final close-out',
      att: f3?.attempted ?? 0,
      conn: f3?.connected ?? 0,
      sale: 0,
      color: '#8A2BE2',
    },
  ];

  const followupStages = [
    {
      name: followupStageLabel(0),
      objective: 'Onboard + educate',
      mainPct: c ? (c.attempted > 0 ? pct(c.connected, c.attempted) : 100) : 0,
      target: 85,
      statLabel: 'Adherence goal',
      attempted: c?.attempted ?? 0,
      connected: c?.connected ?? 0,
      converted: 0,
      onTarget: true,
      color: '#1D4838',
      showConverted: false,
    },
    {
      name: followupStageLabel(1),
      objective: 'Soft push check-in',
      mainPct: f1 ? (f1.connected > 0 ? pct(0, f1.connected) : 0) : 0,
      target: 20,
      statLabel: 'Intent conv.',
      attempted: f1?.attempted ?? 0,
      connected: f1?.connected ?? 0,
      converted: 0,
      onTarget: true,
      color: '#134175',
      showConverted: true,
    },
    {
      name: followupStageLabel(2),
      objective: 'Final follow-up — resolution or close-out',
      mainPct: f2 ? (f2.connected > 0 ? pct(0, f2.connected) : 0) : 0,
      target: 50,
      statLabel: 'Close-out conv.',
      attempted: f2?.attempted ?? 0,
      connected: f2?.connected ?? 0,
      converted: 0,
      onTarget: true,
      color: '#E7580B',
      showConverted: true,
    },
    {
      name: followupStageLabel(3),
      objective: 'Final close-out call',
      mainPct: f3 ? (f3.connected > 0 ? pct(0, f3.connected) : 0) : 0,
      target: 50,
      statLabel: 'Close-out conv.',
      attempted: f3?.attempted ?? 0,
      connected: f3?.connected ?? 0,
      converted: 0,
      onTarget: true,
      color: '#8A2BE2',
      showConverted: true,
    },
  ];

  const stageComparisonData = [
    {
      name: followupStageLabel(0),
      attempted: c?.attempted ?? 0,
      connected: c?.connected ?? 0,
      converted: c?.connected ?? 0,
    },
    {
      name: followupStageLabel(1),
      attempted: f1?.attempted ?? 0,
      connected: f1?.connected ?? 0,
      converted: 0,
    },
    {
      name: followupStageLabel(2),
      attempted: f2?.attempted ?? 0,
      connected: f2?.connected ?? 0,
      converted: 0,
    },
    {
      name: followupStageLabel(3),
      attempted: f3?.attempted ?? 0,
      connected: f3?.connected ?? 0,
      converted: 0,
    },
  ];

  const avgConnPct =
    dietitianData.length > 0
      ? Math.round(dietitianData.reduce((s, d) => s + d.connPct, 0) / dietitianData.length)
      : 0;
  const avgTtc =
    dietitianData.length > 0
      ? (
          dietitianData.reduce((s, d) => s + d.tToCallHours, 0) / dietitianData.length
        ).toFixed(1)
      : '0';

  const topByConn = dietitianData
    .filter((d) => d.attempted >= 5)
    .reduce(
      (best, d) => (d.connPct > (best?.connPct ?? -1) ? d : best),
      null as DietitianAnalyticsRow | null
    );
  const topPerformer =
    topByConn ??
    dietitianData.reduce(
      (best, d) => (d.connected > (best?.connected ?? 0) ? d : best),
      null as DietitianAnalyticsRow | null
    );

  const highestUnreachable = dietitianData.reduce(
    (worst, d) => (d.unreachablePct > (worst?.unreachablePct ?? 0) ? d : worst),
    null as DietitianAnalyticsRow | null
  );

  const teamConnected = dietitianData.reduce((s, d) => s + d.connected, 0);

  const dietitianKpis = [
    { label: 'Avg Conn. Rate', value: `${avgConnPct}%`, subtitle: 'team average', dot: '#1D4838' },
    { label: 'Avg T-to-call', value: `${avgTtc}h`, subtitle: 'target: under 2h', dot: '#FCB92D' },
    {
      label: 'Top performer',
      value: topPerformer?.dtName?.split(' ').slice(0, 2).join(' ') ?? '—',
      subtitle: topPerformer ? `${topPerformer.connPct}% conn · ${topPerformer.connected} connected` : '—',
      dot: '#D5F369',
    },
    {
      label: 'Highest Unreachable',
      value: highestUnreachable?.dtName?.split(' ').slice(0, 2).join(' ') ?? '—',
      subtitle: `${highestUnreachable?.unreachablePct ?? 0}% rate`,
      dot: '#E7580B',
    },
    {
      label: 'Team connected',
      value: teamConnected,
      subtitle:
        filterType === 'custom' && customDateRange
          ? `${customDateRange[0]} to ${customDateRange[1]}`
          : `this ${filterType}`,
      dot: '#134175',
    },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'funnel', label: 'Funnel Overview' },
    { key: 'followup', label: 'Follow-up Stages' },
    { key: 'dietitian', label: 'Agent Performance' },
    { key: 'pipeline', label: 'Pipeline & Alerts' },
  ];

 if (status) return <>
 <div className="analytics-page flex justify-center items-center">
  <h1 className="text-4xl">Under Construction</h1>
 </div>
 </>
 else {return (
    <div className="analytics-page">
      {contextHolder}
      <div className="analytics-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className="analytics-tab"
            data-active={activeTab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'funnel' && (
        <div className="analytics-pane">
          <DateRangeButtons
            value={filterType}
            onChange={setFilterType}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="analytics-krow">
            {funnelKpis.map((k) => (
              <MetricCard
                key={k.label}
                label={k.label}
                value={k.value}
                subtitle={k.subtitle}
                dotColor={k.dot}
              />
            ))}
          </div>
          <div className="analytics-grid-2">
            <div className="analytics-card">
              <div className="analytics-card-title">Overall call funnel</div>
              <OverallCallFunnel
                totalLeads={totalLeads}
                newLeads={totalNewLeads}
                rescheduledLeads={totalRescheduledLeads}
              />
            </div>
            <div className="analytics-card">
              <div className="analytics-card-title">Funnel by stage type</div>
              {stageTypeData.map((s) => (
                <StageTypeCard
                  key={s.label}
                  label={s.label}
                  obj={s.obj}
                  att={s.att}
                  conn={s.conn}
                  sale={s.sale}
                  color={s.color}
                />
              ))}
            </div>
          </div>
          <div className="analytics-footer-label">Call-level activity — individual attempts</div>
          <div className="analytics-table-wrap">
            <TransactionTable transactions={transactions} />
          </div>
        </div>
      )}

      {activeTab === 'followup' && (
        <div className="analytics-pane">
          <DateRangeButtons
            value={filterType}
            onChange={setFilterType}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
            Each stage has a different objective & target conversion rate
          </div>
          <div className="analytics-fug">
            {followupStages.map((s) => (
              <FollowupStageCard
                key={s.name}
                name={s.name}
                objective={s.objective}
                mainPct={s.mainPct}
                target={s.target}
                statLabel={s.statLabel}
                attempted={s.attempted}
                connected={s.connected}
                converted={s.converted}
                onTarget={s.onTarget}
                color={s.color}
                showConverted={s.showConverted}
              />
            ))}
          </div>
          <div className="analytics-card mb-4">
            <div className="analytics-card-title">
              Stage comparison — attempted vs. connected vs. converted
            </div>
            <div className="h-[200px]">
              <StageComparisonChart data={stageComparisonData} />
            </div>
          </div>
          <div className="analytics-grid-2">
            <div className="analytics-card">
              <div className="analytics-card-title">Feedback focus per stage</div>
              <ProductFocusList />
            </div>
            <div className="analytics-card">
              <div className="analytics-card-title">Unreachable → WhatsApp fallback funnel</div>
              <WhatsAppFunnelBar unreachableCount={unreachableCount} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dietitian' && (
        <div className="analytics-pane">
          <DateRangeButtons
            value={filterType}
            onChange={setFilterType}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
          <div className="analytics-krow">
            {dietitianKpis.map((k) => (
              <MetricCard
                key={k.label}
                label={k.label}
                value={k.value}
                subtitle={k.subtitle}
                dotColor={k.dot}
              />
            ))}
          </div>
          <div className="analytics-table-wrap mb-4">
            <DietitianTable dietitians={dietitianData} />
          </div>
          <div className="analytics-grid-2">
            <div className="analytics-card">
              <div className="analytics-card-title">Connected customers by agent</div>
              <ConnectedByDietitianChart
                dietitians={dietitianData}
                selectedDtId={selectedDietitian?.dtId ?? null}
                onSelectDietitian={fetchDietitianAttempts}
              />
            </div>
            <div className="analytics-card">
              <div className="analytics-card-title">Connection rate vs. time-to-first-call</div>
              <ConnectionVsTtcChart dietitians={dietitianData} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="analytics-pane">
          <PipelinePlaceholder />
        </div>
      )}

      {loading && (
        <div className="analytics-loading-overlay">
          <div className="analytics-spinner" />
        </div>
      )}

      <DietitianAttemptsDrawer
        open={dtAttemptsOpen}
        onClose={() => {
          setDtAttemptsOpen(false);
          setSelectedDietitian(null);
          setDtAttempts([]);
        }}
        dietitian={selectedDietitian}
        attempts={dtAttempts}
        loading={dtAttemptsLoading}
        filterType={filterType}
        customDateRange={customDateRange}
        dateRangeLabel={dateRangeLabel}
      />
    </div>
  );}
  }
