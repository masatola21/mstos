-- Add status column to companies table for CRM segmentation compatibility
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

COMMENT ON COLUMN public.companies.status IS '企業ステータス（active, archived等）';
