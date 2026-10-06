ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "external_order_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "marketplace_order_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_source" varchar(80);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ref_code" varchar(255);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_external_order_idx" ON "orders" USING btree ("external_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_marketplace_order_idx" ON "orders" USING btree ("marketplace_order_id");
