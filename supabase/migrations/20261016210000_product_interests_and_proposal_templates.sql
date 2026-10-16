-- Associate lead/prospect service interest with the product catalog and keep reusable proposal templates.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS recommended_product_id text
    REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS interested_product_id text
    REFERENCES public.products(id) ON DELETE SET NULL;

-- Preserve existing free-text service names while linking exact, unambiguous catalog matches.
WITH unique_products AS (
  SELECT min(id) AS id, product_name
  FROM public.products
  GROUP BY product_name
  HAVING count(*) = 1
)
UPDATE public.leads AS lead
SET interested_product_id = product.id
FROM unique_products AS product
WHERE lead.interested_product_id IS NULL
  AND trim(lead.service_type) = product.product_name;

CREATE TABLE IF NOT EXISTS public.proposal_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  initial_fee numeric,
  monthly_fee numeric,
  total_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS proposal_plan_template_id uuid
    REFERENCES public.proposal_plan_templates(id) ON DELETE SET NULL;

ALTER TABLE public.proposal_plan_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_plan_templates TO authenticated;

DROP POLICY IF EXISTS "Owners manage proposal plan templates" ON public.proposal_plan_templates;
CREATE POLICY "Owners manage proposal plan templates"
  ON public.proposal_plan_templates
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS proposal_plan_templates_owner_product_idx
  ON public.proposal_plan_templates(owner_id, product_id);
