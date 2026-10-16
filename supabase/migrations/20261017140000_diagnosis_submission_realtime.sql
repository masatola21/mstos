-- Enable authenticated workspace clients to receive new diagnosis-form submissions in real time.
-- The app creates the configured review task while an authenticated workspace is open.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'supabase_realtime publication is required for diagnosis submission automation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'diagnosis_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.diagnosis_submissions;
  END IF;
END $$;
