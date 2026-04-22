'use client';

import React, { useState } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { GroupedCalls } from '@/lib/utils/callHistoryHelpers';
import CallCard from './CallCard';

interface CallHistoryAccordionProps {
  groupedCalls: GroupedCalls[];
  isLoading?: boolean;
}

export default function CallHistoryAccordion({ groupedCalls, isLoading = false }: CallHistoryAccordionProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(groupedCalls[0]?.date ?? null);
  const activeExpandedDate =
    expandedDate && groupedCalls.some((group) => group.date === expandedDate) ? expandedDate : groupedCalls[0]?.date ?? null;

  const handleToggle = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-200 h-12 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (groupedCalls.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-base">No call history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groupedCalls.map((group) => {
        const isExpanded = activeExpandedDate === group.date;

        return (
          <div key={group.date} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => handleToggle(group.date)}
              className={`
                w-full px-4 py-4 flex items-center justify-between
                transition-all duration-200
                ${isExpanded ? 'bg-blue-50 border-b border-gray-200' : 'bg-white hover:bg-gray-50'}
              `}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">{group.dateLabel}</h3>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{group.calls.length}</span>
              </div>

              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                <DownOutlined style={{ fontSize: '20px' }} className="text-gray-600" />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 py-4 bg-white space-y-0 animate-in fade-in-50 duration-200">
                {group.calls.map((call) => (
                  <CallCard key={call.id} call={call} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
