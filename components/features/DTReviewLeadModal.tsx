'use client';

import { Button, Checkbox, Form, Input, Modal, Radio, Select, Space, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';

type PrimaryMode = 'connected' | 'no_answer';
type QuickOutcome = 'busy' | 'wrong_number' | 'not_interested' | 'no_answer';
type ConnectedChoice = 'reviewed' | 'issue_with_product' | 'interested' | 'dont_reviewed';

export interface ReviewLeadModalData {
  followupId: string;
  leadName: string;
  phone: string;
  followupNumber: number;
  availableConnectedChoices: ConnectedChoice[];
}

interface Props {
  open: boolean;
  data: ReviewLeadModalData | null;
  loading?: boolean;
  onClose: () => void;
  onSubmitQuickOutcome: (followupId: string, outcome: QuickOutcome, notes?: string) => Promise<void>;
  onSubmitConnected: (
    followupId: string,
    choice: ConnectedChoice,
    payload: Record<string, unknown>,
    notes?: string
  ) => Promise<void>;
}

const CONNECTED_LABELS: Record<ConnectedChoice, string> = {
  reviewed: 'Reviewed',
  issue_with_product: 'Issue with product',
  interested: 'Interested',
  dont_reviewed: "Didn't Review",
};

export function DTReviewLeadModal({
  open,
  data,
  loading = false,
  onClose,
  onSubmitQuickOutcome,
  onSubmitConnected,
}: Props) {
  const [mode, setMode] = useState<PrimaryMode>('no_answer');
  const [quickOutcome, setQuickOutcome] = useState<QuickOutcome>('no_answer');
  const [connectedChoice, setConnectedChoice] = useState<ConnectedChoice | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewScreenshotUrl, setReviewScreenshotUrl] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [isTestimonial, setIsTestimonial] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [interestedRemark, setInterestedRemark] = useState('');
  const [dontReviewedRemark, setDontReviewedRemark] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('no_answer');
    setQuickOutcome('no_answer');
    setConnectedChoice(undefined);
    setNotes('');
    setReviewScreenshotUrl('');
    setReviewRemark('');
    setIsTestimonial(false);
    setIssueDescription('');
    setInterestedRemark('');
    setDontReviewedRemark('');
  }, [open, data?.followupId]);

  const connectedOptions = useMemo(() => {
    if (!data) return [];
    return data.availableConnectedChoices.map((choice) => ({
      value: choice,
      label: CONNECTED_LABELS[choice],
    }));
  }, [data]);

  const connectedFormValid = useMemo(() => {
    if (!connectedChoice) return false;
    if (connectedChoice === 'issue_with_product') {
      return issueDescription.trim().length > 0;
    }
    return true;
  }, [connectedChoice, issueDescription]);

  async function handleSubmit() {
    if (!data) return;

    setIsSubmitting(true);
    try {
      if (mode === 'no_answer') {
        await onSubmitQuickOutcome(data.followupId, quickOutcome, notes || undefined);
      } else {
        if (!connectedChoice) return;
        await onSubmitConnected(
          data.followupId,
          connectedChoice,
          {
            review_screenshot_url: reviewScreenshotUrl || undefined,
            review_remark: reviewRemark || undefined,
            is_testimonial: isTestimonial,
            issue_description: issueDescription || undefined,
            interested_remark: interestedRemark || undefined,
            dont_reviewed_remark: dontReviewedRemark || undefined,
          },
          notes || undefined
        );
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title={data ? `Review Lead - ${data.leadName}` : 'Review Lead'}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        {data ? (
          <Typography.Text type="secondary">
            {data.phone} | {followupUiLabel(data.followupNumber)}
          </Typography.Text>
        ) : null}

        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={[
            { label: 'Connected', value: 'connected' },
            { label: 'No Answer', value: 'no_answer' },
          ]}
        />

        {mode === 'no_answer' ? (
          <>
            <Radio.Group
              value={quickOutcome}
              onChange={(e) => setQuickOutcome(e.target.value)}
              options={[
                { label: 'Busy', value: 'busy' },
                { label: 'Wrong Number', value: 'wrong_number' },
                { label: 'Not Interested', value: 'not_interested' },
                { label: 'No Answer', value: 'no_answer' },
              ]}
            />
            <Input.TextArea
              rows={3}
              placeholder="Remarks (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        ) : (
          <Form layout="vertical">
            <Form.Item label="Outcome">
              <Select
                placeholder="Select outcome"
                value={connectedChoice}
                onChange={(value) => setConnectedChoice(value)}
                options={connectedOptions}
              />
            </Form.Item>

            {connectedChoice === 'reviewed' ? (
              <>
                <Form.Item label="Attach Review Screenshot">
                  <Upload
                    maxCount={1}
                    beforeUpload={() => false}
                    onChange={(info) => {
                      const file = info.fileList?.[0];
                      setReviewScreenshotUrl(file?.name ?? '');
                    }}
                  >
                    <Button icon={<UploadOutlined />}>Select file</Button>
                  </Upload>
                </Form.Item>
                <Form.Item label="Add Remark (optional)">
                  <Input.TextArea rows={3} value={reviewRemark} onChange={(e) => setReviewRemark(e.target.value)} />
                </Form.Item>
                <Checkbox checked={isTestimonial} onChange={(e) => setIsTestimonial(e.target.checked)}>
                  Mark Testimonial
                </Checkbox>
              </>
            ) : null}

            {connectedChoice === 'issue_with_product' ? (
              <Form.Item label="Issue Description *" required>
                <Input.TextArea rows={3} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
              </Form.Item>
            ) : null}

            {connectedChoice === 'interested' ? (
              <Form.Item label="Remarks (optional)">
                <Input.TextArea rows={3} value={interestedRemark} onChange={(e) => setInterestedRemark(e.target.value)} />
              </Form.Item>
            ) : null}

            {connectedChoice === 'dont_reviewed' ? (
              <Form.Item label="Remarks (optional)">
                <Input.TextArea rows={3} value={dontReviewedRemark} onChange={(e) => setDontReviewedRemark(e.target.value)} />
              </Form.Item>
            ) : null}

            <Form.Item label="General Notes (optional)">
              <Input.TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Form.Item>
          </Form>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={loading || isSubmitting}
            disabled={mode === 'connected' ? !connectedFormValid : false}
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </div>
      </Space>
    </Modal>
  );
}
