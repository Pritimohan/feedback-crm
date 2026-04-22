'use client';

import React from 'react';
import { ClockCircleOutlined, PhoneOutlined } from '@ant-design/icons';
import { CallLog, getCallStatusInfo, getCountryFlag, getTimeAgo } from '@/lib/utils/callHistoryHelpers';

interface CallCardProps {
  call: CallLog;
}

export default function CallCard({ call }: CallCardProps) {
  const statusInfo = getCallStatusInfo(call.outcome);
  const timeAgo = getTimeAgo(call.updatedAt);
  const flag = getCountryFlag();

  return (
    <div
      className={`
        border rounded-lg p-4 mb-3 transition-all hover:shadow-md
        ${statusInfo.borderColor} border-l-4
        bg-white hover:bg-gray-50
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{flag}</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 truncate">{call.customerName || 'Unknown Customer'}</h4>
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <PhoneOutlined style={{ fontSize: '12px' }} />
                {call.customerPhone}
              </p>
            </div>
          </div>

          {call.attemptCount > 0 && (
            <div className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded mt-1">
              {call.attemptCount} Attempt{call.attemptCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 min-w-max">
          <div
            className={`
              text-xs font-semibold px-3 py-1 rounded-full border
              ${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.borderColor}
            `}
          >
            {statusInfo.label}
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
            <ClockCircleOutlined style={{ fontSize: '12px' }} />
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
