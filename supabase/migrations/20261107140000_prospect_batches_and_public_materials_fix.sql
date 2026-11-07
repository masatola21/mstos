-- ==============================================================================
-- 20261107140000_prospect_batches_and_public_materials_fix.sql
--
-- 1. 見込み企業 AI調査リスト取込バッチ管理テーブル: prospect_import_batches
-- 2. prospects テーブルの拡張 (import_batch_id, email, opted_out, contact_person, source_url)
-- 3. public_materials テーブルの size_bytes 列追加とスキーマリロード
-- ==============================================================================

BEGIN;

-- 1. 取込バッチ管理テーブル
CREATE TABLE IF NOT EXISTS public.prospect_import_batches (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_ai text NOT NULL DEFAULT 'ChatGPT',
  item_count integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all read prospect_import_batches" ON public.prospect_import_batches;
CREATE POLICY "Allow all read prospect_import_batches"
  ON public.prospect_import_batches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert prospect_import_batches" ON public.prospect_import_batches;
CREATE POLICY "Allow authenticated insert prospect_import_batches"
  ON public.prospect_import_batches FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_import_batches TO anon;

-- 2. prospects テーブルの営業・オプトアウト・バッチ列拡張
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS import_batch_id text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS opted_out boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS source_url text;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_prospects_import_batch_id ON public.prospects(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON public.prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_opted_out ON public.prospects(opted_out);

-- 3. public_materials テーブルの size_bytes 列保証
ALTER TABLE public.public_materials
  ADD COLUMN IF NOT EXISTS size_bytes bigint DEFAULT 0;

-- 4. PostgREST スキーマキャッシュの更新通知
NOTIFY pgrst, 'reload schema';

COMMIT;
