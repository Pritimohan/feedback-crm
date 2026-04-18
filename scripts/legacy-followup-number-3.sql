-- Runbook: lifecycles capped at followup_number 0..2 (three stages).
-- Rows with followup_number = 3 may still exist from before the cap.
-- Inspect only (adjust schema/table names if your DB differs):

-- SELECT id, lifecycle_id, followup_number, status, scheduled_date
-- FROM lead_lifecycle_followups
-- WHERE followup_number > 2;

-- Ops may close or reassign pending legacy rows as needed; no automatic migration here.
