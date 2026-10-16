-- Google Calendar booking-page setting and CRM linkage for deal invitation requests.
ALTER TABLE public.communication_outbox
  ADD COLUMN IF NOT EXISTS deal_id text REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communication_outbox_deal
  ON public.communication_outbox(owner_id, deal_id, created_at DESC)
  WHERE deal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sales_workspace_settings (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_page_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own sales workspace settings" ON public.sales_workspace_settings;
CREATE POLICY "Users manage own sales workspace settings"
  ON public.sales_workspace_settings
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_workspace_settings TO authenticated;

COMMENT ON COLUMN public.communication_outbox.deal_id IS 'Optional related CRM deal for sales invitation messages.';
COMMENT ON TABLE public.sales_workspace_settings IS 'Owner-scoped sales workspace preferences such as Google Calendar booking URL.';
