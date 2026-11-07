-- ==============================================================================
-- Migration: 20261107060000_round1_prevent_deletion_resurrection.sql
-- Description:
--   1. Add won_automation_completed_at to deals to prevent deal-won automation
--      from re-creating deleted contracts, invoices, and documents.
--   2. Update mst_save_matrix_workspace to safely handle customer_invoices and
--      customer_contracts UPSERT without 23505 invoice_number unique constraint
--      violations (fixing the root cause of "同期エラー").
--   3. Ensure idempotent execution (IF NOT EXISTS / DROP ... IF EXISTS).
-- ==============================================================================

-- 1. deals テーブルに成約自動化完了日時カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'won_automation_completed_at'
  ) THEN
    ALTER TABLE public.deals ADD COLUMN won_automation_completed_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- 既存の成約済み商談で、既に契約レコードが存在するものは won_automation_completed_at を付与
UPDATE public.deals d
SET won_automation_completed_at = COALESCE(d.updated_at, now())
WHERE d.stage = '成約'
  AND d.won_automation_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customer_contracts c
    WHERE c.deal_id = d.id
  );

-- 2. customer_contracts と customer_invoices の legacy_id 索引を確実に整備
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contracts_legacy_id
  ON public.customer_contracts(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_invoices_legacy_id
  ON public.customer_invoices(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;

-- 3. mst_save_matrix_workspace を改修（差分更新・invoice_number競合防止・同期エラー解消）
CREATE OR REPLACE FUNCTION public.mst_save_matrix_workspace(
  p_user_id uuid,
  p_products jsonb DEFAULT NULL,
  p_contracts jsonb DEFAULT NULL,
  p_invoices jsonb DEFAULT NULL,
  p_tools jsonb DEFAULT NULL,
  p_custom_lists jsonb DEFAULT NULL,
  p_marketing_scenarios jsonb DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_deleted_contract_ids text[] DEFAULT NULL,
  p_deleted_invoice_ids text[] DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_updated_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  -- 1. 認証チェック
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  -- 2. 楽観的ロック
  SELECT updated_at INTO v_current_updated_at
  FROM public.mst_matrix_workspace_sync_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_updated_at IS NOT NULL AND p_expected_updated_at IS NOT NULL THEN
    IF v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'WORKSPACE_CONFLICT' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- 3. mst_managed_products
  IF p_products IS NOT NULL THEN
    INSERT INTO public.mst_managed_products (user_id, id, name, code, status, payload, updated_at)
    SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
           NULLIF(item->>'code',''), COALESCE(NULLIF(item->>'status',''), 'active'), item, now()
    FROM jsonb_array_elements(p_products) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      status = EXCLUDED.status,
      payload = EXCLUDED.payload,
      updated_at = now()
    WHERE mst_managed_products.payload IS DISTINCT FROM EXCLUDED.payload;

    DELETE FROM public.mst_managed_products
    WHERE user_id = p_user_id
      AND id NOT IN (
        SELECT item->>'id'
        FROM jsonb_array_elements(p_products) item
        WHERE NULLIF(item->>'id','') IS NOT NULL
      );
  END IF;

  -- 4. mst_managed_tools
  IF p_tools IS NOT NULL THEN
    INSERT INTO public.mst_managed_tools (user_id, id, name, category, tool_type, status, payload, updated_at)
    SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
           NULLIF(item->>'category',''), NULLIF(item->>'toolType',''), NULLIF(item->>'status',''), item, now()
    FROM jsonb_array_elements(p_tools) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      tool_type = EXCLUDED.tool_type,
      status = EXCLUDED.status,
      payload = EXCLUDED.payload,
      updated_at = now()
    WHERE mst_managed_tools.payload IS DISTINCT FROM EXCLUDED.payload;

    DELETE FROM public.mst_managed_tools
    WHERE user_id = p_user_id
      AND id NOT IN (
        SELECT item->>'id'
        FROM jsonb_array_elements(p_tools) item
        WHERE NULLIF(item->>'id','') IS NOT NULL
      );
  END IF;

  -- 5. mst_custom_list_definitions
  IF p_custom_lists IS NOT NULL THEN
    INSERT INTO public.mst_custom_list_definitions (user_id, id, name, category, payload)
    SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
           NULLIF(item->>'category',''), item
    FROM jsonb_array_elements(p_custom_lists) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      payload = EXCLUDED.payload
    WHERE mst_custom_list_definitions.payload IS DISTINCT FROM EXCLUDED.payload;

    DELETE FROM public.mst_custom_list_definitions
    WHERE user_id = p_user_id
      AND id NOT IN (
        SELECT item->>'id'
        FROM jsonb_array_elements(p_custom_lists) item
        WHERE NULLIF(item->>'id','') IS NOT NULL
      );
  END IF;

  -- 6. mst_marketing_scenarios
  IF p_marketing_scenarios IS NOT NULL THEN
    INSERT INTO public.mst_marketing_scenarios (user_id, id, name, trigger, status, payload, updated_at)
    SELECT p_user_id, item->>'id', COALESCE(NULLIF(item->>'name',''), '名称未設定'),
           NULLIF(item->>'trigger',''), NULLIF(item->>'status',''), item, now()
    FROM jsonb_array_elements(p_marketing_scenarios) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      trigger = EXCLUDED.trigger,
      status = EXCLUDED.status,
      payload = EXCLUDED.payload,
      updated_at = now()
    WHERE mst_marketing_scenarios.payload IS DISTINCT FROM EXCLUDED.payload;

    DELETE FROM public.mst_marketing_scenarios
    WHERE user_id = p_user_id
      AND id NOT IN (
        SELECT item->>'id'
        FROM jsonb_array_elements(p_marketing_scenarios) item
        WHERE NULLIF(item->>'id','') IS NOT NULL
      );
  END IF;

  -- 7. customer_contracts
  IF p_contracts IS NOT NULL THEN
    -- A) 既存の legacy_id が NULL の契約レコードに、自身が該当行であれば legacy_id を補完
    UPDATE public.customer_contracts c
    SET legacy_id = c.id::text
    WHERE c.owner_id = p_user_id
      AND c.legacy_id IS NULL;

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
    FROM jsonb_array_elements(p_contracts) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
      title = EXCLUDED.title, counterparty_name = EXCLUDED.counterparty_name,
      contract_type = EXCLUDED.contract_type, status = EXCLUDED.status,
      company_id = EXCLUDED.company_id, product_id = EXCLUDED.product_id,
      amount = EXCLUDED.amount, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
      notes = EXCLUDED.notes, document_url = EXCLUDED.document_url, payload = EXCLUDED.payload,
      updated_at = now();
  END IF;

  -- 8. customer_invoices
  IF p_invoices IS NOT NULL THEN
    -- A) 既存の legacy_id が NULL の請求レコードに、自身が該当行であれば legacy_id を補完
    UPDATE public.customer_invoices inv
    SET legacy_id = inv.id::text
    WHERE inv.owner_id = p_user_id
      AND inv.legacy_id IS NULL;

    -- B) invoice_number 重複による 23505 を防ぐため、すでに同じ invoice_number を持ちながら
    --    legacy_id が異なる既存行があれば legacy_id を同期
    UPDATE public.customer_invoices inv
    SET legacy_id = item->>'id'
    FROM jsonb_array_elements(p_invoices) item
    WHERE inv.owner_id = p_user_id
      AND NULLIF(item->>'id','') IS NOT NULL
      AND NULLIF(item->>'invoiceNumber','') IS NOT NULL
      AND inv.invoice_number = item->>'invoiceNumber'
      AND inv.legacy_id IS DISTINCT FROM (item->>'id');

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
    FROM jsonb_array_elements(p_invoices) item
    WHERE NULLIF(item->>'id','') IS NOT NULL
    ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE SET
      invoice_number = EXCLUDED.invoice_number, title = EXCLUDED.title,
      recipient_name = EXCLUDED.recipient_name, status = EXCLUDED.status,
      company_id = EXCLUDED.company_id, product_id = EXCLUDED.product_id,
      amount = EXCLUDED.amount, tax_amount = EXCLUDED.tax_amount,
      notes = EXCLUDED.notes, issue_date = EXCLUDED.issue_date, due_date = EXCLUDED.due_date,
      paid_at = EXCLUDED.paid_at, payload = EXCLUDED.payload, updated_at = now();
  END IF;

  -- 9. 削除処理
  IF p_deleted_invoice_ids IS NOT NULL AND array_length(p_deleted_invoice_ids, 1) > 0 THEN
    DELETE FROM public.customer_invoices
    WHERE owner_id = p_user_id AND (legacy_id = ANY(p_deleted_invoice_ids) OR id::text = ANY(p_deleted_invoice_ids));
  END IF;

  IF p_deleted_contract_ids IS NOT NULL AND array_length(p_deleted_contract_ids, 1) > 0 THEN
    UPDATE public.customer_service_engagements engagement
    SET contract_id = NULL
    WHERE engagement.owner_id = p_user_id
      AND engagement.contract_id IN (
        SELECT contract.id
        FROM public.customer_contracts contract
        WHERE contract.owner_id = p_user_id
          AND (contract.legacy_id = ANY(p_deleted_contract_ids) OR contract.id::text = ANY(p_deleted_contract_ids))
      );

    DELETE FROM public.customer_contracts
    WHERE owner_id = p_user_id AND (legacy_id = ANY(p_deleted_contract_ids) OR id::text = ANY(p_deleted_contract_ids));
  END IF;

  -- 10. sync_state の updated_at 更新
  INSERT INTO public.mst_matrix_workspace_sync_state (user_id, updated_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING updated_at INTO v_updated_at;

  RETURN v_updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text[], text[]) TO authenticated;
