-- 商談パイプライン(deals) / リード管理(leads) の 1社1件 一意制約案
--
-- 状態: ドラフト。アプリ側は本マイグレーション未適用でも重複統合・競合吸収が安全に動作します。
-- 前提: アプリ上で「同じ会社の重複を1行に統合」を実行し、既存重複を解消した後に
--       Supabase SQL Editor で実行してください（冪等）。

CREATE UNIQUE INDEX IF NOT EXISTS uq_deals_company_id
  ON public.deals (company_id)
  WHERE company_id IS NOT NULL AND company_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_company_id
  ON public.leads (company_id)
  WHERE company_id IS NOT NULL AND company_id <> '';

-- 取り消し:
--   DROP INDEX IF EXISTS public.uq_deals_company_id;
--   DROP INDEX IF EXISTS public.uq_leads_company_id;
