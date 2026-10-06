DROP INDEX IF EXISTS "lead_lifecycles_order_idx";
--> statement-breakpoint
ALTER TABLE "lead_lifecycles" DROP CONSTRAINT IF EXISTS "lead_lifecycles_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "lead_lifecycles" DROP COLUMN IF EXISTS "order_id";
