ALTER TABLE public.communication_templates
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

UPDATE public.communication_templates
SET name = template_key
WHERE name = '';

NOTIFY pgrst, 'reload schema';
