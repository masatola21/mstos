-- 20261108110000_email_backup_forward_and_job_hidden.sql
-- 受信メールのバックアップ転送設定と配信ジョブ非表示管理列の追加

-- 1. メールチャネル連携にバックアップ転送（Gmail等へのコピー）設定を追加
ALTER TABLE public.email_channel_integrations
  ADD COLUMN IF NOT EXISTS backup_forward_address text,
  ADD COLUMN IF NOT EXISTS backup_forward_enabled boolean NOT NULL DEFAULT false;

-- 2. 受信メール控えの転送状態を記録する列を追加
ALTER TABLE public.email_inbox_messages
  ADD COLUMN IF NOT EXISTS backup_status text DEFAULT 'pending', -- 'sent', 'failed', 'skipped', 'pending'
  ADD COLUMN IF NOT EXISTS backup_error text,
  ADD COLUMN IF NOT EXISTS backup_sent_at timestamptz;

-- 3. 配信ジョブテーブルに取消済み整理用の非表示タイムスタンプを追加
-- （物理削除せず、on conflict による再作成防止フラグとして保持）
ALTER TABLE public.marketing_automation_jobs
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

CREATE INDEX IF NOT EXISTS marketing_automation_jobs_hidden_idx
  ON public.marketing_automation_jobs(owner_id, hidden_at)
  WHERE hidden_at IS NULL;

NOTIFY pgrst, 'reload schema';
