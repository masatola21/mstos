-- Move Matrix operating data out of the compatibility workspace JSON.
-- The payload preserves the complete UI model; selected columns support filtering and relationships.
CREATE TABLE IF NOT EXISTS public.mst_matrix_workspace_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mst_managed_products (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  code text,
  status text NOT NULL DEFAULT 'active',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS public.mst_managed_tools (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  category text,
  tool_type text,
  status text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS public.mst_custom_list_definitions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  category text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS public.mst_marketing_scenarios (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  trigger text,
  status text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE public.customer_contracts ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE public.customer_contracts ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.customer_invoices ADD COLUMN IF NOT EXISTS payload jsonb;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'mst_matrix_workspace_sync_state',
    'mst_managed_products',
    'mst_managed_tools',
    'mst_custom_list_definitions',
    'mst_marketing_scenarios'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'Users manage own ' || table_name, table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_mst_products_user_status ON public.mst_managed_products(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mst_tools_user_category ON public.mst_managed_tools(user_id, category);
CREATE INDEX IF NOT EXISTS idx_mst_marketing_scenarios_user_trigger ON public.mst_marketing_scenarios(user_id, trigger);

-- Preserve full Matrix records in the already-relational sales tables too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contracts_legacy_id
  ON public.customer_contracts(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_invoices_legacy_id
  ON public.customer_invoices(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;

INSERT INTO public.mst_managed_products (user_id, id, name, code, status, payload)
SELECT ws.user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
       NULLIF(item->>'code',''), COALESCE(NULLIF(item->>'status',''), 'active'), item
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'products','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.mst_managed_tools (user_id, id, name, category, tool_type, status, payload)
SELECT ws.user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
       NULLIF(item->>'category',''), NULLIF(item->>'toolType',''), NULLIF(item->>'status',''), item
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'tools','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.mst_custom_list_definitions (user_id, id, name, category, payload)
SELECT ws.user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
       NULLIF(item->>'category',''), item
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'customLists','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.mst_marketing_scenarios (user_id, id, name, trigger, status, payload)
SELECT ws.user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
       NULLIF(item->>'trigger',''), NULLIF(item->>'status',''), item
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'marketingScenarios','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (user_id, id) DO NOTHING;

-- Attach the original full model to rows previously imported into contract/invoice tables.
UPDATE public.customer_contracts c SET payload = item, document_url = NULLIF(item->>'documentUrl','')
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'contracts','[]'::jsonb)) item
WHERE c.owner_id = ws.user_id AND c.legacy_id = item->>'id' AND c.payload IS NULL;

UPDATE public.customer_invoices i SET payload = item
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'invoices','[]'::jsonb)) item
WHERE i.owner_id = ws.user_id AND i.legacy_id = item->>'id' AND i.payload IS NULL;

INSERT INTO public.mst_matrix_workspace_sync_state (user_id)
SELECT user_id FROM public.mst_workspace_state
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mst_save_matrix_workspace(
  p_user_id uuid,
  p_products jsonb,
  p_contracts jsonb,
  p_invoices jsonb,
  p_tools jsonb,
  p_custom_lists jsonb,
  p_marketing_scenarios jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  DELETE FROM public.mst_managed_products WHERE user_id = p_user_id;
  INSERT INTO public.mst_managed_products (user_id, id, name, code, status, payload, updated_at)
  SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
         NULLIF(item->>'code',''), COALESCE(NULLIF(item->>'status',''), 'active'), item, now()
  FROM jsonb_array_elements(COALESCE(p_products,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL;

  DELETE FROM public.mst_managed_tools WHERE user_id = p_user_id;
  INSERT INTO public.mst_managed_tools (user_id, id, name, category, tool_type, status, payload, updated_at)
  SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
         NULLIF(item->>'category',''), NULLIF(item->>'toolType',''), NULLIF(item->>'status',''), item, now()
  FROM jsonb_array_elements(COALESCE(p_tools,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL;

  DELETE FROM public.mst_custom_list_definitions WHERE user_id = p_user_id;
  INSERT INTO public.mst_custom_list_definitions (user_id, id, name, category, payload)
  SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
         NULLIF(item->>'category',''), item
  FROM jsonb_array_elements(COALESCE(p_custom_lists,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL;

  DELETE FROM public.mst_marketing_scenarios WHERE user_id = p_user_id;
  INSERT INTO public.mst_marketing_scenarios (user_id, id, name, trigger, status, payload, updated_at)
  SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
         NULLIF(item->>'trigger',''), NULLIF(item->>'status',''), item, now()
  FROM jsonb_array_elements(COALESCE(p_marketing_scenarios,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL;

  DELETE FROM public.customer_invoices i
  WHERE i.owner_id = p_user_id AND i.legacy_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_invoices,'[]'::jsonb)) item WHERE item->>'id' = i.legacy_id);
  DELETE FROM public.customer_contracts c
  WHERE c.owner_id = p_user_id AND c.legacy_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_contracts,'[]'::jsonb)) item WHERE item->>'id' = c.legacy_id);

  INSERT INTO public.customer_contracts
    (owner_id, legacy_id, title, counterparty_name, contract_type, status, company_id, product_id, amount, start_date, end_date, notes, document_url, payload, created_at, updated_at)
  SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'title',''), '契約'),
         NULLIF(item->>'counterpartyName',''), COALESCE(NULLIF(item->>'type',''), 'service_agreement'),
         CASE WHEN item->>'status' IN ('draft','under_review','sent','signed','expired','canceled') THEN item->>'status' ELSE 'draft' END,
         NULLIF(item->>'companyId',''), NULLIF(item->>'productId',''),
         COALESCE(NULLIF(item->>'amount','')::numeric, 0),
         NULLIF(item->>'startDate','')::date, NULLIF(item->>'endDate','')::date,
         NULLIF(item->>'notes',''), NULLIF(item->>'documentUrl',''), item,
         CASE WHEN COALESCE(item->>'createdAt','') ~ '^[0-9]{13}$' THEN to_timestamp((item->>'createdAt')::double precision / 1000) ELSE now() END,
         now()
  FROM jsonb_array_elements(COALESCE(p_contracts,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL
  ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
    title = EXCLUDED.title, counterparty_name = EXCLUDED.counterparty_name,
    contract_type = EXCLUDED.contract_type, status = EXCLUDED.status,
    company_id = EXCLUDED.company_id, product_id = EXCLUDED.product_id,
    amount = EXCLUDED.amount, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    notes = EXCLUDED.notes, document_url = EXCLUDED.document_url, payload = EXCLUDED.payload,
    updated_at = now();

  INSERT INTO public.customer_invoices
    (owner_id, legacy_id, invoice_number, title, recipient_name, status, company_id, product_id, amount, tax_amount, notes, issue_date, due_date, paid_at, payload, created_at, updated_at)
  SELECT p_user_id, item->>'id',
         COALESCE(NULLIF(item->>'invoiceNumber',''), 'LEGACY-' || left(item->>'id', 24)),
         COALESCE(NULLIF(item->>'title',''), '請求'),
         NULLIF(item->>'recipientName',''),
         CASE WHEN item->>'status' IN ('draft','awaiting_approval','issued','paid','overdue','canceled') THEN item->>'status' ELSE 'draft' END,
         NULLIF(item->>'companyId',''), NULLIF(item->>'productId',''),
         COALESCE(NULLIF(item->>'amount','')::numeric, 0), NULLIF(item->>'taxAmount','')::numeric,
         NULLIF(item->>'notes',''), NULLIF(item->>'issueDate','')::date,
         NULLIF(item->>'dueDate','')::date, NULLIF(item->>'paidDate','')::date, item,
         CASE WHEN COALESCE(item->>'createdAt','') ~ '^[0-9]{13}$' THEN to_timestamp((item->>'createdAt')::double precision / 1000) ELSE now() END,
         now()
  FROM jsonb_array_elements(COALESCE(p_invoices,'[]'::jsonb)) item
  WHERE NULLIF(item->>'id','') IS NOT NULL
  ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
    invoice_number = EXCLUDED.invoice_number, title = EXCLUDED.title,
    recipient_name = EXCLUDED.recipient_name, status = EXCLUDED.status,
    company_id = EXCLUDED.company_id, product_id = EXCLUDED.product_id,
    amount = EXCLUDED.amount, tax_amount = EXCLUDED.tax_amount,
    notes = EXCLUDED.notes, issue_date = EXCLUDED.issue_date, due_date = EXCLUDED.due_date,
    paid_at = EXCLUDED.paid_at, payload = EXCLUDED.payload, updated_at = now();

  INSERT INTO public.mst_matrix_workspace_sync_state (user_id, updated_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
