export interface FeedbackFormData {
  products_purchased?: string[];
  hear_about_fitty?: string;
  product_take_time?: string;
  usage_duration?: string;
  stop_using_reason?: string;
  prior_product_used?: string;
  medical_concern?: string;
  using_supplement?: string;
  physical_activity?: string;
  following_diet?: string;
  purchase_reason?: string;
  finished_product?: string;
  usage_frequency?: string;
  dt_guidance_received?: string;
  packaging_rating?: string;
  cravings_reduction?: string;
  weight_loss_experienced?: string;
  product_issues?: string;
  product_issues_other?: string;
  improvement_suggestion?: string;
  improvement_suggestion_other?: string;
  taste_description?: string;
  side_effects?: string;
  testimonial_comfortable?: string;
  ordering_delivery_experience?: string;
  would_repurchase?: string;
  recommend_likelihood?: number;
  satisfaction_score?: number;
  detailed_remarks?: string;
}

export const FEEDBACK_FORM_FIELD_KEYS = [
  'products_purchased',
  'hear_about_fitty',
  'product_take_time',
  'usage_duration',
  'stop_using_reason',
  'prior_product_used',
  'medical_concern',
  'using_supplement',
  'physical_activity',
  'following_diet',
  'purchase_reason',
  'finished_product',
  'usage_frequency',
  'dt_guidance_received',
  'packaging_rating',
  'cravings_reduction',
  'weight_loss_experienced',
  'product_issues',
  'product_issues_other',
  'improvement_suggestion',
  'improvement_suggestion_other',
  'taste_description',
  'side_effects',
  'testimonial_comfortable',
  'ordering_delivery_experience',
  'would_repurchase',
  'recommend_likelihood',
  'satisfaction_score',
  'detailed_remarks',
] as const satisfies readonly (keyof FeedbackFormData)[];

export type FeedbackFormFieldKey = (typeof FEEDBACK_FORM_FIELD_KEYS)[number];

export const FEEDBACK_FORM_FIELD_LABELS: Record<FeedbackFormFieldKey, string> = {
  products_purchased: 'Product purchased',
  hear_about_fitty: 'How did you first hear about Fitty product?',
  product_take_time: 'At what time do you usually take the product?',
  usage_duration: 'How long have you been using the Fitty product?',
  stop_using_reason: 'Why did you stop using the product?',
  prior_product_used: 'Had you used any other product before? Which one?',
  medical_concern: 'Medical concern',
  using_supplement: 'Are you using any supplement?',
  physical_activity: 'Physical activity',
  following_diet: 'Following diet',
  purchase_reason: 'What made you decide to buy it?',
  finished_product: 'Did you finish using your Fitty product?',
  usage_frequency: 'How regularly did you use your Fitty product?',
  dt_guidance_received: 'Did you receive proper guidance from our Dietitian/Support Team?',
  packaging_rating: 'What do you think about packaging & design?',
  cravings_reduction: 'Have you noticed a reduction in cravings?',
  weight_loss_experienced: 'Have you experienced any weight loss after using the product?',
  product_issues: 'Any issues faced while using the product?',
  product_issues_other: 'Other issue (details)',
  improvement_suggestion: 'What one thing would make Fitty perfect for you?',
  improvement_suggestion_other: 'Other improvement (details)',
  taste_description: 'How would you describe the taste?',
  side_effects: 'Did you experience any side effects while using the product?',
  testimonial_comfortable: 'Would you be comfortable sharing your testimonial?',
  ordering_delivery_experience: 'How was your ordering and delivery experience?',
  would_repurchase: 'Would you purchase this product again?',
  recommend_likelihood: 'How likely are you to recommend Fitty? (1-10)',
  satisfaction_score: 'How satisfied are you with the results? (1-5)',
  detailed_remarks: 'Remarks (detailed customer feedback)',
};

export const PRODUCT_OPTIONS = [
  'Fitty GLP Capsule',
  'Fitty GLP Fizz',
  'Fitty Metabolic Lean(Pro & Prebiotic)',
  'Fitty Yeast Protein',
  'Fitty ACV 600mg',
  'Fitty ACV 2000mg',
] as const;

