-- 20261022120000_document_types_and_consent_evidence.sql
-- 1. Expand document_type check constraint in customer_document_templates
ALTER TABLE public.customer_document_templates
  DROP CONSTRAINT IF EXISTS customer_document_templates_document_type_check;

ALTER TABLE public.customer_document_templates
  ADD CONSTRAINT customer_document_templates_document_type_check
  CHECK (document_type IN ('proposal','diagnosis_report','contract','invoice','estimate','monthly_report','other'));

-- 2. Expand document_type check constraint in customer_documents
ALTER TABLE public.customer_documents
  DROP CONSTRAINT IF EXISTS customer_documents_document_type_check;

ALTER TABLE public.customer_documents
  ADD CONSTRAINT customer_documents_document_type_check
  CHECK (document_type IN ('proposal','diagnosis_report','contract','invoice','estimate','monthly_report','other'));

-- 3. Add consent evidence columns to customer_contracts
ALTER TABLE public.customer_contracts
  ADD COLUMN IF NOT EXISTS consent_method text,
  ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_ip text,
  ADD COLUMN IF NOT EXISTS consent_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_evidence_text text;

CREATE INDEX IF NOT EXISTS idx_customer_contracts_consent
  ON public.customer_contracts(consent_recorded_at)
  WHERE consent_recorded_at IS NOT NULL;

-- 4. Add consent evidence columns to customer_documents
ALTER TABLE public.customer_documents
  ADD COLUMN IF NOT EXISTS consent_method text,
  ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_ip text,
  ADD COLUMN IF NOT EXISTS consent_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_evidence_text text;

CREATE INDEX IF NOT EXISTS idx_customer_documents_consent
  ON public.customer_documents(consent_recorded_at)
  WHERE consent_recorded_at IS NOT NULL;
