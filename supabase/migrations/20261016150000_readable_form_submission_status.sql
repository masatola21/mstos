-- Replace the former lead-conversion marker with an operator workflow status.
-- Form submissions are linked to leads automatically when received.
ALTER TABLE public.diagnosis_submissions
  DROP CONSTRAINT IF EXISTS diagnosis_submissions_status_check;

UPDATE public.diagnosis_submissions SET status = 'completed' WHERE status = 'converted';

ALTER TABLE public.diagnosis_submissions
  ADD CONSTRAINT diagnosis_submissions_status_check
  CHECK (status IN ('received', 'reviewing', 'completed', 'rejected'));
