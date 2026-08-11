'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CommentOutlined,
  FormOutlined,
  ReloadOutlined,
  SaveOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type {
  LifecycleConfigBundle,
  LifecycleStageConfig,
  LifecycleTypeConfig,
  LeadTypeId,
} from '@/lib/lifecycleDefaults';
import { LifecycleScheduleStep } from '@/components/admin/lifecycle/LifecycleScheduleStep';

const { Title, Paragraph, Text } = Typography;

type LifecycleApiResponse = {
  config: LifecycleConfigBundle;
  defaults: LifecycleConfigBundle;
  version: number;
  versionId: string;
  updatedAt: string;
};

const LEAD_TYPE_META: Record<
  LeadTypeId,
  { title: string; description: string; icon: React.ReactNode }
> = {
  review: {
    title: 'Review',
    description: 'Four-stage review collection journey after a customer purchase.',
    icon: <StarOutlined style={{ fontSize: 28 }} />,
  },
  nps: {
    title: 'NPS',
    description: 'Four-stage NPS follow-up journey for net promoter score collection.',
    icon: <CommentOutlined style={{ fontSize: 28 }} />,
  },
  feedback: {
    title: 'Feedback',
    description: 'Single-stage product feedback collection for warranty and diet plan leads.',
    icon: <FormOutlined style={{ fontSize: 28 }} />,
  },
};

function cloneBundle(bundle: LifecycleConfigBundle): LifecycleConfigBundle {
  return JSON.parse(JSON.stringify(bundle)) as LifecycleConfigBundle;
}

function updateStageInBundle(
  bundle: LifecycleConfigBundle,
  leadType: LeadTypeId,
  followupNumber: number,
  patch: Partial<LifecycleStageConfig>
): LifecycleConfigBundle {
  const next = cloneBundle(bundle);
  const typeConfig = next[leadType];
  typeConfig.stages = typeConfig.stages.map((stage) =>
    stage.followupNumber === followupNumber ? { ...stage, ...patch } : stage
  );
  return next;
}

