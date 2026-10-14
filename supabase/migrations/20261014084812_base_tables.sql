/*
# MST AI経営OS 基本テーブル作成（Part 1-5）

1. New Tables (6 total): companies, prospects, leads, products, deals, customers
2. Indexes on FK columns
3. RLS enabled + authenticated policies (SELECT/INSERT/UPDATE)
4. updated_at auto-trigger on all 6 tables
*/

CREATE TABLE IF NOT EXISTS public.companies (
  id pg_catalog.text PRIMARY KEY,
  company_name pg_catalog.text NOT NULL,
  industry pg_catalog.text,
  contact_name pg_catalog.text,
  website pg_catalog.text,
  email pg_catalog.text,
  phone pg_catalog.text,
  social_account pg_catalog.text,
  postal_code pg_catalog.text,
  address pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.prospects (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source pg_catalog.text,
  approach_method pg_catalog.text,
  status pg_catalog.text,
  reply_flag pg_catalog.bool,
  last_reply_at pg_catalog.timestamptz,
  registered_at pg_catalog.timestamptz,
  email_step pg_catalog.text,
  email_step_started_at pg_catalog.timestamptz,
  last_contacted_at pg_catalog.timestamptz,
  memo pg_catalog.text,
  ai_score pg_catalog.int4,
  ai_reason pg_catalog.text,
  target_flag pg_catalog.bool,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  line_user_id pg_catalog.text,
  source pg_catalog.text,
  service_type pg_catalog.text,
  status pg_catalog.text,
  priority_channel pg_catalog.text,
  first_registered_at pg_catalog.timestamptz,
  last_contacted_at pg_catalog.timestamptz,
  next_action_at pg_catalog.timestamptz,
  meeting_date pg_catalog.date,
  meeting_start_time pg_catalog.text,
  report_url pg_catalog.text,
  email_step pg_catalog.text,
  email_step_started_at pg_catalog.timestamptz,
  notes pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id pg_catalog.text PRIMARY KEY,
  product_name pg_catalog.text NOT NULL,
  product_type pg_catalog.text,
  initial_fee pg_catalog.int4,
  monthly_fee pg_catalog.int4,
  description pg_catalog.text,
  status pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id pg_catalog.text PRIMARY KEY,
  company_id pg_catalog.text NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  lead_id pg_catalog.uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  meeting_date pg_catalog.date,
  next_followup_at pg_catalog.timestamptz,
  product_id pg_catalog.text REFERENCES public.products(id) ON DELETE SET NULL,
  proposal_plan_name pg_catalog.text NOT NULL,
  proposal_type pg_catalog.text,
  initial_fee pg_catalog.int4,
  monthly_fee pg_catalog.int4,
  discount_amount pg_catalog.int4,
  total_amount pg_catalog.int4,
  proposal_created pg_catalog.bool,
  proposal_url pg_catalog.text,
  proposal_date pg_catalog.date,
  proposal_status pg_catalog.text,
  memo pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id pg_catalog.uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id pg_catalog.text NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  contract_status pg_catalog.text,
  contract_start_date pg_catalog.date,
  last_updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
  memo pg_catalog.text,
  created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_company_id ON public.prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON public.deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
CREATE POLICY "Allow authenticated read companies" ON public.companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert companies" ON public.companies;
CREATE POLICY "Allow authenticated insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update companies" ON public.companies;
CREATE POLICY "Allow authenticated update companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read prospects" ON public.prospects;
CREATE POLICY "Allow authenticated read prospects" ON public.prospects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert prospects" ON public.prospects;
CREATE POLICY "Allow authenticated insert prospects" ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update prospects" ON public.prospects;
CREATE POLICY "Allow authenticated update prospects" ON public.prospects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read leads" ON public.leads;
CREATE POLICY "Allow authenticated read leads" ON public.leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert leads" ON public.leads;
CREATE POLICY "Allow authenticated insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update leads" ON public.leads;
CREATE POLICY "Allow authenticated update leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read products" ON public.products;
CREATE POLICY "Allow authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert products" ON public.products;
CREATE POLICY "Allow authenticated insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update products" ON public.products;
CREATE POLICY "Allow authenticated update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read deals" ON public.deals;
CREATE POLICY "Allow authenticated read deals" ON public.deals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert deals" ON public.deals;
CREATE POLICY "Allow authenticated insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update deals" ON public.deals;
CREATE POLICY "Allow authenticated update deals" ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read customers" ON public.customers;
CREATE POLICY "Allow authenticated read customers" ON public.customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert customers" ON public.customers;
CREATE POLICY "Allow authenticated insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update customers" ON public.customers;
CREATE POLICY "Allow authenticated update customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_companies_set_updated_at ON public.companies;
CREATE TRIGGER trg_companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_prospects_set_updated_at ON public.prospects;
CREATE TRIGGER trg_prospects_set_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_leads_set_updated_at ON public.leads;
CREATE TRIGGER trg_leads_set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_products_set_updated_at ON public.products;
CREATE TRIGGER trg_products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_deals_set_updated_at ON public.deals;
CREATE TRIGGER trg_deals_set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.prospects.last_contacted_at IS '最終接触日時';
COMMENT ON COLUMN public.deals.proposal_plan_name IS '提案プラン名・商談名';
COMMENT ON COLUMN public.deals.total_amount IS '想定商談総額 (円)';
COMMENT ON COLUMN public.customers.last_updated_at IS '顧客レコード最終更新日時';