export const USAGE_DURATION_NOT_USING = 'Currently Not using';

export const FEEDBACK_FORM_SECTIONS = [
  {
    title: 'Product & discovery',
    fields: [
      { key: 'products_purchased' as const, type: 'multiselect' as const, options: [...PRODUCT_OPTIONS] },
      {
        key: 'hear_about_fitty' as const,
        type: 'radio' as const,
        options: ['Friend/Family', 'Amazon', 'Website', 'Facebook', 'Others'],
      },
    ],
  },
  {
    title: 'Usage habits',
    fields: [
      {
        key: 'product_take_time' as const,
        type: 'radio' as const,
        options: [
          'Breakfast (Before)',
          'Lunch (Before)',
          'Dinner (Before)',
          'Breakfast (After)',
          'Lunch (After)',
          'Dinner (After)',
        ],
      },
      {
        key: 'usage_duration' as const,
        type: 'radio' as const,
        options: ['Less than 1 month', '1–3 months', 'More than 3 months', USAGE_DURATION_NOT_USING],
      },
      {
        key: 'stop_using_reason' as const,
        type: 'radio' as const,
        showWhen: { field: 'usage_duration' as const, equals: USAGE_DURATION_NOT_USING },
        options: [
          "Didn't see results",
          'Taste issue',
          'Forgot to take regularly',
          'Side effects',
          'Product finished late',
          'Other',
        ],
      },
      {
        key: 'finished_product' as const,
        type: 'radio' as const,
        options: [
          'Yes, I finished it',
          "I'm still using it",
          "No, I didn't finish it",
          "I haven't started yet",
        ],
      },
      {
        key: 'usage_frequency' as const,
        type: 'radio' as const,
        options: ['Daily', 'Few times a week', 'Rarely'],
      },
    ],
  },
  {
    title: 'Health & history',
    fields: [
      { key: 'prior_product_used' as const, type: 'text' as const },
      { key: 'medical_concern' as const, type: 'radio' as const, options: ['Yes', 'No'] },
      { key: 'using_supplement' as const, type: 'radio' as const, options: ['Yes', 'No'] },
      { key: 'physical_activity' as const, type: 'radio' as const, options: ['Yes', 'No'] },
      { key: 'following_diet' as const, type: 'radio' as const, options: ['Yes', 'No'] },
    ],
  },
  {
    title: 'Purchase motivation',
    fields: [
      {
        key: 'purchase_reason' as const,
        type: 'radio' as const,
        options: ['Weightloss', 'Brand Trust', 'Offer/Discount', 'Cravings control', 'Gut issues', 'Other'],
      },
    ],
  },
  {
    title: 'Support & packaging',
    fields: [
      { key: 'dt_guidance_received' as const, type: 'radio' as const, options: ['Yes', 'No', 'Maybe'] },
      { key: 'packaging_rating' as const, type: 'radio' as const, options: ['Premium', 'Average', 'Good', 'Poor'] },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'cravings_reduction' as const, type: 'radio' as const, options: ['Yes', 'No'] },
      { key: 'weight_loss_experienced' as const, type: 'radio' as const, options: ['Yes', 'No'] },
    ],
  },
  {
    title: 'Issues & improvements',
    fields: [
      {
        key: 'product_issues' as const,
        type: 'radio' as const,
        options: ['Smell', 'Taste', 'No issue', 'Other'],
      },
      {
        key: 'product_issues_other' as const,
        type: 'text' as const,
        showWhen: { field: 'product_issues' as const, equals: 'Other' },
      },
      {
        key: 'improvement_suggestion' as const,
        type: 'radio' as const,
        options: ['Taste', 'Better results', 'Packaging', 'Better pricing', 'More info on usage', 'Other'],
      },
      {
        key: 'improvement_suggestion_other' as const,
        type: 'text' as const,
        showWhen: { field: 'improvement_suggestion' as const, equals: 'Other' },
      },
      {
        key: 'taste_description' as const,
        type: 'radio' as const,
        options: ['Love it', "It's okay", 'Too strong', 'Unpleasant'],
      },
    ],
  },
  {
    title: 'Safety & repurchase',
    fields: [
      { key: 'side_effects' as const, type: 'radio' as const, options: ['Yes', 'No', 'Maybe'] },
      { key: 'testimonial_comfortable' as const, type: 'radio' as const, options: ['Yes', 'No'] },
      {
        key: 'ordering_delivery_experience' as const,
        type: 'radio' as const,
        options: ['Excellent', 'Good', 'Fair', 'Poor'],
      },
      { key: 'would_repurchase' as const, type: 'radio' as const, options: ['Yes', 'No', 'Maybe'] },
    ],
  },
  {
    title: 'Ratings & remarks',
    fields: [
      { key: 'recommend_likelihood' as const, type: 'rate10' as const },
      { key: 'satisfaction_score' as const, type: 'rate5' as const },
      { key: 'detailed_remarks' as const, type: 'textarea' as const },
    ],
  },
] as const;

