-- CRM intake, contacts, LINE friends/tags, and public diagnosis submissions.
-- Existing company/prospect/lead/deal/customer data remains the source of truth.
-- Public webhooks/forms must write through a server endpoint using service role;
-- never expose the service role key in the browser.

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  role_title text,
  preferred_channel text,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
  ALTER COLUMN company_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.diagnoses
  ALTER COLUMN company_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.line_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  line_user_id text NOT NULL UNIQUE,
  display_name text,
  picture_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'unfollowed', 'unknown')),
  followed_at timestamptz,
  unfollowed_at timestamptz,
  last_message_at timestamptz,
  consent_status text NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown', 'opted_in', 'opted_out')),
  source text NOT NULL DEFAULT 'line_webhook',
  profile_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.line_friend_tags (
  line_friend_id uuid NOT NULL REFERENCES public.line_friends(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
  assigned_by text NOT NULL DEFAULT 'operator',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_friend_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.diagnosis_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  public_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  questionnaire_version text NOT NULL DEFAULT 'v1.0',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_notice text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.diagnosis_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.diagnosis_forms(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  diagnosis_id uuid REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'converted', 'rejected')),
  respondent_name text,
  respondent_email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_agreed_at timestamptz,
  source text NOT NULL DEFAULT 'public_form',
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_ingestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('line', 'email', 'diagnosis_form', 'csv', 'ai_research', 'manual', 'system')),
  source_event_id text,
  event_type text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_line_friends_contact_id ON public.line_friends(contact_id);
CREATE INDEX IF NOT EXISTS idx_line_friends_status ON public.line_friends(status);
CREATE INDEX IF NOT EXISTS idx_diagnosis_submissions_form_submitted ON public.diagnosis_submissions(form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_submissions_contact_id ON public.diagnosis_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_ingestion_events_created_at ON public.crm_ingestion_events(created_at DESC);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_friend_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ingestion_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'contacts', 'line_friends', 'contact_tags', 'line_friend_tags',
    'diagnosis_forms', 'diagnosis_submissions', 'crm_ingestion_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can manage ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Authenticated users can manage ' || table_name, table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.touch_crm_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_contacts_touch_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_touch_updated_at BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
DROP TRIGGER IF EXISTS trg_line_friends_touch_updated_at ON public.line_friends;
CREATE TRIGGER trg_line_friends_touch_updated_at BEFORE UPDATE ON public.line_friends
FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
DROP TRIGGER IF EXISTS trg_diagnosis_forms_touch_updated_at ON public.diagnosis_forms;
CREATE TRIGGER trg_diagnosis_forms_touch_updated_at BEFORE UPDATE ON public.diagnosis_forms
FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();

COMMENT ON TABLE public.contacts IS 'Company-linked contact and individual source of truth; company is optional.';
COMMENT ON TABLE public.line_friends IS 'LINE friends imported from webhook. Friend-follow alone does not create a lead.';
COMMENT ON TABLE public.contact_tags IS 'Shared tag dictionary for contacts and LINE friends.';
COMMENT ON TABLE public.diagnosis_forms IS 'Public diagnosis/application form definitions and publication state.';
COMMENT ON TABLE public.diagnosis_submissions IS 'Public form answers, reviewed before linking to CRM records.';
COMMENT ON TABLE public.crm_ingestion_events IS 'External event idempotency and processing history.';
