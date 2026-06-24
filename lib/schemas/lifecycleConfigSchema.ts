import { z } from 'zod';
import type { LifecycleConfigBundle, LeadTypeId } from '@/lib/lifecycleDefaults';

const leadTypeIdSchema = z.enum(['nps', 'review', 'feedback']);

const scheduleAnchorSchema = z.enum(['lifecycle_start']);

export const lifecycleStageConfigSchema = z
  .object({
    followupNumber: z.number().int().min(0).max(20),
    label: z.string().min(1).max(100),
    maxAttempts: z.number().int().min(1).max(10),
    initialScheduleDays: z.number().int().min(0).max(60),
    attemptScheduleDaysFromAnchor: z.array(z.number().int().min(0).max(60)),
    daysAfterPriorConnection: z.number().int().min(1).max(60).optional(),
  })
  .superRefine((stage, ctx) => {
    if (stage.attemptScheduleDaysFromAnchor.length !== stage.maxAttempts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `attemptScheduleDaysFromAnchor length must equal maxAttempts (${stage.maxAttempts})`,
        path: ['attemptScheduleDaysFromAnchor'],
      });
    }

    for (let i = 1; i < stage.attemptScheduleDaysFromAnchor.length; i++) {
      if (stage.attemptScheduleDaysFromAnchor[i] < stage.attemptScheduleDaysFromAnchor[i - 1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'attemptScheduleDaysFromAnchor must be non-decreasing',
          path: ['attemptScheduleDaysFromAnchor'],
        });
        break;
      }
    }

    if (stage.followupNumber > 0 && stage.daysAfterPriorConnection == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'daysAfterPriorConnection is required for follow-up stages after stage 0',
        path: ['daysAfterPriorConnection'],
      });
    }
  });

export const lifecycleTypeConfigSchema = z
  .object({
    leadType: leadTypeIdSchema,
    lastFollowupNumber: z.number().int().min(0).max(20),
    scheduleAnchor: scheduleAnchorSchema,
    stages: z.array(lifecycleStageConfigSchema).min(1),
  })
  .superRefine((config, ctx) => {
    const numbers = config.stages.map((s) => s.followupNumber).sort((a, b) => a - b);
    for (let i = 0; i < numbers.length; i++) {
      if (numbers[i] !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Stage followupNumber values must be contiguous starting at 0',
          path: ['stages'],
        });
        break;
      }
    }

    const lastStage = config.stages.find((s) => s.followupNumber === config.lastFollowupNumber);
    if (!lastStage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lastFollowupNumber must match an existing stage',
        path: ['lastFollowupNumber'],
      });
    }
  });

export const lifecycleGlobalSettingsSchema = z.object({
  retryAfterDays: z.number().int().min(1).max(60),
  nextDayRetryHour: z.number().int().min(0).max(23),
  initialFollowupCutoffHour: z.number().int().min(0).max(23),
  firstFollowupOffsetDays: z.number().int().min(0).max(60),
  brandConnectedAdvanceDays: z.object({
    fitty: z.number().int().min(1).max(60),
    fitelo: z.number().int().min(1).max(60),
    default: z.number().int().min(1).max(60),
  }),
});

export const lifecycleConfigBundleSchema = z.object({
  global: lifecycleGlobalSettingsSchema,
  nps: lifecycleTypeConfigSchema,
  review: lifecycleTypeConfigSchema,
  feedback: lifecycleTypeConfigSchema,
});

export function parseLifecycleConfigBundle(input: unknown): LifecycleConfigBundle {
  return lifecycleConfigBundleSchema.parse(input) as LifecycleConfigBundle;
}

export function getStageFromTypeConfig(
  typeConfig: LifecycleConfigBundle[LeadTypeId],
  followupNumber: number
) {
  return typeConfig.stages.find((s) => s.followupNumber === followupNumber);
}
