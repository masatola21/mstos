-- Public diagnosis form submissions become received diagnosis records.
ALTER TABLE public.diagnoses
  ALTER COLUMN status SET DEFAULT 'received';

ALTER TABLE public.diagnoses
  DROP CONSTRAINT IF EXISTS chk_diagnoses_status;

UPDATE public.diagnoses
SET status = 'received'
WHERE status IN ('draft', 'in_progress');

ALTER TABLE public.diagnoses
  ADD CONSTRAINT chk_diagnoses_status
  CHECK (status IN ('received', 'completed', 'generating', 'reported'));

ALTER TABLE public.diagnosis_submissions
  ADD COLUMN IF NOT EXISTS diagnosis_id uuid NULL REFERENCES public.diagnoses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_diagnosis_submissions_diagnosis_id
  ON public.diagnosis_submissions(diagnosis_id)
  WHERE diagnosis_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_diagnosis_status(p_diagnosis_id pg_catalog.uuid, p_status pg_catalog.text)
RETURNS pg_catalog.jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_status pg_catalog.text;
  v_questionnaire_version pg_catalog.text;
  v_answers pg_catalog.jsonb;
  v_conducted_at pg_catalog.timestamptz;
  v_required_keys pg_catalog.text[];
  v_missing_keys pg_catalog.text[];
BEGIN
  IF p_status NOT IN ('received', 'completed') THEN
    RAISE EXCEPTION '不正なステータス変更要求: %', p_status;
  END IF;

  SELECT status, questionnaire_version, answers, conducted_at
    INTO v_current_status, v_questionnaire_version, v_answers, v_conducted_at
  FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  IF v_current_status = p_status THEN
    RETURN pg_catalog.jsonb_build_object('success', true, 'message', 'ステータスに変更はありません');
  END IF;
  IF v_current_status IN ('generating', 'reported') THEN
    RAISE EXCEPTION 'レポート生成中または発行済みの診断は変更できません';
  END IF;
  IF v_current_status NOT IN ('received', 'completed') THEN
    RAISE EXCEPTION '不正な状態遷移: %', v_current_status;
  END IF;

  IF p_status = 'completed' THEN
    IF v_answers IS NULL OR pg_catalog.jsonb_typeof(v_answers) <> 'object' THEN
      RAISE EXCEPTION '回答データが存在しません: %', p_diagnosis_id;
    END IF;
    CASE v_questionnaire_version
      WHEN 'v1.0' THEN v_required_keys := ARRAY[
        'q_strat_vision','q_strat_investment','q_strat_leadership',
        'q_data_crm','q_data_cloud','q_data_security',
        'q_ops_standardization','q_ops_automation',
        'q_lit_mindset','q_lit_ai_usage',
        'q_sales_followup','q_sales_analytics'
      ]::pg_catalog.text[];
      ELSE RAISE EXCEPTION 'この設問バージョンは回答完了にできません: %', v_questionnaire_version;
    END CASE;
    SELECT pg_catalog.array_agg(k) INTO v_missing_keys
    FROM pg_catalog.unnest(v_required_keys) AS k
    WHERE (v_answers -> k) IS NULL
       OR (v_answers -> k) = 'null'::jsonb
       OR (pg_catalog.jsonb_typeof(v_answers -> k) = 'string' AND pg_catalog.btrim(v_answers ->> k) = '');
    IF v_missing_keys IS NOT NULL THEN
      RAISE EXCEPTION '必須回答項目が不足: %', pg_catalog.array_to_string(v_missing_keys, ', ');
    END IF;
    UPDATE public.diagnoses
    SET status = 'completed', conducted_at = COALESCE(v_conducted_at, pg_catalog.now()), updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;
  ELSE
    UPDATE public.diagnoses
    SET status = 'received', conducted_at = NULL, score = NULL, category_scores = NULL, updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;
  END IF;
  RETURN pg_catalog.jsonb_build_object('success', true, 'previous_status', v_current_status, 'new_status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_diagnosis_from_form_submission(p_submission_id pg_catalog.uuid)
RETURNS pg_catalog.uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_submission public.diagnosis_submissions%ROWTYPE;
  v_form_type pg_catalog.text;
  v_questionnaire_version pg_catalog.text;
  v_diagnosis_id pg_catalog.uuid;
  v_answers pg_catalog.jsonb;
BEGIN
  SELECT * INTO v_submission
  FROM public.diagnosis_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'フォーム回答が見つかりません: %', p_submission_id; END IF;

  IF v_submission.diagnosis_id IS NOT NULL THEN
    RETURN v_submission.diagnosis_id;
  END IF;

  SELECT form_type, questionnaire_version
    INTO v_form_type, v_questionnaire_version
  FROM public.diagnosis_forms
  WHERE id = v_submission.form_id;
  IF v_form_type IS DISTINCT FROM 'diagnosis' THEN
    RETURN NULL;
  END IF;
  IF v_submission.company_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_answers := COALESCE(v_submission.answers, '{}'::jsonb) ||
    pg_catalog.jsonb_build_object('_intake', pg_catalog.jsonb_build_object(
      'submissionId', v_submission.id,
      'formId', v_submission.form_id,
      'submittedAt', v_submission.submitted_at,
      'respondentName', v_submission.respondent_name,
      'respondentEmail', v_submission.respondent_email,
      'companyName', v_submission.respondent_company_name
    ));

  INSERT INTO public.diagnoses (
    company_id, lead_id, diagnosis_type, questionnaire_version, answers, memo
  ) VALUES (
    v_submission.company_id, v_submission.lead_id, 'standard',
    'form-' || COALESCE(NULLIF(v_questionnaire_version, ''), 'v1'),
    v_answers,
    '公開診断フォームの送信回答から作成'
  )
  RETURNING id INTO v_diagnosis_id;

  UPDATE public.diagnosis_submissions
  SET diagnosis_id = v_diagnosis_id
  WHERE id = p_submission_id;
  RETURN v_diagnosis_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_diagnosis_from_form_submission(pg_catalog.uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_diagnosis_from_form_submission(pg_catalog.uuid) TO service_role;
