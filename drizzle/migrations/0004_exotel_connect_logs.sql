CREATE TABLE IF NOT EXISTS "exotel_connect_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exotel_call_sid" varchar(100) NOT NULL,
	"agent_phone" varchar(25) NOT NULL,
	"customer_phone" varchar(25) NOT NULL,
	"customer_id" uuid,
	"dt_id" uuid,
	"status" varchar(50),
	"duration_seconds" integer,
	"recording_url" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exotel_connect_logs_exotel_call_sid_unique" UNIQUE("exotel_call_sid")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exotel_connect_logs" ADD CONSTRAINT "exotel_connect_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exotel_connect_logs" ADD CONSTRAINT "exotel_connect_logs_dt_id_users_id_fk" FOREIGN KEY ("dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exotel_connect_logs_call_sid_idx" ON "exotel_connect_logs" USING btree ("exotel_call_sid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exotel_connect_logs_customer_idx" ON "exotel_connect_logs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exotel_connect_logs_dt_idx" ON "exotel_connect_logs" USING btree ("dt_id");
