-- Add status columns for CRM segmentation compatibility
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status text;

-- 既存データの互換性同期
UPDATE public.deals SET status = proposal_status WHERE status IS NULL AND proposal_status IS NOT NULL;
UPDATE public.customers SET status = contract_status WHERE status IS NULL AND contract_status IS NOT NULL;

COMMENT ON COLUMN public.companies.status IS '企業ステータス（active, archived等）';
COMMENT ON COLUMN public.deals.status IS '商談ステータス（proposal_statusと同期）';
COMMENT ON COLUMN public.customers.status IS '顧客ステータス（contract_statusと同期）';
