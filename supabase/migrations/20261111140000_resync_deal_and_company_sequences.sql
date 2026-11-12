-- Resync sequences for companies and deals to match the actual maximum ID in the tables.
-- This prevents "duplicate key value violates unique constraint 'deals_pkey'" when records
-- are created with database-generated sequences.

DO $$
DECLARE
  max_deal_id bigint;
  max_company_id bigint;
BEGIN
  -- Resync deals sequence
  SELECT COALESCE(MAX((substring(id from '^DEAL-([0-9]+)$'))::bigint), 0)
  INTO max_deal_id
  FROM public.deals;

  IF max_deal_id > 0 THEN
    PERFORM setval('public.deals_deal_id_seq', max_deal_id, true);
  ELSE
    PERFORM setval('public.deals_deal_id_seq', 1, false);
  END IF;

  -- Resync companies sequence
  SELECT COALESCE(MAX((substring(id from '^CID-([0-9]+)$'))::bigint), 0)
  INTO max_company_id
  FROM public.companies;

  IF max_company_id > 0 THEN
    PERFORM setval('public.companies_cid_seq', max_company_id, true);
  ELSE
    PERFORM setval('public.companies_cid_seq', 1, false);
  END IF;
END $$;
