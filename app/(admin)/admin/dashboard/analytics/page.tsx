'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

/** Legacy route: dashboard analytics merged into main admin analytics. */
export default function DashboardAnalyticsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/analytics');
  }, [router]);
  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Spin />
    </div>
  );
}
