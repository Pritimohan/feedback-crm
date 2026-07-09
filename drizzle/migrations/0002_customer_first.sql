CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"source" varchar(100),
	"assigned_dt_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_dt_id_users_id_fk" FOREIGN KEY ("assigned_dt_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
--> statement-breakpoint
CREATE INDEX "customers_assigned_dt_idx" ON "customers" USING btree ("assigned_dt_id");
--> statement-breakpoint

ALTER TABLE "leads" ADD COLUMN "customer_id" uuid;
--> statement-breakpoint

INSERT INTO "customers" ("phone", "name", "email", "source", "assigned_dt_id", "created_at", "updated_at")
SELECT DISTINCT ON (l."phone")
  l."phone",
  l."name",
  l."email",
  l."source",
  l."assigned_dt_id",
  COALESCE(l."created_at", now()),
  COALESCE(l."updated_at", now())
FROM "leads" l
WHERE l."phone" IS NOT NULL;
--> statement-breakpoint

UPDATE "leads" l
SET "customer_id" = c."id"
FROM "customers" c
WHERE c."phone" = l."phone";
--> statement-breakpoint

ALTER TABLE "leads" ALTER COLUMN "customer_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

DROP INDEX IF EXISTS "leads_phone_idx";
--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_phone_unique";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN IF EXISTS "phone";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN IF EXISTS "name";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN IF EXISTS "email";
--> statement-breakpoint

CREATE INDEX "leads_customer_idx" ON "leads" USING btree ("customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "leads_active_customer_type_idx" ON "leads" USING btree ("customer_id","lead_type") WHERE "leads"."activity_status" = 'active';
