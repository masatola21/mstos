ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS phase text;

COMMENT ON COLUMN public.products.phase IS '商品別の提案フォーマットへ差し込む提供フェーズ';
