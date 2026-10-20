-- Private owner-scoped storage for marketing drafts, website/LP source files, and creative assets.
CREATE TABLE IF NOT EXISTS public.mst_marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('draft', 'website', 'landing_page', 'image', 'video', 'document', 'other')),
  source text NOT NULL CHECK (source IN ('upload', 'url')),
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  strategy_record_id text,
  tool_record_id text,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mst_marketing_assets_source_location_check CHECK (
    (source = 'upload' AND storage_path IS NOT NULL AND external_url IS NULL)
    OR (source = 'url' AND external_url IS NOT NULL AND storage_path IS NULL)
  )
);

ALTER TABLE public.mst_marketing_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own marketing assets" ON public.mst_marketing_assets;
CREATE POLICY "Users manage own marketing assets"
  ON public.mst_marketing_assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mst_marketing_assets TO authenticated;

CREATE INDEX IF NOT EXISTS idx_mst_marketing_assets_user_updated
  ON public.mst_marketing_assets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_marketing_assets_user_links
  ON public.mst_marketing_assets(user_id, strategy_record_id, tool_record_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mst-marketing-assets', 'mst-marketing-assets', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Users manage own marketing asset files" ON storage.objects;
CREATE POLICY "Users manage own marketing asset files"
  ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'mst-marketing-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mst-marketing-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
