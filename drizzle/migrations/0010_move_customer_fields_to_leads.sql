ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" varchar(100);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "purchase_date" varchar(100);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "variant" varchar(255);

WITH ranked_leads AS (
  SELECT
    "id",
    "customer_id",
    ROW_NUMBER() OVER (
      PARTITION BY "customer_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS "row_num"
  FROM "leads"
),
creation_leads AS (
  SELECT "id", "customer_id"
  FROM ranked_leads
  WHERE "row_num" = 1
)
UPDATE "leads" AS l
SET
  "source" = c."source",
  "purchase_date" = c."purchase_date",
  "variant" = c."variant",
  "updated_at" = NOW()
FROM creation_leads cl
INNER JOIN "customers" c ON c."id" = cl."customer_id"
WHERE l."id" = cl."id"
  AND (
    c."source" IS NOT NULL
    OR c."purchase_date" IS NOT NULL
    OR c."variant" IS NOT NULL
  );

ALTER TABLE "customers" DROP COLUMN IF EXISTS "source";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "purchase_date";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "variant";
