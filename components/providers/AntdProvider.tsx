'use client';

import React from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App } from 'antd';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1d4838',
            colorSuccess: '#1d4838',
            colorWarning: '#fcb92d',
            colorError: '#e7580b',
            colorInfo: '#134175',
            borderRadius: 10,
            colorBgContainer: '#ffffff',
            colorBgLayout: '#f4f2ed',
            colorBorder: 'rgba(0, 0, 0, 0.08)',
            colorText: '#1a1a1a',
            colorTextSecondary: '#666660',
            colorTextTertiary: '#99998f',
          },
          components: {
            Button: {
              primaryColor: '#d5f369',
              borderRadius: 9999,
              defaultBg: '#ffffff',
              defaultColor: '#666660',
              defaultBorderColor: 'rgba(0, 0, 0, 0.12)',
              defaultShadow: 'none',
              defaultHoverBorderColor: '#1d4838',
              defaultHoverColor: '#1d4838',
              primaryShadow: 'none',
            },
            Menu: {
              itemSelectedBg: '#1d4838',
              itemSelectedColor: '#d5f369',
              itemHoverBg: 'rgba(29, 72, 56, 0.06)',
              itemHoverColor: '#1d4838',
              itemColor: '#1a1a1a',
            },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
