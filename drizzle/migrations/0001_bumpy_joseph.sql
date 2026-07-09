CREATE TYPE "public"."lead_connected_choice" AS ENUM('reviewed', 'issue_with_product', 'interested', 'dont_reviewed');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_status" AS ENUM('active', 'inactive', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."lead_brand" AS ENUM('fitty', 'fitelo');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('nps', 'review');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"source" varchar(100),
	"lead_type" "lead_type" DEFAULT 'review' NOT NULL,
	"activity_status" "lead_activity_status" DEFAULT 'active' NOT NULL,
	"assigned_dt_id" uuid,
	"active_lifecycle_id" uuid,
	"brand" "lead_brand",
	"product_name" varchar(255),
	"product_sku" varchar(120),
	"purchase_channel" varchar(120),
	"remarks" text,
	"metadata" jsonb,
	"current_followup_number" integer DEFAULT 0 NOT NULL,
	"current_touch_status" varchar(50),
	"last_connected_choice" "lead_connected_choice",
	"is_testimonial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "lead_lifecycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"lifecycle_type" varchar(50) DEFAULT 'feedback_default' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"inactive_after_at" timestamp,
	"remarks" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_lifecycle_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lifecycle_id" uuid NOT NULL,
	"followup_number" integer DEFAULT 0 NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"connected_date" timestamp,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"first_attempt_date" timestamp,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"payload" jsonb,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_lifecycle_followup_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"followup_id" uuid NOT NULL,
	"dt_id" uuid NOT NULL,
	"attempt_date" timestamp NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"notes" text,
	"was_overdue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_lifecycle_followup_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"followup_id" uuid NOT NULL,
	"dt_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"unassigned_at" timestamp,
	"source" varchar(50) DEFAULT 'system' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_dt_id_users_id_fk" FOREIGN KEY ("assigned_dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycles" ADD CONSTRAINT "lead_lifecycles_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycle_followups" ADD CONSTRAINT "lead_lifecycle_followups_lifecycle_id_lead_lifecycles_id_fk" FOREIGN KEY ("lifecycle_id") REFERENCES "public"."lead_lifecycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycle_followup_attempts" ADD CONSTRAINT "lead_lifecycle_followup_attempts_followup_id_lead_lifecycle_followups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "public"."lead_lifecycle_followups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycle_followup_attempts" ADD CONSTRAINT "lead_lifecycle_followup_attempts_dt_id_users_id_fk" FOREIGN KEY ("dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycle_followup_assignments" ADD CONSTRAINT "lead_lifecycle_followup_assignments_followup_id_lead_lifecycle_followups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "public"."lead_lifecycle_followups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_lifecycle_followup_assignments" ADD CONSTRAINT "lead_lifecycle_followup_assignments_dt_id_users_id_fk" FOREIGN KEY ("dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "leads_assigned_dt_idx" ON "leads" USING btree ("assigned_dt_id");--> statement-breakpoint
CREATE INDEX "leads_active_lifecycle_idx" ON "leads" USING btree ("active_lifecycle_id");--> statement-breakpoint
CREATE INDEX "leads_lead_type_idx" ON "leads" USING btree ("lead_type");--> statement-breakpoint
CREATE INDEX "leads_activity_status_idx" ON "leads" USING btree ("activity_status");--> statement-breakpoint
CREATE INDEX "lead_lifecycles_lead_idx" ON "lead_lifecycles" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycles_type_idx" ON "lead_lifecycles" USING btree ("lifecycle_type");--> statement-breakpoint
CREATE INDEX "lead_lifecycles_status_idx" ON "lead_lifecycles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lead_lifecycles_started_at_idx" ON "lead_lifecycles" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_lifecycles_active_per_lead_idx" ON "lead_lifecycles" USING btree ("lead_id") WHERE "lead_lifecycles"."status" = 'active';--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followups_lifecycle_idx" ON "lead_lifecycle_followups" USING btree ("lifecycle_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followups_stage_idx" ON "lead_lifecycle_followups" USING btree ("followup_number");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followups_scheduled_date_idx" ON "lead_lifecycle_followups" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followups_status_idx" ON "lead_lifecycle_followups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_attempts_followup_idx" ON "lead_lifecycle_followup_attempts" USING btree ("followup_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_attempts_dt_idx" ON "lead_lifecycle_followup_attempts" USING btree ("dt_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_attempts_date_idx" ON "lead_lifecycle_followup_attempts" USING btree ("attempt_date");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_assignments_followup_idx" ON "lead_lifecycle_followup_assignments" USING btree ("followup_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_assignments_dt_idx" ON "lead_lifecycle_followup_assignments" USING btree ("dt_id");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_assignments_assigned_at_idx" ON "lead_lifecycle_followup_assignments" USING btree ("assigned_at");--> statement-breakpoint
CREATE INDEX "lead_lifecycle_followup_assignments_unassigned_at_idx" ON "lead_lifecycle_followup_assignments" USING btree ("unassigned_at");