-- Keep both customer-facing outputs for one diagnosis report.
-- Make this migration safe to run even if the earlier document-link migration was not applied.
ALTER TABLE public.customer_documents
  ADD COLUMN IF NOT EXISTS ai_report_id uuid REFERENCES public.ai_reports(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.customer_documents_owner_ai_report_unique;
CREATE UNIQUE INDEX IF NOT EXISTS customer_documents_owner_ai_report_type_unique
  ON public.customer_documents(owner_id, ai_report_id, document_type)
  WHERE ai_report_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_generated_ai_report_to_customer_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_company_id text;
  v_lead_id uuid;
  v_company_name text;
  v_deal_id text;
  v_deal_name text;
  v_total_amount numeric;
  v_initial_fee numeric;
  v_monthly_fee numeric;
  v_product_name text;
  v_report_text text;
  v_recommendation_text text;
BEGIN
  IF NEW.status <> 'generated' OR NEW.is_latest IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT d.company_id, d.lead_id, c.company_name
    INTO v_company_id, v_lead_id, v_company_name
  FROM public.diagnoses d
  JOIN public.companies c ON c.id = d.company_id
  WHERE d.id = NEW.diagnosis_id;

  IF v_company_id IS NULL OR v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT deal.id, deal.proposal_plan_name, deal.total_amount, deal.initial_fee, deal.monthly_fee,
         product.product_name
    INTO v_deal_id, v_deal_name, v_total_amount, v_initial_fee, v_monthly_fee, v_product_name
  FROM public.deals deal
  LEFT JOIN public.products product ON product.id = deal.product_id
  WHERE (v_lead_id IS NOT NULL AND deal.lead_id = v_lead_id)
     OR (deal.company_id = v_company_id)
  ORDER BY deal.created_at DESC
  LIMIT 1;

  v_report_text := COALESCE(NULLIF(NEW.full_report_text, ''), NULLIF(NEW.summary, ''), '診断レポート本文は未入力です。');
  v_recommendation_text := COALESCE(NEW.recommendations::text, '[]');

  INSERT INTO public.customer_documents (
    owner_id, document_type, title, status, body_html, company_id, lead_id, deal_id, diagnosis_id, ai_report_id
  ) VALUES (
    v_owner_id, 'diagnosis_report', COALESCE(NULLIF(NEW.title, ''), 'AI診断レポート'), 'awaiting_approval',
    '<article><h1>' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(COALESCE(NEW.title, '診断レポート'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h1><pre style="white-space:pre-wrap">' ||
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(v_report_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</pre></article>',
    v_company_id, v_lead_id, v_deal_id, NEW.diagnosis_id, NEW.id
  )
  ON CONFLICT (owner_id, ai_report_id, document_type) WHERE (ai_report_id IS NOT NULL) DO NOTHING;

  INSERT INTO public.customer_documents (
    owner_id, document_type, title, status, body_html, company_id, lead_id, deal_id, diagnosis_id, ai_report_id
  ) VALUES (
    v_owner_id, 'proposal', '診断結果に基づくご提案（下書き）', 'draft',
    '<article><h1>' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(COALESCE(v_deal_name, '診断結果に基づくご提案'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</h1><p>宛先：' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(COALESCE(v_company_name, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</p><h2>診断結果・推奨事項</h2><pre style="white-space:pre-wrap">' ||
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(v_recommendation_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</pre><h2>ご提案内容</h2><p>推奨サービス：' ||
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(COALESCE(v_product_name, NEW.recommended_product_id, '要選定'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</p><p>提案プラン：' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(COALESCE(v_deal_name, '要設定'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</p><p>初期費用：' || COALESCE(v_initial_fee::text, '要設定') || ' 円</p><p>月額費用：' || COALESCE(v_monthly_fee::text, '要設定') ||
    ' 円</p><p>合計金額：' || COALESCE(v_total_amount::text, '要設定') || ' 円</p></article>',
    v_company_id, v_lead_id, v_deal_id, NEW.diagnosis_id, NEW.id
  )
  ON CONFLICT (owner_id, ai_report_id, document_type) WHERE (ai_report_id IS NOT NULL) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_generated_ai_report_to_customer_documents ON public.ai_reports;
CREATE TRIGGER trg_sync_generated_ai_report_to_customer_documents
AFTER INSERT OR UPDATE OF status, is_latest ON public.ai_reports
FOR EACH ROW
EXECUTE FUNCTION public.sync_generated_ai_report_to_customer_documents();

-- The active v1.0 questionnaire now has a concrete required-key set, enabling safe completion.
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
  SELECT status, questionnaire_version, answers, conducted_at
    INTO v_current_status, v_questionnaire_version, v_answers, v_conducted_at
  FROM public.diagnoses WHERE id = p_diagnosis_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '指定された診断が見つかりません: %', p_diagnosis_id; END IF;
  IF v_current_status = p_status THEN
    RETURN pg_catalog.jsonb_build_object('success', true, 'message', 'ステータスに変更はありません');
  END IF;
  IF v_current_status = 'generating' THEN RAISE EXCEPTION 'AIレポート生成中のため変更不可'; END IF;
  IF v_current_status = 'reported' THEN RAISE EXCEPTION 'レポート発行済みの診断は戻せません: %', p_status; END IF;
  IF NOT (
    (v_current_status = 'draft' AND p_status IN ('in_progress', 'completed')) OR
    (v_current_status = 'in_progress' AND p_status IN ('draft', 'completed')) OR
    (v_current_status = 'completed' AND p_status IN ('draft', 'in_progress'))
  ) THEN
    RAISE EXCEPTION '不正な状態遷移: % から % への遷移は許可されていません', v_current_status, p_status;
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
      ELSE RAISE EXCEPTION '未対応の設問バージョンです: %', v_questionnaire_version;
    END CASE;
    SELECT pg_catalog.array_agg(k) INTO v_missing_keys
    FROM pg_catalog.unnest(v_required_keys) AS k
    WHERE (v_answers -> k) IS NULL
       OR (v_answers -> k) = 'null'::jsonb
       OR (pg_catalog.jsonb_typeof(v_answers -> k) = 'string' AND pg_catalog.btrim(v_answers ->> k) = '');
    IF v_missing_keys IS NOT NULL THEN
      RAISE EXCEPTION '必須回答項目が不足: % (未回答: %)', v_questionnaire_version, pg_catalog.array_to_string(v_missing_keys, ', ');
    END IF;
    UPDATE public.diagnoses SET status = 'completed', conducted_at = COALESCE(v_conducted_at, pg_catalog.now()), updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;
  ELSIF v_current_status = 'completed' AND p_status IN ('draft', 'in_progress') THEN
    UPDATE public.diagnoses SET status = p_status, conducted_at = NULL, score = NULL, category_scores = NULL, updated_at = pg_catalog.now()
    WHERE id = p_diagnosis_id;
  ELSE
    UPDATE public.diagnoses SET status = p_status, updated_at = pg_catalog.now() WHERE id = p_diagnosis_id;
  END IF;
  RETURN pg_catalog.jsonb_build_object('success', true, 'previous_status', v_current_status, 'new_status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_diagnosis_status(pg_catalog.uuid, pg_catalog.text) TO authenticated;
