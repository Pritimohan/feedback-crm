'use client';

import React from 'react';
import { Tooltip } from 'antd';
import type { DietitianAnalyticsRow, RescheduledDueTodayByStage } from '@/types/analytics';
import { followupStageLabel } from '@/lib/utils/analyticsStageLabels';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';

function formatStageBreakdown(byStage?: RescheduledDueTodayByStage | null): string {
  if (!byStage) return '';
  const parts = [
    byStage.counselling > 0 ? `${followupStageLabel(0)}: ${byStage.counselling}` : null,
    byStage.fu1 > 0 ? `${followupStageLabel(1)}: ${byStage.fu1}` : null,
    byStage.fu2 > 0 ? `${followupStageLabel(2)}: ${byStage.fu2}` : null,
    byStage.fu3 > 0 ? `${followupStageLabel(3)}: ${byStage.fu3}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '';
}

function RescheduledDueCell({
  rescheduledDueToday,
  byStage,
}: {
  rescheduledDueToday: number;
  byStage?: RescheduledDueTodayByStage | null;
}) {
  const breakdown = formatStageBreakdown(byStage);
  const tooltipTitle = (
    <span>
      Due today but not new (not {followupUiLabel(0)} with zero attempts); can decrease as calls are made.
      {breakdown && (
        <>
          <br />
          <br />
          By stage: {breakdown}
        </>
      )}
    </span>
  );
  return (
    <Tooltip title={tooltipTitle}>
      <span className="cursor-help">{rescheduledDueToday}</span>
    </Tooltip>
  );
}

function BadgePill({
  value,
  variant = 'green',
}: {
  value: number | string;
  variant?: 'green' | 'amber' | 'red';
}) {
  const styles: Record<string, string> = {
    green: 'rgba(29,72,56,.1)',
    amber: 'rgba(252,185,45,.22)',
    red: 'rgba(231,88,11,.1)',
  };
  const textStyles: Record<string, string> = {
    green: '#1D4838',
    amber: '#7a4f00',
    red: '#b54000',
  };
  return (
    <span
      className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
      style={{ background: styles[variant], color: textStyles[variant] }}
    >
      {value}
    </span>
  );
}

export function DietitianTable({ dietitians }: { dietitians: DietitianAnalyticsRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr style={{ background: 'var(--fg)' }}>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Agent
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Pending queue: distinct customers with pending followups due today"
            >
              Today Due
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Pending queue: distinct customers with pending followups overdue"
            >
              Overdue
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Overdue attempt rows logged by this agent in the selected date range (was_overdue at dial time)"
            >
              Overdue Attempted
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Distinct leads in pool for the selected date range (not new + rescheduled sum)."
            >
              Leads
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title={`${followupUiLabel(0)} (followup_number 0), never attempted (attempt_count 0), due in snapshot day`}
            >
              New
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title={`Due today but not new: not (${followupUiLabel(0)} with zero attempts).`}
            >
              Rescheduled Due
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Every attempt row logged by this agent in the selected date range"
            >
              Total Attempts
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Unique customer-days (IST): one count per customer per calendar day in range"
            >
              Unique Attempts
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Customer-days where any call that day was connected"
            >
              Connected
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected calls with reviewed outcome in range"
            >
              Reviewed
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Attempted customer-days ÷ leads in pool for the selected period"
            >
              Att.%
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected ÷ attempted"
            >
              Conn.%
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Reviewed / connected"
            >
              Conv.%
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected / attempted (unique lead-days) at this follow-up stage"
            >
              {followupStageLabel(0)}
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected / attempted (unique lead-days) at this follow-up stage"
            >
              {followupStageLabel(1)}
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected / attempted (unique lead-days) at this follow-up stage"
            >
              {followupStageLabel(2)}
            </th>
            <th
              className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55"
              title="Connected / attempted (unique lead-days) at this follow-up stage"
            >
              {followupStageLabel(3)}
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Unreachable%
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              T-to-call
            </th>
          </tr>
        </thead>
        <tbody>
          {dietitians.map((d) => (
            <tr
              key={d.dtId}
              className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface2)]"
            >
              <td className="whitespace-nowrap px-3 py-2 font-medium">{d.dtName}</td>
              <td className="px-3 py-2">{d.todayDue ?? 0}</td>
              <td className="px-3 py-2">{d.overdue ?? 0}</td>
              <td className="px-3 py-2">{d.overdueAttempted ?? 0}</td>
              <td className="px-3 py-2">{d.leads ?? 0}</td>
              <td className="px-3 py-2">{d.newDueToday ?? 0}</td>
              <td className="px-3 py-2">
                <RescheduledDueCell
                  rescheduledDueToday={d.rescheduledDueToday ?? 0}
                  byStage={d.rescheduledDueTodayByStage}
                />
              </td>
              <td className="px-3 py-2">{d.totalDials ?? 0}</td>
              <td className="px-3 py-2">{d.attempted}</td>
              <td className="px-3 py-2">{d.connected}</td>
              <td className="px-3 py-2">{d.reviewed}</td>
              <td className="px-3 py-2">
                <BadgePill
                  value={`${d.attemptPct}%`}
                  variant={d.attemptPct >= 70 ? 'green' : d.attemptPct >= 40 ? 'amber' : 'red'}
                />
              </td>
              <td className="px-3 py-2">
                <BadgePill
                  value={`${d.connPct}%`}
                  variant={d.connPct >= 75 ? 'green' : d.connPct >= 55 ? 'amber' : 'red'}
                />
              </td>
              <td className="px-3 py-2">
                <BadgePill
                  value={`${d.conversionPct}%`}
                  variant={d.conversionPct >= 40 ? 'green' : d.conversionPct >= 20 ? 'amber' : 'red'}
                />
              </td>
              <td className="px-3 py-2">
                {d.counselling}/<span style={{ color: 'var(--text3)' }}>{d.fu0Att}</span>
              </td>
              <td className="px-3 py-2">
                {d.fu1Conn}/<span style={{ color: 'var(--text3)' }}>{d.fu1Att}</span>
              </td>
              <td className="px-3 py-2">
                {d.fu2Conn}/<span style={{ color: 'var(--text3)' }}>{d.fu2Att}</span>
              </td>
              <td className="px-3 py-2">
                {d.fu3Conn}/<span style={{ color: 'var(--text3)' }}>{d.fu3Att}</span>
              </td>
              <td className="px-3 py-2">
                <BadgePill
                  value={`${d.unreachablePct}%`}
                  variant={d.unreachablePct <= 4 ? 'green' : d.unreachablePct <= 7 ? 'amber' : 'red'}
                />
              </td>
              <td
                className="px-3 py-2"
                style={{ color: d.tToCallHours > 4 ? '#b54000' : 'var(--text2)' }}
              >
                {d.tToCallHours > 0 ? `${d.tToCallHours}h` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
