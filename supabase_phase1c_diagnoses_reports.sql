-- ==============================================================================
-- MST AI経営OS: Phase 1-C 診断（diagnoses）＆ AIレポート（ai_reports）
-- テーブル定義・制約・整合性トリガー・競合防止RPC・RLS設定 SQL（修正版 v4）
-- ==============================================================================
-- 【重要事項・設計方針】
-- 1. 本SQLは設計案のレビュー用ファイルです。現時点ではSupabase上で実行していません。
-- 2. 全体を BEGIN; ... COMMIT; の単一トランザクションで実行します。
--    先頭のStorage安全検査で異常（publicバケット等）を検知した場合は即時ロールバックされ、
--    テーブルやトリガー等の作成は一切行われません。
-- 3. 既存の6テーブル（companies, prospects, leads, products, deals, customers）に対する
--    ALTER / DROP / DELETE 等の変更は一切行いません。既存データへの影響はゼロです。
-- 4. 承認済み設計案の列名・ステータス名に完全準拠しています。
--    （diagnoses: diagnosis_type, category_scores, memo, conducted_at）
--    （ai_reports: title, recommendations, recommended_product_id, full_report_text）
--    ※既存 products.id (text) に合わせ、recommended_product_id は pg_catalog.text 型です。
-- 5. 【不正改ざん防止・完全RPCカプセル化（最小権限の徹底）】
--    - ai_reports への直接 INSERT 権限は authenticated に付与せず、
--      新規レポート作成は create_ai_report_draft RPC（SECURITY DEFINER）に限定。
--    - diagnoses の UPDATE 権限は設問・メモ等の業務列に限定し、status 列の直接変更を禁止。
--      回答ステータス遷移（draft / in_progress / completed）は update_diagnosis_status RPC 経由に限定。
--    - ai_reports の UPDATE 権限から status, is_latest, version に加え、
--      reviewed_at, reviewed_by を除外。
--      レビュー承認および最新化は review_ai_report / activate_ai_report RPC 経由に限定。
-- 6. 【RLSアクセス権限と社内限定運用の前提】
--    本システムは社内専用システムであり、RLSは authenticated（ログイン社員）に
--    対してオープンに設定されています。
--    ※外部からの一般登録を防ぐため、Supabase Auth 設定で「Disable Signups (Invite only)」
--      が有効になっていることを確認してから実行してください。
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Storage（レポートPDF保存バケット `reports`）安全検査＆初期化（最優先実行）
-- ------------------------------------------------------------------------------
-- [1. バケット存在チェックと安全確認]
-- 既に同名バケットが存在し、かつ public = true（公開設定）の場合は
-- 企業の機密診断・レポート漏洩を防ぐため、即座に例外を送出してトランザクション全体を安全停止（ロールバック）
DO $$
DECLARE
  v_is_public pg_catalog.bool;
BEGIN
  SELECT public INTO v_is_public
  FROM storage.buckets
  WHERE id = 'reports';

  IF FOUND AND v_is_public = true THEN
    RAISE EXCEPTION '安全停止エラー: reports バケットが既に「公開(public)」として存在しています。機密保護のため自動処理は行いません。Supabaseダッシュボードにて非公開(private)に変更するか、確認の上手動で設定を変更してください。';
  END IF;
END;
$$;

-- バケットが存在しない場合は private (public = false) として新規作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- [2. Storage ポリシー設定（専用名により他バケットとの名前重複・上書きを防止）]
-- 閲覧・署名付きURL発行権限（authenticated のみ、privateバケット内の安全な参照）
DROP POLICY IF EXISTS "mst_reports_storage_authenticated_select" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'reports');

-- アップロード権限（authenticated のみ、フォルダ指定必須）
DROP POLICY IF EXISTS "mst_reports_storage_authenticated_insert" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] IS NOT NULL
  );

-- 【削除・更新制限】
-- 過去のレポートファイル改ざんや誤削除を防ぐため、UPDATE / DELETE ポリシーは作成せず完全拒否


