-- Public intake form types and idempotent submissions.
-- Public requests are handled by the server with the service-role key; it is never exposed to browsers.

ALTER TABLE public.diagnosis_forms
  ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'diagnosis';

UPDATE public.diagnosis_forms
SET form_type = CASE
  WHEN definition->>'formType' IN ('diagnosis', 'consultation', 'meeting') THEN definition->>'formType'
  ELSE form_type
END;

ALTER TABLE public.diagnosis_forms
  DROP CONSTRAINT IF EXISTS diagnosis_forms_form_type_check;
ALTER TABLE public.diagnosis_forms
  ADD CONSTRAINT diagnosis_forms_form_type_check
  CHECK (form_type IN ('diagnosis', 'consultation', 'meeting'));

ALTER TABLE public.diagnosis_submissions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnosis_submissions_idempotency_key
  ON public.diagnosis_submissions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.diagnosis_forms.form_type IS 'Public intake kind; all published intake types create or update a CRM lead.';
COMMENT ON COLUMN public.diagnosis_submissions.idempotency_key IS 'Client-generated UUID used to prevent duplicate lead/submission creation on retries.';
