'use client';

import { Alert, Button, Form, Space, Typography } from 'antd';
import type {
  LifecycleGlobalSettings,
  LifecycleStageConfig,
  LifecycleTypeConfig,
  LeadTypeId,
} from '@/lib/lifecycleDefaults';
import { LifecycleStageCard } from './LifecycleStageCard';
import { StageGapConnector } from './StageGapConnector';
import { DaysInput } from './DaysInput';

const { Paragraph } = Typography;

type LifecycleScheduleStepProps = {
  leadType: LeadTypeId;
  typeConfig: LifecycleTypeConfig;
  globalSettings: LifecycleGlobalSettings;
  onUpdateStage: (followupNumber: number, patch: Partial<LifecycleStageConfig>) => void;
  onUpdateGlobal: (patch: Partial<LifecycleGlobalSettings>) => void;
  onCopyStages: (fromNumbers: number[], toNumbers: number[]) => void;
};

export function LifecycleScheduleStep({
  leadType,
  typeConfig,
  globalSettings,
  onUpdateStage,
  onUpdateGlobal,
  onCopyStages,
}: LifecycleScheduleStepProps) {
  const isSingleStage = leadType === 'feedback';
  const isMultiStage = leadType === 'review' || leadType === 'nps';
  const stages = typeConfig.stages;

  return (
    <Form layout="vertical">
      <Paragraph>
        Configure max attempts and retry timing for each stage.
        {isMultiStage && (
          <>
            {' '}
            Adjust time between stages on the connectors below each card. Fitty and Fitelo brands
            use the brand-specific connected advance days from global settings.
          </>
        )}
        {isSingleStage && <> Feedback leads use a single call stage.</>}
      </Paragraph>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Global timing"
        description={
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item label="Retry gap (busy / no answer)" style={{ marginBottom: 8 }}>
              <DaysInput
                value={globalSettings.retryAfterDays}
                onChange={(v) => onUpdateGlobal({ retryAfterDays: v })}
                min={1}
                max={60}
              />
            </Form.Item>
            <Form.Item label="Initial call cutoff hour (0–23)" style={{ marginBottom: 8 }}>
              <DaysInput
                value={globalSettings.initialFollowupCutoffHour}
                onChange={(v) => onUpdateGlobal({ initialFollowupCutoffHour: v })}
                min={0}
                max={23}
                suffix="Hour"
              />
            </Form.Item>
            <Form.Item label="Default connected advance" style={{ marginBottom: 8 }}>
              <DaysInput
                value={globalSettings.brandConnectedAdvanceDays.default}
                onChange={(v) =>
                  onUpdateGlobal({
                    brandConnectedAdvanceDays: {
                      ...globalSettings.brandConnectedAdvanceDays,
                      default: v,
                    },
                  })
                }
                min={1}
                max={60}
              />
            </Form.Item>
            <Form.Item label="Fitty / Fitelo connected advance" style={{ marginBottom: 0 }}>
              <Space>
                <DaysInput
                  value={globalSettings.brandConnectedAdvanceDays.fitty}
                  onChange={(v) =>
                    onUpdateGlobal({
                      brandConnectedAdvanceDays: {
                        ...globalSettings.brandConnectedAdvanceDays,
                        fitty: v,
                        fitelo: v,
                      },
                    })
                  }
                  min={1}
                  max={60}
                  suffix="Days"
                />
              </Space>
            </Form.Item>
          </Space>
        }
      />

      {isMultiStage && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Button size="small" onClick={() => onCopyStages([1], [2, 3])}>
            Copy stage 1 settings to stages 2–3
          </Button>
        </Space>
      )}

      {isSingleStage && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Single-stage lifecycle"
          description="Feedback lifecycles have one stage. Inter-stage gaps do not apply."
        />
      )}

      {stages.map((stage, index) => {
        const nextStage = stages[index + 1];
        const showConnector = isMultiStage && nextStage != null && nextStage.followupNumber > 0;

        return (
          <div key={stage.followupNumber}>
            <LifecycleStageCard
              stage={stage}
              defaultExpanded={index === 0}
              onChange={(patch) => onUpdateStage(stage.followupNumber, patch)}
            />

            {showConnector && nextStage && (
              <StageGapConnector
                days={nextStage.daysAfterPriorConnection ?? 1}
                onChange={(days) =>
                  onUpdateStage(nextStage.followupNumber, { daysAfterPriorConnection: days })
                }
              />
            )}
          </div>
        );
      })}
    </Form>
  );
}
