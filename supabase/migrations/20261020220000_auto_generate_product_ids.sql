-- Generate human-readable product master IDs atomically.
-- Existing product IDs are preserved; new rows without an ID receive PRD-###.
CREATE SEQUENCE IF NOT EXISTS public.products_prd_id_seq;

SELECT setval(
  'public.products_prd_id_seq',
  COALESCE(MAX((substring(id from '^PRD-([0-9]+)$'))::bigint), 1),
  COUNT(*) FILTER (WHERE id ~ '^PRD-[0-9]+$') > 0
)
FROM public.products;

CREATE OR REPLACE FUNCTION public.set_product_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS NULL OR pg_catalog.btrim(NEW.id) = '' THEN
    NEW.id := 'PRD-' || pg_catalog.lpad(pg_catalog.nextval('public.products_prd_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_id ON public.products;
CREATE TRIGGER products_set_id
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_product_id();
