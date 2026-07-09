-- Pre-migration baseline: run before applying 0010_move_customer_fields_to_leads.sql.
-- Save these counts externally for post-migration parity verification.
SELECT
  COUNT(*) FILTER (WHERE c.source IS NOT NULL) AS customers_source_non_null,
  COUNT(*) FILTER (WHERE c.purchase_date IS NOT NULL) AS customers_purchase_date_non_null,
  COUNT(*) FILTER (WHERE c.variant IS NOT NULL) AS customers_variant_non_null
FROM customers c;

-- Post-migration parity: run after migration.
-- Compare these counts against the saved pre-migration baseline above.
SELECT
  COUNT(*) FILTER (WHERE l.source IS NOT NULL) AS leads_source_non_null,
  COUNT(*) FILTER (WHERE l.purchase_date IS NOT NULL) AS leads_purchase_date_non_null,
  COUNT(*) FILTER (WHERE l.variant IS NOT NULL) AS leads_variant_non_null
FROM leads l;

-- Post-migration sanity: no customers should be left without at least one lead.
SELECT COUNT(*) AS customers_without_lead
FROM customers c
LEFT JOIN leads l ON l.customer_id = c.id
WHERE l.id IS NULL;
