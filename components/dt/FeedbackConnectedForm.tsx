'use client';

import { Card, Checkbox, Input, Radio, Rate, Space, Typography } from 'antd';
import {
  FEEDBACK_FORM_FIELD_LABELS,
  FEEDBACK_FORM_SECTIONS,
  type FeedbackFormData,
  type FeedbackFormFieldKey,
  shouldShowFeedbackField,
} from '@/lib/feedback/feedbackFormSchema';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  customerName: string;
  customerPhone: string;
  value: FeedbackFormData;
  onChange: (next: FeedbackFormData) => void;
}

export function FeedbackConnectedForm({ customerName, customerPhone, value, onChange }: Props) {
  const setField = <K extends keyof FeedbackFormData>(key: K, fieldValue: FeedbackFormData[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" title="Customer">
        <Text>
          {customerName} · {customerPhone}
        </Text>
      </Card>

      {FEEDBACK_FORM_SECTIONS.map((section) => {
        const visibleFields = section.fields.filter((field) => shouldShowFeedbackField(field, value));
        if (!visibleFields.length) return null;

        return (
          <Card key={section.title} size="small" title={section.title}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {visibleFields.map((field) => {
                const label = FEEDBACK_FORM_FIELD_LABELS[field.key as FeedbackFormFieldKey];

                if (field.type === 'multiselect') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        {label}
                      </Text>
                      <Checkbox.Group
                        options={field.options.map((option) => ({ label: option, value: option }))}
                        value={value.products_purchased ?? []}
                        onChange={(checked) => setField('products_purchased', checked as string[])}
                      />
                    </div>
                  );
                }

                if (field.type === 'radio') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        {label}
                      </Text>
                      <Radio.Group
                        value={value[field.key]}
                        onChange={(e) => setField(field.key, e.target.value)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                      >
                        {field.options.map((option) => (
                          <Radio key={option} value={option}>
                            {option}
                          </Radio>
                        ))}
                      </Radio.Group>
                    </div>
                  );
                }

                if (field.type === 'text') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        {label}
                      </Text>
                      <Input
                        value={value[field.key] ?? ''}
                        onChange={(e) => setField(field.key, e.target.value)}
                      />
                    </div>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        Remarks (in detail customer feedback)
                      </Text>
                      <TextArea
                        rows={4}
                        value={value.detailed_remarks ?? ''}
                        onChange={(e) => setField('detailed_remarks', e.target.value)}
                      />
                    </div>
                  );
                }

                if (field.type === 'rate10') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        How likely are you to recommend Fitty to friends or family? (1-10)
                      </Text>
                      <Rate
                        count={10}
                        value={value.recommend_likelihood ?? 0}
                        onChange={(rating) => setField('recommend_likelihood', rating || undefined)}
                      />
                    </div>
                  );
                }

                if (field.type === 'rate5') {
                  return (
                    <div key={field.key}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        How satisfied are you with the results achieved from the product? (1-5)
                      </Text>
                      <Rate
                        count={5}
                        value={value.satisfaction_score ?? 0}
                        onChange={(rating) => setField('satisfaction_score', rating || undefined)}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </Space>
          </Card>
        );
      })}
    </Space>
  );
}