-- ------------------------------------------------------------------------------
-- 1. 共通トリガー関数（updated_at自動更新：名前衝突防止のため専用命名）
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 2. 診断テーブル（diagnoses）
-- ------------------------------------------------------------------------------
-- 【列名・型：承認済み設計案に完全準拠】
-- - diagnosis_type: 診断種別（例: 'standard', 'comprehensive', 'quick'）
-- - category_scores: 設問カテゴリ別スコア（JSONB）
-- - memo: 社内共有用メモ（TEXT）
-- - conducted_at: 診断実施日時（TIMESTAMPTZ）
--
-- 【ステータス設計】
-- draft: 下書き（設問回答途中）
-- in_progress: 診断実施中（ヒアリング中）
-- completed: 回答完了（レポート生成待ち）
-- generating: AIレポート生成処理中（RPC経由でのみ遷移）
-- reported: 最新AIレポート生成完了・閲覧可能（RPC経由でのみ遷移）
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

  -- ステータス値の厳密な制約
  CONSTRAINT chk_diagnoses_status CHECK (
    status IN ('draft', 'in_progress', 'completed', 'generating', 'reported')
  ),

  -- 総合スコア（0〜100点または未算出NULL）の制約
  CONSTRAINT chk_diagnoses_score CHECK (
    score IS NULL OR (score >= 0 AND score <= 100)
  )
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_diagnoses_company_id ON public.diagnoses(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_lead_id ON public.diagnoses(lead_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON public.diagnoses(status);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON public.diagnoses(diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON public.diagnoses(created_at DESC);

-- updated_at 自動更新トリガー
DROP TRIGGER IF EXISTS trg_diagnoses_set_updated_at ON public.diagnoses;
CREATE TRIGGER trg_diagnoses_set_updated_at
  BEFORE UPDATE ON public.diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mst_phase1c_updated_at();


-- ------------------------------------------------------------------------------
-- 3. 会社とリードの整合性担保＆確定診断の凍結トリガー（既存6テーブルには変更を加えない方式）
-- ------------------------------------------------------------------------------
-- [3-A. 会社とリードの紐付け検証トリガー]
-- 診断に lead_id が指定された場合、そのリードの company_id が
-- 診断の company_id と完全に一致しているかを検証します。
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
    FROM public.leads
    WHERE id = NEW.lead_id;

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
  FOR EACH ROW
  EXECUTE FUNCTION public.check_diagnosis_company_lead_match();


-- [3-B. 完了済み（completed）およびレポート発行済み（reported）診断の回答・スコア直接変更禁止トリガー]
-- 回答完了（completed）またはレポート発行済み（reported）の診断レコードに対して、回答内容（answers）や
-- スコア（score, category_scores）が直接書き換えられると、算出済みスコアや実施完了日時、
-- あるいは発行済みAIレポート（ai_reports）との整合性が破壊されます。
-- これを防止するため、completed, reported, generating 状態の診断に対して answers, score, category_scores,
-- conducted_at, questionnaire_version, diagnosis_type, company_id, lead_id の直接UPDATEをデータベース層で拒否（エラー送出）します。
--
-- 【差し戻しRPC（update_diagnosis_status）との連動設計】
-- diagnoses テーブルの status 列に対する直接UPDATE権限は一般ユーザーに付与されておらず、
-- status を変更できるのは SECURITY DEFINER RPC のみです。
-- したがって、通常の直接UPDATEでは常に OLD.status = 'completed' かつ NEW.status = 'completed' となります。
-- このトリガーでは：
-- 1) completed のまま行われる回答・スコア・基本情報の直接UPDATEはすべて拒否。
-- 2) update_diagnosis_status RPC による completed -> draft / in_progress への差し戻し時
--    （NEW.status IN ('draft', 'in_progress')）に限り、スコア・完了日時の初期化（score=NULL, category_scores=NULL, conducted_at=NULL）を許可。
--    ただし差し戻しと同時に回答内容や基本情報が書き換えられることは防止。
-- 3) reported, generating からの更新は引き続き完全凍結。
-- ※社内共有メモ memo の追記・修正は完了後も自由に可能です。
CREATE OR REPLACE FUNCTION public.prevent_reported_diagnosis_content_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. レポート発行中・発行済み（generating / reported）は回答・スコア・基本情報の変更を完全凍結
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

  -- 2. 回答完了済み（completed）診断の制御
  -- status 列の更新権限は authenticated に付与されていないため、
  -- クライアントからの通常の直接編集では常に OLD.status = 'completed' かつ NEW.status = 'completed' となります。
  IF OLD.status = 'completed' THEN
    -- A. ステータスが completed のまま行われる直接編集はすべて拒否
    IF NEW.status = 'completed' THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR
         (NEW.score IS DISTINCT FROM OLD.score) OR
         (NEW.category_scores IS DISTINCT FROM OLD.category_scores) OR
         (NEW.conducted_at IS DISTINCT FROM OLD.conducted_at) OR
         (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR
         (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR
         (NEW.company_id IS DISTINCT FROM OLD.company_id) OR
         (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '回答完了済み（completed）診断の直接変更禁止: 回答内容や基本情報を修正する場合は、先にステータスを draft または in_progress に差し戻してください（差し戻し時にスコア・完了日時は自動リセットされます）。';
      END IF;

    -- B. completed -> draft / in_progress への差し戻し時（update_diagnosis_status RPC経由のみ可能）
    -- 差し戻しRPCによるスコア・完了日時のリセット（score = NULL, category_scores = NULL, conducted_at = NULL）は許可
    -- ただし、差し戻しと同時に回答内容(answers)や基本情報(company_id, lead_id, questionnaire_version, diagnosis_type)が書き換えられることは防止
    ELSIF NEW.status IN ('draft', 'in_progress') THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR
         (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR
         (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR
         (NEW.company_id IS DISTINCT FROM OLD.company_id) OR
         (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '差し戻し整合性エラー: 差し戻し時はスコアおよび実施完了日時のリセットのみが許可されます。回答内容や基本情報の編集は差し戻し完了後に実施してください。';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reported_diagnosis_content_update ON public.diagnoses;
CREATE TRIGGER trg_prevent_reported_diagnosis_content_update
  BEFORE UPDATE OF answers, score, category_scores, conducted_at, questionnaire_version, diagnosis_type, company_id, lead_id ON public.diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reported_diagnosis_content_update();


-- ------------------------------------------------------------------------------
-- 4. AIレポートテーブル（ai_reports）
-- ------------------------------------------------------------------------------
-- 【列名・型：承認済み設計案に完全準拠】
-- - title: レポート表題（TEXT）
-- - recommendations: 改善提案・推奨アクション（JSONB）
-- - recommended_product_id: 推奨サービス/商材（既存products.idに合わせて TEXT 型、ON DELETE SET NULL）
-- - full_report_text: レポート全文テキスト・マークダウン（TEXT）
--
-- 【ステータス設計】
-- pending: 生成要求待ち
-- generating: AI生成実行中
-- generated: 生成成功（有効版）
-- reviewed: 人間による確認・承認済み（有効版）
-- superseded: 新しい再生成レポートに更新された過去版
-- failed: 生成失敗
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

  -- バージョン番号は正の整数
  CONSTRAINT chk_ai_reports_version CHECK (version >= 1),

  -- ステータス値の厳密な制約
  CONSTRAINT chk_ai_reports_status CHECK (
    status IN ('pending', 'generating', 'generated', 'superseded', 'failed', 'reviewed')
  ),

  -- 【重要整合性制約】
  -- is_latest = true に設定できるのは、正常完了した generated または reviewed だけ
  CONSTRAINT chk_ai_reports_latest_status CHECK (
    NOT (is_latest = true) OR (status IN ('generated', 'reviewed'))
  )
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_ai_reports_diagnosis_id ON public.ai_reports(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON public.ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_product_id ON public.ai_reports(recommended_product_id);

-- 【部分一意インデックス】
-- 同一診断内で is_latest = true を持つレコードは「物理的に最大1件のみ」であることをDBレベルで強制
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_one_latest_per_diagnosis
  ON public.ai_reports (diagnosis_id)
  WHERE (is_latest = true);

-- 同一診断内でのバージョン重複防止
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_diagnosis_version
  ON public.ai_reports (diagnosis_id, version);

-- updated_at 自動更新トリガー
DROP TRIGGER IF EXISTS trg_ai_reports_set_updated_at ON public.ai_reports;
CREATE TRIGGER trg_ai_reports_set_updated_at
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mst_phase1c_updated_at();


-- ------------------------------------------------------------------------------
-- 5. 不正直接更新防止トリガー（状態遷移・最新フラグのカプセル化保護）
-- ------------------------------------------------------------------------------
-- 診断紐付け (diagnosis_id) や採番 (version) の改ざんをデータベース層で完全遮断します。
CREATE OR REPLACE FUNCTION public.guard_ai_reports_direct_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- diagnosis_id の付け替えは禁止
  IF OLD.diagnosis_id <> NEW.diagnosis_id THEN
    RAISE EXCEPTION '改ざん防止エラー: レポートの紐付け先診断 (diagnosis_id) を変更することはできません';
  END IF;

  -- version の改変は禁止（RPC内でのみ採番・設定）
  IF OLD.version <> NEW.version THEN
    RAISE EXCEPTION '改ざん防止エラー: version の直接変更は禁止されています';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ai_reports_direct_update ON public.ai_reports;
CREATE TRIGGER trg_guard_ai_reports_direct_update
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ai_reports_direct_update();


-- ------------------------------------------------------------------------------
-- 6. 競合防止・採番直列化・状態遷移 RPC（ストアドファンクション群）
-- ------------------------------------------------------------------------------

-- 【6-A. 診断ステータス更新 RPC（手動状態遷移のカプセル化＆設問バージョン別回答検証＆差し戻し時リセット規則）】
-- 一般ユーザーの diagnoses.status 直接UPDATEおよび直接INSERT時の status 指定が禁止されているため、
-- 回答入力中の状態遷移を安全に行う唯一の窓口です。
--
-- 【許可される状態遷移表とビジネスルール】
-- 1. draft -> in_progress : 入力開始
-- 2. draft -> completed   : 入力完了（回答必須チェックあり）
-- 3. in_progress -> draft : 下書きに戻す
-- 4. in_progress -> completed : 入力完了（回答必須チェックあり）
-- 5. completed -> in_progress : 修正のため再入力（conducted_at, score, category_scores をリセット）
-- 6. completed -> draft : 下書きに戻す（conducted_at, score, category_scores をリセット）
--
-- 【回答必須検証ルール（設問仕様確定までの暫定最小設問数ガード＆バージョン拡張対応）】
-- - draft / in_progress -> completed :
--     1) answers が NULL、空、または非オブジェクトの場合は completed への遷移を拒絶。
--     2) 設問バージョン（questionnaire_version）ごとに定義された必須設問キーまたは必要設問数をチェック。
--        （※「1件回答しただけで完了」になる事態を防ぐため、確定前の暫定ガードとして
--         最低5問以上の有効な非NULL回答が存在することを必須条件とする。
--         バージョンごとのキー一覧が確定した際は、ARRAY['q1', 'q2', ...] の完全充足チェックに切り替え可能）
--     3) conducted_at が未設定の場合は pg_catalog.now() を自動補填。
--
-- 【差し戻し時のデータ整合性ルール】
-- - completed -> draft / in_progress :
--     回答修正に伴い過去の算出値・完了日時が無効化されるため、
--     conducted_at, score, category_scores を NULL リセット。
--
-- 【禁止・拒否される遷移】
-- - * -> generating : create_ai_report_draft RPC 専用
-- - * -> reported   : complete_and_activate_ai_report / activate_ai_report RPC 専用
-- - reported -> draft / in_progress / completed : 
--     【重要】レポート発行済み（reported）の診断を過去の入力状態へ戻す操作は禁止です。
--     発行済みレポート（ai_reports）や最新版フラグ（is_latest）との不整合、監査証跡の破損を防ぐためです。
--     回答を変更して再診断を行う場合は、新しい診断レコード（新規 draft）を起票するか、
--     レポート再生成機能（再生成RPC）を利用します。
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
  v_valid_answers_count pg_catalog.int4;
  v_required_keys pg_catalog.text[];
  v_missing_keys pg_catalog.text[];
BEGIN
  -- 1. 要求先ステータスの検証
  -- 手動RPCで指定可能なステータスは ('draft', 'in_progress', 'completed') のみ
  IF p_status NOT IN ('draft', 'in_progress', 'completed') THEN
    RAISE EXCEPTION '不正なステータス変更要求: 手動で変更可能なステータスは draft, in_progress, completed のみです（要求: %）',
      p_status;
  END IF;

  -- 2. 対象の診断行を排他ロック（FOR UPDATE）
  SELECT status, questionnaire_version, answers, conducted_at
  INTO v_current_status, v_questionnaire_version, v_answers, v_conducted_at
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 3. 同一ステータスへの変更はそのまま成功を返す
  IF v_current_status = p_status THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'diagnosis_id', p_diagnosis_id,
      'previous_status', v_current_status,
      'new_status', p_status,
      'message', 'ステータスに変更はありません'
    );
  END IF;

  -- 4. レポート生成中（generating）の時は手動変更を禁止
  IF v_current_status = 'generating' THEN
    RAISE EXCEPTION '現在AIレポート生成処理中のため、診断ステータスを変更することはできません';
  END IF;

  -- 5. レポート発行済み（reported）からの巻き戻し禁止
  -- レポート発行済みから draft / in_progress / completed へ戻すと、
  -- 紐づく ai_reports (is_latest=true) との整合性が破壊されるため禁止
  IF v_current_status = 'reported' THEN
    RAISE EXCEPTION 'レポート発行済み（reported）の診断ステータスを % に戻すことはできません。再診断を行う場合は新しい診断を起票してください。',
      p_status;
  END IF;

  -- 6. 許可される遷移表の検証
  -- draft        -> in_progress, completed
  -- in_progress  -> draft, completed
  -- completed    -> draft, in_progress
  IF NOT (
    (v_current_status = 'draft' AND p_status IN ('in_progress', 'completed')) OR
    (v_current_status = 'in_progress' AND p_status IN ('draft', 'completed')) OR
    (v_current_status = 'completed' AND p_status IN ('draft', 'in_progress'))
  ) THEN
    RAISE EXCEPTION '不正な状態遷移です: % から % への遷移は許可されていません',
      v_current_status, p_status;
  END IF;

  -- 7. completed（完了）遷移時の回答検証
  -- 回答（answers）が存在しない、または空のオブジェクト（'{}'）の場合は完了遷移を拒絶
  IF p_status = 'completed' THEN
    IF v_answers IS NULL OR pg_catalog.jsonb_typeof(v_answers) != 'object' THEN
      RAISE EXCEPTION '完了遷移エラー: 回答データ (answers) がオブジェクト形式で存在しません (diagnosis_id: %)', p_diagnosis_id;
    END IF;

    -- 【設問バージョンごとの必須キー検証テーブル】
    -- ※各設問バージョンの必須設問IDが正式に定義・確定されるまでは、不完全な入力による完了を防ぐため
    --   completed への遷移を厳格に拒否（例外送出）します。
    CASE v_questionnaire_version
      WHEN 'v1.0' THEN
        -- v1.0 の必須設問定義（現時点で確定設問IDが未登録のため空配列）
        v_required_keys := ARRAY[]::pg_catalog.text[];
      ELSE
        v_required_keys := ARRAY[]::pg_catalog.text[];
    END CASE;

    -- 設問定義が未確定（必須設問一覧が空）の場合は、検証不能なまま完了扱いにすることを防止
    IF v_required_keys IS NULL OR pg_catalog.array_length(v_required_keys, 1) IS NULL OR pg_catalog.array_length(v_required_keys, 1) = 0 THEN
      RAISE EXCEPTION '完了遷移エラー: 設問バージョン % の必須設問定義が確定していないため、完了（completed）に遷移できません。設問仕様の必須キー一覧を確定・登録してください。',
        v_questionnaire_version;
    END IF;

    -- 必須キーが定義されている場合は全キーの存在と非空を検証
    SELECT pg_catalog.array_agg(k)
    INTO v_missing_keys
    FROM pg_catalog.unnest(v_required_keys) AS k
    WHERE (v_answers -> k) IS NULL
       OR (v_answers -> k) = 'null'::jsonb
       OR (pg_catalog.jsonb_typeof(v_answers -> k) = 'string' AND pg_catalog.btrim(v_answers ->> k) = '');

    IF v_missing_keys IS NOT NULL AND pg_catalog.array_length(v_missing_keys, 1) > 0 THEN
      RAISE EXCEPTION '完了遷移エラー: 設問バージョン % の必須回答項目が不足しています (未回答項目: %)',
        v_questionnaire_version, pg_catalog.array_to_string(v_missing_keys, ', ');
    END IF;

    -- 完了遷移時の conducted_at 処理: 未設定の場合は完了時点の現在時刻を自動記録
    UPDATE public.diagnoses
    SET
      status = 'completed',
      conducted_at = COALESCE(v_conducted_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;

  -- 8. completed -> draft / in_progress への差し戻し時
  -- 編集やり直しに伴い、回答完了時の算出値（スコア・カテゴリ別スコア）および実施完了日時を NULL リセット
  ELSIF v_current_status = 'completed' AND p_status IN ('draft', 'in_progress') THEN
    UPDATE public.diagnoses
    SET
      status = p_status,
      conducted_at = NULL,
      score = NULL,
      category_scores = NULL,
      updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;

  -- 9. 通常の draft <-> in_progress 遷移
  ELSE
    UPDATE public.diagnoses
    SET
      status = p_status,
      updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'diagnosis_id', p_diagnosis_id,
    'previous_status', v_current_status,
    'new_status', p_status
  );
END;
$$;


-- 【6-B. レポート生成開始とバージョン採番（直列化・回答状態検証・唯一の新規起票手段）】
-- ai_reports への直接 INSERT 権限を持たない一般クライアントに代わり、
-- 親診断行を FOR UPDATE でロックし、回答完了または再生成可能な状態であることを検証した上で、
-- 安全に最新 version + 1 を採番して generating 状態のレコードを作成します。
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
  -- 1. 親診断行を排他ロック（FOR UPDATE）
  SELECT status INTO v_diagnosis_status
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 2. 診断ステータスの検証（回答完了 completed または レポート完了 reported のみ新規/再生成可能）
  IF v_diagnosis_status NOT IN ('completed', 'reported') THEN
    RAISE EXCEPTION '診断ステータスが「%」のため、レポート生成を開始できません（completed または reported のみ許可）',
      v_diagnosis_status;
  END IF;

  -- 3. 現在の最大バージョンを取得して + 1 (COALESCE はSQL標準構文)
  SELECT COALESCE(pg_catalog.max(version), 0) + 1
  INTO v_next_version
  FROM public.ai_reports
  WHERE diagnosis_id = p_diagnosis_id;

  -- 4. レポート行を generating 状態で作成（is_latest はまだ false）
  INSERT INTO public.ai_reports (
    diagnosis_id,
    version,
    is_latest,
    status,
    title,
    model_name,
    prompt_version
  )
  VALUES (
    p_diagnosis_id,
    v_next_version,
    false,
    'generating',
    COALESCE(p_title, 'AI経営診断レポート'),
    p_model_name,
    p_prompt_version
  )
  RETURNING id INTO v_new_report_id;

  -- 5. 親診断のステータスを generating に更新
  UPDATE public.diagnoses
  SET status = 'generating',
      updated_at = pg_catalog.now()
  WHERE id = p_diagnosis_id;

  RETURN v_new_report_id;
END;
$$;


-- 【6-C. 生成完了とデータ格納・最新版有効化 RPC（ワンストップ整合性更新）】
-- 生成されたレポートデータ（サマリー・強み・課題・推奨・全文テキスト・PDF保存パス等）を一括格納し、
-- 直列化排他ロックのもとで安全に latest へ切り替えます。
-- ※ recommended_product_id は products.id (TEXT) に合わせて TEXT 型です。
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
  -- 1. 対象の診断行を明示的に行ロック（排他ロック）
  PERFORM id
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 2. 対象レポートの存在・所属診断・ステータスを検証
  SELECT diagnosis_id, status, version
  INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id;
  END IF;

  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません',
      p_report_id, p_diagnosis_id;
  END IF;

  -- generating 状態のレポートのみ完了可能
  IF v_report_status <> 'generating' THEN
    RAISE EXCEPTION 'ステータスが generating 以外のレポート (現在: %) は完了処理できません',
      v_report_status;
  END IF;

  -- 3. 【巻き戻し防止ルール】
  SELECT id, version
  INTO v_current_latest_id, v_current_latest_version
  FROM public.ai_reports
  WHERE diagnosis_id = p_diagnosis_id
    AND is_latest = true;

  IF v_current_latest_id IS NOT NULL AND v_current_latest_id <> p_report_id THEN
    IF v_target_version < v_current_latest_version THEN
      RAISE EXCEPTION '最新版の巻き戻し防止: 有効化対象レポートのバージョン(v%)は、現在の最新版(v%)より古いため最新版にできません',
        v_target_version, v_current_latest_version;
    END IF;
  END IF;

  -- 4. 既存の最新レポートを退避（is_latest = false にし、generated のものは superseded へ）
  UPDATE public.ai_reports
  SET
    is_latest = false,
    status = CASE
      WHEN status = 'reviewed' THEN 'reviewed' -- レビュー承認履歴はステータスを維持
      ELSE 'superseded'
    END,
    updated_at = pg_catalog.now()
  WHERE diagnosis_id = p_diagnosis_id
    AND is_latest = true
    AND id <> p_report_id;

  -- 5. 対象レポートに生成コンテンツを保存し、generated ＆ is_latest = true に更新
  UPDATE public.ai_reports
  SET
    status = 'generated',
    is_latest = true,
    summary = p_summary,
    strengths = p_strengths,
    challenges = p_challenges,
    recommendations = p_recommendations,
    full_report_text = p_full_report_text,
    storage_path = p_storage_path,
    recommended_product_id = p_recommended_product_id,
    generated_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  -- 6. 親診断のステータスを 'reported' に更新
  UPDATE public.diagnoses
  SET
    status = 'reported',
    updated_at = pg_catalog.now()
  WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'diagnosis_id', p_diagnosis_id,
    'activated_report_id', p_report_id,
    'version', v_target_version,
    'status', 'generated'
  );
END;
$$;


-- 【6-D. レビュー承認 RPC（reviewed_at, reviewed_by 更新専用）】
-- reviewed_at と reviewed_by の直接UPDATEが禁止されているため、
-- 人間によるレビュー承認・署名を安全に行う専用RPC。
-- 【改ざん防止・本人性保証】呼び出し元から任意の担当者IDを受け取らず、
-- DB側で auth.uid()（認証済みユーザーID）を取得して reviewed_by に記録します。
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
  -- 1. ログイン中の認証ユーザーIDをDB側で取得（改ざん防止）
  v_reviewer_id := auth.uid()::pg_catalog.text;

  IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN
    RAISE EXCEPTION '認証エラー: ログイン中のユーザー情報を取得できませんでした。レビュー承認は認証ユーザーのみ実行可能です。';
  END IF;

  -- 2. 親診断行を排他ロック
  PERFORM id
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 3. 対象レポートの検証
  SELECT diagnosis_id, status, version
  INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id;
  END IF;

  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません',
      p_report_id, p_diagnosis_id;
  END IF;

  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN
    RAISE EXCEPTION 'ステータスが % のレポートはレビューできません（generated, reviewed, superseded のみ許可）',
      v_report_status;
  END IF;

  -- 4. レビュー情報更新および status -> 'reviewed'（ログインユーザーIDを記録）
  UPDATE public.ai_reports
  SET
    status = 'reviewed',
    reviewed_at = pg_catalog.now(),
    reviewed_by = v_reviewer_id,
    updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'diagnosis_id', p_diagnosis_id,
    'report_id', p_report_id,
    'version', v_target_version,
    'status', 'reviewed',
    'reviewed_by', v_reviewer_id
  );
END;
$$;


-- 【6-E. 最新版再有効化・過去版採用 RPC】
-- 過去版の再採用、またはレビュー済み版の最新化を安全に行います。
-- レビュー署名を行う場合は、クライアントからではなく auth.uid() から担当者IDを記録します。
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
  -- 1. レビュー署名フラグが真の場合、DB側で auth.uid() を取得
  IF p_mark_as_reviewed IS TRUE THEN
    v_reviewer_id := auth.uid()::pg_catalog.text;

    IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN
      RAISE EXCEPTION '認証エラー: ログイン中のユーザー情報を取得できませんでした。レビュー承認は認証ユーザーのみ実行可能です。';
    END IF;
  END IF;

  -- 2. 対象の診断行を明示的に行ロック（排他ロック）
  PERFORM id
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 3. 有効化対象レポートの存在・所属診断・ステータスを検証
  SELECT diagnosis_id, status, version
  INTO v_report_diagnosis_id, v_report_status, v_target_version
  FROM public.ai_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id;
  END IF;

  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません',
      p_report_id, p_diagnosis_id;
  END IF;

  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN
    RAISE EXCEPTION 'ステータスが % のレポートは最新版に切り替えられません（generated, reviewed, superseded のみ許可）',
      v_report_status;
  END IF;

  -- 4. 既存の最新レポートを退避
  UPDATE public.ai_reports
  SET
    is_latest = false,
    status = CASE
      WHEN status = 'reviewed' THEN 'reviewed'
      ELSE 'superseded'
    END,
    updated_at = pg_catalog.now()
  WHERE diagnosis_id = p_diagnosis_id
    AND is_latest = true
    AND id <> p_report_id;

  -- 5. 対象レポートを最新版に設定（レビュー指定があれば DB側で取得した auth.uid() を記録）
  UPDATE public.ai_reports
  SET
    is_latest = true,
    status = CASE
      WHEN p_mark_as_reviewed IS TRUE THEN 'reviewed'
      WHEN status = 'superseded' THEN 'generated'
      ELSE status
    END,
    reviewed_at = CASE WHEN p_mark_as_reviewed IS TRUE THEN pg_catalog.now() ELSE reviewed_at END,
    reviewed_by = CASE WHEN p_mark_as_reviewed IS TRUE THEN v_reviewer_id ELSE reviewed_by END,
    updated_at = pg_catalog.now()
  WHERE id = p_report_id;

  -- 6. 親診断のステータスを 'reported' に更新
  UPDATE public.diagnoses
  SET
    status = 'reported',
    updated_at = pg_catalog.now()
  WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'diagnosis_id', p_diagnosis_id,
    'activated_report_id', p_report_id,
    'version', v_target_version,
    'status', CASE WHEN p_mark_as_reviewed IS TRUE THEN 'reviewed' ELSE 'generated' END
  );
