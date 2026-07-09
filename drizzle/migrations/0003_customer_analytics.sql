CREATE TYPE "public"."customer_flag_type" AS ENUM('deferred', 'testimonial');
--> statement-breakpoint
CREATE TABLE "customer_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"sku" varchar(120) NOT NULL,
	"product_name" varchar(255),
	"quantity" integer DEFAULT 1 NOT NULL,
	"channel" varchar(80) DEFAULT 'unknown' NOT NULL,
	"ordered_at" timestamp DEFAULT now() NOT NULL,
	"order_ref" varchar(120),
	"amount" numeric(12, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"flag_type" "customer_flag_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" varchar(80) DEFAULT 'system' NOT NULL,
	"reason" text,
	"payload" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"lifecycle_id" uuid,
	"followup_id" uuid,
	"attempt_id" uuid,
	"dt_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'exotel' NOT NULL,
	"provider_call_sid" varchar(255),
	"provider_parent_sid" varchar(255),
	"provider_status_raw" varchar(100),
	"provider_recording_url" text,
	"provider_start_at" timestamp,
	"provider_end_at" timestamp,
	"provider_duration_sec" integer,
	"provider_ring_sec" integer,
	"provider_talk_sec" integer,
	"dt_number" varchar(25),
	"customer_number" varchar(25),
	"exotel_number" varchar(25),
	"attempt_outcome" varchar(50) NOT NULL,
	"attempt_notes" text,
	"scheduled_date_at_attempt" timestamp,
	"was_overdue" boolean DEFAULT false NOT NULL,
	"lead_type" varchar(50) NOT NULL,
	"followup_number" integer DEFAULT 0 NOT NULL,
	"ingest_source" varchar(40) DEFAULT 'attempt_api' NOT NULL,
	"ingest_status" varchar(40) DEFAULT 'partial' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_purchases" ADD CONSTRAINT "customer_purchases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_flags" ADD CONSTRAINT "customer_flags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_flags" ADD CONSTRAINT "customer_flags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lifecycle_id_lead_lifecycles_id_fk" FOREIGN KEY ("lifecycle_id") REFERENCES "public"."lead_lifecycles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_followup_id_lead_lifecycle_followups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "public"."lead_lifecycle_followups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_attempt_id_lead_lifecycle_followup_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."lead_lifecycle_followup_attempts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_dt_id_users_id_fk" FOREIGN KEY ("dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_purchases_customer_ordered_idx" ON "customer_purchases" USING btree ("customer_id","ordered_at");
--> statement-breakpoint
CREATE INDEX "customer_purchases_sku_idx" ON "customer_purchases" USING btree ("sku");
--> statement-breakpoint
CREATE INDEX "customer_purchases_channel_idx" ON "customer_purchases" USING btree ("channel");
--> statement-breakpoint
CREATE INDEX "customer_flags_customer_active_idx" ON "customer_flags" USING btree ("customer_id","is_active");
--> statement-breakpoint
CREATE INDEX "customer_flags_type_active_idx" ON "customer_flags" USING btree ("flag_type","is_active");
--> statement-breakpoint
CREATE INDEX "customer_flags_created_at_idx" ON "customer_flags" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "call_logs_attempt_unique_idx" ON "call_logs" USING btree ("attempt_id");
--> statement-breakpoint
CREATE INDEX "call_logs_provider_sid_idx" ON "call_logs" USING btree ("provider_call_sid");
--> statement-breakpoint
CREATE INDEX "call_logs_outcome_created_idx" ON "call_logs" USING btree ("attempt_outcome","created_at");
--> statement-breakpoint
CREATE INDEX "call_logs_dt_created_idx" ON "call_logs" USING btree ("dt_id","created_at");
--> statement-breakpoint
CREATE INDEX "call_logs_customer_created_idx" ON "call_logs" USING btree ("customer_id","created_at");
--> statement-breakpoint
CREATE INDEX "call_logs_lead_stage_created_idx" ON "call_logs" USING btree ("lead_type","followup_number","created_at");
