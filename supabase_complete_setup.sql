-- ==============================================================================
-- MST AI経営OS: Supabase 完全セットアップSQL（全テーブル + RLS + 診断機能）
-- ==============================================================================
-- 【概要】
-- このSQLファイル1つで、アプリケーションに必要な全8テーブルと
-- RLSポリシー、トリガー、RPC関数を作成します。
-- Supabaseダッシュボードの「SQL Editor」でこのファイル全文を貼り付けて実行してください。
-- 既存テーブルが存在する場合はスキップし、既存データは保持されます（IF NOT EXISTS使用）。
-- 何度実行しても安全な冪等設計です。
--
-- 【前提条件】
-- - Supabase Authで「Disable Signups (Invite only)」を有効にすることを推奨
--   （社内専用システムのため、外部登録を防ぐ）
-- ==============================================================================

-- ==============================================================================
-- Part 1: 基本6テーブル作成
-- ==============================================================================

-- 1. companies（会社マスタ）
CREATE TABLE IF NOT EXISTS public.companies (
  id pg_catalog.text PRIMARY KEY,
  company_name pg_catalog.text NOT NULL,
  industry pg_catalog.text,
  contact_name pg_catalog.text,
  website pg_catalog.text,
  email pg_catalog.text,
  phone pg_catalog.text,
  social_account pg_catalog.text,
  postal_code pg_catalog.text,
  address pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- 2. prospects（見込み企業）
CREATE TABLE IF NOT EXISTS public.prospects (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source pg_catalog.text,
  approach_method pg_catalog.text,
  status pg_catalog.text,
  reply_flag pg_catalog.boolean,
  last_reply_at pg_catalog.timestamptz,
  registered_at pg_catalog.timestamptz,
  email_step pg_catalog.text,
  email_step_started_at pg_catalog.timestamptz,
  last_contacted_at pg_catalog.timestamptz,
  memo pg_catalog.text,
  ai_score pg_catalog.int4,
  ai_reason pg_catalog.text,
  target_flag pg_catalog.boolean,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- 3. leads（リード）
CREATE TABLE IF NOT EXISTS public.leads (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  line_user_id pg_catalog.text,
  source pg_catalog.text,
  service_type pg_catalog.text,
  status pg_catalog.text,
  priority_channel pg_catalog.text,
  first_registered_at pg_catalog.timestamptz,
  last_contacted_at pg_catalog.timestamptz,
  next_action_at pg_catalog.timestamptz,
  meeting_date pg_catalog.date,
  meeting_start_time pg_catalog.text,
  report_url pg_catalog.text,
  email_step pg_catalog.text,
  email_step_started_at pg_catalog.timestamptz,
  notes pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- 4. products（商品マスタ）
CREATE TABLE IF NOT EXISTS public.products (
  id pg_catalog.text PRIMARY KEY,
  product_name pg_catalog.text NOT NULL,
  product_type pg_catalog.text,
  initial_fee pg_catalog.int4,
  monthly_fee pg_catalog.int4,
  description pg_catalog.text,
  status pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- 5. deals（商談）
CREATE TABLE IF NOT EXISTS public.deals (
  id pg_catalog.text PRIMARY KEY,
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  lead_id pg_catalog.uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  meeting_date pg_catalog.date,
  next_followup_at pg_catalog.timestamptz,
  product_id pg_catalog.text REFERENCES public.products(id) ON DELETE SET NULL,
  proposal_plan_name pg_catalog.text NOT NULL,
  proposal_type pg_catalog.text,
  initial_fee pg_catalog.int4,
  monthly_fee pg_catalog.int4,
  discount_amount pg_catalog.int4,
  total_amount pg_catalog.int4,
  proposal_created pg_catalog.boolean,
  proposal_url pg_catalog.text,
  proposal_date pg_catalog.date,
  proposal_status pg_catalog.text,
  memo pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- 6. customers（顧客）
CREATE TABLE IF NOT EXISTS public.customers (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  contract_status pg_catalog.text,
  contract_start_date pg_catalog.date,
  last_updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  memo pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- ==============================================================================
-- Part 2: 基本6テーブルのインデックス
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_prospects_company_id ON public.prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON public.deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

-- ==============================================================================
-- Part 3: 基本6テーブルのRLS有効化
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Part 4: 基本6テーブルのRLSポリシー（社内認証ユーザー向け）
-- ==============================================================================

-- companies
DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
CREATE POLICY "Allow authenticated read companies"
  ON public.companies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert companies" ON public.companies;
CREATE POLICY "Allow authenticated insert companies"
  ON public.companies FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update companies" ON public.companies;
CREATE POLICY "Allow authenticated update companies"
  ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- prospects
DROP POLICY IF EXISTS "Allow authenticated read prospects" ON public.prospects;
CREATE POLICY "Allow authenticated read prospects"
  ON public.prospects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert prospects" ON public.prospects;
CREATE POLICY "Allow authenticated insert prospects"
  ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update prospects" ON public.prospects;
CREATE POLICY "Allow authenticated update prospects"
  ON public.prospects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- leads
DROP POLICY IF EXISTS "Allow authenticated read leads" ON public.leads;
CREATE POLICY "Allow authenticated read leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert leads" ON public.leads;
CREATE POLICY "Allow authenticated insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update leads" ON public.leads;
CREATE POLICY "Allow authenticated update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- products
DROP POLICY IF EXISTS "Allow authenticated read products" ON public.products;
CREATE POLICY "Allow authenticated read products"
  ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert products" ON public.products;
CREATE POLICY "Allow authenticated insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update products" ON public.products;
CREATE POLICY "Allow authenticated update products"
  ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- deals
DROP POLICY IF EXISTS "Allow authenticated read deals" ON public.deals;
CREATE POLICY "Allow authenticated read deals"
  ON public.deals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert deals" ON public.deals;
CREATE POLICY "Allow authenticated insert deals"
  ON public.deals FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update deals" ON public.deals;
CREATE POLICY "Allow authenticated update deals"
  ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- customers
DROP POLICY IF EXISTS "Allow authenticated read customers" ON public.customers;
CREATE POLICY "Allow authenticated read customers"
  ON public.customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert customers" ON public.customers;
CREATE POLICY "Allow authenticated insert customers"
  ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update customers" ON public.customers;
CREATE POLICY "Allow authenticated update customers"
  ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- Part 5: updated_at 自動更新トリガー（基本テーブル用）
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_set_updated_at ON public.companies;
CREATE TRIGGER trg_companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prospects_set_updated_at ON public.prospects;
CREATE TRIGGER trg_prospects_set_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_set_updated_at ON public.leads;
CREATE TRIGGER trg_leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON public.products;
CREATE TRIGGER trg_products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_deals_set_updated_at ON public.deals;
CREATE TRIGGER trg_deals_set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- Part 6: 診断テーブル（diagnoses）＆ AIレポートテーブル（ai_reports）
-- ==============================================================================

-- 診断テーブル
CREATE TABLE IF NOT EXISTS public.diagnoses (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  lead_id pg_catalog.uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  diagnosis_type pg_catalog.text NOT NULL DEFAULT 'standard',
  status pg_catalog.text NOT NULL DEFAULT 'draft',
  questionnaire_version pg_catalog.text NOT NULL DEFAULT 'v1.0',
  answers pg_catalog.jsonb NOT NULL DEFAULT '{}'::jsonb,
  score pg_catalog.int4 NULL,
  category_scores pg_catalog.jsonb NULL,
  memo pg_catalog.text NULL,
  conducted_at pg_catalog.timestamptz NULL,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT chk_diagnoses_status CHECK (
    status IN ('draft', 'in_progress', 'completed', 'generating', 'reported')
  ),
  CONSTRAINT chk_diagnoses_score CHECK (
    score IS NULL OR (score >= 0 AND score <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_company_id ON public.diagnoses(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_lead_id ON public.diagnoses(lead_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON public.diagnoses(status);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON public.diagnoses(diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON public.diagnoses(created_at DESC);

-- AIレポートテーブル
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id pg_catalog.uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE RESTRICT,
  version pg_catalog.int4 NOT NULL DEFAULT 1,
  is_latest pg_catalog.bool NOT NULL DEFAULT false,
  status pg_catalog.text NOT NULL DEFAULT 'pending',
  title pg_catalog.text NOT NULL DEFAULT 'AI経営診断レポート',
  model_name pg_catalog.text NOT NULL,
  prompt_version pg_catalog.text NOT NULL,
  summary pg_catalog.text NULL,
  strengths pg_catalog.jsonb NULL,
  challenges pg_catalog.jsonb NULL,
  recommendations pg_catalog.jsonb NULL,
  recommended_product_id pg_catalog.text NULL REFERENCES public.products(id) ON DELETE SET NULL,
  full_report_text pg_catalog.text NULL,
  storage_path pg_catalog.text NULL,
  error_message pg_catalog.text NULL,
  generated_at pg_catalog.timestamptz NULL,
  reviewed_at pg_catalog.timestamptz NULL,
  reviewed_by pg_catalog.text NULL,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT chk_ai_reports_version CHECK (version >= 1),
  CONSTRAINT chk_ai_reports_status CHECK (
    status IN ('pending', 'generating', 'generated', 'superseded', 'failed', 'reviewed')
  ),
  CONSTRAINT chk_ai_reports_latest_status CHECK (
    NOT (is_latest = true) OR (status IN ('generated', 'reviewed'))
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_diagnosis_id ON public.ai_reports(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON public.ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_product_id ON public.ai_reports(recommended_product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_one_latest_per_diagnosis
  ON public.ai_reports (diagnosis_id) WHERE (is_latest = true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_diagnosis_version
  ON public.ai_reports (diagnosis_id, version);

-- ==============================================================================
-- Part 7: 診断・レポートのトリガー関数
-- ==============================================================================

-- updated_at自動更新（診断・レポート用）
CREATE OR REPLACE FUNCTION public.set_mst_phase1c_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diagnoses_set_updated_at ON public.diagnoses;
CREATE TRIGGER trg_diagnoses_set_updated_at
  BEFORE UPDATE ON public.diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();

DROP TRIGGER IF EXISTS trg_ai_reports_set_updated_at ON public.ai_reports;
CREATE TRIGGER trg_ai_reports_set_updated_at
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();

-- 会社・リード整合性検証トリガー
CREATE OR REPLACE FUNCTION public.check_diagnosis_company_lead_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lead_company_id pg_catalog.text;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT company_id INTO v_lead_company_id
    FROM public.leads WHERE id = NEW.lead_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '整合性エラー: 指定されたリード (id: %) が leads テーブルに存在しません', NEW.lead_id;
    END IF;
    IF v_lead_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION '整合性エラー: 診断の対象会社 (id: %) とリードの所属会社 (id: %) が一致していません',
        NEW.company_id, v_lead_company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_diagnosis_company_lead_match ON public.diagnoses;
CREATE TRIGGER trg_check_diagnosis_company_lead_match
  BEFORE INSERT OR UPDATE OF company_id, lead_id ON public.diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.check_diagnosis_company_lead_match();

-- 完了済み診断の回答・スコア直接変更禁止トリガー
CREATE OR REPLACE FUNCTION public.prevent_reported_diagnosis_content_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('reported', 'generating') THEN
    IF (NEW.answers IS DISTINCT FROM OLD.answers) OR
       (NEW.score IS DISTINCT FROM OLD.score) OR
       (NEW.category_scores IS DISTINCT FROM OLD.category_scores) OR
       (NEW.conducted_at IS DISTINCT FROM OLD.conducted_at) OR
       (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR
       (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR
       (NEW.company_id IS DISTINCT FROM OLD.company_id) OR
       (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
      RAISE EXCEPTION '確定診断の変更禁止: レポート発行中・発行済み（%）の診断は、回答内容・スコア・基本情報を直接編集できません。新しい回答で診断を行う場合は、新規診断を作成してください。',
        OLD.status;
    END IF;
  END IF;

  IF OLD.status = 'completed' THEN
    IF NEW.status = 'completed' THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR
         (NEW.score IS DISTINCT FROM OLD.score) OR
         (NEW.category_scores IS DISTINCT FROM OLD.category_scores) OR
         (NEW.conducted_at IS DISTINCT FROM OLD.conducted_at) OR
         (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR
         (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR
         (NEW.company_id IS DISTINCT FROM OLD.company_id) OR
         (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '回答完了済み（completed）診断の直接変更禁止: 回答内容や基本情報を修正する場合は、先にステータスを draft または in_progress に差し戻してください。';
      END IF;
    ELSIF NEW.status IN ('draft', 'in_progress') THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR
         (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR
         (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR
         (NEW.company_id IS DISTINCT FROM OLD.company_id) OR
         (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '差し戻し整合性エラー: 差し戻し時はスコアおよび実施完了日時のリセットのみが許可されます。';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reported_diagnosis_content_update ON public.diagnoses;
CREATE TRIGGER trg_prevent_reported_diagnosis_content_update
  BEFORE UPDATE OF answers, score, category_scores, conducted_at, questionnaire_version, diagnosis_type, company_id, lead_id ON public.diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_reported_diagnosis_content_update();

-- ai_reports改ざん防止トリガー
CREATE OR REPLACE FUNCTION public.guard_ai_reports_direct_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.diagnosis_id <> NEW.diagnosis_id THEN
    RAISE EXCEPTION '改ざん防止エラー: レポートの紐付け先診断 (diagnosis_id) を変更することはできません';
  END IF;
  IF OLD.version <> NEW.version THEN
    RAISE EXCEPTION '改ざん防止エラー: version の直接変更は禁止されています';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ai_reports_direct_update ON public.ai_reports;
CREATE TRIGGER trg_guard_ai_reports_direct_update
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_reports_direct_update();

-- ==============================================================================
-- Part 8: RPC関数（状態遷移・レポート生成・レビュー）
-- ==============================================================================

-- 診断ステータス更新RPC
CREATE OR REPLACE FUNCTION public.update_diagnosis_status(
  p_diagnosis_id pg_catalog.uuid,
  p_status pg_catalog.text
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_status pg_catalog.text;
  v_questionnaire_version pg_catalog.text;
  v_answers pg_catalog.jsonb;
  v_conducted_at pg_catalog.timestamptz;
  v_required_keys pg_catalog.text[];
  v_missing_keys pg_catalog.text[];
BEGIN
  IF p_status NOT IN ('draft', 'in_progress', 'completed') THEN
    RAISE EXCEPTION '不正なステータス変更要求: 手動で変更可能なステータスは draft, in_progress, completed のみです（要求: %）', p_status;
  END IF;

  SELECT status, questionnaire_version, answers, conducted_at
  INTO v_current_status, v_questionnaire_version, v_answers, v_conducted_at
  FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  IF v_current_status = p_status THEN
    RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'previous_status', v_current_status, 'new_status', p_status, 'message', 'ステータスに変更はありません');
  END IF;

  IF v_current_status = 'generating' THEN
    RAISE EXCEPTION '現在AIレポート生成処理中のため、診断ステータスを変更することはできません';
  END IF;

  IF v_current_status = 'reported' THEN
    RAISE EXCEPTION 'レポート発行済み（reported）の診断ステータスを % に戻すことはできません。再診断を行う場合は新しい診断を起票してください。', p_status;
  END IF;

  IF NOT (
    (v_current_status = 'draft' AND p_status IN ('in_progress', 'completed')) OR
    (v_current_status = 'in_progress' AND p_status IN ('draft', 'completed')) OR
    (v_current_status = 'completed' AND p_status IN ('draft', 'in_progress'))
  ) THEN
    RAISE EXCEPTION '不正な状態遷移です: % から % への遷移は許可されていません', v_current_status, p_status;
  END IF;

  IF p_status = 'completed' THEN
    IF v_answers IS NULL OR pg_catalog.jsonb_typeof(v_answers) != 'object' THEN
      RAISE EXCEPTION '完了遷移エラー: 回答データ (answers) がオブジェクト形式で存在しません (diagnosis_id: %)', p_diagnosis_id;
    END IF;

    CASE v_questionnaire_version
      WHEN 'v1.0' THEN v_required_keys := ARRAY[]::pg_catalog.text[];
      ELSE v_required_keys := ARRAY[]::pg_catalog.text[];
    END CASE;

    IF v_required_keys IS NULL OR pg_catalog.array_length(v_required_keys, 1) IS NULL OR pg_catalog.array_length(v_required_keys, 1) = 0 THEN
      RAISE EXCEPTION '完了遷移エラー: 設問バージョン % の必須設問定義が確定していないため、完了（completed）に遷移できません。設問仕様の必須キー一覧を確定・登録してください。', v_questionnaire_version;
    END IF;

    SELECT pg_catalog.array_agg(k) INTO v_missing_keys
    FROM pg_catalog.unnest(v_required_keys) AS k
    WHERE (v_answers -> k) IS NULL OR (v_answers -> k) = 'null'::jsonb
       OR (pg_catalog.jsonb_typeof(v_answers -> k) = 'string' AND pg_catalog.btrim(v_answers ->> k) = '');

    IF v_missing_keys IS NOT NULL AND pg_catalog.array_length(v_missing_keys, 1) > 0 THEN
      RAISE EXCEPTION '完了遷移エラー: 設問バージョン % の必須回答項目が不足しています (未回答項目: %)', v_questionnaire_version, pg_catalog.array_to_string(v_missing_keys, ', ');
    END IF;

    UPDATE public.diagnoses SET status = 'completed', conducted_at = COALESCE(v_conducted_at, pg_catalog.now()), updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;

  ELSIF v_current_status = 'completed' AND p_status IN ('draft', 'in_progress') THEN
    UPDATE public.diagnoses SET status = p_status, conducted_at = NULL, score = NULL, category_scores = NULL, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;

  ELSE
    UPDATE public.diagnoses SET status = p_status, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'previous_status', v_current_status, 'new_status', p_status);
END;
$$;

-- レポート生成開始RPC
CREATE OR REPLACE FUNCTION public.create_ai_report_draft(
  p_diagnosis_id pg_catalog.uuid,
  p_model_name pg_catalog.text,
  p_prompt_version pg_catalog.text,
  p_title pg_catalog.text DEFAULT 'AI経営診断レポート'
)
RETURNS pg_catalog.uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_diagnosis_status pg_catalog.text;
  v_next_version pg_catalog.int4;
  v_new_report_id pg_catalog.uuid;
BEGIN
  SELECT status INTO v_diagnosis_status FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;
  IF v_diagnosis_status NOT IN ('completed', 'reported') THEN
    RAISE EXCEPTION '診断ステータスが「%」のため、レポート生成を開始できません（completed または reported のみ許可）', v_diagnosis_status;
  END IF;

  SELECT COALESCE(pg_catalog.max(version), 0) + 1 INTO v_next_version
  FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id;

  INSERT INTO public.ai_reports (diagnosis_id, version, is_latest, status, title, model_name, prompt_version)
  VALUES (p_diagnosis_id, v_next_version, false, 'generating', COALESCE(p_title, 'AI経営診断レポート'), p_model_name, p_prompt_version)
  RETURNING id INTO v_new_report_id;

  UPDATE public.diagnoses SET status = 'generating', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  RETURN v_new_report_id;
END;
$$;

-- レポート生成完了・有効化RPC
CREATE OR REPLACE FUNCTION public.complete_and_activate_ai_report(
  p_report_id pg_catalog.uuid,
  p_diagnosis_id pg_catalog.uuid,
  p_summary pg_catalog.text,
  p_strengths pg_catalog.jsonb,
  p_challenges pg_catalog.jsonb,
  p_recommendations pg_catalog.jsonb,
  p_full_report_text pg_catalog.text,
  p_storage_path pg_catalog.text DEFAULT NULL,
  p_recommended_product_id pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report_status pg_catalog.text;
  v_report_diagnosis_id pg_catalog.uuid;
  v_target_version pg_catalog.int4;
  v_current_latest_version pg_catalog.int4;
  v_current_latest_id pg_catalog.uuid;
BEGIN
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id; END IF;

  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません', p_report_id, p_diagnosis_id;
  END IF;
  IF v_report_status <> 'generating' THEN
    RAISE EXCEPTION 'ステータスが generating 以外のレポート (現在: %) は完了処理できません', v_report_status;
  END IF;

  SELECT id, version INTO v_current_latest_id, v_current_latest_version
  FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id AND is_latest = true;
  IF v_current_latest_id IS NOT NULL AND v_current_latest_id <> p_report_id THEN
    IF v_target_version < v_current_latest_version THEN
      RAISE EXCEPTION '最新版の巻き戻し防止: 有効化対象レポートのバージョン(v%)は、現在の最新版(v%)より古いため最新版にできません', v_target_version, v_current_latest_version;
    END IF;
  END IF;

  UPDATE public.ai_reports SET is_latest = false, status = CASE WHEN status = 'reviewed' THEN 'reviewed' ELSE 'superseded' END, updated_at = pg_catalog.now()
  WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND id <> p_report_id;

  UPDATE public.ai_reports SET
    status = 'generated', is_latest = true, summary = p_summary, strengths = p_strengths,
    challenges = p_challenges, recommendations = p_recommendations, full_report_text = p_full_report_text,
    storage_path = p_storage_path, recommended_product_id = p_recommended_product_id,
    generated_at = pg_catalog.now(), updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  UPDATE public.diagnoses SET status = 'reported', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'activated_report_id', p_report_id, 'version', v_target_version, 'status', 'generated');
END;
$$;

-- レビュー承認RPC
CREATE OR REPLACE FUNCTION public.review_ai_report(
  p_report_id pg_catalog.uuid,
  p_diagnosis_id pg_catalog.uuid
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report_status pg_catalog.text;
  v_report_diagnosis_id pg_catalog.uuid;
  v_target_version pg_catalog.int4;
  v_reviewer_id pg_catalog.text;
BEGIN
  v_reviewer_id := auth.uid()::pg_catalog.text;
  IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN
    RAISE EXCEPTION '認証エラー: ログイン中のユーザー情報を取得できませんでした。';
  END IF;

  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id; END IF;

  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません', p_report_id, p_diagnosis_id;
  END IF;
  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN
    RAISE EXCEPTION 'ステータスが % のレポートはレビューできません', v_report_status;
  END IF;

  UPDATE public.ai_reports SET status = 'reviewed', reviewed_at = pg_catalog.now(), reviewed_by = v_reviewer_id, updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'report_id', p_report_id, 'version', v_target_version, 'status', 'reviewed', 'reviewed_by', v_reviewer_id);
END;
$$;

-- 最新版再有効化RPC
CREATE OR REPLACE FUNCTION public.activate_ai_report(
  p_report_id pg_catalog.uuid,
  p_diagnosis_id pg_catalog.uuid,
  p_mark_as_reviewed pg_catalog.bool DEFAULT false
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report_status pg_catalog.text;
  v_report_diagnosis_id pg_catalog.uuid;
  v_target_version pg_catalog.int4;
  v_reviewer_id pg_catalog.text;
BEGIN
  IF p_mark_as_reviewed IS TRUE THEN
    v_reviewer_id := auth.uid()::pg_catalog.text;
    IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN
      RAISE EXCEPTION '認証エラー: ログイン中のユーザー情報を取得できませんでした。';
    END IF;
  END IF;

  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id; END IF;

  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません', p_report_id, p_diagnosis_id;
  END IF;
  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN
    RAISE EXCEPTION 'ステータスが % のレポートは最新版に切り替えられません', v_report_status;
  END IF;

  UPDATE public.ai_reports SET is_latest = false, status = CASE WHEN status = 'reviewed' THEN 'reviewed' ELSE 'superseded' END, updated_at = pg_catalog.now()
  WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND id <> p_report_id;

  UPDATE public.ai_reports SET
    is_latest = true,
    status = CASE WHEN p_mark_as_reviewed IS TRUE THEN 'reviewed' WHEN status = 'superseded' THEN 'generated' ELSE status END,
    reviewed_at = CASE WHEN p_mark_as_reviewed IS TRUE THEN pg_catalog.now() ELSE reviewed_at END,
    reviewed_by = CASE WHEN p_mark_as_reviewed IS TRUE THEN v_reviewer_id ELSE reviewed_by END,
    updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  UPDATE public.diagnoses SET status = 'reported', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'activated_report_id', p_report_id, 'version', v_target_version, 'status', CASE WHEN p_mark_as_reviewed IS TRUE THEN 'reviewed' ELSE 'generated' END);
END;
$$;

-- 生成失敗時RPC
CREATE OR REPLACE FUNCTION public.handle_ai_report_failure(
  p_report_id pg_catalog.uuid,
  p_diagnosis_id pg_catalog.uuid,
  p_error_message pg_catalog.text
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report_status pg_catalog.text;
  v_report_diagnosis_id pg_catalog.uuid;
  v_has_valid_latest pg_catalog.bool;
BEGIN
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id; END IF;

  SELECT diagnosis_id, status INTO v_report_diagnosis_id, v_report_status FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません', p_report_id, p_diagnosis_id;
  END IF;
  IF v_report_status <> 'generating' THEN
    RAISE EXCEPTION 'ステータスが generating 以外のレポート (現在: %) は失敗処理できません', v_report_status;
  END IF;

  UPDATE public.ai_reports SET status = 'failed', is_latest = false, error_message = p_error_message, updated_at = pg_catalog.now()
  WHERE id = p_report_id AND diagnosis_id = p_diagnosis_id;

  SELECT EXISTS (SELECT 1 FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND status IN ('generated', 'reviewed')) INTO v_has_valid_latest;

  UPDATE public.diagnoses SET status = CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'diagnosis_id', p_diagnosis_id, 'failed_report_id', p_report_id, 'restored_diagnosis_status', CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END);
END;
$$;

-- ==============================================================================
-- Part 9: RPC実行権限（authenticated限定）
-- ==============================================================================
REVOKE ALL ON FUNCTION public.update_diagnosis_status(pg_catalog.uuid, pg_catalog.text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_diagnosis_status(pg_catalog.uuid, pg_catalog.text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_diagnosis_status(pg_catalog.uuid, pg_catalog.text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_ai_report_draft(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ai_report_draft(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_ai_report_draft(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.text) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_and_activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_and_activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.text, pg_catalog.text, pg_catalog.text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_and_activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.jsonb, pg_catalog.text, pg_catalog.text, pg_catalog.text) TO authenticated;

REVOKE ALL ON FUNCTION public.review_ai_report(pg_catalog.uuid, pg_catalog.uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_ai_report(pg_catalog.uuid, pg_catalog.uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_ai_report(pg_catalog.uuid, pg_catalog.uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bool) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bool) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_ai_report(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bool) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_ai_report_failure(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_ai_report_failure(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text) FROM anon;
GRANT EXECUTE ON FUNCTION public.handle_ai_report_failure(pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text) TO authenticated;

-- ==============================================================================
-- Part 10: 診断・レポートテーブルのRLSと列レベル権限
-- ==============================================================================
REVOKE ALL ON TABLE public.diagnoses FROM anon;
REVOKE ALL ON TABLE public.ai_reports FROM anon;

-- diagnoses: SELECT許可、INSERT/UPDATEはstatus除外
REVOKE ALL ON TABLE public.diagnoses FROM authenticated;
GRANT SELECT ON TABLE public.diagnoses TO authenticated;
GRANT INSERT (id, company_id, lead_id, diagnosis_type, questionnaire_version, answers, score, category_scores, memo, conducted_at) ON TABLE public.diagnoses TO authenticated;
GRANT UPDATE (company_id, lead_id, diagnosis_type, questionnaire_version, answers, score, category_scores, memo, conducted_at) ON TABLE public.diagnoses TO authenticated;

-- ai_reports: SELECT許可、INSERT禁止、UPDATEは業務列のみ
REVOKE ALL ON TABLE public.ai_reports FROM authenticated;
GRANT SELECT ON TABLE public.ai_reports TO authenticated;
GRANT UPDATE (title, summary, strengths, challenges, recommendations, recommended_product_id, full_report_text, storage_path) ON TABLE public.ai_reports TO authenticated;

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated read diagnoses"
  ON public.diagnoses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated insert diagnoses"
  ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated update diagnoses"
  ON public.diagnoses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated read ai_reports"
  ON public.ai_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert ai_reports" ON public.ai_reports;

DROP POLICY IF EXISTS "Allow authenticated update ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated update ai_reports"
  ON public.ai_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- Part 11: Storage バケット（レポートPDF保存用・非公開）
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mst_reports_storage_authenticated_select" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "mst_reports_storage_authenticated_insert" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] IS NOT NULL);

-- ==============================================================================
-- Part 12: スキーマコメント
-- ==============================================================================
COMMENT ON COLUMN public.prospects.last_contacted_at IS '最終接触日時';
COMMENT ON COLUMN public.deals.proposal_plan_name IS '提案プラン名・商談名';
COMMENT ON COLUMN public.deals.total_amount IS '想定商談総額 (円)';
COMMENT ON COLUMN public.customers.last_updated_at IS '顧客レコード最終更新日時';

-- Part 13: AI社長・Matrixのユーザー別クラウド保存
CREATE TABLE IF NOT EXISTS public.mst_workspace_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mst_workspace_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own workspace state" ON public.mst_workspace_state;
CREATE POLICY "Users can read their own workspace state"
  ON public.mst_workspace_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own workspace state" ON public.mst_workspace_state;
CREATE POLICY "Users can insert their own workspace state"
  ON public.mst_workspace_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own workspace state" ON public.mst_workspace_state;
CREATE POLICY "Users can update their own workspace state"
  ON public.mst_workspace_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.mst_workspace_state TO authenticated;

-- ==============================================================================
-- 完了
-- ==============================================================================

