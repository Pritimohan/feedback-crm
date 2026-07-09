ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "flag_type" varchar(50);
--> statement-breakpoint

UPDATE "customers" c
SET "flag_type" = x."flag_type"::text
FROM (
  SELECT DISTINCT ON ("customer_id")
    "customer_id",
    "flag_type",
    "created_at"
  FROM "customer_flags"
  WHERE "is_active" = true
  ORDER BY "customer_id", "created_at" DESC
) x
WHERE c."id" = x."customer_id"
  AND c."flag_type" IS NULL;
--> statement-breakpoint

ALTER TABLE "customer_purchases" RENAME TO "orders";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "ordered_at" TO "order_date";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "order_ref" TO "shopify_order_id";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "amount" TO "total_amount";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "sku" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_date" timestamp;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_status" varchar(50) DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pack_size" integer DEFAULT 1;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "orders_customer_order_date_idx" ON "orders" USING btree ("customer_id","order_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_sku_idx" ON "orders" USING btree ("sku");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_channel_idx" ON "orders" USING btree ("channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_delivery_status_idx" ON "orders" USING btree ("delivery_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_shopify_order_idx" ON "orders" USING btree ("shopify_order_id");
--> statement-breakpoint

DROP TABLE IF EXISTS "customer_flags";
--> statement-breakpoint
DROP TYPE IF EXISTS "customer_flag_type";
