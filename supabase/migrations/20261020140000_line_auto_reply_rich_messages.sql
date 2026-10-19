ALTER TABLE public.line_auto_reply_rules
  ADD COLUMN IF NOT EXISTS reply_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS reply_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'line_auto_reply_rules_reply_type_check'
      AND conrelid = 'public.line_auto_reply_rules'::regclass
  ) THEN
    ALTER TABLE public.line_auto_reply_rules
      ADD CONSTRAINT line_auto_reply_rules_reply_type_check
      CHECK (reply_type IN ('text', 'image', 'flex'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
