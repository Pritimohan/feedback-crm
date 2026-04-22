ALTER TABLE "lead_lifecycle_followups" ADD COLUMN IF NOT EXISTS "assigned_dt_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_lifecycle_followups" ADD CONSTRAINT "lead_lifecycle_followups_assigned_dt_id_users_id_fk" FOREIGN KEY ("assigned_dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_lifecycle_followups_assigned_dt_idx" ON "lead_lifecycle_followups" USING btree ("assigned_dt_id");
--> statement-breakpoint

UPDATE "lead_lifecycle_followups" f
SET "assigned_dt_id" = a."dt_id"
FROM (
  SELECT DISTINCT ON ("followup_id")
    "followup_id",
    "dt_id"
  FROM "lead_lifecycle_followup_assignments"
  WHERE "unassigned_at" IS NULL
  ORDER BY "followup_id", "assigned_at" DESC, "created_at" DESC
) a
WHERE f."id" = a."followup_id"
  AND f."assigned_dt_id" IS NULL;
--> statement-breakpoint

UPDATE "lead_lifecycle_followups" f
SET "assigned_dt_id" = l."assigned_dt_id"
FROM "lead_lifecycles" ll
INNER JOIN "leads" l ON l."id" = ll."lead_id"
WHERE f."lifecycle_id" = ll."id"
  AND f."assigned_dt_id" IS NULL;
--> statement-breakpoint

DROP TABLE IF EXISTS "lead_lifecycle_followup_assignments";
--> statement-breakpoint
DROP TABLE IF EXISTS "exotel_connect_logs";
