'use client';

import React from 'react';
import type { TransactionRow } from '@/types/analytics';

const OUTCOME_BADGES: Record<string, { bg: string; color: string }> = {
  Connected: { bg: 'rgba(29,72,56,.1)', color: '#1D4838' },
  'Call Later': { bg: 'rgba(19,65,117,.1)', color: '#134175' },
  Unreachable: { bg: 'rgba(231,88,11,.1)', color: '#b54000' },
  'Not Interested': { bg: 'rgba(107,114,128,.12)', color: '#374151' },
  '→ WhatsApp': { bg: 'rgba(252,185,45,.22)', color: '#7a4f00' },
};

function getBadgeStyle(outcome: string) {
  return OUTCOME_BADGES[outcome] ?? { bg: 'var(--surface2)', color: 'var(--text2)' };
}

export function TransactionTable({ transactions }: { transactions: TransactionRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr style={{ background: 'var(--fg)' }}>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Customer
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Agent
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Stage
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Attempted
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Connected
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Outcome
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-normal uppercase tracking-wider text-white/55">
              Time-to-call
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-sm"
                style={{ color: 'var(--text3)' }}
              >
                No call activity in this period
              </td>
            </tr>
          ) : (
            transactions.map((t, i) => {
              const badge = getBadgeStyle(t.outcome);
              return (
                <tr
                  key={i}
                  className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface2)]"
                >
                  <td className="px-3 py-2 font-medium">{t.customerName}</td>
                  <td style={{ color: 'var(--text2)' }}>{t.dietitianName}</td>
                  <td>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: 'var(--text2)' }}
                    >
                      {t.stage}
                    </span>
                  </td>
                  <td>
                    {t.attempted ? (
                      <span
                        className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: 'rgba(29,72,56,.1)',
                          color: '#1D4838',
                        }}
                      >
                        Yes
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {t.connected ? (
                      <span
                        className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: 'rgba(29,72,56,.1)',
                          color: '#1D4838',
                        }}
                      >
                        Yes
                      </span>
                    ) : (
                      <span
                        className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: 'rgba(231,88,11,.1)',
                          color: '#b54000',
                        }}
                      >
                        No
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className="inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {t.outcome}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{t.timeToCall}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