export type FeedbackFormFieldDef = (typeof FEEDBACK_FORM_SECTIONS)[number]['fields'][number];

function trimString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function normalizeNumber(value: unknown, min: number, max: number): number | undefined {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return undefined;
  if (num < min || num > max) return undefined;
  return num;
}

export function shouldShowFeedbackField(field: FeedbackFormFieldDef, values: FeedbackFormData): boolean {
  if (!('showWhen' in field) || !field.showWhen) return true;
  return values[field.showWhen.field] === field.showWhen.equals;
}

export function sanitizeFeedbackFormPayload(raw: unknown): FeedbackFormData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const input = raw as Record<string, unknown>;
  const result: FeedbackFormData = {};

  const products = normalizeStringArray(input.products_purchased);
  if (products) result.products_purchased = products;

  const stringFields: Array<Exclude<FeedbackFormFieldKey, 'products_purchased' | 'recommend_likelihood' | 'satisfaction_score'>> = [
    'hear_about_fitty',
    'product_take_time',
    'usage_duration',
    'stop_using_reason',
    'prior_product_used',
    'medical_concern',
    'using_supplement',
    'physical_activity',
    'following_diet',
    'purchase_reason',
    'finished_product',
    'usage_frequency',
    'dt_guidance_received',
    'packaging_rating',
    'cravings_reduction',
    'weight_loss_experienced',
    'product_issues',
    'product_issues_other',
    'improvement_suggestion',
    'improvement_suggestion_other',
    'taste_description',
    'side_effects',
    'testimonial_comfortable',
    'ordering_delivery_experience',
    'would_repurchase',
    'detailed_remarks',
  ];

  for (const key of stringFields) {
    const value = trimString(input[key]);
    if (value) result[key] = value;
  }

  const recommend = normalizeNumber(input.recommend_likelihood, 1, 10);
  if (recommend !== undefined) result.recommend_likelihood = recommend;

  const satisfaction = normalizeNumber(input.satisfaction_score, 1, 5);
  if (satisfaction !== undefined) result.satisfaction_score = satisfaction;

  if (result.usage_duration !== USAGE_DURATION_NOT_USING) {
    delete result.stop_using_reason;
  }
  if (result.product_issues !== 'Other') {
    delete result.product_issues_other;
  }
  if (result.improvement_suggestion !== 'Other') {
    delete result.improvement_suggestion_other;
  }

  return result;
}

export function formatFeedbackFormForDisplay(form: FeedbackFormData): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  for (const key of FEEDBACK_FORM_FIELD_KEYS) {
    const value = form[key];
    if (value === undefined || value === null || value === '') continue;
    const label = FEEDBACK_FORM_FIELD_LABELS[key];
    if (Array.isArray(value)) {
      rows.push({ label, value: value.join(', ') });
    } else {
      rows.push({ label, value: String(value) });
    }
  }

  return rows;
}

export function isFeedbackFormEmpty(form: FeedbackFormData): boolean {
  return formatFeedbackFormForDisplay(form).length === 0;
}
