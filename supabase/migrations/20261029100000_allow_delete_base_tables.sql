-- Migration: 20261029100000_allow_delete_base_tables.sql
-- Purpose: Add DELETE policies for base tables (products, companies, prospects, leads, deals, customers)
-- Idempotent: Can be safely re-run without errors.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products', 'companies', 'prospects', 'leads', 'deals', 'customers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow authenticated delete ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', 'Allow authenticated delete ' || tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow anon delete ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO anon USING (true)', 'Allow anon delete ' || tbl, tbl);

    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT DELETE ON public.%I TO anon', tbl);
  END LOOP;
END $$;
