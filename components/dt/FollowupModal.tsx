'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Image,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Input,
  Checkbox,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CallButton from '@/components/dt/CallButton';

const { Text } = Typography;
const MAX_REVIEW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function renderPreviousInteractionContent(remarks: string | null, payload: unknown): ReactNode {
  const rows: ReactNode[] = [];
  if (remarks?.trim()) {
    rows.push(
      <span key="remarks" style={{ marginRight: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          • Remarks:
        </Text>
        <Text style={{ fontSize: 13 }}> {remarks.trim()}</Text>
      </span>
    );
  }
  if (payload && typeof payload === 'object' && payload !== null) {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object') continue;
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      rows.push(
        <span key={key} style={{ marginRight: 8 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            • {label}:
          </Text>
          <Text style={{ fontSize: 13 }}> {String(value)}</Text>
        </span>
      );
    }
  }
  if (!rows.length) return null;
  return <div style={{ lineHeight: 1.6 }}>{rows}</div>;
}

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

interface PreviousFollowupRow {
  id: string;
  followup_number: number;
  connected_date: Date | string | null;
  updated_at: Date | string;
  remarks: string | null;
  payload: unknown;
}

interface FollowupDetails {
  followup: {
    id: string;
    followup_number: number;
    scheduled_date: string;
    attempt_count: number;
  };
  lead: {
    id: string;
    lead_type: 'nps' | 'review';
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  attempts: AttemptRow[];
  previousFollowups?: PreviousFollowupRow[];
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
  const [reviewScreenshotFile, setReviewScreenshotFile] = useState<File | null>(null);
  const [reviewScreenshotPreviewUrl, setReviewScreenshotPreviewUrl] = useState('');
  const [uploadingReviewScreenshot, setUploadingReviewScreenshot] = useState(false);
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
        setReviewScreenshotFile(null);
        setReviewScreenshotPreviewUrl('');
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

  useEffect(() => {
    if (!visible) {
      setDetails(null);
      setShowConnectedForm(false);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (reviewScreenshotPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(reviewScreenshotPreviewUrl);
      }
    };
  }, [reviewScreenshotPreviewUrl]);

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
      let uploadedReviewScreenshotPath = reviewScreenshotUrl || '';

      if (connectedChoice === 'reviewed' && reviewScreenshotFile) {
        setUploadingReviewScreenshot(true);
        const formData = new FormData();
        formData.append('file', reviewScreenshotFile);
        formData.append('followupId', followupId);

        const uploadRes = await fetch('/api/dt/uploads/review-screenshot', {
          method: 'POST',
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson?.success) {
          throw new Error(uploadJson?.error || 'Failed to upload screenshot');
        }

        uploadedReviewScreenshotPath = String(uploadJson.data.path ?? '');
        setReviewScreenshotUrl(uploadedReviewScreenshotPath);
        setReviewScreenshotPreviewUrl(String(uploadJson.data.signedUrl ?? ''));
        setReviewScreenshotFile(null);
      }

      const payload: Record<string, unknown> = {
        review_screenshot_url: uploadedReviewScreenshotPath || undefined,
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
      setUploadingReviewScreenshot(false);
      setSubmitting(false);
    }
  };

  const handleReviewScreenshotSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Only image files are allowed');
      return;
    }
    if (file.size > MAX_REVIEW_IMAGE_SIZE_BYTES) {
      message.error('Image size must be 10MB or less');
      return;
    }

    if (reviewScreenshotPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(reviewScreenshotPreviewUrl);
    }
    setReviewScreenshotFile(file);
    setReviewScreenshotUrl('');
    setReviewScreenshotPreviewUrl(URL.createObjectURL(file));
    message.success('Screenshot selected. It will upload on Submit Outcome.');
  };

  if (!details) {
    return (
      <Modal
        title="Follow-up Details"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1000}
        loading={loading}
      />
    );
  }

  const { followup, customer, attempts, previousFollowups = [] } = details;

  const getFollowupTitle = (followupNumber: number) => `Follow-up ${followupNumber}`;

  const sortedPreviousFollowups = [...previousFollowups].sort((a, b) => a.followup_number - b.followup_number);

  const connectedOptions: Array<{ label: string; value: ConnectedChoice }> =
    followup.followup_number >= 3
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
            <Row gutter={16}>
              <Col span={12}>
                <Space direction="vertical">
                  <Text strong>
                    <UserOutlined /> {customer.name}
                  </Text>
                  <Space>
                    <Text>
                      <PhoneOutlined /> {customer.phone}
                    </Text>
                    <CallButton customerPhone={customer.phone} customerId={customer.id} />
                  </Space>
                  {customer.email ? (
                    <Text>
                      <MailOutlined /> {customer.email}
                    </Text>
                  ) : null}
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical">
                  <Statistic title="Attempts" value={followup.attempt_count} />
                </Space>
              </Col>
            </Row>
          </Card>

          {sortedPreviousFollowups.length > 0 ? (
            <Card title="Previous Interactions" size="small" styles={{ body: { padding: '8px 12px' } }}>
              {sortedPreviousFollowups.map((pf, index) => {
                const label = `Follow-up ${pf.followup_number}`;
                const when = pf.connected_date ?? pf.updated_at;
                return (
                  <div
                    key={pf.id}
                    style={{
                      padding: '6px 0',
                      borderBottom: index < sortedPreviousFollowups.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <Tag color="#1d4838" style={{ marginRight: 6 }}>
                        {label}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(when).format('MMM D, YYYY')}
                      </Text>
                    </div>
                    {renderPreviousInteractionContent(pf.remarks, pf.payload)}
                  </div>
                );
              })}
            </Card>
          ) : null}

          <Card title="Call Outcome">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={() => setShowConnectedForm(true)}
                loading={submitting}
                block
              >
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
              <Button size="large" onClick={() => handleShortcutOutcome('busy')} loading={submitting}>
                Busy
              </Button>
              <Button size="large" onClick={() => handleShortcutOutcome('wrong_number')} loading={submitting}>
                Wrong Number
              </Button>
              <Button size="large" onClick={() => handleShortcutOutcome('not_interested')} loading={submitting}>
                Not Interested
              </Button>
            </Space>
          </Card>

          <Card title="Call Outcome: Connected">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="Select connected outcome"
                options={connectedOptions}
                value={connectedChoice}
                onChange={(value) => setConnectedChoice(value)}
                style={{ width: 220 }}
              />

              {connectedChoice === 'reviewed' ? (
                <>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <input
                      id="review-screenshot-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const selectedFile = e.currentTarget.files?.[0];
                        if (selectedFile) {
                          handleReviewScreenshotSelect(selectedFile);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    <Space wrap>
                      <Button
                        onClick={() => {
                          const input = document.getElementById('review-screenshot-upload') as HTMLInputElement | null;
                          input?.click();
                        }}
                        loading={uploadingReviewScreenshot || submitting}
                      >
                        Choose review screenshot
                      </Button>
                      {reviewScreenshotFile || reviewScreenshotUrl ? (
                        <Button
                          danger
                          type="text"
                          onClick={() => {
                            if (reviewScreenshotPreviewUrl.startsWith('blob:')) {
                              URL.revokeObjectURL(reviewScreenshotPreviewUrl);
                            }
                            setReviewScreenshotFile(null);
                            setReviewScreenshotUrl('');
                            setReviewScreenshotPreviewUrl('');
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </Space>
                    <Text type="secondary">Max image size: 10MB</Text>
                    {reviewScreenshotFile ? (
                      <Text type="secondary">Selected file: {reviewScreenshotFile.name}</Text>
                    ) : null}
                    {reviewScreenshotUrl ? (
                      <Text type="secondary" style={{ wordBreak: 'break-all' }}>
                        Stored path: {reviewScreenshotUrl}
                      </Text>
                    ) : null}
                    {reviewScreenshotPreviewUrl ? (
                      <Image
                        src={reviewScreenshotPreviewUrl}
                        alt="Review screenshot preview"
                        width={220}
                        style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}
                      />
                    ) : null}
                  </Space>
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
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card title="Call Attempts" size="small">
            {attempts.length > 0 ? (
              <Timeline
                items={attempts.map((attempt: AttemptRow) => ({
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
                      {attempt.notes ? (
                        <Text type="secondary" italic>
                          {attempt.notes}
                        </Text>
                      ) : null}
                    </Space>
                  ),
                  color: attempt.outcome === 'connected' ? '#1d4838' : '#666660',
                }))}
              />
            ) : (
              <Text type="secondary">No attempts yet</Text>
            )}
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Text strong style={{ fontSize: 16, color: 'var(--crm-text, #1a1a1a)' }}>
          {getFollowupTitle(followup.followup_number)}: {customer.name}
        </Text>
      }
      open={visible}
      onCancel={showConnectedForm ? undefined : onClose}
      closable={!showConnectedForm}
      footer={null}
      width={1000}
    >
      <Tabs defaultActiveKey="call" items={tabItems} />
    </Modal>
  );
}
