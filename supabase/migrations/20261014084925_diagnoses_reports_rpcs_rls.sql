/*
# 診断・レポート RPC関数・権限・RLS設定（Part 8-11）

1. RPC Functions: update_diagnosis_status, create_ai_report_draft, complete_and_activate_ai_report, review_ai_report, activate_ai_report, handle_ai_report_failure
2. RPC execution grants to authenticated only
3. Column-level privileges on diagnoses (status excluded) and ai_reports (INSERT denied)
4. RLS policies on diagnoses and ai_reports
5. Storage bucket 'reports' (private) with SELECT/INSERT policies
*/

CREATE OR REPLACE FUNCTION public.update_diagnosis_status(p_diagnosis_id pg_catalog.uuid, p_status pg_catalog.text)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_status pg_catalog.text; v_questionnaire_version pg_catalog.text;
  v_answers pg_catalog.jsonb; v_conducted_at pg_catalog.timestamptz;
  v_required_keys pg_catalog.text[]; v_missing_keys pg_catalog.text[];
BEGIN
  IF p_status NOT IN ('draft', 'in_progress', 'completed') THEN
    RAISE EXCEPTION '不正なステータス変更要求: %', p_status;
  END IF;
  SELECT status, questionnaire_version, answers, conducted_at INTO v_current_status, v_questionnaire_version, v_answers, v_conducted_at FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  IF v_current_status = p_status THEN RETURN pg_catalog.jsonb_build_object('success', true, 'message', 'ステータスに変更はありません'); END IF;
  IF v_current_status = 'generating' THEN RAISE EXCEPTION 'AIレポート生成中のため変更不可'; END IF;
  IF v_current_status = 'reported' THEN RAISE EXCEPTION 'レポート発行済みの診断は戻せません: %', p_status; END IF;
  IF NOT ((v_current_status = 'draft' AND p_status IN ('in_progress', 'completed')) OR (v_current_status = 'in_progress' AND p_status IN ('draft', 'completed')) OR (v_current_status = 'completed' AND p_status IN ('draft', 'in_progress'))) THEN
    RAISE EXCEPTION '不正な状態遷移: % から % への遷移は許可されていません', v_current_status, p_status;
  END IF;
  IF p_status = 'completed' THEN
    IF v_answers IS NULL OR pg_catalog.jsonb_typeof(v_answers) != 'object' THEN RAISE EXCEPTION '回答データが存在しません: %', p_diagnosis_id; END IF;
    CASE v_questionnaire_version WHEN 'v1.0' THEN v_required_keys := ARRAY[]::pg_catalog.text[]; ELSE v_required_keys := ARRAY[]::pg_catalog.text[]; END CASE;
    IF v_required_keys IS NULL OR pg_catalog.array_length(v_required_keys, 1) IS NULL OR pg_catalog.array_length(v_required_keys, 1) = 0 THEN
      RAISE EXCEPTION '必須設問定義が未確定のため完了に遷移できません: %', v_questionnaire_version;
    END IF;
    SELECT pg_catalog.array_agg(k) INTO v_missing_keys FROM pg_catalog.unnest(v_required_keys) AS k WHERE (v_answers -> k) IS NULL OR (v_answers -> k) = 'null'::jsonb OR (pg_catalog.jsonb_typeof(v_answers -> k) = 'string' AND pg_catalog.btrim(v_answers ->> k) = '');
    IF v_missing_keys IS NOT NULL AND pg_catalog.array_length(v_missing_keys, 1) > 0 THEN RAISE EXCEPTION '必須回答項目が不足: % (未回答: %)', v_questionnaire_version, pg_catalog.array_to_string(v_missing_keys, ', '); END IF;
    UPDATE public.diagnoses SET status = 'completed', conducted_at = COALESCE(v_conducted_at, pg_catalog.now()), updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  ELSIF v_current_status = 'completed' AND p_status IN ('draft', 'in_progress') THEN
    UPDATE public.diagnoses SET status = p_status, conducted_at = NULL, score = NULL, category_scores = NULL, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  ELSE
    UPDATE public.diagnoses SET status = p_status, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  END IF;
  RETURN pg_catalog.jsonb_build_object('success', true, 'previous_status', v_current_status, 'new_status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ai_report_draft(p_diagnosis_id pg_catalog.uuid, p_model_name pg_catalog.text, p_prompt_version pg_catalog.text, p_title pg_catalog.text DEFAULT 'AI経営診断レポート')
RETURNS pg_catalog.uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_diagnosis_status pg_catalog.text; v_next_version pg_catalog.int4; v_new_report_id pg_catalog.uuid;
BEGIN
  SELECT status INTO v_diagnosis_status FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  IF v_diagnosis_status NOT IN ('completed', 'reported') THEN RAISE EXCEPTION 'レポート生成はcompletedまたはreportedのみ許可: %', v_diagnosis_status; END IF;
  SELECT COALESCE(pg_catalog.max(version), 0) + 1 INTO v_next_version FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id;
  INSERT INTO public.ai_reports (diagnosis_id, version, is_latest, status, title, model_name, prompt_version) VALUES (p_diagnosis_id, v_next_version, false, 'generating', COALESCE(p_title, 'AI経営診断レポート'), p_model_name, p_prompt_version) RETURNING id INTO v_new_report_id;
  UPDATE public.diagnoses SET status = 'generating', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  RETURN v_new_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_and_activate_ai_report(p_report_id pg_catalog.uuid, p_diagnosis_id pg_catalog.uuid, p_summary pg_catalog.text, p_strengths pg_catalog.jsonb, p_challenges pg_catalog.jsonb, p_recommendations pg_catalog.jsonb, p_full_report_text pg_catalog.text, p_storage_path pg_catalog.text DEFAULT NULL, p_recommended_product_id pg_catalog.text DEFAULT NULL)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_report_status pg_catalog.text; v_report_diagnosis_id pg_catalog.uuid; v_target_version pg_catalog.int4; v_current_latest_version pg_catalog.int4; v_current_latest_id pg_catalog.uuid;
BEGIN
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポートが見つかりません: %', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN RAISE EXCEPTION 'レポートが診断に紐付いていません: % / %', p_report_id, p_diagnosis_id; END IF;
  IF v_report_status <> 'generating' THEN RAISE EXCEPTION 'generating以外のレポートは完了処理できません: %', v_report_status; END IF;
  SELECT id, version INTO v_current_latest_id, v_current_latest_version FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id AND is_latest = true;
  IF v_current_latest_id IS NOT NULL AND v_current_latest_id <> p_report_id AND v_target_version < v_current_latest_version THEN RAISE EXCEPTION '巻き戻し防止: v% < v%', v_target_version, v_current_latest_version; END IF;
  UPDATE public.ai_reports SET is_latest = false, status = CASE WHEN status = 'reviewed' THEN 'reviewed' ELSE 'superseded' END, updated_at = pg_catalog.now() WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND id <> p_report_id;
  UPDATE public.ai_reports SET status = 'generated', is_latest = true, summary = p_summary, strengths = p_strengths, challenges = p_challenges, recommendations = p_recommendations, full_report_text = p_full_report_text, storage_path = p_storage_path, recommended_product_id = p_recommended_product_id, generated_at = pg_catalog.now(), updated_at = pg_catalog.now() WHERE id = p_report_id;
  UPDATE public.diagnoses SET status = 'reported', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  RETURN pg_catalog.jsonb_build_object('success', true, 'activated_report_id', p_report_id, 'version', v_target_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_report(p_report_id pg_catalog.uuid, p_diagnosis_id pg_catalog.uuid)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_report_status pg_catalog.text; v_report_diagnosis_id pg_catalog.uuid; v_target_version pg_catalog.int4; v_reviewer_id pg_catalog.text;
BEGIN
  v_reviewer_id := auth.uid()::pg_catalog.text;
  IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN RAISE EXCEPTION '認証エラー: ユーザー情報を取得できません'; END IF;
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポートが見つかりません: %', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN RAISE EXCEPTION 'レポートが診断に紐付いていません'; END IF;
  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN RAISE EXCEPTION 'レビュー不可: %', v_report_status; END IF;
  UPDATE public.ai_reports SET status = 'reviewed', reviewed_at = pg_catalog.now(), reviewed_by = v_reviewer_id, updated_at = pg_catalog.now() WHERE id = p_report_id;
  RETURN pg_catalog.jsonb_build_object('success', true, 'report_id', p_report_id, 'status', 'reviewed', 'reviewed_by', v_reviewer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_ai_report(p_report_id pg_catalog.uuid, p_diagnosis_id pg_catalog.uuid, p_mark_as_reviewed pg_catalog.bool DEFAULT false)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_report_status pg_catalog.text; v_report_diagnosis_id pg_catalog.uuid; v_target_version pg_catalog.int4; v_reviewer_id pg_catalog.text;
BEGIN
  IF p_mark_as_reviewed IS TRUE THEN
    v_reviewer_id := auth.uid()::pg_catalog.text;
    IF v_reviewer_id IS NULL OR pg_catalog.btrim(v_reviewer_id) = '' THEN RAISE EXCEPTION '認証エラー'; END IF;
  END IF;
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  SELECT diagnosis_id, status, version INTO v_report_diagnosis_id, v_report_status, v_target_version FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポートが見つかりません: %', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN RAISE EXCEPTION 'レポートが診断に紐付いていません'; END IF;
  IF v_report_status NOT IN ('generated', 'reviewed', 'superseded') THEN RAISE EXCEPTION '最新版に切り替えられません: %', v_report_status; END IF;
  UPDATE public.ai_reports SET is_latest = false, status = CASE WHEN status = 'reviewed' THEN 'reviewed' ELSE 'superseded' END, updated_at = pg_catalog.now() WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND id <> p_report_id;
  UPDATE public.ai_reports SET is_latest = true, status = CASE WHEN p_mark_as_reviewed IS TRUE THEN 'reviewed' WHEN status = 'superseded' THEN 'generated' ELSE status END, reviewed_at = CASE WHEN p_mark_as_reviewed IS TRUE THEN pg_catalog.now() ELSE reviewed_at END, reviewed_by = CASE WHEN p_mark_as_reviewed IS TRUE THEN v_reviewer_id ELSE reviewed_by END, updated_at = pg_catalog.now() WHERE id = p_report_id;
  UPDATE public.diagnoses SET status = 'reported', updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  RETURN pg_catalog.jsonb_build_object('success', true, 'activated_report_id', p_report_id, 'version', v_target_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_ai_report_failure(p_report_id pg_catalog.uuid, p_diagnosis_id pg_catalog.uuid, p_error_message pg_catalog.text)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_report_status pg_catalog.text; v_report_diagnosis_id pg_catalog.uuid; v_has_valid_latest pg_catalog.bool;
BEGIN
  PERFORM id FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  SELECT diagnosis_id, status INTO v_report_diagnosis_id, v_report_status FROM public.ai_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION '指定されたレポートが見つかりません: %', p_report_id; END IF;
  IF v_report_diagnosis_id <> p_diagnosis_id THEN RAISE EXCEPTION 'レポートが診断に紐付いていません'; END IF;
  IF v_report_status <> 'generating' THEN RAISE EXCEPTION 'generating以外は失敗処理できません: %', v_report_status; END IF;
  UPDATE public.ai_reports SET status = 'failed', is_latest = false, error_message = p_error_message, updated_at = pg_catalog.now() WHERE id = p_report_id AND diagnosis_id = p_diagnosis_id;
  SELECT EXISTS (SELECT 1 FROM public.ai_reports WHERE diagnosis_id = p_diagnosis_id AND is_latest = true AND status IN ('generated', 'reviewed')) INTO v_has_valid_latest;
  UPDATE public.diagnoses SET status = CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  RETURN pg_catalog.jsonb_build_object('success', true, 'restored_diagnosis_status', CASE WHEN v_has_valid_latest THEN 'reported' ELSE 'completed' END);
END;
$$;

-- RPC権限
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

-- 列レベル権限
REVOKE ALL ON TABLE public.diagnoses FROM anon;
REVOKE ALL ON TABLE public.ai_reports FROM anon;
REVOKE ALL ON TABLE public.diagnoses FROM authenticated;
GRANT SELECT ON TABLE public.diagnoses TO authenticated;
GRANT INSERT (id, company_id, lead_id, diagnosis_type, questionnaire_version, answers, score, category_scores, memo, conducted_at) ON TABLE public.diagnoses TO authenticated;
GRANT UPDATE (company_id, lead_id, diagnosis_type, questionnaire_version, answers, score, category_scores, memo, conducted_at) ON TABLE public.diagnoses TO authenticated;
REVOKE ALL ON TABLE public.ai_reports FROM authenticated;
GRANT SELECT ON TABLE public.ai_reports TO authenticated;
GRANT UPDATE (title, summary, strengths, challenges, recommendations, recommended_product_id, full_report_text, storage_path) ON TABLE public.ai_reports TO authenticated;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated read diagnoses" ON public.diagnoses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated insert diagnoses" ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update diagnoses" ON public.diagnoses;
CREATE POLICY "Allow authenticated update diagnoses" ON public.diagnoses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated read ai_reports" ON public.ai_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert ai_reports" ON public.ai_reports;
DROP POLICY IF EXISTS "Allow authenticated update ai_reports" ON public.ai_reports;
CREATE POLICY "Allow authenticated update ai_reports" ON public.ai_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Storage バケット
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "mst_reports_storage_authenticated_select" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');
DROP POLICY IF EXISTS "mst_reports_storage_authenticated_insert" ON storage.objects;
CREATE POLICY "mst_reports_storage_authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] IS NOT NULL);