export function LifecycleConfigWizard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<LeadTypeId>('review');
  const [draft, setDraft] = useState<LifecycleConfigBundle | null>(null);
  const [defaults, setDefaults] = useState<LifecycleConfigBundle | null>(null);
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadConfig = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const response = await fetch('/api/admin/config/lifecycle');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load config');

      const payload = data as LifecycleApiResponse;
      setDraft(cloneBundle(payload.config));
      setDefaults(cloneBundle(payload.defaults));
      setVersion(payload.version);
      setUpdatedAt(payload.updatedAt);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load lifecycle config');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const typeConfig = draft?.[selectedType] ?? null;

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      const response = await fetch('/api/admin/config/lifecycle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      message.success(`Lifecycle config saved (v${data.version})`);
      setVersion(data.version);
      setUpdatedAt(new Date().toISOString());
      setCurrentStep(0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/config/lifecycle/reset', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset');

      message.success('Lifecycle config reset to defaults');
      setDraft(cloneBundle(data.config));
      setVersion(data.version);
      setUpdatedAt(new Date().toISOString());
      setCurrentStep(0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to reset config');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = (followupNumber: number, patch: Partial<LifecycleStageConfig>) => {
    if (!draft) return;
    setDraft(updateStageInBundle(draft, selectedType, followupNumber, patch));
  };

  const updateGlobal = (patch: Partial<LifecycleConfigBundle['global']>) => {
    if (!draft) return;
    let next: LifecycleConfigBundle = { ...draft, global: { ...draft.global, ...patch } };

    if (patch.retryAfterDays != null) {
      const gap = patch.retryAfterDays;
      const leadTypes: LeadTypeId[] = ['review', 'nps', 'feedback'];
      for (const leadType of leadTypes) {
        next = {
          ...next,
          [leadType]: {
            ...next[leadType],
            stages: next[leadType].stages.map((stage) => ({
              ...stage,
              attemptScheduleDaysFromAnchor: Array.from(
                { length: stage.maxAttempts },
                (_, i) => i * gap
              ),
            })),
          },
        };
      }
    }

    setDraft(next);
  };

  const copyStagesFrom = (fromNumbers: number[], toNumbers: number[]) => {
    if (!draft || !typeConfig) return;
    const source = typeConfig.stages.find((s) => fromNumbers.includes(s.followupNumber));
    if (!source) return;

    let next = draft;
    for (const n of toNumbers) {
      if (fromNumbers.includes(n)) continue;
      next = updateStageInBundle(next, selectedType, n, {
        maxAttempts: source.maxAttempts,
        attemptScheduleDaysFromAnchor: [...source.attemptScheduleDaysFromAnchor],
        daysAfterPriorConnection: source.daysAfterPriorConnection,
      });
    }
    setDraft(next);
    message.success('Copied settings to selected stages');
  };

  const renderJourneyMap = (config: LifecycleTypeConfig) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
      {config.stages.map((stage) => (
        <Card
          key={stage.followupNumber}
          size="small"
          style={{ minWidth: 120, flex: '1 1 120px' }}
          title={stage.label}
        >
          <Text type="secondary">{stage.maxAttempts} attempts</Text>
          <br />
          {stage.followupNumber > 0 && stage.daysAfterPriorConnection != null && (
            <Tag color="blue">+{stage.daysAfterPriorConnection}d after connect</Tag>
          )}
        </Card>
      ))}
    </div>
  );

  if (loading || !draft || !defaults) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const steps = [
    {
      title: 'Lead type',
      content: (
        <div>
          <Paragraph>Select which lead type journey you want to configure.</Paragraph>
          <Row gutter={[16, 16]}>
            {(Object.keys(LEAD_TYPE_META) as LeadTypeId[]).map((type) => {
              const meta = LEAD_TYPE_META[type];
              const selected = selectedType === type;
              return (
                <Col xs={24} md={8} key={type}>
                  <Card
                    hoverable
                    onClick={() => setSelectedType(type)}
                    style={{
                      borderColor: selected ? '#1677ff' : undefined,
                      background: selected ? '#f0f5ff' : undefined,
                    }}
                  >
                    <Space orientation="vertical">
                      {meta.icon}
                      <Title level={5} style={{ margin: 0 }}>
                        {meta.title}
                      </Title>
                      <Text type="secondary">{meta.description}</Text>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      ),
    },
    {
      title: 'Journey map',
      content: (
        <div>
          <Paragraph>
            Current journey for <strong>{LEAD_TYPE_META[selectedType].title}</strong>. Anchor:{' '}
            <Tag>{typeConfig?.scheduleAnchor}</Tag>
          </Paragraph>
          {typeConfig && renderJourneyMap(typeConfig)}
        </div>
      ),
    },
    {
      title: 'Schedule settings',
      content: typeConfig ? (
        <LifecycleScheduleStep
          leadType={selectedType}
          typeConfig={typeConfig}
          globalSettings={draft.global}
          onUpdateStage={updateStage}
          onUpdateGlobal={updateGlobal}
          onCopyStages={copyStagesFrom}
        />
      ) : null,
    },
    {
      title: 'Review',
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Pending leads will be updated"
            description="Saving applies to new lifecycles and pending follow-ups on active lifecycles. Completed attempts and terminal states are not changed. Schedules will not move earlier than today."
          />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Lead type">
              {LEAD_TYPE_META[selectedType].title}
            </Descriptions.Item>
            <Descriptions.Item label="Stages">{typeConfig?.stages.length}</Descriptions.Item>
            <Descriptions.Item label="Current DB version">v{version}</Descriptions.Item>
            {updatedAt && (
              <Descriptions.Item label="Last updated">
                {new Date(updatedAt).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>
          {typeConfig && renderJourneyMap(typeConfig)}
        </div>
      ),
    },
    {
      title: 'Save',
      content: (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={4}>Ready to save all lead types</Title>
          <Paragraph type="secondary">
            This saves review, NPS, and feedback settings together.
          </Paragraph>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset} loading={saving}>
              Reset all to defaults
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              Save configuration
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Tag color="blue">Version v{version}</Tag>
        <Button size="small" onClick={() => void loadConfig()}>
          Refresh
        </Button>
      </Space>

      <Steps
        current={currentStep}
        items={steps.map((s) => ({ title: s.title }))}
        style={{ marginBottom: 24 }}
      />

      <Card>{steps[currentStep].content}</Card>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={currentStep === 0} onClick={() => setCurrentStep((s) => s - 1)}>
          Previous
        </Button>
        <Button
          type="primary"
          disabled={currentStep === steps.length - 1}
          onClick={() => setCurrentStep((s) => s + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
