'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type {
  AgentReviewedRow,
  AnalyticsData,
  AnalyticsFilterType,
  DietitianAnalyticsRow,
  OutcomesAnalytics,
  TransactionRow,
} from '@/types/analytics';
import {
  MetricCard,
  DateRangeButtons,
  FeedbackCallFunnel,
  StageTypeCard,
  TransactionTable,
  FollowupStageCard,
  StageComparisonChart,
  DietitianTable,
  AgentReviewedChart,
  ConnectionVsTtcChart,
  AgentReviewedDrawer,
  OutcomesBarChart,
  AttemptOutcomesChart,
} from '@/components/analytics';
import './analytics-page.css';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';
import { sumConversionBreakdown } from '@/lib/utils/analyticsOutcomes';

type TabKey = 'overview' | 'outcomes' | 'agents';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [filterType, setFilterType] = useState<AnalyticsFilterType>('week');
  const [customDateRange, setCustomDateRange] = useState<[string, string] | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [outcomesData, setOutcomesData] = useState<OutcomesAnalytics | null>(null);
  const [dietitianData, setDietitianData] = useState<DietitianAnalyticsRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const [selectedAgent, setSelectedAgent] = useState<{
    dtId: string;
    dtName: string;
  } | null>(null);
  const [reviewedDrawerOpen, setReviewedDrawerOpen] = useState(false);
  const [reviewedLoading, setReviewedLoading] = useState(false);
  const [reviewedRows, setReviewedRows] = useState<AgentReviewedRow[]>([]);

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

      const [analyticsRes, outcomesRes, dietitianRes, transactionsRes, dtWorkloadRes] =
        await Promise.all([
          fetch(`/api/admin/analytics?${params}`),
          fetch(`/api/admin/analytics/outcomes?${params}`),
          fetch(`/api/admin/analytics/dietitians?${params}`),
          fetch(`/api/admin/analytics/transactions?${params}`),
          fetch(`/api/admin/analytics/dietitians-workload?${workloadParams}`),
        ]);

      if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
      if (!outcomesRes.ok) throw new Error('Failed to fetch outcomes');
      if (!dietitianRes.ok) throw new Error('Failed to fetch agent analytics');
      if (!transactionsRes.ok) throw new Error('Failed to fetch transactions');
      if (!dtWorkloadRes.ok) throw new Error('Failed to fetch agent workload');

      const [analyticsJson, outcomesJson, dietitianJson, transactionsJson, dtWorkloadJson] =
        await Promise.all([
          analyticsRes.json(),
          outcomesRes.json(),
          dietitianRes.json(),
          transactionsRes.json(),
          dtWorkloadRes.json(),
        ]);

      setAnalyticsData(analyticsJson as AnalyticsData);
      setOutcomesData(outcomesJson as OutcomesAnalytics);

      type WorkloadRow = {
        dtId: string;
        todayDue: number;
        overdue: number;
        newDueToday?: number;
        rescheduledDueToday?: number;
        rescheduledDueTodayByStage?: {
          counselling: number;
          fu1: number;
          fu2: number;
          fu3: number;
        };
        overdueDueToday?: number;
        overdueByStage?: { counselling: number; fu1: number; fu2: number; fu3: number };
        overdueAttempted?: number;
        overdueAttemptedByStage?: { counselling: number; fu1: number; fu2: number; fu3: number };
        callsAttempted?: number;
        callsConnected?: number;
      };
      const workloadList = (dtWorkloadJson as { dietitians?: WorkloadRow[] }).dietitians ?? [];
      const workloadByDtId = new Map(
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
          const leads = d.leads ?? 0;
          const attemptPct = leads > 0 ? Math.round((attempted / leads) * 100) : d.attemptPct;
          const connPct = attempted > 0 ? Math.round((connected / attempted) * 100) : d.connPct;
          const conversionPct =
            connected > 0 ? Math.round((d.reviewed / connected) * 100) : d.conversionPct;
          return {
            ...d,
            todayDue: w?.todayDue ?? 0,
            overdue: w?.overdue ?? 0,
            newDueToday: useSnapshotData ? (w?.newDueToday ?? 0) : (d.newLeads ?? 0),
            rescheduledDueToday: useSnapshotData
              ? (w?.rescheduledDueToday ?? 0)
              : (d.rescheduledLeads ?? 0),
            rescheduledDueTodayByStage: useSnapshotData
              ? w?.rescheduledDueTodayByStage
              : undefined,
            overdueDueToday: useSnapshotData ? (w?.overdueDueToday ?? 0) : 0,
            overdueAttempted: useSnapshotData ? (w?.overdueAttempted ?? 0) : 0,
            attempted,
            connected,
            attemptPct,
            connPct,
            conversionPct,
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

  const fetchAgentReviewed = useCallback(
    async (dt: { dtId: string; dtName: string }) => {
      if (filterType === 'custom' && !customDateRange) return;
      try {
        setSelectedAgent(dt);
        setReviewedDrawerOpen(true);
        setReviewedLoading(true);
        setReviewedRows([]);

        const params = new URLSearchParams();
        params.set('filter', filterType);
        if (filterType === 'custom' && customDateRange) {
          params.set('startDate', customDateRange[0]);
          params.set('endDate', customDateRange[1]);
        }

        const res = await fetch(`/api/admin/analytics/dietitians/${dt.dtId}/reviewed?${params}`);
        if (!res.ok) throw new Error('Failed to fetch reviewed conversions');
        const json = (await res.json()) as { reviewed?: AgentReviewedRow[] };
        setReviewedRows(Array.isArray(json.reviewed) ? json.reviewed : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch reviewed conversions';
        messageApi.error(msg);
      } finally {
        setReviewedLoading(false);
      }
    },
    [filterType, customDateRange, messageApi]
  );

  const c = analyticsData?.counselling ?? null;
  const f1 = analyticsData?.firstFollowup ?? null;
  const f2 = analyticsData?.secondFollowup ?? null;
  const f3 = analyticsData?.thirdFollowup ?? null;
  const funnel = analyticsData?.funnelSummary;

  const totalLeads = funnel?.totalLeads ?? 0;
  const uniqueAttempted = funnel?.attempted ?? analyticsData?.activity?.uniqueCustomersCalled ?? 0;
  const uniqueConnected = funnel?.connected ?? analyticsData?.activity?.uniqueCustomersConnected ?? 0;
  const totalConverted = funnel?.converted ?? 0;
  const totalAttempts = analyticsData?.activity?.attempts ?? 0;

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
      subtitle: `unique customers called (once per day) · ${pct(uniqueAttempted, totalLeads || 1)}% of leads`,
      dot: '#FCB92D',
    },
    {
      label: 'Connected',
      value: uniqueConnected,
      subtitle: `unique customer-days with a connect · ${pct(uniqueConnected, uniqueAttempted || 1)}% of attempted`,
      dot: '#1D4838',
    },
    {
      label: 'Reviewed',
      value: totalConverted,
      subtitle: `${pct(totalConverted, uniqueConnected || 1)}% of connected`,
      dot: '#134175',
    },
    {
      label: 'Total Lead touched',
      value: totalAttempts,
      subtitle: `total call attempts · ${
        analyticsData?.dateRange
          ? `${analyticsData.dateRange.startDate} to ${analyticsData.dateRange.endDate}`
          : filterType === 'custom' && customDateRange
            ? `${customDateRange[0]} to ${customDateRange[1]}`
            : `this ${filterType}`
      }`,
      dot: '#88CEEB',
    },
  ];

  const stageTypeData = [
    {
      label: followupStageLabel(0),
      obj: 'Onboarding',
      att: c?.attempted ?? 0,
      conn: c?.connected ?? 0,
      conversion: c?.converted ?? 0,
      color: '#1D4838',
    },
    {
      label: followupStageLabel(1),
      obj: 'Soft push',
      att: f1?.attempted ?? 0,
      conn: f1?.connected ?? 0,
      conversion: f1?.converted ?? 0,
      color: '#134175',
    },
    {
      label: followupStageLabel(2),
      obj: 'Final cadence',
      att: f2?.attempted ?? 0,
      conn: f2?.connected ?? 0,
      conversion: f2?.converted ?? 0,
      color: '#E7580B',
    },
    {
      label: followupStageLabel(3),
      obj: 'Final close-out',
      att: f3?.attempted ?? 0,
      conn: f3?.connected ?? 0,
      conversion: f3?.converted ?? 0,
      color: '#8A2BE2',
    },
  ];

  const buildFollowupStage = (
    section: typeof c,
    config: {
      name: string;
      objective: string;
      target: number;
      statLabel: string;
      color: string;
      showConverted: boolean;
      useConnectionMainPct?: boolean;
    }
  ) => {
    const attempted = section?.attempted ?? 0;
    const connected = section?.connected ?? 0;
    const converted = section?.converted ?? 0;
    const mainPct = config.useConnectionMainPct
      ? attempted > 0
        ? pct(connected, attempted)
        : 100
      : connected > 0
        ? pct(converted, connected)
        : 0;
    return {
      name: config.name,
      objective: config.objective,
      mainPct,
      target: config.target,
      statLabel: config.statLabel,
      attempted,
      connected,
      converted,
      onTarget: mainPct >= config.target,
      color: config.color,
      showConverted: config.showConverted,
    };
  };

  const followupStages = [
    buildFollowupStage(c, {
      name: followupStageLabel(0),
      objective: 'Onboard + educate',
      target: 85,
      statLabel: 'Connection rate',
      color: '#1D4838',
      showConverted: false,
      useConnectionMainPct: true,
    }),
    buildFollowupStage(f1, {
      name: followupStageLabel(1),
      objective: 'Soft push check-in',
      target: 20,
      statLabel: 'Review conv.',
      color: '#134175',
      showConverted: true,
    }),
    buildFollowupStage(f2, {
      name: followupStageLabel(2),
      objective: 'Final follow-up — resolution or close-out',
      target: 50,
      statLabel: 'Review conv.',
      color: '#E7580B',
      showConverted: true,
    }),
    buildFollowupStage(f3, {
      name: followupStageLabel(3),
      objective: 'Final close-out call',
      target: 50,
      statLabel: 'Review conv.',
      color: '#8A2BE2',
      showConverted: true,
    }),
  ];

  const mapStageComparison = (section: typeof c) => {
    const breakdown = section?.conversionBreakdown;
    const connectedFromOutcomes = sumConversionBreakdown(breakdown);
    return {
      attempted: section?.attempted ?? 0,
      connected: connectedFromOutcomes || (section?.connected ?? 0),
      reviewed: breakdown?.reviewed ?? 0,
      issue_with_product: breakdown?.issue_with_product ?? 0,
      interested: breakdown?.interested ?? 0,
      didnt_reviewed: breakdown?.didnt_reviewed ?? 0,
      unknown: breakdown?.unknown ?? 0,
    };
  };

  const stageComparisonData = [
    { name: followupStageLabel(0), ...mapStageComparison(c) },
    { name: followupStageLabel(1), ...mapStageComparison(f1) },
    { name: followupStageLabel(2), ...mapStageComparison(f2) },
    { name: followupStageLabel(3), ...mapStageComparison(f3) },
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

  const topByReviewed = dietitianData.reduce(
    (best, d) => (d.reviewed > (best?.reviewed ?? -1) ? d : best),
    null as DietitianAnalyticsRow | null
  );
  const topPerformer =
    topByReviewed ??
    dietitianData.reduce(
      (best, d) => (d.connected > (best?.connected ?? 0) ? d : best),
      null as DietitianAnalyticsRow | null
    );

  const highestUnreachable = dietitianData.reduce(
    (worst, d) => (d.unreachablePct > (worst?.unreachablePct ?? 0) ? d : worst),
    null as DietitianAnalyticsRow | null
  );

  const teamReviewed = dietitianData.reduce((s, d) => s + d.reviewed, 0);

  const agentKpis = [
    { label: 'Avg Conn. Rate', value: `${avgConnPct}%`, subtitle: 'team average', dot: '#1D4838' },
    { label: 'Avg T-to-call', value: `${avgTtc}h`, subtitle: 'target: under 2h', dot: '#FCB92D' },
    {
      label: 'Top performer',
      value: topPerformer?.dtName?.split(' ').slice(0, 2).join(' ') ?? '—',
      subtitle: topPerformer
        ? `${topPerformer.reviewed} reviewed · ${topPerformer.conversionPct}% conv`
        : '—',
      dot: '#D5F369',
    },
    {
      label: 'Highest Unreachable',
      value: highestUnreachable?.dtName?.split(' ').slice(0, 2).join(' ') ?? '—',
      subtitle: `${highestUnreachable?.unreachablePct ?? 0}% rate`,
      dot: '#E7580B',
    },
    {
      label: 'Team reviewed',
      value: teamReviewed,
      subtitle:
        filterType === 'custom' && customDateRange
          ? `${customDateRange[0]} to ${customDateRange[1]}`
          : `this ${filterType}`,
      dot: '#134175',
    },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'outcomes', label: 'Outcomes' },
    { key: 'agents', label: 'Agent Performance' },
  ];

  const dateRangeButtons = (
    <DateRangeButtons
      value={filterType}
      onChange={setFilterType}
      customDateRange={customDateRange}
      onCustomDateRangeChange={setCustomDateRange}
    />
  );

  const errorBanner = error ? (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      {error}
    </div>
  ) : null;

  return (
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

      {activeTab === 'overview' && (
        <div className="analytics-pane">
          {dateRangeButtons}
          {errorBanner}
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
              <div className="analytics-card-title">Call funnel</div>
              {funnel ? (
                <FeedbackCallFunnel summary={funnel} />
              ) : (
                <div className="text-sm" style={{ color: 'var(--text3)' }}>
                  No funnel data
                </div>
              )}
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
                  conversion={s.conversion}
                  color={s.color}
                />
              ))}
            </div>
          </div>
          <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
            Follow-up stages — objectives & conversion targets
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
          <div className="analytics-footer-label">Call-level activity — individual attempts</div>
          <div className="analytics-table-wrap">
            <TransactionTable transactions={transactions} />
          </div>
        </div>
      )}

      {activeTab === 'outcomes' && (
        <div className="analytics-pane">
          {dateRangeButtons}
          {errorBanner}
          <div className="analytics-grid-2">
            <div className="analytics-card">
              <div className="analytics-card-title">Connected outcomes</div>
              <OutcomesBarChart data={outcomesData?.byConnectedChoice ?? []} />
            </div>
            <div className="analytics-card">
              <div className="analytics-card-title">Call attempt dispositions</div>
              <AttemptOutcomesChart data={outcomesData?.byAttemptOutcome ?? []} />
            </div>
          </div>
          <div className="analytics-card mt-4">
            <div className="analytics-card-title">
              Stage comparison — attempted, connected & outcomes
            </div>
            <StageComparisonChart data={stageComparisonData} />
          </div>
          <div
            className="analytics-card mt-4 text-[11px] leading-relaxed"
            style={{ color: 'var(--text2)' }}
          >
            <strong style={{ color: 'var(--fg)' }}>Reviewed</strong> is the conversion KPI — a
            connected call where the customer completed a review. Other connected choices (issue,
            interested, didn&apos;t review) are shown for context but do not count toward
            conversion.
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="analytics-pane">
          {dateRangeButtons}
          {errorBanner}
          <div className="analytics-krow">
            {agentKpis.map((k) => (
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
              <div className="analytics-card-title">Reviewed by agent</div>
              <AgentReviewedChart
                agents={dietitianData}
                selectedDtId={selectedAgent?.dtId ?? null}
                onSelectAgent={fetchAgentReviewed}
              />
            </div>
            <div className="analytics-card">
              <div className="analytics-card-title">Connection rate vs. time-to-first-call</div>
              <ConnectionVsTtcChart dietitians={dietitianData} />
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="analytics-loading-overlay">
          <div className="analytics-spinner" />
        </div>
      )}

      <AgentReviewedDrawer
        open={reviewedDrawerOpen}
        onClose={() => {
          setReviewedDrawerOpen(false);
          setSelectedAgent(null);
          setReviewedRows([]);
        }}
        agent={selectedAgent}
        reviewed={reviewedRows}
        loading={reviewedLoading}
        filterType={filterType}
        customDateRange={customDateRange}
        dateRangeLabel={dateRangeLabel}
      />
    </div>
  );
}
