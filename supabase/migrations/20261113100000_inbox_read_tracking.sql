-- 統合受信トレイ（メール・LINE）の既読/未読管理用マイグレーション
-- 1. email_inbox_messages に既読フラグと既読日時を追加
alter table public.email_inbox_messages
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz;

comment on column public.email_inbox_messages.is_read is 'メールの既読状態: false(未読) / true(閲覧済み)';
comment on column public.email_inbox_messages.read_at is 'メールを閲覧した日時';

create index if not exists email_inbox_messages_owner_unread_idx
  on public.email_inbox_messages(owner_id, is_read, received_at desc);

-- 2. line_inbox_messages の未読集計を高速化するためのインデックス
-- （status カラム自体は既存: 'received' = 未読 / 'read' = 既読 / 'sent' = 送信済み）
create index if not exists idx_line_inbox_messages_owner_direction_status
  on public.line_inbox_messages(owner_id, direction, status, received_at desc);
