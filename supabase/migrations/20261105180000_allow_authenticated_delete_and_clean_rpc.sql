-- Migration: 20261105180000_allow_authenticated_delete_and_clean_rpc.sql
-- Purpose: 
--  1. Restore full SELECT & DELETE access on CRM tables for authenticated and anon roles
--  2. Add idempotent stored function public.clean_dummy_crm_data() for 1-click test data wipe in Supabase SQL Editor

BEGIN;

-- 1. 基本CRMテーブルへの権限付与（SELECT, INSERT, UPDATE, DELETE）
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products', 'companies', 'contacts', 'prospects', 'leads', 'deals',
    'customers', 'customer_contracts', 'customer_invoices', 'customer_documents',
    'customer_service_engagements', 'diagnoses', 'communication_outbox'
  ] LOOP
    -- RLS有効化確認
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- SELECT ポリシー
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow read ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', 'Allow read ' || tbl, tbl);

    -- INSERT ポリシー
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow insert ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (true)', 'Allow insert ' || tbl, tbl);

    -- UPDATE ポリシー
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow update ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (true) WITH CHECK (true)', 'Allow update ' || tbl, tbl);

    -- DELETE ポリシー
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow delete ' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (true)', 'Allow delete ' || tbl, tbl);

    -- ロール権限付与
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', tbl);
  END LOOP;
END $$;

-- 2. ダミーデータ・テストデータを依存関係順に安全に一括削除するRPC関数
CREATE OR REPLACE FUNCTION public.clean_dummy_crm_data(
  include_products boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb := '{}'::jsonb;
  cnt integer;
BEGIN
  -- 1. 最子階層の書類・請求・契約・業務支援
  DELETE FROM public.customer_documents;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{customer_documents}', to_jsonb(cnt));

  DELETE FROM public.customer_invoices;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{customer_invoices}', to_jsonb(cnt));

  DELETE FROM public.customer_contracts;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{customer_contracts}', to_jsonb(cnt));

  DELETE FROM public.customer_service_engagements;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{customer_service_engagements}', to_jsonb(cnt));

  -- 2. 診断・通信アウトボックス
  DELETE FROM public.diagnoses;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{diagnoses}', to_jsonb(cnt));

  DELETE FROM public.communication_outbox;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{communication_outbox}', to_jsonb(cnt));

  -- 3. 商談・リード・見込み
  DELETE FROM public.deals;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{deals}', to_jsonb(cnt));

  DELETE FROM public.leads;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{leads}', to_jsonb(cnt));

  DELETE FROM public.prospects;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{prospects}', to_jsonb(cnt));

  -- 4. 顧客・連絡先・法人
  DELETE FROM public.customers;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{customers}', to_jsonb(cnt));

  DELETE FROM public.contacts;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{contacts}', to_jsonb(cnt));

  DELETE FROM public.companies;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  res := jsonb_set(res, '{companies}', to_jsonb(cnt));

  -- 5. 商品マスタ（オプション指定時のみ）
  IF include_products THEN
    DELETE FROM public.products;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    res := jsonb_set(res, '{products}', to_jsonb(cnt));
  END IF;

  RETURN res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_dummy_crm_data(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_dummy_crm_data(boolean) TO anon;

COMMIT;
