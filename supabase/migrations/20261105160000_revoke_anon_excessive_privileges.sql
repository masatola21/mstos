BEGIN;

-- anonの過剰な権限をすべて剥奪
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- HPフォームが動くために必要な最小限の権限だけを再付与
GRANT INSERT ON public.leads TO anon;
GRANT SELECT ON public.mst_ai_acquisition_records TO anon;

COMMIT;
