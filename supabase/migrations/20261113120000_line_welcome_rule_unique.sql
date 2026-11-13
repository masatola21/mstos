-- Ensure a single __welcome__ rule per owner in line_auto_reply_rules
-- Deduplicate any existing __welcome__ rows before creating partial unique index
WITH ranked_welcome AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.line_auto_reply_rules
  WHERE match_text = '__welcome__'
)
DELETE FROM public.line_auto_reply_rules
WHERE id IN (SELECT id FROM ranked_welcome WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_auto_reply_rules_owner_welcome_unique
  ON public.line_auto_reply_rules (owner_id)
  WHERE match_text = '__welcome__';
