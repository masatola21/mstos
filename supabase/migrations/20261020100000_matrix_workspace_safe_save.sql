DROP FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.mst_save_matrix_workspace(
  p_user_id uuid,
  p_products jsonb,
  p_contracts jsonb,
  p_invoices jsonb,
  p_tools jsonb,
  p_custom_lists jsonb,
  p_marketing_scenarios jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_deleted_contract_ids text[] DEFAULT NULL,
  p_deleted_invoice_ids text[] DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mst_matrix_workspace_sync_state
    WHERE user_id = p_user_id AND updated_at IS DISTINCT FROM p_expected_updated_at
  ) THEN
    RAISE EXCEPTION 'WORKSPACE_CONFLICT' USING ERRCODE = '40001';
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

  DELETE FROM public.customer_invoices
  WHERE owner_id = p_user_id AND legacy_id = ANY(COALESCE(p_deleted_invoice_ids, ARRAY[]::text[]));

  UPDATE public.customer_service_engagements engagement
  SET contract_id = NULL
  WHERE engagement.owner_id = p_user_id
    AND engagement.contract_id IN (
      SELECT contract.id
      FROM public.customer_contracts contract
      WHERE contract.owner_id = p_user_id
        AND contract.legacy_id = ANY(COALESCE(p_deleted_contract_ids, ARRAY[]::text[]))
    );

  DELETE FROM public.customer_contracts
  WHERE owner_id = p_user_id AND legacy_id = ANY(COALESCE(p_deleted_contract_ids, ARRAY[]::text[]));

  INSERT INTO public.mst_matrix_workspace_sync_state (user_id, updated_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING updated_at INTO v_updated_at;

  RETURN v_updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mst_save_matrix_workspace(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text[], text[]) TO authenticated;
