'use client';

import { useState } from 'react';
import { App, Button, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import FollowupList from '@/components/dt/FollowupList';
import FollowupModal from '@/components/dt/FollowupModal';

const { Title, Paragraph } = Typography;

interface FollowupRow {
  followup: {
    id: string;
  };
}

export default function DTFollowupsPage() {
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { message } = App.useApp();

  const handleFollowupClick = (row: FollowupRow) => {
    setSelectedFollowupId(row.followup.id);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedFollowupId(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger((v) => v + 1);
    message.success('Action completed successfully');
  };

  const handleRefresh = () => {
    setRefreshTrigger((v) => v + 1);
    message.success('Follow-ups refreshed');
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2}>Active Follow-ups</Title>
          <Paragraph type="secondary">Manage your daily follow-up tasks with leads</Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} size="large">
          Refresh
        </Button>
      </Space>

      <FollowupList onFollowupClick={handleFollowupClick} refreshTrigger={refreshTrigger} />

      <FollowupModal
        followupId={selectedFollowupId}
        visible={modalVisible}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
