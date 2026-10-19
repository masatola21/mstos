-- LINE inbox, channel-to-owner mapping and human-configured keyword auto replies.
CREATE TABLE IF NOT EXISTS public.line_channel_integrations (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_user_id text NOT NULL UNIQUE,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.line_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_event_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  line_user_id text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, line_event_id, direction)
);

CREATE TABLE IF NOT EXISTS public.line_auto_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  match_mode text NOT NULL CHECK (match_mode IN ('exact','contains')),
  match_text text NOT NULL,
  reply_text text NOT NULL,
  tag_id text,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['line_channel_integrations','line_inbox_messages','line_auto_reply_rules'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)',
      'Users manage own ' || table_name, table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_line_inbox_messages_owner_received
  ON public.line_inbox_messages(owner_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_inbox_messages_owner_contact
  ON public.line_inbox_messages(owner_id, contact_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_auto_reply_rules_owner_priority
  ON public.line_auto_reply_rules(owner_id, enabled, priority);
