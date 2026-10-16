-- Store AI work-management records as user-scoped rows instead of a single workspace JSON snapshot.
CREATE TABLE IF NOT EXISTS public.mst_ai_projects (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_tasks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('waiting', 'in_progress', 'pending_approval', 'completed', 'blocked')),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  due_date date,
  related_record jsonb,
  source_automation_id text,
  source_automation_record_id text,
  automation_auto_run boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_approvals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  task_id text,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  action_title text NOT NULL,
  requested_by text NOT NULL,
  source_automation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_automation_rules (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN ('diagnosis_submitted', 'deal_won', 'contract_signed', 'invoice_overdue', 'project_milestone')),
  is_enabled boolean NOT NULL DEFAULT false,
  ai_mode text NOT NULL CHECK (ai_mode IN ('suggest', 'prepare', 'execute')),
  approval_policy text NOT NULL CHECK (approval_policy IN ('always', 'external_actions', 'none')),
  task_due_in_days integer NOT NULL DEFAULT 1 CHECK (task_due_in_days >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_activity_logs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action_type text NOT NULL,
  actor text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_character_id text,
  top_goal text NOT NULL DEFAULT '',
  characters jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_model_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mst_ai_chat_conversations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_knowledge_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('business', 'product', 'customer', 'decision', 'research', 'deliverable')),
  content text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_task_id text,
  source_role_id text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_token_usage_records (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  endpoint_name text NOT NULL,
  model text NOT NULL,
  provider text,
  fallback_from text,
  status text NOT NULL CHECK (status IN ('acquired', 'unacquired')),
  prompt_tokens bigint,
  candidates_tokens bigint,
  total_tokens bigint,
  estimated_cost numeric,
  currency text,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_model_pricing (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('JPY', 'USD')),
  input_price_per_million numeric,
  output_price_per_million numeric,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, model)
);

