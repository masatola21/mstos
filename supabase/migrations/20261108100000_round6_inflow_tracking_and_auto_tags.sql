-- ==============================================================================
-- Migration: 20261108100000_round6_inflow_tracking_and_auto_tags.sql
-- Description: ラウンド6 流入計測・タグ自動付与・媒体別追跡リンクのDB基盤
-- ==============================================================================

-- 1. line_friend_tags の (line_friend_id, tag_id) ユニークインデックス保証
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_friend_tags_unique_pair
ON line_friend_tags (line_friend_id, tag_id);

-- 2. contact_tags の name インデックス
CREATE INDEX IF NOT EXISTS idx_contact_tags_name_lookup
ON contact_tags (name);

-- 3. 標準マスタータグの初期シード（存在しない場合のみ安全に挿入）
INSERT INTO contact_tags (name, color)
VALUES
  ('診断受検済み', '#10B981'),
  ('資料請求', '#8B5CF6'),
  ('個別相談予約済み', '#6366F1'),
  ('相談実施済み', '#A855F7'),
  ('流入:SNS', '#6366F1'),
  ('流入:HPブログ', '#10B981'),
  ('流入:LINE', '#059669'),
  ('流入:メール', '#0284C7'),
  ('流入:資料', '#D97706'),
  ('流入:Threads', '#0F172A'),
  ('流入:Facebook', '#1D4ED8'),
  ('流入:LinkedIn', '#0284C7'),
  ('流入:Instagram', '#DB2777'),
  ('流入:X', '#0F172A')
ON CONFLICT (name) DO NOTHING;

-- 4. line_friend_tags の assigned_by カラム確認
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'line_friend_tags' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE line_friend_tags ADD COLUMN assigned_by TEXT DEFAULT 'operator';
  END IF;
END $$;
