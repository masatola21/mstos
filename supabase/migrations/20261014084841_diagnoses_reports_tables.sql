/*
# 診断・AIレポートテーブル作成（Part 6-7）

1. New Tables: diagnoses, ai_reports
2. Indexes and unique constraints
3. Triggers: updated_at, company-lead integrity, content freeze, tamper guard
*/

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
  CONSTRAINT chk_diagnoses_status CHECK (status IN ('draft', 'in_progress', 'completed', 'generating', 'reported')),
  CONSTRAINT chk_diagnoses_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_company_id ON public.diagnoses(company_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_lead_id ON public.diagnoses(lead_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON public.diagnoses(status);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON public.diagnoses(diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON public.diagnoses(created_at DESC);

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
  CONSTRAINT chk_ai_reports_status CHECK (status IN ('pending', 'generating', 'generated', 'superseded', 'failed', 'reviewed')),
  CONSTRAINT chk_ai_reports_latest_status CHECK (NOT (is_latest = true) OR (status IN ('generated', 'reviewed')))
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_diagnosis_id ON public.ai_reports(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON public.ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_product_id ON public.ai_reports(recommended_product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_one_latest_per_diagnosis ON public.ai_reports (diagnosis_id) WHERE (is_latest = true);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_diagnosis_version ON public.ai_reports (diagnosis_id, version);

CREATE OR REPLACE FUNCTION public.set_mst_phase1c_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_diagnoses_set_updated_at ON public.diagnoses;
CREATE TRIGGER trg_diagnoses_set_updated_at BEFORE UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();
DROP TRIGGER IF EXISTS trg_ai_reports_set_updated_at ON public.ai_reports;
CREATE TRIGGER trg_ai_reports_set_updated_at BEFORE UPDATE ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();

CREATE OR REPLACE FUNCTION public.check_diagnosis_company_lead_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_lead_company_id pg_catalog.text;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT company_id INTO v_lead_company_id FROM public.leads WHERE id = NEW.lead_id;
    IF NOT FOUND THEN RAISE EXCEPTION '整合性エラー: 指定されたリードが存在しません (%)', NEW.lead_id; END IF;
    IF v_lead_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION '整合性エラー: 診断の対象会社 (%) とリードの所属会社 (%) が一致していません', NEW.company_id, v_lead_company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_diagnosis_company_lead_match ON public.diagnoses;
CREATE TRIGGER trg_check_diagnosis_company_lead_match BEFORE INSERT OR UPDATE OF company_id, lead_id ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.check_diagnosis_company_lead_match();

CREATE OR REPLACE FUNCTION public.prevent_reported_diagnosis_content_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('reported', 'generating') THEN
    IF (NEW.answers IS DISTINCT FROM OLD.answers) OR (NEW.score IS DISTINCT FROM OLD.score) OR (NEW.category_scores IS DISTINCT FROM OLD.category_scores) OR (NEW.conducted_at IS DISTINCT FROM OLD.conducted_at) OR (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR (NEW.company_id IS DISTINCT FROM OLD.company_id) OR (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
      RAISE EXCEPTION '確定診断の変更禁止 (%)', OLD.status;
    END IF;
  END IF;
  IF OLD.status = 'completed' THEN
    IF NEW.status = 'completed' THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR (NEW.score IS DISTINCT FROM OLD.score) OR (NEW.category_scores IS DISTINCT FROM OLD.category_scores) OR (NEW.conducted_at IS DISTINCT FROM OLD.conducted_at) OR (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR (NEW.company_id IS DISTINCT FROM OLD.company_id) OR (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '回答完了済み診断の直接変更禁止';
      END IF;
    ELSIF NEW.status IN ('draft', 'in_progress') THEN
      IF (NEW.answers IS DISTINCT FROM OLD.answers) OR (NEW.questionnaire_version IS DISTINCT FROM OLD.questionnaire_version) OR (NEW.diagnosis_type IS DISTINCT FROM OLD.diagnosis_type) OR (NEW.company_id IS DISTINCT FROM OLD.company_id) OR (NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
        RAISE EXCEPTION '差し戻し整合性エラー';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reported_diagnosis_content_update ON public.diagnoses;
CREATE TRIGGER trg_prevent_reported_diagnosis_content_update BEFORE UPDATE OF answers, score, category_scores, conducted_at, questionnaire_version, diagnosis_type, company_id, lead_id ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.prevent_reported_diagnosis_content_update();

CREATE OR REPLACE FUNCTION public.guard_ai_reports_direct_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.diagnosis_id <> NEW.diagnosis_id THEN RAISE EXCEPTION '改ざん防止: diagnosis_idの変更は禁止'; END IF;
  IF OLD.version <> NEW.version THEN RAISE EXCEPTION '改ざん防止: versionの直接変更は禁止'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ai_reports_direct_update ON public.ai_reports;
CREATE TRIGGER trg_guard_ai_reports_direct_update BEFORE UPDATE ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION public.guard_ai_reports_direct_update();
