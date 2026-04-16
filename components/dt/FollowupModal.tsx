'use client';

import { useEffect, useState } from 'react';
import { App, Button, Card, Modal, Select, Space, Tabs, Timeline, Typography, Input, Checkbox } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CallButton from '@/components/dt/CallButton';

const { Text } = Typography;

type ConnectedChoice = 'reviewed' | 'issue_with_product' | 'interested' | 'dont_reviewed';

interface Props {
  followupId: string | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AttemptRow {
  id: string;
  outcome: string;
  attempt_date: string;
  notes: string | null;
}

interface FollowupDetails {
  followup: {
    id: string;
    followup_number: number;
  };
  lead: {
    id: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  attempts: AttemptRow[];
}

export default function FollowupModal({ followupId, visible, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<FollowupDetails | null>(null);
  const [showConnectedForm, setShowConnectedForm] = useState(false);
  const [connectedChoice, setConnectedChoice] = useState<ConnectedChoice | undefined>(undefined);
  const [remarks, setRemarks] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewScreenshotUrl, setReviewScreenshotUrl] = useState('');
  const [isTestimonial, setIsTestimonial] = useState(false);
  const [dontReviewedRemark, setDontReviewedRemark] = useState('');
  const [interestedRemark, setInterestedRemark] = useState('');
  const { message } = App.useApp();

  useEffect(() => {
    if (!followupId || !visible) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/dt/followups/${followupId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load details');
        setDetails(json.data);
        setShowConnectedForm(false);
        setConnectedChoice(undefined);
        setRemarks('');
        setIssueDescription('');
        setReviewRemark('');
        setReviewScreenshotUrl('');
        setIsTestimonial(false);
        setDontReviewedRemark('');
        setInterestedRemark('');
      } catch (error: unknown) {
        message.error(error instanceof Error ? error.message : 'Failed to load followup details');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [followupId, visible, message]);

  const handleNoAnswer = async () => {
    if (!followupId) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/dt/followups/${followupId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'no_answer' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save no answer');
      message.success('No answer recorded');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to save no answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShortcutOutcome = async (outcome: 'busy' | 'wrong_number' | 'not_interested' | 'no_answer') => {
    if (!followupId) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/dt/followups/${followupId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, notes: remarks || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to save ${outcome}`);
      message.success(`${outcome.replace('_', ' ')} recorded`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to save outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const submitConnected = async () => {
    if (!followupId || !connectedChoice) return;
    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        review_screenshot_url: reviewScreenshotUrl || undefined,
        review_remark: reviewRemark || undefined,
        is_testimonial: isTestimonial,
        issue_description: issueDescription || undefined,
        interested_remark: interestedRemark || undefined,
        dont_reviewed_remark: dontReviewedRemark || undefined,
      };
      const res = await fetch(`/api/dt/followups/${followupId}/connected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: connectedChoice, payload, notes: remarks || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save connected outcome');
      message.success('Connected outcome saved');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to save connected outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const connectedOptions: Array<{ label: string; value: ConnectedChoice }> = (details?.followup?.followup_number ?? 0) >= 3
    ? [
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Issue with product', value: 'issue_with_product' },
        { label: "Don't Reviewed", value: 'dont_reviewed' },
      ]
    : [
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Issue with product', value: 'issue_with_product' },
        { label: 'Interested', value: 'interested' },
        { label: "Don't Reviewed", value: 'dont_reviewed' },
      ];

  const tabItems = [
    {
      key: 'call',
      label: 'Make Call',
      children: !showConnectedForm ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical">
              <Text strong>
                <UserOutlined /> {details?.customer?.name}
              </Text>
              <Space align="center">
                <Text>
                  <PhoneOutlined /> {details?.customer?.phone}
                </Text>
                {details?.customer?.phone ? (
                  <CallButton customerPhone={details.customer.phone} customerId={details.customer.id} />
                ) : null}
              </Space>
              <Text type="secondary">Follow-up {details?.followup?.followup_number}</Text>
            </Space>
          </Card>
          <Card title="Call Outcome">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={() => setShowConnectedForm(true)} block>
                Connected
              </Button>
              <Button size="large" onClick={handleNoAnswer} loading={submitting} block>
                No Answer
              </Button>
            </Space>
          </Card>
        </Space>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="Other Options">
            <Space wrap>
              <Button onClick={() => handleShortcutOutcome('busy')} loading={submitting}>
                Busy
              </Button>
              <Button onClick={() => handleShortcutOutcome('wrong_number')} loading={submitting}>
                Wrong Number
              </Button>
              <Button onClick={() => handleShortcutOutcome('not_interested')} loading={submitting}>
                Not Interested
              </Button>
              <Button onClick={() => handleShortcutOutcome('no_answer')} loading={submitting}>
                No Answer
              </Button>
            </Space>
          </Card>

          <Card title="Connected Outcome Form">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="Select connected outcome"
                options={connectedOptions}
                value={connectedChoice}
                onChange={(value) => setConnectedChoice(value)}
              />

              {connectedChoice === 'reviewed' ? (
                <>
                  <Input
                    placeholder="Attach Review Screenshot URL (optional)"
                    value={reviewScreenshotUrl}
                    onChange={(e) => setReviewScreenshotUrl(e.target.value)}
                  />
                  <Input.TextArea
                    placeholder="Add Remark (optional)"
                    rows={3}
                    value={reviewRemark}
                    onChange={(e) => setReviewRemark(e.target.value)}
                  />
                  <Checkbox checked={isTestimonial} onChange={(e) => setIsTestimonial(e.target.checked)}>
                    Mark Testimonial
                  </Checkbox>
                </>
              ) : null}

              {connectedChoice === 'issue_with_product' ? (
                <Input.TextArea
                  placeholder="Issue Description *"
                  rows={3}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                />
              ) : null}

              {connectedChoice === 'interested' ? (
                <Input.TextArea
                  placeholder="Remarks (optional)"
                  rows={3}
                  value={interestedRemark}
                  onChange={(e) => setInterestedRemark(e.target.value)}
                />
              ) : null}

              {connectedChoice === 'dont_reviewed' ? (
                <Input.TextArea
                  placeholder="Remarks (optional)"
                  rows={3}
                  value={dontReviewedRemark}
                  onChange={(e) => setDontReviewedRemark(e.target.value)}
                />
              ) : null}

              <Input.TextArea placeholder="General Notes (optional)" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />

              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                  type="primary"
                  loading={submitting}
                  disabled={!connectedChoice || (connectedChoice === 'issue_with_product' && !issueDescription.trim())}
                  onClick={submitConnected}
                >
                  Submit Outcome
                </Button>
              </Space>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'history',
      label: 'History',
      children: (
        <Card title="Call Attempts" size="small">
          {details?.attempts?.length ? (
            <Timeline
              items={details.attempts.map((attempt: AttemptRow) => ({
                content: (
                  <Space direction="vertical" size={0}>
                    <Text strong>
                      {attempt.outcome === 'connected' ? (
                        <>
                          <CheckCircleOutlined style={{ color: '#1d4838' }} /> Connected
                        </>
                      ) : (
                        <>
                          <CloseCircleOutlined style={{ color: '#666660' }} /> {attempt.outcome}
                        </>
                      )}
                    </Text>
                    <Text type="secondary">{dayjs(attempt.attempt_date).format('MMM D, YYYY h:mm A')}</Text>
                    {attempt.notes ? <Text type="secondary">{attempt.notes}</Text> : null}
                  </Space>
                ),
                color: attempt.outcome === 'connected' ? '#1d4838' : '#666660',
              }))}
            />
          ) : (
            <Text type="secondary">No attempts yet</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <Text>
            Follow-up {details?.followup?.followup_number}: {details?.customer?.name}
          </Text>
        </Space>
      }
      open={visible}
      onCancel={showConnectedForm ? undefined : onClose}
      closable={!showConnectedForm}
      footer={null}
      width={1000}
      loading={loading}
      destroyOnHidden
    >
      <Tabs defaultActiveKey="call" items={tabItems} />
    </Modal>
  );
}
