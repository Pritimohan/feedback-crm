'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
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
import { FeedbackConnectedForm } from '@/components/dt/FeedbackConnectedForm';
import {
  formatFeedbackFormForDisplay,
  sanitizeFeedbackFormPayload,
  type FeedbackFormData,
} from '@/lib/feedback/feedbackFormSchema';
import { getConnectedChoicesForStage } from '@/lib/lifecycle/leadLifecycleValidation';
import { MAX_FOLLOWUP_NUMBER } from '@/lib/lifecycle/followupStageBounds';
import { followupUiLabel } from '@/lib/utils/followupUiLabel';
import { BUSY_RESCHEDULE_SLOTS } from '@/lib/utils/lifecycleConstants';
import { isDtSchedulingPickerDateDisabled } from '@/lib/utils/schedulingDates';

const { Text } = Typography;
const MAX_REVIEW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SCREENSHOT_UPLOAD_RETRY_DELAY_MS = 500;

async function uploadReviewScreenshotWithRetry(
  file: File,
  followupId: string,
  retries = 1
): Promise<{ path: string; signedUrl: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('followupId', followupId);

      const uploadRes = await fetch('/api/dt/uploads/review-screenshot', {
        method: 'POST',
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson?.success) {
        throw new Error(uploadJson?.error || 'Failed to upload screenshot');
      }

      return {
        path: String(uploadJson.data.path ?? ''),
        signedUrl: String(uploadJson.data.signedUrl ?? ''),
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error('Failed to upload screenshot');
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_UPLOAD_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error('Failed to upload screenshot');
}

const TIME_SLOT_OPTIONS = BUSY_RESCHEDULE_SLOTS.map((s, i) => ({
  label: s.label,
  value: i,
}));

function renderPreviousInteractionContent(remarks: string | null, payload: unknown): ReactNode {
  const rows: ReactNode[] = [];
  const payloadObj =
    payload && typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : undefined;

  const addTextRow = (key: string, label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return;
    rows.push(
      <span key={key} style={{ marginRight: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          • {label}:
        </Text>
        <Text style={{ fontSize: 13 }}> {text}</Text>
      </span>
    );
  };

  addTextRow('remarks', 'Remarks', remarks);
  addTextRow('review_remark', 'Review Remark', payloadObj?.review_remark);
  addTextRow('issue_description', 'Issue Description', payloadObj?.issue_description);
  addTextRow('interested_remark', 'Interested Remark', payloadObj?.interested_remark);
  const connectedChoice =
    typeof payloadObj?.connected_choice === 'string' ? payloadObj.connected_choice.trim() : '';
  if (connectedChoice === 'didnt_feedback') {
    addTextRow('didnt_feedback_remark', "Didn't Feedback Remark", payloadObj?.didnt_reviewed_remark);
  } else {
    addTextRow('didnt_reviewed_remark', "Didn't Review Remark", payloadObj?.didnt_reviewed_remark);
  }

  const feedbackFormRaw = payloadObj?.feedback_form;
  if (feedbackFormRaw && typeof feedbackFormRaw === 'object') {
    const feedbackRows = formatFeedbackFormForDisplay(sanitizeFeedbackFormPayload(feedbackFormRaw));
    for (const row of feedbackRows) {
      addTextRow(`feedback_${row.label}`, row.label, row.value);
    }
  }

  const screenshotUrl = typeof payloadObj?.review_screenshot_url === 'string' ? payloadObj.review_screenshot_url.trim() : '';
  if (screenshotUrl) {
    rows.push(
      <span key="review_screenshot_url" style={{ marginRight: 8 }}>
        <Button type="link" size="small" href={screenshotUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 0 }}>
          Open Screenshot
        </Button>
      </span>
    );
  }

  if (!rows.length) return null;
  return <div style={{ lineHeight: 1.6 }}>{rows}</div>;
}

type ConnectedChoice =
  | 'reviewed'
  | 'issue_with_product'
  | 'interested'
  | 'didnt_reviewed'
  | 'feedbacked'
  | 'didnt_feedback';

const CONNECTED_CHOICE_LABELS: Record<ConnectedChoice, string> = {
  reviewed: 'Reviewed',
  issue_with_product: 'Issue with product',
  interested: 'Interested',
  didnt_reviewed: "Didn't Review",
  feedbacked: 'Feedbacked',
  didnt_feedback: "Didn't Feedback",
};

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
    lead_type: 'nps' | 'review' | 'feedback';
    brand: 'fitty' | 'fitelo' | null;
    source: string | null;
    variant: string | null;
    purchase_date: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  latestOrder: {
    product_name: string | null;
    channel: string | null;
  } | null;
  attempts: AttemptRow[];
  previousFollowups?: PreviousFollowupRow[];
}

function formatPurchaseDateForDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = dayjs(trimmed);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : trimmed;
}

function formatLeadProductDisplay(
  lead: FollowupDetails['lead'],
  latestOrder: FollowupDetails['latestOrder']
): string {
  const base =
    lead.brand === 'fitty'
      ? 'GLP'
      : lead.brand === 'fitelo'
        ? 'smart scale'
        : latestOrder?.product_name?.trim() || '';

  const parts: string[] = [];
  if (base) parts.push(base);
  const variant = lead.variant?.trim();
  if (variant) parts.push(variant);

  return parts.length > 0 ? parts.join(' · ') : '-';
}

export default function FollowupModal({ followupId, visible, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<FollowupDetails | null>(null);
  const [showConnectedForm, setShowConnectedForm] = useState(false);
  const [connectedChoice, setConnectedChoice] = useState<ConnectedChoice | undefined>(undefined);
  const [issueDescription, setIssueDescription] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewScreenshotUrl, setReviewScreenshotUrl] = useState('');
  const [reviewScreenshotFile, setReviewScreenshotFile] = useState<File | null>(null);
  const [reviewScreenshotPreviewUrl, setReviewScreenshotPreviewUrl] = useState('');
  const [uploadingReviewScreenshot, setUploadingReviewScreenshot] = useState(false);
  const [isTestimonial, setIsTestimonial] = useState(false);
  const [dontReviewedRemark, setDontReviewedRemark] = useState('');
  const [interestedRemark, setInterestedRemark] = useState('');
  const [feedbackForm, setFeedbackForm] = useState<FeedbackFormData>({});
  const [showBusyRescheduleModal, setShowBusyRescheduleModal] = useState(false);
  const [busyRescheduleDate, setBusyRescheduleDate] = useState<dayjs.Dayjs | null>(null);
  const [busyRescheduleSlot, setBusyRescheduleSlot] = useState<number | null>(null);
  const [busySubmitting, setBusySubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const { message } = App.useApp();

  const beginSubmit = (): boolean => {
    if (submitInFlightRef.current) return false;
    submitInFlightRef.current = true;
    setSubmitting(true);
    return true;
  };

  const endSubmit = () => {
    submitInFlightRef.current = false;
    setSubmitting(false);
  };

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
        setIssueDescription('');
        setReviewRemark('');
        setReviewScreenshotUrl('');
        setReviewScreenshotFile(null);
        setReviewScreenshotPreviewUrl('');
        setIsTestimonial(false);
        setDontReviewedRemark('');
        setInterestedRemark('');
        setFeedbackForm({});
        setShowBusyRescheduleModal(false);
        setBusyRescheduleDate(null);
        setBusyRescheduleSlot(null);
      } catch (error: unknown) {
        message.error(error instanceof Error ? error.message : 'Failed to load followup details');
      } finally {
        setLoading(false);
      }
    };
    void load();
    // message is intentionally omitted — re-running on message identity would wipe in-progress form state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followupId, visible]);

  useEffect(() => {
    if (!visible) {
      setDetails(null);
      setShowConnectedForm(false);
      setShowBusyRescheduleModal(false);
      setBusyRescheduleDate(null);
      setBusyRescheduleSlot(null);
      setBusySubmitting(false);
      submitInFlightRef.current = false;
      setSubmitting(false);
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
    if (!followupId || !beginSubmit()) return;
    try {
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
      endSubmit();
    }
  };

  const handleShortcutOutcome = async (outcome: 'wrong_number' | 'not_interested' | 'no_answer') => {
    if (!followupId || !beginSubmit()) return;
    try {
      const res = await fetch(`/api/dt/followups/${followupId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to save ${outcome}`);
      message.success(`${outcome.replace('_', ' ')} recorded`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to save outcome');
    } finally {
      endSubmit();
    }
  };

  const completeAfterBusyAction = () => {
    onSuccess();
    onClose();
  };

  const handleBusyClick = () => {
    setShowBusyRescheduleModal(true);
    setBusyRescheduleDate(null);
    setBusyRescheduleSlot(null);
  };

  const handleBusyCancel = async () => {
    if (!followupId || busySubmitting) return;

    try {
      setBusySubmitting(true);
      const res = await fetch(`/api/dt/followups/${followupId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'busy' }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowBusyRescheduleModal(false);
        setBusyRescheduleDate(null);
        setBusyRescheduleSlot(null);
        completeAfterBusyAction();
        message.success('Attempt recorded. Rescheduled per retry schedule.');
      } else {
        message.error(json.error || 'Failed to record attempt');
      }
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to record attempt');
    } finally {
      setBusySubmitting(false);
    }
  };

  const handleBusyReschedule = async () => {
    if (!followupId || busySubmitting) return;
    if (busyRescheduleDate === null || busyRescheduleSlot === null) {
      message.warning('Please select both date and time slot.');
      return;
    }

    const slot = BUSY_RESCHEDULE_SLOTS[busyRescheduleSlot];
    const scheduledDateTime = busyRescheduleDate
      .hour(slot.hour)
      .minute(slot.minute)
      .second(0)
      .millisecond(0)
      .toISOString();

    try {
      setBusySubmitting(true);
      const res = await fetch(`/api/dt/followups/${followupId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'busy',
          preferred_scheduled_date: scheduledDateTime,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowBusyRescheduleModal(false);
        setBusyRescheduleDate(null);
        setBusyRescheduleSlot(null);
        completeAfterBusyAction();
        const nextDate = json.nextScheduledDate ? dayjs(json.nextScheduledDate) : null;
        if (nextDate?.isValid()) {
          message.success(`Attempt recorded. Rescheduled for ${nextDate.format('MMM D, YYYY h:mm A')}.`);
        } else {
          message.success('Attempt recorded. Rescheduled for preferred time slot.');
        }
      } else {
        message.error(json.error || 'Failed to record attempt');
      }
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to record attempt');
    } finally {
      setBusySubmitting(false);
    }
  };

  const submitConnected = async () => {
    if (!followupId) return;
    if (!connectedChoice) {
      message.error('Please select a connected outcome before submitting.');
      return;
    }
    if (!beginSubmit()) return;
    try {
      let uploadedReviewScreenshotPath = reviewScreenshotUrl || '';

      const isFeedbackLead = details?.lead.lead_type === 'feedback';
      const isFeedbackedOutcome = connectedChoice === 'feedbacked';

      if (
        !isFeedbackLead &&
        connectedChoice === 'reviewed' &&
        reviewScreenshotFile
      ) {
        setUploadingReviewScreenshot(true);
        try {
          const uploaded = await uploadReviewScreenshotWithRetry(reviewScreenshotFile, followupId);
          uploadedReviewScreenshotPath = uploaded.path;
          setReviewScreenshotUrl(uploaded.path);
          setReviewScreenshotPreviewUrl(uploaded.signedUrl);
          setReviewScreenshotFile(null);
        } catch (error: unknown) {
          const uploadMessage =
            error instanceof Error ? error.message : 'Failed to upload screenshot';
          throw new Error(`Screenshot upload failed — please try again. (${uploadMessage})`);
        } finally {
          setUploadingReviewScreenshot(false);
        }
      }

      const payload: Record<string, unknown> = isFeedbackLead
        ? isFeedbackedOutcome
          ? {
              feedback_form: feedbackForm,
              is_testimonial: feedbackForm.testimonial_comfortable === 'Yes',
            }
          : {
              didnt_reviewed_remark: dontReviewedRemark || undefined,
            }
        : {
            review_screenshot_url: uploadedReviewScreenshotPath || undefined,
            review_remark: reviewRemark || undefined,
            is_testimonial: isTestimonial,
            issue_description: issueDescription || undefined,
            interested_remark: interestedRemark || undefined,
            didnt_reviewed_remark: dontReviewedRemark || undefined,
          };
      const res = await fetch(`/api/dt/followups/${followupId}/connected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: connectedChoice, payload }),
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
      endSubmit();
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

  const { followup, customer, lead, latestOrder, attempts, previousFollowups = [] } = details;

  const purchaseDateDisplay = (() => {
    const raw = lead.purchase_date?.trim();
    if (!raw) return '-';
    return formatPurchaseDateForDisplay(raw) || '-';
  })();

  const getFollowupTitle = (followupNumber: number) => followupUiLabel(followupNumber);

  const sortedPreviousFollowups = [...previousFollowups].sort((a, b) => a.followup_number - b.followup_number);

  const connectedOptions: Array<{ label: string; value: ConnectedChoice }> =
    lead.lead_type === 'feedback'
      ? getConnectedChoicesForStage(followup.followup_number, 'feedback').map((value) => ({
          label: CONNECTED_CHOICE_LABELS[value],
          value,
        }))
      : followup.followup_number >= MAX_FOLLOWUP_NUMBER
        ? [
            { label: 'Reviewed', value: 'reviewed' },
            { label: 'Issue with product', value: 'issue_with_product' },
            { label: "Didn't Review", value: 'didnt_reviewed' },
          ]
        : [
            { label: 'Reviewed', value: 'reviewed' },
            { label: 'Issue with product', value: 'issue_with_product' },
            { label: 'Interested', value: 'interested' },
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
                  <Text>
                    <Text type="secondary">Product Name: </Text>
                    {formatLeadProductDisplay(lead, latestOrder)}
                  </Text>
                  <Text>
                    <Text type="secondary">Purchase From: </Text>
                    {lead.source?.trim() || '-'}
                  </Text>
                  <Text>
                    <Text type="secondary">Purchase date: </Text>
                    {purchaseDateDisplay}
                  </Text>
                </Space>
              </Col>
            </Row>
          </Card>

          {sortedPreviousFollowups.length > 0 ? (
            <Card title="Previous Interactions" size="small" styles={{ body: { padding: '8px 12px' } }}>
              {sortedPreviousFollowups.map((pf, index) => {
                const label = followupUiLabel(pf.followup_number);
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
              <Button size="large" onClick={handleBusyClick} loading={submitting}>
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

              {lead.lead_type === 'feedback' && connectedChoice === 'feedbacked' ? (
                <FeedbackConnectedForm
                  customerName={customer.name}
                  customerPhone={customer.phone}
                  value={feedbackForm}
                  onChange={setFeedbackForm}
                />
              ) : null}

              {lead.lead_type !== 'feedback' && connectedChoice === 'reviewed' ? (
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

              {connectedChoice === 'didnt_reviewed' || connectedChoice === 'didnt_feedback' ? (
                <Input.TextArea
                  placeholder="Remarks (optional)"
                  rows={3}
                  value={dontReviewedRemark}
                  onChange={(e) => setDontReviewedRemark(e.target.value)}
                />
              ) : null}

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
    <>
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

    <Modal
      title="Customer is Busy - Schedule Preferred Time Slot"
      open={showBusyRescheduleModal}
      closable={false}
      maskClosable={false}
      footer={[
        <Button key="cancel" onClick={handleBusyCancel} loading={busySubmitting} disabled={busySubmitting}>
          Cancel
        </Button>,
        <Button
          key="reschedule"
          type="primary"
          onClick={handleBusyReschedule}
          loading={busySubmitting}
          disabled={busySubmitting || busyRescheduleDate === null || busyRescheduleSlot === null}
        >
          Reschedule
        </Button>,
      ]}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Text type="secondary">
          If the customer provided a preferred date and time slot, select below. They will appear in Today&apos;s Due on that day.
        </Text>
        <Form layout="vertical">
          <Form.Item label="Date" required>
            <DatePicker
              value={busyRescheduleDate}
              onChange={(date) => setBusyRescheduleDate(date)}
              disabledDate={(current) =>
                isDtSchedulingPickerDateDisabled(current, dayjs().startOf('day'))
              }
              disabled={busySubmitting}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Time Slot" required>
            <Select
              placeholder="Select preferred time slot"
              value={busyRescheduleSlot}
              onChange={setBusyRescheduleSlot}
              options={TIME_SLOT_OPTIONS}
              disabled={busySubmitting}
              style={{ width: '100%' }}
              allowClear
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
    </>
  );
}
