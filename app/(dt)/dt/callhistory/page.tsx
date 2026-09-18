'use client';

import React, { useEffect, useState } from 'react';
import { App } from 'antd';
import { CalendarOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CallHistoryAccordion from '@/components/dt/CallHistoryAccordion';
import { CallLog, groupCallsByDate } from '@/lib/utils/callHistoryHelpers';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

const OUTCOME_FILTERS = ['Connected', 'No Answer', 'Busy', 'Wrong Number', 'CNR', 'Not Interested'];

export default function CallHistoryPage() {
  const { message } = App.useApp();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  });
  const [outcomeFilter, setOutcomeFilter] = useState<string[]>([]);

  const fetchCallHistory = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/dt/call-logs?startDate=${dateRange.start}&endDate=${dateRange.end}`);
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to fetch call history'));
      }

      const data = await response.json();
      setCalls(data.callHistory || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
      message.error(toUserFacingMessage(error, 'Failed to load call history'));
      setCalls([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.end, dateRange.start, message]);

  const filterCalls = React.useCallback(() => {
    let filtered = [...calls];

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (call) => call.customerName?.toLowerCase().includes(lowerSearch) || call.customerPhone.includes(searchTerm)
      );
    }

    const startDate = dayjs(dateRange.start).startOf('day');
    const endDate = dayjs(dateRange.end).endOf('day');
    filtered = filtered.filter((call) => {
      const callDate = dayjs(call.updatedAt);
      return callDate.isAfter(startDate) && callDate.isBefore(endDate);
    });

    if (outcomeFilter.length > 0) {
      filtered = filtered.filter((call) => {
        const callOutcome = call.outcome?.toLowerCase() || '';
        return outcomeFilter.some((filter) => callOutcome.includes(filter.toLowerCase().replace(' ', '_')));
      });
    }

    setFilteredCalls(filtered);
  }, [calls, dateRange.end, dateRange.start, outcomeFilter, searchTerm]);

  useEffect(() => {
    void fetchCallHistory();
  }, [fetchCallHistory]);

  useEffect(() => {
    filterCalls();
  }, [filterCalls]);

  const toggleOutcomeFilter = (outcome: string) => {
    setOutcomeFilter((prev) => (prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome]));
  };

  const groupedCalls = groupCallsByDate(filteredCalls);
  const connectedCount = filteredCalls.filter((c) => c.outcome?.toLowerCase() === 'connected').length;
  const successRate = filteredCalls.length > 0 ? Math.round((connectedCount / filteredCalls.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Call History</h1>
        <p className="text-gray-600 text-base">Review call logs with customers. Analytics totals deduplicate by customer-day.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <SearchOutlined />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CalendarOutlined className="text-gray-400" />
            <label htmlFor="fromdate">From</label>
            <input
              id="fromdate"
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CalendarOutlined className="text-gray-400" />
            <label htmlFor="todate">To</label>
            <input
              id="todate"
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Filter by Outcome</p>
          <div className="flex flex-wrap gap-2">
            {OUTCOME_FILTERS.map((outcome) => (
              <button
                key={outcome}
                onClick={() => toggleOutcomeFilter(outcome)}
                className={`px-3 py-1 text-sm rounded-full border transition-all ${
                  outcomeFilter.includes(outcome)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setSearchTerm('');
            setOutcomeFilter([]);
            setDateRange({
              start: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
              end: dayjs().format('YYYY-MM-DD'),
            });
          }}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors"
        >
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-1">Total Calls</p>
          <p className="text-2xl font-bold text-gray-900">{filteredCalls.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-1">Connected</p>
          <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-blue-600">{successRate}%</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <CallHistoryAccordion groupedCalls={groupedCalls} isLoading={isLoading} />
      </div>
    </div>
  );
}
