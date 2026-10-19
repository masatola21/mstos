CREATE TABLE IF NOT EXISTS public.mst_ai_acquisition_records (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  record_type text NOT NULL,
  title text NOT NULL,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE public.mst_ai_acquisition_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own AI acquisition records" ON public.mst_ai_acquisition_records;
CREATE POLICY "Users manage own AI acquisition records"
  ON public.mst_ai_acquisition_records FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mst_ai_acquisition_records TO authenticated;
CREATE INDEX IF NOT EXISTS idx_mst_ai_acquisition_records_user_type_updated
  ON public.mst_ai_acquisition_records(user_id, record_type, updated_at DESC);

