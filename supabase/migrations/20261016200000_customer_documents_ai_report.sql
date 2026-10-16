-- Link an outbound document snapshot to the exact generated AI report version.
ALTER TABLE public.customer_documents
  ADD COLUMN IF NOT EXISTS ai_report_id uuid REFERENCES public.ai_reports(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_documents_owner_ai_report_unique
  ON public.customer_documents(owner_id, ai_report_id)
  WHERE ai_report_id IS NOT NULL;
