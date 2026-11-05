-- ==============================================================================
-- Migration Proposal: 20261105150000_optimize_matrix_workspace_save_v2.sql
-- Description: Optimize mst_save_matrix_workspace by replacing full-table DELETE+INSERT
--              with differential UPSERT, explicit row-level locking (FOR UPDATE),
--              and conditional updates.
--
-- 【未検証の設計案】
-- 本ファイルは未検証の設計案です。supabase/migrations/ に戻す前にステージングで並行保存・削除のテストを行うこと。
-- 本番環境・ステージング環境のいずれのDBにも適用されていません（レビュー・検証用）。
--
-- 【トリガー発火に関する挙動変更の注記】
-- 本マイグレーションでは、customer_invoices および customer_contracts の UPSERT において
-- `WHERE table.payload IS DISTINCT FROM EXCLUDED.payload` を追加しています。
-- これにより、ペイロードに変更がない既存行に対しては UPDATE が実行されず、
-- customer_invoices / customer_contracts に紐づく BEFORE/AFTER UPDATE トリガー
-- （例: 請求ステータス変更トリガー等）が発火しなくなります。
-- 実質的なデータ変更時のみトリガーを走らせる意図的な最適化仕様です。
-- ==============================================================================

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

  -- 2. 楽観的ロック（同一トランザクション内で sync_state 行を SELECT ... FOR UPDATE で明示ロック）
  -- 行が存在しない場合（初回保存時）：v_current_updated_at は NULL となり競合チェックを安全に通過する
  SELECT updated_at INTO v_current_updated_at
  FROM public.mst_matrix_workspace_sync_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 【要検討1】p_expected_updated_at が NULL で sync_state の行が存在する場合も、WORKSPACE_CONFLICT にする案
  -- （例: IF v_current_updated_at IS NOT NULL AND (p_expected_updated_at IS NULL OR v_current_updated_at IS DISTINCT FROM p_expected_updated_at) THEN ...）
  IF v_current_updated_at IS NOT NULL AND p_expected_updated_at IS NOT NULL THEN
    IF v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'WORKSPACE_CONFLICT' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- 3. mst_managed_products: 引数が NULL でない場合のみ差分UPSERTおよび削除を実行
  -- （NULL は「更新対象外」、'[]'::jsonb は「全削除」として扱う）
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

  -- 4. mst_managed_tools: 引数が NULL でない場合のみ実行
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

  -- 5. mst_custom_list_definitions: 引数が NULL でない場合のみ実行
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

  -- 6. mst_marketing_scenarios: 引数が NULL でない場合のみ実行
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

  -- 7. customer_contracts: 変更がある場合のみUPDATE
  IF p_contracts IS NOT NULL THEN
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
      updated_at = now()
    WHERE customer_contracts.payload IS DISTINCT FROM EXCLUDED.payload;
  END IF;

  -- 8. customer_invoices: 変更がある場合のみUPDATE
  IF p_invoices IS NOT NULL THEN
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
      paid_at = EXCLUDED.paid_at, payload = EXCLUDED.payload, updated_at = now()
    WHERE customer_invoices.payload IS DISTINCT FROM EXCLUDED.payload;
  END IF;

  -- 9. 削除処理（明示的にID配列が渡された場合のみ実行）
  IF p_deleted_invoice_ids IS NOT NULL AND array_length(p_deleted_invoice_ids, 1) > 0 THEN
    DELETE FROM public.customer_invoices
    WHERE owner_id = p_user_id AND legacy_id = ANY(p_deleted_invoice_ids);
  END IF;

  IF p_deleted_contract_ids IS NOT NULL AND array_length(p_deleted_contract_ids, 1) > 0 THEN
    UPDATE public.customer_service_engagements engagement
    SET contract_id = NULL
    WHERE engagement.owner_id = p_user_id
      AND engagement.contract_id IN (
        SELECT contract.id
        FROM public.customer_contracts contract
        WHERE contract.owner_id = p_user_id
          AND contract.legacy_id = ANY(p_deleted_contract_ids)
      );

    DELETE FROM public.customer_contracts
    WHERE owner_id = p_user_id AND legacy_id = ANY(p_deleted_contract_ids);
  END IF;

  -- 10. sync_state の updated_at 更新
  -- 【要検討2】行が実際に変更されたときだけ sync_state.updated_at を更新する案（偽の競合の削減）
  -- （例: UPSERT / DELETE で実変更があった行数をカウントし、実変更ゼロなら updated_at を更新せず既存の値を返す案）
  INSERT INTO public.mst_matrix_workspace_sync_state (user_id, updated_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING updated_at INTO v_updated_at;

  RETURN v_updated_at;
END;
$$;

-- 【要検討3: 権限明示的剥奪案】
-- REVOKE EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text[], text[]) FROM PUBLIC;
-- REVOKE EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text[], text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text[], text[]) TO authenticated;
