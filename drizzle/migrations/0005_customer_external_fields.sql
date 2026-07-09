ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_assigned_dt_id_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "customers_assigned_dt_idx";
--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN IF EXISTS "assigned_dt_id";
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "serial_number" varchar(120);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "purchase_date" varchar(100);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "purchase_from" varchar(120);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "variant" varchar(255);
