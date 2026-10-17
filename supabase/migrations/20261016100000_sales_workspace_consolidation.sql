-- Sales workspace: saved CRM segments, generated documents, customer operations and a single send outbox.
-- CRM entities remain the source of truth; these tables reference their IDs and do not copy contact records.

CREATE TABLE IF NOT EXISTS public.crm_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('companies','contacts','prospects','leads','deals','customers')),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('proposal','diagnosis_report','contract','invoice','other')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, template_key)
);

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('proposal','diagnosis_report','contract','invoice','other')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','approved','queued','sent','failed','archived')),
  body_html text NOT NULL DEFAULT '',
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id text REFERENCES public.deals(id) ON DELETE SET NULL,
  diagnosis_id uuid REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  legacy_id text,
  counterparty_name text,
  contract_type text NOT NULL DEFAULT 'service_agreement',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','sent','signed','expired','canceled')),
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id text REFERENCES public.deals(id) ON DELETE SET NULL,
  product_id text, -- Matrix product ID; product master is currently persisted in workspace state
  document_id uuid REFERENCES public.customer_documents(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  legacy_id text,
  title text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','issued','paid','overdue','canceled')),
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.customer_contracts(id) ON DELETE SET NULL,
  product_id text, -- Matrix product ID; product master is currently persisted in workspace state
  document_id uuid REFERENCES public.customer_documents(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2),
  notes text,
  issue_date date,
  due_date date,
  paid_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.customer_service_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.customer_contracts(id) ON DELETE SET NULL,
  service_type text NOT NULL CHECK (service_type IN ('retainer','implementation_support')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','paused','completed','canceled')),
  next_meeting_at timestamptz,
  milestone_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- All email/LINE sends, including document delivery, enter one auditable queue.
-- Actual provider delivery is enabled only after server-side credentials and a sender are configured.
CREATE TABLE IF NOT EXISTS public.communication_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','line')),
  recipient_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  recipient_address text NOT NULL,
  subject text,
  body_text text NOT NULL DEFAULT '',
  document_id uuid REFERENCES public.customer_documents(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','queued','sending','sent','failed','canceled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'crm_segments','customer_document_templates','customer_documents','customer_contracts','customer_invoices',
    'customer_service_engagements','communication_outbox'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)',
      'Users manage own ' || table_name, table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_segments_owner ON public.crm_segments(owner_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_customer_document_templates_owner ON public.customer_document_templates(owner_id, document_type);
CREATE INDEX IF NOT EXISTS idx_customer_documents_owner_status ON public.customer_documents(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_owner_status ON public.customer_contracts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_owner_due ON public.customer_invoices(owner_id, due_date);
CREATE INDEX IF NOT EXISTS idx_customer_services_owner_type ON public.customer_service_engagements(owner_id, service_type, status);
CREATE INDEX IF NOT EXISTS idx_communication_outbox_owner_status ON public.communication_outbox(owner_id, status, scheduled_at);

COMMENT ON TABLE public.crm_segments IS 'Saved CRM filters; stores conditions only, never duplicated contact rows.';
COMMENT ON TABLE public.customer_document_templates IS 'Owner-scoped reusable templates used to generate customer documents.';
COMMENT ON TABLE public.customer_documents IS 'Generated customer documents linked to their CRM source records.';
COMMENT ON TABLE public.customer_contracts IS 'Post-sale contract lifecycle linked to company, contact, deal, product and document.';
COMMENT ON TABLE public.customer_invoices IS 'Invoice lifecycle and payment state; notices are sent through communication_outbox.';
COMMENT ON TABLE public.customer_service_engagements IS 'Retainer and implementation-support delivery after contract.';
COMMENT ON TABLE public.communication_outbox IS 'Single auditable queue for LINE/email and document sends.';


-- Preserve contracts and invoices already stored in the synchronized workspace JSON.
-- legacy_id makes the import idempotent and allows the old workspace state to remain recoverable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contracts_legacy_id ON public.customer_contracts(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_invoices_legacy_id ON public.customer_invoices(owner_id, legacy_id) WHERE legacy_id IS NOT NULL;

INSERT INTO public.customer_contracts
  (owner_id, legacy_id, title, counterparty_name, contract_type, status, company_id, product_id, amount, start_date, end_date, notes, created_at, updated_at)
SELECT
  ws.user_id,
  item->>'id',
  COALESCE(NULLIF(item->>'title',''), '旧契約'),
  NULLIF(item->>'counterpartyName',''),
  COALESCE(NULLIF(item->>'type',''), 'service_agreement'),
  CASE WHEN item->>'status' IN ('draft','under_review','sent','signed','expired','canceled') THEN item->>'status' ELSE 'draft' END,
  NULLIF(item->>'companyId',''),
  NULLIF(item->>'productId',''),
  COALESCE(NULLIF(item->>'amount','')::numeric, 0),
  NULLIF(item->>'startDate','')::date,
  NULLIF(item->>'endDate','')::date,
  NULLIF(item->>'notes',''),
  CASE WHEN COALESCE(item->>'createdAt','') ~ '^[0-9]{13}$'
       THEN to_timestamp((item->>'createdAt')::double precision / 1000)
       ELSE COALESCE(NULLIF(item->>'createdAt','')::timestamptz, now()) END,
  CASE WHEN COALESCE(item->>'updatedAt','') ~ '^[0-9]{13}$'
       THEN to_timestamp((item->>'updatedAt')::double precision / 1000)
       ELSE COALESCE(NULLIF(item->>'updatedAt','')::timestamptz, now()) END
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'contracts','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING;

INSERT INTO public.customer_invoices
  (owner_id, legacy_id, invoice_number, title, recipient_name, status, company_id, product_id, amount, issue_date, due_date, paid_at, created_at, updated_at)
SELECT
  ws.user_id,
  item->>'id',
  COALESCE(NULLIF(item->>'invoiceNumber',''), 'LEGACY-' || left(item->>'id', 24)),
  COALESCE(NULLIF(item->>'title',''), '旧請求'),
  NULLIF(item->>'recipientName',''),
  CASE WHEN item->>'status' IN ('draft','awaiting_approval','issued','paid','overdue','canceled') THEN item->>'status' ELSE 'draft' END,
  NULLIF(item->>'companyId',''),
  NULLIF(item->>'productId',''),
  COALESCE(NULLIF(item->>'amount','')::numeric, 0),
  NULLIF(item->>'issueDate','')::date,
  NULLIF(item->>'dueDate','')::date,
  NULLIF(item->>'paidDate','')::date,
  CASE WHEN COALESCE(item->>'createdAt','') ~ '^[0-9]{13}$'
       THEN to_timestamp((item->>'createdAt')::double precision / 1000)
       ELSE COALESCE(NULLIF(item->>'createdAt','')::timestamptz, now()) END,
  CASE WHEN COALESCE(item->>'updatedAt','') ~ '^[0-9]{13}$'
       THEN to_timestamp((item->>'updatedAt')::double precision / 1000)
       ELSE COALESCE(NULLIF(item->>'updatedAt','')::timestamptz, now()) END
FROM public.mst_workspace_state ws
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ws.data->'invoices','[]'::jsonb)) item
WHERE NULLIF(item->>'id','') IS NOT NULL
ON CONFLICT (owner_id, legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING;
