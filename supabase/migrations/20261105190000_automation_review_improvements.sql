-- ==============================================================================
-- 20261105190000_automation_review_improvements.sql
-- 
-- 【Claude自動化レビュー対応】
-- 1. 緊急停止（キルスイッチ）管理テーブル: automation_controls
-- 2. marketing_automation_jobs の指数バックオフ用 retry_count 列追加
-- 3. DBトリガーの auth.uid() 依存解消（サービスロール・Webhook・Cronからの書き込み対応）
-- 4. 毎日朝9時（JST / UTC 0:00）実行の請求自動化 cron ジョブ (pg_cron)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. 緊急停止（キルスイッチ）テーブル
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_controls (
  id text PRIMARY KEY,
  target text NOT NULL CHECK (target IN ('all', 'ai', 'send', 'billing')),
  paused boolean NOT NULL DEFAULT false,
  reason text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS設定
ALTER TABLE public.automation_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read automation_controls" ON public.automation_controls;
CREATE POLICY "Allow read automation_controls" ON public.automation_controls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update automation_controls" ON public.automation_controls;
CREATE POLICY "Allow update automation_controls" ON public.automation_controls FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_controls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_controls TO anon;

-- 初期データ投入（全体キルスイッチ: 稼働中）
INSERT INTO public.automation_controls (id, target, paused, reason, updated_by, updated_at)
VALUES ('all', 'all', false, '通常稼働中', 'system', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.automation_controls (id, target, paused, reason, updated_by, updated_at)
VALUES ('ai', 'ai', false, '通常稼働中', 'system', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.automation_controls (id, target, paused, reason, updated_by, updated_at)
VALUES ('send', 'send', false, '通常稼働中', 'system', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.automation_controls (id, target, paused, reason, updated_by, updated_at)
VALUES ('billing', 'billing', false, '通常稼働中', 'system', now())
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 2. marketing_automation_jobs のリトライ管理列
-- ------------------------------------------------------------------------------
ALTER TABLE public.marketing_automation_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.marketing_automation_jobs
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;


-- ------------------------------------------------------------------------------
-- 3. DBトリガーの auth.uid() 依存解消
-- サービスロールやWebhook、Cronジョブ等 auth.uid() が NULL の場合でも、
-- シナリオ登録者（または管理者）に帰属させてジョブを正常生成する。
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.queue_marketing_scenarios_for_event(
  p_contact uuid, p_company text, p_record jsonb, p_table text,
  p_event text, p_matching_trigger text, p_event_time text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_owner uuid;
  v_scenario_owner_found boolean := false;
BEGIN
  IF p_table = 'communication_outbox' THEN
    BEGIN 
      v_owner := NULLIF(p_record->>'owner_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN 
      RETURN; 
    END;
    IF v_owner IS NOT NULL THEN
      PERFORM public.queue_marketing_scenarios_text(v_owner, p_contact, p_company, p_record, p_table, p_event, p_matching_trigger, p_event_time);
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    -- ログインユーザー操作時
    PERFORM public.queue_marketing_scenarios_text(auth.uid(), p_contact, p_company, p_record, p_table, p_event, p_matching_trigger, p_event_time);
  ELSE
    -- 【改善】WebhookやService Role等 auth.uid() is null の場合
    -- 該当トリガーが有効化されている全シナリオのオーナーに対してジョブを生成
    FOR v_owner IN
      SELECT DISTINCT owner_id FROM public.marketing_automation_scenarios
      WHERE coalesce((config->>'automationEnabled')::boolean,false)
        AND coalesce(config->>'status','')='prepared'
        AND coalesce(config->>'trigger','')=p_matching_trigger
        AND coalesce(config->>'consentBasis','')<>''
    LOOP
      v_scenario_owner_found := true;
      PERFORM public.queue_marketing_scenarios_text(v_owner, p_contact, p_company, p_record, p_table, p_event, p_matching_trigger, p_event_time);
    END LOOP;

    -- もしシナリオオーナーが見つからなかった場合のフォールバック（最初の管理者オーナー）
    IF NOT v_scenario_owner_found THEN
      SELECT owner_id INTO v_owner FROM public.marketing_automation_scenarios WHERE owner_id IS NOT NULL LIMIT 1;
      IF v_owner IS NULL THEN
        SELECT id INTO v_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;
      END IF;
      IF v_owner IS NOT NULL THEN
        PERFORM public.queue_marketing_scenarios_text(v_owner, p_contact, p_company, p_record, p_table, p_event, p_matching_trigger, p_event_time);
      END IF;
    END IF;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 4. 請求のスケジュール実行（pg_cron & pg_net 連携）
-- 毎日朝9時（JST / UTC 0:00）に /api/cron/billing-automation を実行
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_billing_automation_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, cron
AS $$
DECLARE
  v_url text := 'https://os.mstcorp.info/api/cron/billing-automation';
  v_secret text := '';
  v_vault_url text;
  v_vault_secret text;
  v_request_id bigint;
  v_headers jsonb;
BEGIN
  -- Supabase Vault からシークレットを取得
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets') THEN
      SELECT decrypted_secret INTO v_vault_secret 
      FROM vault.decrypted_secrets 
      WHERE name = 'cron_secret' 
      LIMIT 1;

      SELECT decrypted_secret INTO v_vault_url 
      FROM vault.decrypted_secrets 
      WHERE name = 'app_cron_billing_url' 
      LIMIT 1;

      IF v_vault_secret IS NOT NULL AND v_vault_secret <> '' THEN
        v_secret := v_vault_secret;
      END IF;

      IF v_vault_url IS NOT NULL AND v_vault_url <> '' THEN
        v_url := v_vault_url;
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    );
  ELSE
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json'
    );
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := jsonb_build_object(
      'source', 'supabase_pg_cron_billing',
      'executed_at', now()
    ),
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_billing_automation_cron() IS '毎日9時(JST)に定期請求下書き生成と期限超過督促タスク起票を実行する関数';

-- 既存Cronジョブがあれば再登録
DO $$
BEGIN
  PERFORM cron.unschedule('invoke-billing-automation-cron')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'invoke-billing-automation-cron'
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- UTC 0:00（JST 9:00）に毎日1回実行
SELECT cron.schedule(
  'invoke-billing-automation-cron',
  '0 0 * * *',
  $$SELECT public.invoke_billing_automation_cron();$$
);

COMMIT;
