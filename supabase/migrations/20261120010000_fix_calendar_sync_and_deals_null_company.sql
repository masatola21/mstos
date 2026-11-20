-- ==============================================================================
-- 20261120010000_fix_calendar_sync_and_deals_null_company.sql
--
-- 1. automation_controls.target に 'google_calendar_ical' を正式許可する
-- 2. deals.company_id の NOT NULL 制約を緩和し、会社名未入力のTimeRex予約等でも
--    商談パイプライン登録が制約違反で落ちないようにする
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  constraint_rec record;
BEGIN
  FOR constraint_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.automation_controls'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%target%'
  LOOP
    EXECUTE format('ALTER TABLE public.automation_controls DROP CONSTRAINT %I', constraint_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.automation_controls
  ADD CONSTRAINT automation_controls_target_check
  CHECK (target IN ('all', 'ai', 'send', 'billing', 'google_calendar_ical'));

ALTER TABLE public.deals
  ALTER COLUMN company_id DROP NOT NULL;

COMMIT;
