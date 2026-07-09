CREATE TABLE IF NOT EXISTS "user_brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" "lead_brand" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"eligible_lead_types" "lead_type"[] DEFAULT '{review}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_brand_profiles" ADD CONSTRAINT "user_brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_brand_profiles_user_brand_idx" ON "user_brand_profiles" USING btree ("user_id","brand");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_brand_profiles_brand_active" ON "user_brand_profiles" USING btree ("brand","is_active");
--> statement-breakpoint
INSERT INTO "user_brand_profiles" ("user_id", "brand", "is_active", "eligible_lead_types")
SELECT u.id, b.brand, true, ARRAY['review']::lead_type[]
FROM "users" u
CROSS JOIN (VALUES ('fitty'::lead_brand), ('fitelo'::lead_brand)) AS b(brand)
WHERE u.role = 'dt'
ON CONFLICT ("user_id", "brand") DO NOTHING;
