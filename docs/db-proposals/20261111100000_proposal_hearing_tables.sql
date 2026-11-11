-- 商談ヒアリング・提案書テーブル(案)
--
-- 状態: ドラフト。本番DBには未適用。supabase/migrations には置かない(置くと自動適用の対象になるため)。
-- 設計書: docs/db-proposals/proposal-hearing-db-design.md
-- 方針: 追加のみ。既存テーブルへの ALTER なし。何度実行しても安全(冪等)。
-- 適用手順: ステージング(またはテスト用プロジェクト)の SQL Editor で実行 → 確認 → 本番。
-- 取り消し: ファイル末尾の ROLLBACK 手順を参照。

-- ───────────────────────────────────────────────────────────
-- 1. hearing_sheets(ヒアリングシート)
--    1診断につき1枚が基本。再商談は別枚を許す(UNIQUE は付けない)。
--    質問文はコード側の定数。DBには回答と版(core_version)だけ持つ。
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hearing_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE RESTRICT,
  deal_id text REFERENCES public.deals(id) ON DELETE SET NULL,
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  core_version text NOT NULL DEFAULT 'core_v1',
  core_answers jsonb NOT NULL DEFAULT '{}'::jsonb,      -- q01〜q10、型判断用 t01〜t03
  extra_questions jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{"q": "...", "a": "..."}] 最大5
  conducted_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_hearing_sheets_status CHECK (status IN ('draft', 'completed')),
  CONSTRAINT chk_hearing_sheets_core_answers CHECK (jsonb_typeof(core_answers) = 'object'),
  CONSTRAINT chk_hearing_sheets_extra_questions CHECK (
    jsonb_typeof(extra_questions) = 'array' AND jsonb_array_length(extra_questions) <= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_hearing_sheets_diagnosis_id ON public.hearing_sheets(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_hearing_sheets_deal_id ON public.hearing_sheets(deal_id);
CREATE INDEX IF NOT EXISTS idx_hearing_sheets_owner_id ON public.hearing_sheets(owner_id);

-- ───────────────────────────────────────────────────────────
-- 2. proposal_drafts(提案パート P1〜P7)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE RESTRICT,
  hearing_sheet_id uuid REFERENCES public.hearing_sheets(id) ON DELETE SET NULL,
  -- 承認待ち以降は必須(下の CHECK)。承認済みの記録が商談削除で崩れないよう RESTRICT。
  deal_id text REFERENCES public.deals(id) ON DELETE RESTRICT,
  plan_group_id uuid,                                   -- 将来の2案併記用。今は常に NULL
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'drafting',

  our_assessment text,                                  -- 当社の見立て
  our_assessment_reason text,
  customer_intent text,                                 -- お客様の意向(未確認は NULL)
  final_kind text NOT NULL DEFAULT 'undecided',         -- 最終決定
  payment_mode text,                                    -- 既存 PaymentMode と同じ値

  chapters jsonb NOT NULL DEFAULT '{}'::jsonb,          -- P1〜P7 の本文と入力値(product_id は text で持つだけ)

  initial_fee numeric(14,0),
  monthly_fee numeric(14,0),
  discount_amount numeric(14,0),
  subtotal numeric(14,0),                               -- 税抜小計
  tax_amount numeric(14,0),                             -- 端数は切り捨て(既存の Math.floor に合わせる)
  total_amount numeric(14,0),                           -- 税込合計

  issued_on date,
  valid_until date,                                     -- 発行日から自動計算(日数は定数。API側で設定)
  roadmap_confirmed_by text,
  roadmap_confirmed_at timestamptz,
  approved_by text,
  approved_at timestamptz,

  document_id uuid REFERENCES public.customer_documents(id) ON DELETE SET NULL,
  supersedes_id uuid REFERENCES public.proposal_drafts(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_proposal_drafts_version CHECK (version >= 1),
  CONSTRAINT chk_proposal_drafts_status CHECK (
    status IN ('drafting', 'awaiting_approval', 'approved', 'sent', 'superseded')
  ),
  CONSTRAINT chk_proposal_drafts_our_assessment CHECK (
    our_assessment IS NULL OR our_assessment IN ('spot_build', 'retainer', 'hybrid')
  ),
  CONSTRAINT chk_proposal_drafts_customer_intent CHECK (
    customer_intent IS NULL OR customer_intent IN ('spot_build', 'retainer', 'hybrid')
  ),
  CONSTRAINT chk_proposal_drafts_final_kind CHECK (
    final_kind IN ('spot_build', 'retainer', 'hybrid', 'undecided')
  ),
  CONSTRAINT chk_proposal_drafts_payment_mode CHECK (
    payment_mode IS NULL OR payment_mode IN
      ('lump_sum', 'retainer', 'milestone', 'installments_3', 'installments_6', 'hybrid_setup_retainer')
  ),
  -- 型と支払い方式が矛盾しない(型が未定、または支払い方式が未選択の間は問わない)
  CONSTRAINT chk_proposal_drafts_kind_payment CHECK (
    final_kind = 'undecided'
    OR payment_mode IS NULL
    OR (final_kind = 'spot_build' AND payment_mode IN ('lump_sum', 'installments_3', 'installments_6', 'milestone'))
    OR (final_kind = 'retainer' AND payment_mode = 'retainer')
    OR (final_kind = 'hybrid' AND payment_mode = 'hybrid_setup_retainer')
  ),
  CONSTRAINT chk_proposal_drafts_amounts_nonneg CHECK (
    COALESCE(initial_fee, 0) >= 0 AND COALESCE(monthly_fee, 0) >= 0 AND COALESCE(discount_amount, 0) >= 0
    AND COALESCE(subtotal, 0) >= 0 AND COALESCE(tax_amount, 0) >= 0 AND COALESCE(total_amount, 0) >= 0
  ),
  CONSTRAINT chk_proposal_drafts_valid_until CHECK (
    valid_until IS NULL OR issued_on IS NULL OR valid_until >= issued_on
  ),
  -- 承認待ち以降に必要な条件。「P2の提供内容が入力済み」は jsonb の中身なので API 側で検証する。
  CONSTRAINT chk_proposal_drafts_ready_for_approval CHECK (
    status NOT IN ('awaiting_approval', 'approved', 'sent')
    OR (
      final_kind <> 'undecided'
      AND deal_id IS NOT NULL
      AND payment_mode IS NOT NULL
      AND subtotal IS NOT NULL AND tax_amount IS NOT NULL AND total_amount IS NOT NULL
      AND subtotal + tax_amount = total_amount
      AND issued_on IS NOT NULL
      AND valid_until IS NOT NULL
      AND roadmap_confirmed_at IS NOT NULL
    )
  ),
  CONSTRAINT chk_proposal_drafts_approved_fields CHECK (
    status NOT IN ('approved', 'sent') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT chk_proposal_drafts_current_not_superseded CHECK (
    NOT (is_current AND status = 'superseded')
  )
);

-- 現行版は1診断につき1件
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposal_drafts_one_current_per_diagnosis
  ON public.proposal_drafts (diagnosis_id) WHERE (is_current);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposal_drafts_diagnosis_version
  ON public.proposal_drafts (diagnosis_id, version);

CREATE INDEX IF NOT EXISTS idx_proposal_drafts_deal_id ON public.proposal_drafts(deal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_drafts_owner_status ON public.proposal_drafts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_proposal_drafts_document_id ON public.proposal_drafts(document_id);

-- ───────────────────────────────────────────────────────────
-- 3. 送付済み(sent)の版は編集不可
--    許すのは「新しい版に置き換えられた」記録だけ(status→superseded、is_current→false)。
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_sent_proposal_draft()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    IF NEW.status = 'superseded'
       AND NEW.is_current = false
       AND (pg_catalog.to_jsonb(NEW) - 'status' - 'is_current' - 'updated_at')
         = (pg_catalog.to_jsonb(OLD) - 'status' - 'is_current' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION '送付済みの提案書は編集できません。新しい版を作成してください。(id=%)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_drafts_guard_sent ON public.proposal_drafts;
CREATE TRIGGER trg_proposal_drafts_guard_sent
  BEFORE UPDATE ON public.proposal_drafts
  FOR EACH ROW EXECUTE FUNCTION public.guard_sent_proposal_draft();

-- updated_at(既存の共通関数を再利用)
DROP TRIGGER IF EXISTS trg_hearing_sheets_set_updated_at ON public.hearing_sheets;
CREATE TRIGGER trg_hearing_sheets_set_updated_at
  BEFORE UPDATE ON public.hearing_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();

DROP TRIGGER IF EXISTS trg_proposal_drafts_set_updated_at ON public.proposal_drafts;
CREATE TRIGGER trg_proposal_drafts_set_updated_at
  BEFORE UPDATE ON public.proposal_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_mst_phase1c_updated_at();

-- ───────────────────────────────────────────────────────────
-- 4. RLS(既存の customer_documents と同じ「自分の行だけ」方式)
--    ※ 承認者の限定は RLS ではなくサーバー側(別作業)。設計書 第5節。
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.hearing_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own hearing_sheets" ON public.hearing_sheets;
CREATE POLICY "Users manage own hearing_sheets" ON public.hearing_sheets
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users manage own proposal_drafts" ON public.proposal_drafts;
CREATE POLICY "Users manage own proposal_drafts" ON public.proposal_drafts
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.hearing_sheets IS '商談中のヒアリングシート。質問文はコード側定数、ここには回答と版のみ。';
COMMENT ON TABLE public.proposal_drafts IS '提案パート(P1〜P7)。章データを正とし、送付用HTMLは承認時に customer_documents へ生成する。';

-- ───────────────────────────────────────────────────────────
-- ROLLBACK(他のテーブルはこれらを参照していないため、これで元に戻る)
--   DROP TABLE IF EXISTS public.proposal_drafts, public.hearing_sheets;
--   DROP FUNCTION IF EXISTS public.guard_sent_proposal_draft();
-- ───────────────────────────────────────────────────────────
