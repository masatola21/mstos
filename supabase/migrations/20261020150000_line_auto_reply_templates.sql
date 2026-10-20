CREATE TABLE IF NOT EXISTS public.line_auto_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  reply_type text NOT NULL CHECK (reply_type IN ('text', 'image', 'flex', 'video')),
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

-- Allow video replies in the existing automatic reply rules.
ALTER TABLE public.line_auto_reply_rules
  DROP CONSTRAINT IF EXISTS line_auto_reply_rules_reply_type_check;
ALTER TABLE public.line_auto_reply_rules
  ADD CONSTRAINT line_auto_reply_rules_reply_type_check
  CHECK (reply_type IN ('text', 'image', 'flex', 'video'));

-- LINE must be able to fetch uploaded media from a public URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mst-line-message-assets',
  'mst-line-message-assets',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own LINE message assets" ON storage.objects;
CREATE POLICY "Users upload own LINE message assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mst-line-message-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own LINE message assets" ON storage.objects;
CREATE POLICY "Users update own LINE message assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mst-line-message-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mst-line-message-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own LINE message assets" ON storage.objects;
CREATE POLICY "Users delete own LINE message assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mst-line-message-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
