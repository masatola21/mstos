-- Keep both customer-facing outputs for one diagnosis report.
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
