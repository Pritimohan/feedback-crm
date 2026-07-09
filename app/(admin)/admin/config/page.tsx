'use client';

import { Typography } from 'antd';
import { LifecycleConfigWizard } from '@/components/admin/LifecycleConfigWizard';

const { Title, Paragraph } = Typography;

export default function ConfigPage() {
  return (
    <div>
      <Title level={2}>Lead Lifecycle Configuration</Title>
      <Paragraph type="secondary">
        Configure call attempt limits and timing gaps for review, NPS, and feedback lead journeys.
        Changes apply to new lifecycles and pending follow-ups on active leads.
      </Paragraph>
      <LifecycleConfigWizard />
    </div>
  );
}
