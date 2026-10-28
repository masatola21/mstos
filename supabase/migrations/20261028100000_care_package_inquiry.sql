-- Migration: 20261028100000_care_package_inquiry.sql
-- Purpose: Add inquiry_type column and index to public.leads for care package inquiries.
-- Idempotent: Can be safely re-run without errors.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inquiry_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_inquiry_type_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_inquiry_type_check
      CHECK (inquiry_type IS NULL OR inquiry_type IN ('資料請求', '開業相談', '両方希望'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_inquiry_type ON public.leads (inquiry_type);

COMMENT ON COLUMN public.leads.inquiry_type IS '介護保険外サービス等の問い合わせ種別（資料請求 / 開業相談 / 両方希望）';
