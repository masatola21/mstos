-- 20261108100000_public_materials_columns_and_unique_path.sql
-- 配布資料テーブルの不足列の追加および Storage file_path 重複防止インデックス

-- [事前確認用SELECT]
-- もし本番DBで file_path に重複データが存在する場合、インデックス作成がエラーとなります。
-- 以下のクエリで重複件数が 0 件であることを確認した上でマイグレーションを実行してください。
-- SELECT file_path, count(*) FROM public.public_materials WHERE file_path IS NOT NULL GROUP BY file_path HAVING count(*) > 1;

-- 1. 既存の public.public_materials テーブルに必要な列を安全に追加
ALTER TABLE public.public_materials
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text DEFAULT '経営実務',
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. 同一の file_path（Storageオブジェクト）を別資料が二重参照・上書きする事故を防ぐ一意インデックス
CREATE UNIQUE INDEX IF NOT EXISTS public_materials_file_path_key
  ON public.public_materials (file_path)
  WHERE file_path IS NOT NULL;

-- 3. PostgREST のスキーマキャッシュを再読み込み
NOTIFY pgrst, 'reload schema';
