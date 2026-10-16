-- Consent confirmation is captured when a document send request is created.
ALTER TABLE public.communication_outbox
  ADD COLUMN IF NOT EXISTS consent_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_basis text;
