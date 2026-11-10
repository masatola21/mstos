-- ==============================================================================
-- ラウンド2: 公開配布資料レジストリ（public_materials）とリード流入元の正規化
-- ==============================================================================

-- 1. public_materials テーブルの作成
CREATE TABLE IF NOT EXISTS public.public_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '経営実務',
  file_path text,
  external_url text,
  public_url text NOT NULL,
  size_bytes bigint DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS設定
ALTER TABLE public.public_materials ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全操作可能（管理用）
DROP POLICY IF EXISTS "Authenticated users full access on public_materials" ON public.public_materials;
CREATE POLICY "Authenticated users full access on public_materials"
  ON public.public_materials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 匿名ユーザーはアクセス不可（HPはExpressサーバーの /api/public/materials 経由で取得）
DROP POLICY IF EXISTS "Anon no direct access on public_materials" ON public.public_materials;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.touch_public_materials_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_materials_updated_at ON public.public_materials;
CREATE TRIGGER trg_public_materials_updated_at
  BEFORE UPDATE ON public.public_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_public_materials_updated_at();

-- 2. Supabase Storage: materials バケットの作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf'];

-- Storage RLS ポリシー
-- 公開読み取り（誰でもダウンロード可能）
DROP POLICY IF EXISTS "Public materials are readable by anyone" ON storage.objects;
CREATE POLICY "Public materials are readable by anyone"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'materials');

-- 認証済みユーザーのみアップロード・更新・削除可能
DROP POLICY IF EXISTS "Authenticated users can manage materials files" ON storage.objects;
CREATE POLICY "Authenticated users can manage materials files"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'materials')
  WITH CHECK (bucket_id = 'materials');

-- 3. 初期資料2件の投入（既存のHP実体PDFを指すURLを初期値として設定）
INSERT INTO public.public_materials (key, label, description, category, external_url, public_url, is_active, sort_order)
VALUES
  (
    'management-guide',
    '経営改善実務ガイドブック（要点解説スライド）',
    '中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。',
    '経営実務・仕組み化',
    'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
    'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
    true,
    10
  ),
  (
    'care-package-overview',
    '介護保険外サービス開業パッケージ概要資料',
    '介護事業所・法人が保険外の自費収益柱（月30万〜100万円超）を最短で立ち上げるための実務手順。',
    '開業パッケージ',
    'https://corp.mstcorp.info/materials/care-package-overview.pdf',
    'https://corp.mstcorp.info/materials/care-package-overview.pdf',
    true,
    20
  )
ON CONFLICT (key) DO NOTHING;

-- 4. 既存リードの source 表記ゆれ正規化
-- 過去の「Web相談・問い合わせ（流入: corporate_website）」などの旧表記を整理
UPDATE public.leads
SET source = 'HP：お問い合わせ'
WHERE source ILIKE '%Web相談%' OR source ILIKE '%問い合わせ%' OR source = 'contact-inquiry';

UPDATE public.leads
SET source = 'HP：資料請求'
WHERE (source ILIKE '%資料請求%' OR source = 'material-download') AND source NOT ILIKE '%開業パッケージ%';

UPDATE public.leads
SET source = 'HP：経営診断'
WHERE source ILIKE '%診断%' OR source = 'business-diagnosis';

UPDATE public.leads
SET source = 'HP：開業パッケージ'
WHERE source ILIKE '%介護保険外%' OR source ILIKE '%開業パッケージ%' OR source = 'care-package-inquiry';

COMMENT ON TABLE public.public_materials IS 'OSおよび公式HPからダウンロード提供される公開PDF資料マスタ';
