-- Generate human-readable CRM IDs atomically in the database.
-- Sequences avoid duplicate IDs when multiple users create records at the same time.

CREATE SEQUENCE IF NOT EXISTS public.companies_cid_seq;
SELECT setval(
  'public.companies_cid_seq',
  COALESCE(MAX((substring(id from '^CID-([0-9]+)$'))::bigint), 1),
  COUNT(*) FILTER (WHERE id ~ '^CID-[0-9]+$') > 0
)
FROM public.companies;

CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS NULL OR pg_catalog.btrim(NEW.id) = '' THEN
    NEW.id := 'CID-' || pg_catalog.lpad(pg_catalog.nextval('public.companies_cid_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_set_id ON public.companies;
CREATE TRIGGER companies_set_id
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

CREATE SEQUENCE IF NOT EXISTS public.deals_deal_id_seq;
SELECT setval(
  'public.deals_deal_id_seq',
  COALESCE(MAX((substring(id from '^DEAL-([0-9]+)$'))::bigint), 1),
  COUNT(*) FILTER (WHERE id ~ '^DEAL-[0-9]+$') > 0
)
FROM public.deals;

CREATE OR REPLACE FUNCTION public.set_deal_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS NULL OR pg_catalog.btrim(NEW.id) = '' THEN
    NEW.id := 'DEAL-' || pg_catalog.lpad(pg_catalog.nextval('public.deals_deal_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_set_id ON public.deals;
CREATE TRIGGER deals_set_id
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_deal_id();
