ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_consent_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS email_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opt_out_reason text;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_email_consent_status_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_email_consent_status_check
  CHECK (email_consent_status IN ('unknown', 'opted_in', 'opted_out'));

ALTER TABLE public.marketing_automation_jobs
  DROP CONSTRAINT IF EXISTS marketing_automation_jobs_status_check;
ALTER TABLE public.marketing_automation_jobs
  ADD CONSTRAINT marketing_automation_jobs_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped'));