END;
$$;


-- 【6-F. 生成失敗時の状態更新 RPC】
-- レポート生成ジョブがエラーとなった場合、診断・レポートの存在・紐付け・generating状態を厳密に検証した上で安全に状態を更新・復元します。
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
  -- 1. 親診断行を排他ロック
  PERFORM id
  FROM public.diagnoses
  WHERE id = p_diagnosis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定された診断 (id: %) が見つかりません', p_diagnosis_id;
  END IF;

  -- 2. 対象レポートの存在、診断との紐付け、generating 状態を厳密に検証
  SELECT diagnosis_id, status
  INTO v_report_diagnosis_id, v_report_status
  FROM public.ai_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '指定されたレポート (id: %) が見つかりません', p_report_id;
  END IF;

  IF v_report_diagnosis_id <> p_diagnosis_id THEN
    RAISE EXCEPTION '指定されたレポート (id: %) はこの診断 (id: %) のものではありません',
      p_report_id, p_diagnosis_id;
  END IF;

  IF v_report_status <> 'generating' THEN
    RAISE EXCEPTION 'ステータスが generating 以外のレポート (現在: %) は失敗処理できません',
      v_report_status;
  END IF;

  -- 3. 対象レポート行を failed に更新
  UPDATE public.ai_reports
  SET
    status = 'failed',
    is_latest = false,
    error_message = p_error_message,
    updated_at = pg_catalog.now()
  WHERE id = p_report_id
    AND diagnosis_id = p_diagnosis_id;

  -- 4. 親診断ステータスの安全な更新:
  -- すでに有効な最新版レポート（過去版）が存在している再生成失敗の場合は 'reported'（正常閲覧可能）を維持
  -- 過去版が存在しない初回生成の失敗の場合は 'completed'（診断完了・再試行可能）に戻す
  SELECT EXISTS (
    SELECT 1 FROM public.ai_reports
    WHERE diagnosis_id = p_diagnosis_id
      AND is_latest = true
      AND status IN ('generated', 'reviewed')
  ) INTO v_has_valid_latest;

  UPDATE public.diagnoses
  SET
    status = CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END,
    updated_at = pg_catalog.now()
  WHERE id = p_diagnosis_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'diagnosis_id', p_diagnosis_id,
    'failed_report_id', p_report_id,
    'restored_diagnosis_status', CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. RPC実行権限の設定
