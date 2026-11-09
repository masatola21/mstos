-- 受信箱（メール / LINE）のリアルタイム受信（Supabase Realtime）を有効にするための確認・設定SQL
--
-- 背景:
--   受信箱の画面は Supabase Realtime（postgres_changes）で新着を受け取ります。
--   対象テーブルが supabase_realtime の publication に入っていないと、通知が一切届かず、
--   画面側は30秒ごとのフォールバック（ポーリング）だけで動くことになります。
--
-- 使い方: Supabase の SQL Editor に貼り付けて実行してください。何度実行しても安全です（冪等）。

-- 1) 現在の状態を確認（2行返れば設定済み）
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('email_inbox_messages', 'line_inbox_messages')
ORDER BY tablename;

-- 2) 入っていなければ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'supabase_realtime publication is required for inbox realtime updates';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'email_inbox_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_inbox_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'line_inbox_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.line_inbox_messages;
  END IF;
END $$;

-- メモ: Realtime はテーブルのRLS（行レベルセキュリティ）に従って配信されます。
--       ログイン中のユーザーが SELECT できない行の通知は届きません。
