-- Keep the applicant-provided company or trade name with each public intake.
-- The name is matched to an existing company when possible; unmatched values remain reviewable here.
ALTER TABLE public.diagnosis_submissions
  ADD COLUMN IF NOT EXISTS respondent_company_name text;

COMMENT ON COLUMN public.diagnosis_submissions.respondent_company_name IS 'Company or trade name as entered by the respondent; may not yet be linked to a company master record.';