-- ------------------------------------------------------------------------------
-- PUBLIC / anon の実行権限を完全に剥奪し、authenticated（社内ログインユーザー）のみに限定
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


-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) & テーブル権限設定（最小権限とカプセル化保護）
-- ------------------------------------------------------------------------------
-- [1. anon（未認証・外部アクセス）の完全遮断]
REVOKE ALL ON TABLE public.diagnoses FROM anon;
REVOKE ALL ON TABLE public.ai_reports FROM anon;

-- [2. diagnoses テーブルの権限（列レベル権限で status の直接INSERT・直接UPDATEを遮断）]
-- status の初期値はスキーマ既定値 'draft' を強制し、クライアントからの直接値指定（例: completed や reported での不正作成）を防止します。
-- 社内ユーザーは SELECT が可能。
-- INSERT は status を除く必要な列のみ許可（id, company_id, lead_id, diagnosis_type, questionnaire_version, answers, score, category_scores, memo, conducted_at）
-- UPDATE も設問入力やメモ更新に必要な列のみ許可し、status の変更は update_diagnosis_status RPC（または生成RPC）経由に限定
REVOKE ALL ON TABLE public.diagnoses FROM authenticated;
GRANT SELECT ON TABLE public.diagnoses TO authenticated;
GRANT INSERT (
  id, company_id, lead_id, diagnosis_type, questionnaire_version,
  answers, score, category_scores, memo, conducted_at
) ON TABLE public.diagnoses TO authenticated;
GRANT UPDATE (
  company_id, lead_id, diagnosis_type, questionnaire_version,
  answers, score, category_scores, memo, conducted_at
) ON TABLE public.diagnoses TO authenticated;

