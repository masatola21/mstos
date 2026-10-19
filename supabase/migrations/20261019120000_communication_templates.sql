-- Reusable owner-scoped email and LINE message templates for the unified send center.
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('document','form','diagnosis','deal','announcement')),
  channel text NOT NULL CHECK (channel IN ('email','line')),
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, template_key)
);
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own communication_templates" ON public.communication_templates;
CREATE POLICY "Users manage own communication_templates"
  ON public.communication_templates FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_templates TO authenticated;
CREATE INDEX IF NOT EXISTS idx_communication_templates_owner ON public.communication_templates(owner_id, category, channel);
