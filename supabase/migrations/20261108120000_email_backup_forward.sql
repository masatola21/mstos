-- 2-8-6: 受信メールのバックアップ転送（Gmailへのコピー）
-- 1. email_channel_integrations にバックアップ転送先・有効化フラグを追加
alter table public.email_channel_integrations
  add column if not exists backup_forward_address text,
  add column if not exists backup_forward_enabled boolean not null default false;

comment on column public.email_channel_integrations.backup_forward_address is '受信メールの控えを自動転送するバックアップ先メールアドレス（個人のGmail等）';
comment on column public.email_channel_integrations.backup_forward_enabled is 'バックアップ転送機能の有効/無効フラグ（既定: false）';

-- 2. email_inbox_messages に転送ステータス・エラー詳細を追加
alter table public.email_inbox_messages
  add column if not exists backup_status text not null default 'skipped',
  add column if not exists backup_error text;

-- 既存の制約があれば安全に再定義
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_inbox_messages_backup_status_check'
  ) then
    alter table public.email_inbox_messages
      add constraint email_inbox_messages_backup_status_check
      check (backup_status in ('sent', 'failed', 'skipped'));
  end if;
end $$;

comment on column public.email_inbox_messages.backup_status is 'バックアップ先への転送状態: sent(転送済) / failed(転送失敗) / skipped(対象外または無効)';
comment on column public.email_inbox_messages.backup_error is 'バックアップ転送失敗時のエラーメッセージ';

create index if not exists email_inbox_messages_backup_status_idx
  on public.email_inbox_messages(owner_id, backup_status);
