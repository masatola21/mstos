-- Extend the existing template categories without changing saved templates or RLS.
ALTER TABLE public.communication_templates
  DROP CONSTRAINT IF EXISTS communication_templates_category_check;

ALTER TABLE public.communication_templates
  ADD CONSTRAINT communication_templates_category_check
  CHECK (category IN ('document', 'form', 'diagnosis', 'deal', 'customer_meeting', 'announcement'));
