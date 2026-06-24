-- Migration: Admin-configurable lifecycle settings for feedbackCRM
-- Creates lifecycle_config_settings and version pointer on lead_lifecycles.

CREATE TABLE IF NOT EXISTS lifecycle_config_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lifecycle_config_settings_active_idx ON lifecycle_config_settings(is_active);
CREATE INDEX IF NOT EXISTS lifecycle_config_settings_version_idx ON lifecycle_config_settings(version);

ALTER TABLE lead_lifecycles
  ADD COLUMN IF NOT EXISTS lifecycle_config_version_id UUID REFERENCES lifecycle_config_settings(id);

-- Seed v1 defaults (matches lib/lifecycleDefaults.ts)
INSERT INTO lifecycle_config_settings (version, config, is_active)
SELECT 1, '{
  "global": {
    "retryAfterDays": 3,
    "nextDayRetryHour": 9,
    "initialFollowupCutoffHour": 19,
    "firstFollowupOffsetDays": 0,
    "brandConnectedAdvanceDays": { "fitty": 3, "fitelo": 3, "default": 1 }
  },
  "review": {
    "leadType": "review",
    "lastFollowupNumber": 3,
    "scheduleAnchor": "lifecycle_start",
    "stages": [
      { "followupNumber": 0, "label": "Collect first review feedback", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9] },
      { "followupNumber": 1, "label": "Nudge review completion", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 },
      { "followupNumber": 2, "label": "Final review reminder — close review cycle", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 },
      { "followupNumber": 3, "label": "General follow-up", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 }
    ]
  },
  "nps": {
    "leadType": "nps",
    "lastFollowupNumber": 3,
    "scheduleAnchor": "lifecycle_start",
    "stages": [
      { "followupNumber": 0, "label": "Collect NPS baseline", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9] },
      { "followupNumber": 1, "label": "Follow up NPS response", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 },
      { "followupNumber": 2, "label": "Close NPS conversation — final closure", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 },
      { "followupNumber": 3, "label": "General follow-up", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9], "daysAfterPriorConnection": 1 }
    ]
  },
  "feedback": {
    "leadType": "feedback",
    "lastFollowupNumber": 0,
    "scheduleAnchor": "lifecycle_start",
    "stages": [
      { "followupNumber": 0, "label": "Collect product feedback", "maxAttempts": 4, "initialScheduleDays": 0, "attemptScheduleDaysFromAnchor": [0, 3, 6, 9] }
    ]
  }
}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM lifecycle_config_settings WHERE version = 1);