CREATE TABLE IF NOT EXISTS public.mst_ai_operations_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mst_ai_projects_user_status
  ON public.mst_ai_projects(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_ai_tasks_user_status_due
  ON public.mst_ai_tasks(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_mst_ai_tasks_user_project
  ON public.mst_ai_tasks(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_mst_ai_tasks_automation_source
  ON public.mst_ai_tasks(user_id, source_automation_id, source_automation_record_id)
  WHERE source_automation_id IS NOT NULL AND source_automation_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mst_ai_approvals_user_status
  ON public.mst_ai_approvals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_ai_automation_rules_user_trigger
  ON public.mst_ai_automation_rules(user_id, is_enabled, trigger_event);
CREATE INDEX IF NOT EXISTS idx_mst_ai_activity_logs_user_time
  ON public.mst_ai_activity_logs(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_ai_chat_conversations_updated
  ON public.mst_ai_chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_ai_knowledge_category
  ON public.mst_ai_knowledge_items(user_id, category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_ai_token_usage_time
  ON public.mst_ai_token_usage_records(user_id, occurred_at DESC);

ALTER TABLE public.mst_ai_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_operations_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_token_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mst_ai_model_pricing ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'mst_ai_projects',
    'mst_ai_tasks',
    'mst_ai_approvals',
    'mst_ai_automation_rules',
    'mst_ai_activity_logs',
    'mst_ai_operations_sync_state',
    'mst_ai_user_preferences',
    'mst_ai_chat_conversations',
    'mst_ai_knowledge_items',
    'mst_ai_token_usage_records',
    'mst_ai_model_pricing'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can manage own ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'Users can manage own ' || table_name,
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.mst_save_ai_operations(
  p_user_id uuid,
  p_projects jsonb,
  p_tasks jsonb,
  p_approvals jsonb,
  p_automation_rules jsonb,
  p_activity_logs jsonb,
  p_user_profile jsonb,
  p_characters jsonb,
  p_active_character_id text,
  p_ai_model_settings jsonb,
  p_top_goal text,
  p_token_usage_records jsonb,
  p_model_pricing jsonb,
  p_chat_histories jsonb,
  p_knowledge_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_projects jsonb := COALESCE(p_projects, '[]'::jsonb);
  v_tasks jsonb := COALESCE(p_tasks, '[]'::jsonb);
  v_approvals jsonb := COALESCE(p_approvals, '[]'::jsonb);
  v_automation_rules jsonb := COALESCE(p_automation_rules, '[]'::jsonb);
  v_activity_logs jsonb := COALESCE(p_activity_logs, '[]'::jsonb);
  v_user_profile jsonb := COALESCE(p_user_profile, '{}'::jsonb);
  v_characters jsonb := COALESCE(p_characters, '[]'::jsonb);
  v_ai_model_settings jsonb := COALESCE(p_ai_model_settings, '{}'::jsonb);
  v_token_usage_records jsonb := COALESCE(p_token_usage_records, '[]'::jsonb);
  v_model_pricing jsonb := COALESCE(p_model_pricing, '[]'::jsonb);
  v_chat_histories jsonb := COALESCE(p_chat_histories, '{}'::jsonb);
  v_knowledge_items jsonb := COALESCE(p_knowledge_items, '[]'::jsonb);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'ユーザーの業務データを更新する権限がありません';
  END IF;
  IF pg_catalog.jsonb_typeof(v_projects) <> 'array'
    OR pg_catalog.jsonb_typeof(v_tasks) <> 'array'
    OR pg_catalog.jsonb_typeof(v_approvals) <> 'array'
    OR pg_catalog.jsonb_typeof(v_automation_rules) <> 'array'
    OR pg_catalog.jsonb_typeof(v_activity_logs) <> 'array'
    OR pg_catalog.jsonb_typeof(v_user_profile) <> 'object'
    OR pg_catalog.jsonb_typeof(v_characters) <> 'array'
    OR pg_catalog.jsonb_typeof(v_ai_model_settings) <> 'object'
    OR pg_catalog.jsonb_typeof(v_token_usage_records) <> 'array'
    OR pg_catalog.jsonb_typeof(v_model_pricing) <> 'array'
    OR pg_catalog.jsonb_typeof(v_chat_histories) <> 'object'
    OR pg_catalog.jsonb_typeof(v_knowledge_items) <> 'array' THEN
    RAISE EXCEPTION 'AI業務データまたはユーザー設定の形式が正しくありません';
  END IF;

  INSERT INTO public.mst_ai_user_preferences (
    user_id, active_character_id, top_goal, characters, user_profile, ai_model_settings, updated_at
  ) VALUES (
    p_user_id, NULLIF(p_active_character_id, ''), COALESCE(p_top_goal, ''), v_characters, v_user_profile, v_ai_model_settings, pg_catalog.now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    active_character_id = EXCLUDED.active_character_id,
    top_goal = EXCLUDED.top_goal,
    characters = EXCLUDED.characters,
    user_profile = EXCLUDED.user_profile,
    ai_model_settings = EXCLUDED.ai_model_settings,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.mst_ai_projects (
    user_id, id, name, status, priority, due_date, created_at, updated_at, payload
  )
  SELECT
    p_user_id,
    item.payload->>'id',
    COALESCE(NULLIF(item.payload->>'name', ''), '名称未設定'),
    COALESCE(NULLIF(item.payload->>'status', ''), 'planning'),
    COALESCE(NULLIF(item.payload->>'priority', ''), 'medium'),
    NULLIF(item.payload->>'dueDate', '')::date,
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'createdAt', '')::double precision / 1000), pg_catalog.now()),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'updatedAt', '')::double precision / 1000), pg_catalog.now()),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_projects) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_tasks (
    user_id, id, project_id, title, status, priority, due_date,
    related_record, source_automation_id, source_automation_record_id,
    automation_auto_run, created_at, updated_at, payload
  )
  SELECT
    p_user_id,
    item.payload->>'id',
    NULLIF(item.payload->>'projectId', ''),
    COALESCE(NULLIF(item.payload->>'title', ''), '名称未設定'),
    COALESCE(NULLIF(item.payload->>'status', ''), 'waiting'),
    COALESCE(NULLIF(item.payload->>'priority', ''), 'medium'),
    NULLIF(item.payload->>'dueDate', '')::date,
    item.payload->'relatedRecord',
    NULLIF(item.payload->>'sourceAutomationId', ''),
    NULLIF(item.payload->>'sourceAutomationRecordId', ''),
    COALESCE((item.payload->>'automationAutoRun')::boolean, false),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'createdAt', '')::double precision / 1000), pg_catalog.now()),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'updatedAt', '')::double precision / 1000), pg_catalog.now()),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_tasks) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    project_id = EXCLUDED.project_id,
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    related_record = EXCLUDED.related_record,
    source_automation_id = EXCLUDED.source_automation_id,
    source_automation_record_id = EXCLUDED.source_automation_record_id,
    automation_auto_run = EXCLUDED.automation_auto_run,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_approvals (
    user_id, id, task_id, status, action_title, requested_by,
    source_automation_id, created_at, resolved_at, payload
  )
  SELECT
    p_user_id,
    item.payload->>'id',
    NULLIF(item.payload->>'taskId', ''),
    COALESCE(NULLIF(item.payload->>'status', ''), 'pending'),
    COALESCE(NULLIF(item.payload->>'actionTitle', ''), '承認項目'),
    COALESCE(NULLIF(item.payload->>'requestedBy', ''), 'システム'),
    NULLIF(item.payload->>'sourceAutomationId', ''),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'createdAt', '')::double precision / 1000), pg_catalog.now()),
    pg_catalog.to_timestamp(NULLIF(item.payload->>'resolvedAt', '')::double precision / 1000),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_approvals) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    task_id = EXCLUDED.task_id,
    status = EXCLUDED.status,
    action_title = EXCLUDED.action_title,
    requested_by = EXCLUDED.requested_by,
    source_automation_id = EXCLUDED.source_automation_id,
    created_at = EXCLUDED.created_at,
    resolved_at = EXCLUDED.resolved_at,
    payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_automation_rules (
    user_id, id, trigger_event, is_enabled, ai_mode, approval_policy,
    task_due_in_days, updated_at, payload
  )
  SELECT
    p_user_id,
    item.payload->>'id',
    COALESCE(NULLIF(item.payload->>'triggerEvent', ''), 'diagnosis_submitted'),
    COALESCE((item.payload->>'isEnabled')::boolean, false),
    COALESCE(NULLIF(item.payload->>'aiMode', ''), 'suggest'),
    COALESCE(NULLIF(item.payload->>'approvalPolicy', ''), 'always'),
    COALESCE(NULLIF(item.payload->>'taskDueInDays', '')::integer, 1),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'updatedAt', '')::double precision / 1000), pg_catalog.now()),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_automation_rules) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    trigger_event = EXCLUDED.trigger_event,
    is_enabled = EXCLUDED.is_enabled,
    ai_mode = EXCLUDED.ai_mode,
    approval_policy = EXCLUDED.approval_policy,
    task_due_in_days = EXCLUDED.task_due_in_days,
    updated_at = EXCLUDED.updated_at,
    payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_activity_logs (
    user_id, id, occurred_at, action_type, actor, summary, payload
  )
  SELECT
    p_user_id,
    item.payload->>'id',
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'timestamp', '')::double precision / 1000), pg_catalog.now()),
    COALESCE(NULLIF(item.payload->>'actionType', ''), 'task_updated'),
    COALESCE(NULLIF(item.payload->>'actor', ''), 'システム'),
    COALESCE(NULLIF(item.payload->>'summary', ''), ''),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_activity_logs) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    occurred_at = EXCLUDED.occurred_at,
    action_type = EXCLUDED.action_type,
    actor = EXCLUDED.actor,
    summary = EXCLUDED.summary,
    payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_knowledge_items (
    user_id, id, title, category, content, tags, source_task_id, source_role_id, attachments,
    created_at, updated_at, payload
  )
  SELECT
    p_user_id, item.payload->>'id',
    COALESCE(NULLIF(item.payload->>'title', ''), '名称未設定'),
    COALESCE(NULLIF(item.payload->>'category', ''), 'business'),
    COALESCE(item.payload->>'content', ''),
    COALESCE(item.payload->'tags', '[]'::jsonb),
    NULLIF(item.payload->>'sourceTaskId', ''),
    NULLIF(item.payload->>'sourceRoleId', ''),
    COALESCE(item.payload->'attachments', '[]'::jsonb),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'createdAt', '')::double precision / 1000), pg_catalog.now()),
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'updatedAt', '')::double precision / 1000), pg_catalog.now()),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_knowledge_items) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    title = EXCLUDED.title, category = EXCLUDED.category, content = EXCLUDED.content,
    tags = EXCLUDED.tags, source_task_id = EXCLUDED.source_task_id, source_role_id = EXCLUDED.source_role_id,
    attachments = EXCLUDED.attachments, created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at, payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_token_usage_records (
    user_id, id, occurred_at, endpoint, endpoint_name, model, provider, fallback_from, status,
    prompt_tokens, candidates_tokens, total_tokens, estimated_cost, currency, payload
  )
  SELECT
    p_user_id, item.payload->>'id',
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'timestamp', '')::double precision / 1000), pg_catalog.now()),
    COALESCE(NULLIF(item.payload->>'endpoint', ''), 'chat'),
    COALESCE(NULLIF(item.payload->>'endpointName', ''), 'AI利用'),
    COALESCE(NULLIF(item.payload->>'model', ''), 'unknown'),
    NULLIF(item.payload->>'provider', ''),
    NULLIF(item.payload->>'fallbackFrom', ''),
    COALESCE(NULLIF(item.payload->>'status', ''), 'unacquired'),
    NULLIF(item.payload->>'promptTokens', '')::bigint,
    NULLIF(item.payload->>'candidatesTokens', '')::bigint,
    NULLIF(item.payload->>'totalTokens', '')::bigint,
    NULLIF(item.payload->>'estimatedCost', '')::numeric,
    NULLIF(item.payload#>>'{rateSnapshot,currency}', ''),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_token_usage_records) AS item(payload)
  WHERE NULLIF(item.payload->>'id', '') IS NOT NULL
  ON CONFLICT (user_id, id) DO UPDATE SET
    occurred_at = EXCLUDED.occurred_at, endpoint = EXCLUDED.endpoint, endpoint_name = EXCLUDED.endpoint_name,
    model = EXCLUDED.model, provider = EXCLUDED.provider, fallback_from = EXCLUDED.fallback_from,
    status = EXCLUDED.status, prompt_tokens = EXCLUDED.prompt_tokens,
    candidates_tokens = EXCLUDED.candidates_tokens, total_tokens = EXCLUDED.total_tokens,
    estimated_cost = EXCLUDED.estimated_cost, currency = EXCLUDED.currency, payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_model_pricing (
    user_id, model, currency, input_price_per_million, output_price_per_million, updated_at, payload
  )
  SELECT
    p_user_id, item.payload->>'model',
    COALESCE(NULLIF(item.payload->>'currency', ''), 'JPY'),
    NULLIF(item.payload->>'inputPricePerMillion', '')::numeric,
    NULLIF(item.payload->>'outputPricePerMillion', '')::numeric,
    COALESCE(pg_catalog.to_timestamp(NULLIF(item.payload->>'updatedAt', '')::double precision / 1000), pg_catalog.now()),
    item.payload
  FROM pg_catalog.jsonb_array_elements(v_model_pricing) AS item(payload)
  WHERE NULLIF(item.payload->>'model', '') IS NOT NULL
  ON CONFLICT (user_id, model) DO UPDATE SET
    currency = EXCLUDED.currency, input_price_per_million = EXCLUDED.input_price_per_million,
    output_price_per_million = EXCLUDED.output_price_per_million,
    updated_at = EXCLUDED.updated_at, payload = EXCLUDED.payload;

  INSERT INTO public.mst_ai_chat_conversations (user_id, conversation_key, messages, updated_at)
  SELECT p_user_id, history.key, history.value, pg_catalog.now()
  FROM pg_catalog.jsonb_each(v_chat_histories) AS history(key, value)
  WHERE pg_catalog.jsonb_typeof(history.value) = 'array'
  ON CONFLICT (user_id, conversation_key) DO UPDATE SET
    messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at;

  DELETE FROM public.mst_ai_chat_conversations current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_each(v_chat_histories) AS desired(key, value)
      WHERE desired.key = current_row.conversation_key
    );
  DELETE FROM public.mst_ai_knowledge_items current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_knowledge_items) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_token_usage_records current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_token_usage_records) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_model_pricing current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_model_pricing) AS desired(payload)
      WHERE desired.payload->>'model' = current_row.model
    );

  DELETE FROM public.mst_ai_approvals current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_approvals) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_tasks current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_tasks) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_projects current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_projects) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_automation_rules current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_automation_rules) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );
  DELETE FROM public.mst_ai_activity_logs current_row
  WHERE current_row.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_activity_logs) AS desired(payload)
      WHERE desired.payload->>'id' = current_row.id
    );

  INSERT INTO public.mst_ai_operations_sync_state (user_id, migrated_at, updated_at)
  VALUES (p_user_id, pg_catalog.now(), pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mst_save_ai_operations(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, jsonb, text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mst_save_ai_operations(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, jsonb, text, jsonb, jsonb, jsonb, jsonb) TO authenticated;
