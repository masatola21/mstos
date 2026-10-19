-- Optional LINE video content for queued messages. Existing outbox rows remain valid.
ALTER TABLE public.communication_outbox
  ADD COLUMN IF NOT EXISTS line_message_payload jsonb;

COMMENT ON COLUMN public.communication_outbox.line_message_payload IS
  'Optional LINE Messaging API payload metadata for non-text messages such as video; currently video only.';
