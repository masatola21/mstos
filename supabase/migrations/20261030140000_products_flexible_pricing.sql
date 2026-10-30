-- Migration: products flexible pricing support
-- Adds pricing_model, price_range_max, and price_note columns to products table

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_model pg_catalog.text DEFAULT 'fixed';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_range_max pg_catalog.int8;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_note pg_catalog.text;

-- Comment on columns for clear documentation
COMMENT ON COLUMN public.products.pricing_model IS 'Pricing model: fixed (固定価格), starting_at (最低価格〜), range (価格帯), custom_quote (個別見積・商談時決定)';
COMMENT ON COLUMN public.products.price_range_max IS 'Upper bound for range pricing model';
COMMENT ON COLUMN public.products.price_note IS 'Flexible pricing guidelines or notes for sales negotiations';
