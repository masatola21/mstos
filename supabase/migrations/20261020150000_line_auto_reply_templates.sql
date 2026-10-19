CREATE TABLE IF NOT EXISTS public.line_auto_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  reply_type text NOT NULL CHECK (reply_type IN ('text', 'image', 'flex')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.line_auto_reply_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own line_auto_reply_templates" ON public.line_auto_reply_templates;
CREATE POLICY "Users manage own line_auto_reply_templates"
  ON public.line_auto_reply_templates FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_auto_reply_templates TO authenticated;
CREATE INDEX IF NOT EXISTS idx_line_auto_reply_templates_owner_type
  ON public.line_auto_reply_templates(owner_id, reply_type, created_at DESC);

NOTIFY pgrst, 'reload schema';
