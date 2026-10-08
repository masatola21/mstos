-- ==============================================================================
-- MST AI経営OS: Supabase Row Level Security (RLS) 推奨設定SQL
-- ==============================================================================
-- 【重要: アクセス権限のスコープについて】
-- 本設定で使用している `TO authenticated USING (true)` は、
-- Supabase Auth に招待・ログインしたすべての社内ユーザーが、全テーブルの
-- 全レコードを閲覧（SELECT）・登録（INSERT）・更新（UPDATE）できる
-- 「全社共有型（社内オープン）」のアクセス権限設定です。
-- （※未認証・外部一般ユーザー（anon）からのアクセスは完全に遮断されます）
--
-- 【注意】
-- 1. このSQLはテーブルの作成や既存データの削除・変更を行いません。
-- 2. DROP TABLE や DELETE などの破壊的な文は一切含まれていません。
-- 3. 実行は Supabase Dashboard の「SQL Editor」で手動実行してください。
-- ==============================================================================

-- 1. RLSの有効化（各テーブルでRLSを確実に有効化）
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

-- 2. 接続テスト用の不要な anon ポリシーの削除
-- 実際に作成済みのテストポリシー「anon_select_companies_for_test」を確実に削除し、
-- 未認証ユーザーへの情報露出を防止します。
DROP POLICY IF EXISTS "anon_select_companies_for_test" ON public.companies;
DROP POLICY IF EXISTS "Allow anon read companies" ON public.companies;
DROP POLICY IF EXISTS "Anon can select companies" ON public.companies;

-- 3. companies（会社マスタ）ポリシー
-- 認証済みユーザーの閲覧、新規登録、更新を許可（削除はアプリ運用上禁止）
DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
CREATE POLICY "Allow authenticated read companies"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert companies" ON public.companies;
CREATE POLICY "Allow authenticated insert companies"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update companies" ON public.companies;
CREATE POLICY "Allow authenticated update companies"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. prospects（見込み企業）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read prospects" ON public.prospects;
CREATE POLICY "Allow authenticated read prospects"
  ON public.prospects
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert prospects" ON public.prospects;
CREATE POLICY "Allow authenticated insert prospects"
  ON public.prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update prospects" ON public.prospects;
CREATE POLICY "Allow authenticated update prospects"
  ON public.prospects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. leads（リード）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read leads" ON public.leads;
CREATE POLICY "Allow authenticated read leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert leads" ON public.leads;
CREATE POLICY "Allow authenticated insert leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update leads" ON public.leads;
CREATE POLICY "Allow authenticated update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. products（商品マスタ）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read products" ON public.products;
CREATE POLICY "Allow authenticated read products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert products" ON public.products;
CREATE POLICY "Allow authenticated insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update products" ON public.products;
CREATE POLICY "Allow authenticated update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. deals（商談）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read deals" ON public.deals;
CREATE POLICY "Allow authenticated read deals"
  ON public.deals
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert deals" ON public.deals;
CREATE POLICY "Allow authenticated insert deals"
  ON public.deals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update deals" ON public.deals;
CREATE POLICY "Allow authenticated update deals"
  ON public.deals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. customers（顧客）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read customers" ON public.customers;
CREATE POLICY "Allow authenticated read customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert customers" ON public.customers;
CREATE POLICY "Allow authenticated insert customers"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update customers" ON public.customers;
CREATE POLICY "Allow authenticated update customers"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 以上で設定完了です。
-- ==============================================================================
