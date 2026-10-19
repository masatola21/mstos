ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS phase pg_catalog.text;

NOTIFY pgrst, 'reload schema';
