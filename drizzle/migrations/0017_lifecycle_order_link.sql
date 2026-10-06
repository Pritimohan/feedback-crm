ALTER TABLE "lead_lifecycles" ADD COLUMN IF NOT EXISTS "order_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lead_lifecycles"
    ADD CONSTRAINT "lead_lifecycles_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_lifecycles_order_idx" ON "lead_lifecycles" USING btree ("order_id");
