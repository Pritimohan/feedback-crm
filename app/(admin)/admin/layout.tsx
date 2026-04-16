'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { DashboardOutlined, LogoutOutlined } from '@ant-design/icons';
import { UserProfileDropdown } from '@/components/layout/UserProfileDropdown';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser({ name: data.name, role: data.role }))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    router.push(e.key);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f4f2ed' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={220}
        style={{ background: '#ffffff', boxShadow: '1px 0 0 rgba(0,0,0,0.08)' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 18,
            color: '#1d4838',
            borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          }}
        >
          {collapsed ? 'AD' : 'Admin'}
        </div>
        <Menu mode="inline" selectedKeys={[pathname]} items={menuItems} onClick={handleMenuClick} style={{ borderRight: 0 }} />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#f4f2ed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
            borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          }}
        >
          <Text strong style={{ color: '#1d4838', fontSize: 15 }}>
            Admin Dashboard
          </Text>
          <UserProfileDropdown user={user} menuItems={userMenuItems} />
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: 24,
            background: '#ffffff',
            borderRadius: 14,
            minHeight: 280,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '0.5px solid rgba(0,0,0,0.08)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