-- [3. ai_reports テーブルの権限（直接INSERT禁止＆列レベル権限で厳格保護）]
-- 新規レポート作成は create_ai_report_draft RPC（SECURITY DEFINER）に限定するため、INSERT 権限は付与しません。
-- UPDATE は業務コンテンツ（サマリー、改善案、商材、全文等）のみ許可し、
-- status, is_latest, version, reviewed_at, reviewed_by の直接変更は禁止（各専用RPC経由に限定）
REVOKE ALL ON TABLE public.ai_reports FROM authenticated;
GRANT SELECT ON TABLE public.ai_reports TO authenticated;
GRANT UPDATE (
  title, summary, strengths, challenges, recommendations,
  recommended_product_id, full_report_text, storage_path
) ON TABLE public.ai_reports TO authenticated;

-- [4. RLS の有効化]
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- [5. 診断（diagnoses）RLSポリシー（社内ログインユーザー向け）]
DROP POLICY IF EXISTS "Allow authenticated read diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated read diagnoses"
  ON public.diagnoses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated insert diagnoses"
  ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated update diagnoses"
  ON public.diagnoses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- [6. AIレポート（ai_reports）RLSポリシー（社内ログインユーザー向け）]
DROP POLICY IF EXISTS "Allow authenticated read ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated read ai_reports"
  ON public.ai_reports FOR SELECT TO authenticated USING (true);

-- 【直接INSERTの完全遮断】
-- 新規作成は create_ai_report_draft RPC（SECURITY DEFINER）でのみ行うため、
-- INSERT ポリシーは作成せず、テーブル全体の GRANT INSERT も付与しません。
DROP POLICY IF EXISTS "Allow authenticated insert ai_reports" ON public.ai_reports;

DROP POLICY IF EXISTS "Allow authenticated update ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated update ai_reports"
  ON public.ai_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMIT;
