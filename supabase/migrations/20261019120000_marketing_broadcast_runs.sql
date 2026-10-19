-- Owner-scoped group record for marketing broadcasts. Individual deliveries remain in communication_outbox.
CREATE TABLE IF NOT EXISTS public.marketing_broadcast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','line')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','partial','failed','canceled')),
  audience_summary text NOT NULL DEFAULT '',
  subject text,
  body_text text NOT NULL DEFAULT '',
  total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_broadcast_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own marketing_broadcast_runs" ON public.marketing_broadcast_runs;
CREATE POLICY "Users manage own marketing_broadcast_runs" ON public.marketing_broadcast_runs
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_broadcast_runs TO authenticated;
CREATE INDEX IF NOT EXISTS idx_marketing_broadcast_runs_owner_created
  ON public.marketing_broadcast_runs(owner_id, created_at DESC);

COMMENT ON TABLE public.marketing_broadcast_runs IS 'Owner-scoped broadcast summaries; individual recipient outcomes are recorded in communication_outbox using source_id.';
