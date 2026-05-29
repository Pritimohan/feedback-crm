-- Rename connected choice: dont_reviewed -> didnt_reviewed ("didn't review")
-- Enum value must be committed before UPDATEs (PostgreSQL 55P04).
ALTER TYPE "public"."lead_connected_choice" ADD VALUE IF NOT EXISTS 'didnt_reviewed';--> statement-breakpoint
UPDATE "leads"
SET "last_connected_choice" = 'didnt_reviewed'
WHERE "last_connected_choice"::text = 'dont_reviewed';--> statement-breakpoint
UPDATE "lead_lifecycle_followups"
SET "payload" = jsonb_set(
  COALESCE("payload", '{}'::jsonb),
  '{connected_choice}',
  '"didnt_reviewed"'::jsonb,
  true
)
WHERE "payload"->>'connected_choice' = 'dont_reviewed';--> statement-breakpoint
UPDATE "lead_lifecycle_followups"
SET "payload" =
  ("payload" - 'dont_reviewed_remark')
  || CASE
    WHEN "payload" ? 'dont_reviewed_remark'
    THEN jsonb_build_object('didnt_reviewed_remark', "payload"->'dont_reviewed_remark')
    ELSE '{}'::jsonb
  END
WHERE "payload" ? 'dont_reviewed_remark';
