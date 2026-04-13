'use client';

import React from 'react';
import { Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import './UserProfileDropdown.css';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
};

const ROLE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  admin: { bg: 'rgba(29,72,56,.12)', color: '#1D4838' },
};

interface UserProfileDropdownProps {
  user: { name: string; role: string } | null;
  menuItems: MenuProps['items'];
}

export function UserProfileDropdown({ user, menuItems }: UserProfileDropdownProps) {
  const badgeStyle = user
    ? (ROLE_BADGE_STYLES[user.role] ?? { bg: 'rgba(102,102,96,.12)', color: '#666660' })
    : null;

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight">
      <div className="user-profile-trigger">
        <div className="user-profile-info">
          {user ? (
            <>
              <div className="user-profile-name">{user.name}</div>
              <span
                className="user-profile-badge"
                style={badgeStyle ? { background: badgeStyle.bg, color: badgeStyle.color } : undefined}
              >
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </>
          ) : (
            <div className="user-profile-placeholder">—</div>
          )}
        </div>
        <Avatar
          size={40}
          icon={<UserOutlined />}
          className="user-profile-avatar"
          style={{ background: '#1D4838' }}
        />
      </div>
    </Dropdown>
  );
}
