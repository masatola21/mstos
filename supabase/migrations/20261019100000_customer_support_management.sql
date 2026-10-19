-- Add non-destructive fields for post-contract support and an owner-scoped meeting history.
-- Existing engagement, contract, milestone, and document rows remain intact.
ALTER TABLE public.customer_service_engagements
  ADD COLUMN IF NOT EXISTS support_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.customer_service_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES public.customer_service_engagements(id) ON DELETE CASCADE,
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL,
  purpose text NOT NULL DEFAULT '',
  topic text NOT NULL,
  discussion text NOT NULL DEFAULT '',
  decisions text NOT NULL DEFAULT '',
  unresolved_items text NOT NULL DEFAULT '',
  client_homework text NOT NULL DEFAULT '',
  mst_homework text NOT NULL DEFAULT '',
  next_topic text NOT NULL DEFAULT '',
  next_meeting_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_service_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own customer_service_meetings" ON public.customer_service_meetings;
CREATE POLICY "Users manage own customer_service_meetings"
  ON public.customer_service_meetings
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.customer_service_engagements engagement
      WHERE engagement.id = customer_service_meetings.engagement_id
        AND engagement.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.customer_service_engagements engagement
      WHERE engagement.id = customer_service_meetings.engagement_id
        AND engagement.owner_id = auth.uid()
        AND engagement.company_id IS NOT DISTINCT FROM customer_service_meetings.company_id
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_service_meetings TO authenticated;

CREATE INDEX IF NOT EXISTS idx_customer_service_engagements_company
  ON public.customer_service_engagements(owner_id, company_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_service_meetings_engagement_date
  ON public.customer_service_meetings(owner_id, engagement_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_service_meetings_company
  ON public.customer_service_meetings(owner_id, company_id, occurred_at DESC);

COMMENT ON COLUMN public.customer_service_engagements.support_details
  IS 'Editable post-contract support summary including phase, themes, ownership, purpose, and progress.';
COMMENT ON TABLE public.customer_service_meetings
  IS 'Owner-scoped, editable meeting and support history linked to an existing customer service engagement.';
