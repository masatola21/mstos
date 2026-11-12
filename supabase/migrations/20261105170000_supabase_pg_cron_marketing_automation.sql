-- ==============================================================================
-- 20261105170000_supabase_pg_cron_marketing_automation.sql
-- 
-- 【目的】
-- Vercel Hobbyプラン（1日1回制限）のCron制限を回避するため、
-- Supabaseの pg_cron と pg_net を使用して3分おきにVercelの自動配信エンドポイント
-- (/api/cron/marketing-automation) を定期呼び出し（Webhook実行）する。
-- 
-- 【セキュリティ配慮】
-- 1. 推奨（最も安全）: Supabase Vault に 'cron_secret' と 'app_cron_url' を暗号化保存。
-- 2. 簡易版: 下記の関数のデフォルト値に直接設定（Vaultが未設定の場合のフォールバック）。
-- ==============================================================================

-- 1. 必要な拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 定期呼び出し用ストアドプロシージャの作成
CREATE OR REPLACE FUNCTION public.invoke_marketing_automation_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, cron
AS $$
DECLARE
  v_url text := 'https://os.mstcorp.info/api/cron/marketing-automation'; -- ★ デフォルトURL（必要に応じて実際のVercelドメインに変更）
  v_secret text := '';                                                -- ★ デフォルトCRON_SECRET（直接指定する場合）
  v_vault_url text;
  v_vault_secret text;
  v_request_id bigint;
  v_headers jsonb;
BEGIN
  -- 1) Supabase Vault から安全にシークレットとURLを取得（存在する場合）
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets') THEN
      SELECT decrypted_secret INTO v_vault_secret 
      FROM vault.decrypted_secrets 
      WHERE name = 'cron_secret' 
      LIMIT 1;

      SELECT decrypted_secret INTO v_vault_url 
      FROM vault.decrypted_secrets 
      WHERE name = 'app_cron_url' 
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
      -- Vaultアクセス不可時はデフォルト値を使用
      NULL;
  END;

  -- 2) リクエストヘッダーの構築
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

  -- 3) pg_net による非同期POSTリクエスト送信
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'executed_at', now()
    ),
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_marketing_automation_cron() IS '3分おきにVercelのマーケティング自動配信キュー処理エンドポイントをPOST実行する関数';

-- 3. 既存の同名Cronジョブがあれば一度安全に登録解除
DO $$
BEGIN
  PERFORM cron.unschedule('invoke-marketing-automation-cron')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'invoke-marketing-automation-cron'
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 4. 3分おき（*/3 * * * *）の定期実行ジョブを登録
SELECT cron.schedule(
  'invoke-marketing-automation-cron',
  '*/3 * * * *',
  $$SELECT public.invoke_marketing_automation_cron();$$
);

-- ==============================================================================
-- 【初期設定ガイド（Supabase SQL Editorで実行する場合）】
-- 
-- 1. シークレットを最も安全に管理したい場合（Supabase Vault推奨）:
--    Supabaseの「Project Settings」>「Vault」またはSQL Editorで以下を実行してください:
-- 
--    -- CRON_SECRETの登録 (Vercel環境変数と同じ値)
--    SELECT vault.create_secret('YOUR_VERCEL_CRON_SECRET', 'cron_secret');
-- 
--    -- 本番URLの登録 (例: https://your-project.vercel.app/api/cron/marketing-automation)
--    SELECT vault.create_secret('https://os.mstcorp.info/api/cron/marketing-automation', 'app_cron_url');
-- 
-- 2. 手動テスト方法:
--    SELECT public.invoke_marketing_automation_cron();
--    SELECT * FROM net._http_response ORDER BY id DESC LIMIT 5;
-- 
-- 3. ジョブの稼働確認:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ==============================================================================
