'use client';

import { useState } from 'react';
import { Tabs, Typography } from 'antd';
import { LifecycleConfigWizard } from '@/components/admin/LifecycleConfigWizard';
import ExotelConfigForm from '@/components/admin/ExotelConfigForm';

const { Title, Paragraph } = Typography;

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('lifecycle');

  const pageHeader =
    activeTab === 'calling'
      ? {
          title: 'Calling',
          description:
            'Set the phone number used for outgoing calls for Fitty and Fitelo.',
        }
      : {
          title: 'Lead Lifecycle Configuration',
          description:
            'Configure call attempt limits and timing gaps for review, NPS, and feedback lead journeys. Changes apply to new lifecycles and pending follow-ups on active leads.',
        };

  return (
    <div>
      <Title level={2}>{pageHeader.title}</Title>
      <Paragraph type="secondary">{pageHeader.description}</Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'lifecycle',
            label: 'Lead Lifecycle Configuration',
            children: <LifecycleConfigWizard />,
          },
          {
            key: 'calling',
            label: 'Calling',
            children: <ExotelConfigForm />,
          },
        ]}
      />
    </div>
  );
}
