ALTER TABLE public.marketing_automation_jobs
  DROP CONSTRAINT IF EXISTS marketing_automation_jobs_status_check;

ALTER TABLE public.marketing_automation_jobs
  ADD CONSTRAINT marketing_automation_jobs_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped', 'canceled'));
