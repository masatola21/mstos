-- ========================================================
-- LINE自動化・あいさつ・シナリオ配信・同意ステータス修復マイグレーション
-- ========================================================

-- 1. 既存の有効なLINE友だちの配信同意を opted_in に更新
-- （友だち追加済みユーザーへのシナリオ配信・配信チェックをパスさせるため）
UPDATE public.line_friends
SET consent_status = 'opted_in'
WHERE status = 'active' AND (consent_status IS NULL OR consent_status = 'unknown');

-- 2. line_channel_integrations の自動返信デフォルトを有効化
UPDATE public.line_channel_integrations
SET auto_reply_enabled = true
WHERE auto_reply_enabled IS NULL;

-- 3. enqueue_marketing_automation_jobs 関数の修正
-- （LINE Webhook等の service_role 経由で auth.uid() が NULL の場合でも、
--   管理者の owner_id を自動補完してシナリオジョブを投入できるように改善）
CREATE OR REPLACE FUNCTION public.enqueue_marketing_automation_jobs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_trigger text;
  v_owner uuid;
  v_contact_id uuid;
  v_company_id uuid;
  v_lead_id uuid;
  v_contact record;
  v_scenario record;
  v_segment record;
  v_candidate jsonb;
  v_field text;
  v_value text;
  v_channel text;
  v_body text;
  v_payload jsonb;
  v_due timestamptz;
  v_status text;
  v_key text;
  channels text[];
  channel_name text;
  message_text text;
  payload jsonb;
  delay_minutes integer;
  due_time timestamptz;
  job_key text;
BEGIN
  -- owner_idの解決（セッションがあれば auth.uid()、無ければインテグレーションまたは管理者から取得）
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    SELECT owner_id INTO v_owner FROM public.line_channel_integrations LIMIT 1;
    IF v_owner IS NULL THEN
      SELECT id INTO v_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'leads' AND TG_OP = 'INSERT' THEN
    v_trigger := 'lead_created';
  ELSIF TG_TABLE_NAME = 'contacts' AND (TG_OP = 'INSERT' OR coalesce(v_old->>'line_user_id','') = '') AND coalesce(v_new->>'line_user_id','') <> '' THEN
    v_trigger := 'line_registered';
  ELSIF TG_TABLE_NAME = 'prospects' AND TG_OP = 'UPDATE'
    AND (coalesce(v_old->>'is_selected','false') <> coalesce(v_new->>'is_selected','false')
      OR coalesce(v_old->>'status','') <> coalesce(v_new->>'status',''))
    AND (lower(coalesce(v_new->>'status','')) IN ('selected','target','営業対象') OR lower(coalesce(v_new->>'is_selected',''))='true') THEN
    v_trigger := 'prospect_selected';
  ELSIF TG_TABLE_NAME = 'line_friend_tags' AND TG_OP = 'INSERT' THEN
    v_trigger := 'tag_added';
  ELSIF TG_TABLE_NAME = 'customer_service_engagements' AND TG_OP = 'UPDATE'
    AND coalesce(v_old->>'status','') <> coalesce(v_new->>'status','')
    AND lower(coalesce(v_new->>'status','')) IN ('completed','complete','done','完了') THEN
    v_trigger := 'meeting_completed';
  ELSIF TG_TABLE_NAME = 'customer_invoices' AND TG_OP IN ('INSERT','UPDATE') THEN
    IF TG_OP='UPDATE' THEN
      UPDATE public.marketing_automation_jobs SET status='failed', error_message='請求情報が更新されたため予約配信を再評価します。', updated_at=now()
        WHERE owner_id=v_owner AND status='queued' AND event_key LIKE 'customer_invoices:'||coalesce(v_new->>'id','')||':%';
    END IF;
    IF TG_OP='UPDATE' AND lower(coalesce(v_new->>'status','')) IN ('paid','paid_full','cancelled','canceled') THEN
      UPDATE public.marketing_automation_jobs SET status='failed', error_message='請求状態が変更されたため予約配信を停止しました。', updated_at=now()
        WHERE owner_id=v_owner AND status='queued' AND event_key LIKE 'customer_invoices:'||coalesce(v_new->>'id','')||':%';
      RETURN NEW;
    END IF;
    v_trigger := 'invoice_due';
  ELSIF TG_TABLE_NAME = 'deals' AND TG_OP = 'UPDATE' AND coalesce(v_old->>'stage','') <> coalesce(v_new->>'stage','') THEN
    v_trigger := 'deal_stage_changed';
  ELSIF TG_TABLE_NAME = 'deals' AND TG_OP = 'UPDATE' AND coalesce(v_old->>'status','') <> coalesce(v_new->>'status','') THEN
    v_trigger := 'deal_stage_changed';
  ELSIF TG_TABLE_NAME = 'customer_contracts' AND TG_OP = 'UPDATE'
    AND coalesce(v_old->>'status','') <> coalesce(v_new->>'status','')
    AND lower(coalesce(v_new->>'status','')) IN ('sent','signed','active','executed','締結済み') THEN
    IF lower(coalesce(v_new->>'status','')) = 'sent' THEN v_trigger := 'contract_sent';
    ELSE v_trigger := 'contract_signed'; END IF;
  ELSIF TG_TABLE_NAME = 'customer_documents' AND TG_OP = 'UPDATE'
    AND coalesce(v_old->>'status','') <> coalesce(v_new->>'status','')
    AND lower(coalesce(v_new->>'status','')) IN ('approved','sent','signed','signed_complete') THEN
    v_status := lower(coalesce(v_new->>'status',''));
    IF v_status IN ('signed','signed_complete') AND lower(coalesce(v_new->>'document_type','')) LIKE '%contract%' THEN v_trigger := 'contract_signed';
    ELSIF v_status = 'sent' AND lower(coalesce(v_new->>'document_type','')) LIKE '%contract%' THEN v_trigger := 'contract_sent';
    ELSIF v_status = 'approved' AND lower(coalesce(v_new->>'document_type','')) LIKE '%proposal%' THEN v_trigger := 'proposal_approved';
    ELSIF v_status = 'approved' AND (lower(coalesce(v_new->>'document_type','')) LIKE '%report%' OR lower(coalesce(v_new->>'document_type','')) LIKE '%diagnosis%') THEN v_trigger := 'report_approved';
    ELSIF v_status = 'sent' AND lower(coalesce(v_new->>'document_type','')) LIKE '%proposal%' THEN v_trigger := 'proposal_sent';
    ELSIF v_status = 'sent' AND (lower(coalesce(v_new->>'document_type','')) LIKE '%report%' OR lower(coalesce(v_new->>'document_type','')) LIKE '%diagnosis%') THEN v_trigger := 'report_sent';
    ELSE RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'diagnosis_submissions' AND TG_OP = 'INSERT' THEN
    v_trigger := 'diagnosis_completed';
  ELSE
    RETURN NEW;
  END IF;

  -- 連絡先IDの解決
  IF TG_TABLE_NAME = 'contacts' THEN
    v_contact_id := (v_new->>'id')::uuid;
  ELSIF TG_TABLE_NAME = 'leads' THEN
    v_contact_id := nullif(v_new->>'contact_id','')::uuid;
  ELSIF TG_TABLE_NAME = 'line_friend_tags' THEN
    SELECT contact_id INTO v_contact_id FROM public.line_friends WHERE id = nullif(v_new->>'line_friend_id','')::uuid;
  ELSIF TG_TABLE_NAME = 'diagnosis_submissions' THEN
    SELECT contact_id INTO v_contact_id FROM public.leads WHERE id = nullif(v_new->>'lead_id','')::uuid;
  END IF;

  IF v_contact_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE id = v_contact_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- 対象シナリオの検索とジョブ投入
  FOR v_scenario IN SELECT scenario_id, config FROM public.marketing_automation_scenarios WHERE owner_id = v_owner LOOP
    IF coalesce((v_scenario.config->>'automationEnabled')::boolean,false) IS NOT TRUE
      OR coalesce(v_scenario.config->>'trigger','') <> v_trigger THEN
      CONTINUE;
    END IF;

    channels := CASE v_scenario.config->>'channel' WHEN 'both' THEN ARRAY['email','line'] WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['line'] END;
    FOREACH channel_name IN ARRAY channels LOOP
      IF channel_name = 'line' AND (v_contact.line_user_id IS NULL OR v_contact.line_user_id = '') THEN
        CONTINUE;
      END IF;
      IF channel_name = 'email' AND (v_contact.email IS NULL OR v_contact.email = '') THEN
        CONTINUE;
      END IF;

      IF channel_name = 'email' THEN
        message_text := coalesce(v_scenario.config->>'emailBody','');
      ELSE
        message_text := coalesce(v_scenario.config->>'messageBody','');
        IF message_text = '' AND coalesce(v_scenario.config->>'lineMessageType','') = 'flex' THEN
          message_text := concat_ws(E'\n', nullif(v_scenario.config->>'flexTitle',''), nullif(v_scenario.config->>'flexBody',''));
        END IF;
      END IF;

      IF message_text = '' AND NOT (channel_name='line' AND coalesce(v_scenario.config->>'lineMessageType','') IN ('video','image')) THEN
        CONTINUE;
      END IF;

      delay_minutes := greatest(0, least(coalesce((v_scenario.config->>'waitMinutes')::integer, 0), 10080));
      due_time := now() + make_interval(mins => delay_minutes);
      job_key := concat(TG_TABLE_NAME, ':', coalesce(v_new->>'id',''), ':', v_trigger, ':', v_scenario.scenario_id, ':', channel_name);

      INSERT INTO public.marketing_automation_jobs(
        owner_id, event_key, scenario_id, contact_id, channel, subject, body_text, line_message_payload, consent_basis, due_at, status
      )
      VALUES (
        v_owner, job_key, v_scenario.scenario_id, v_contact_id, channel_name,
        nullif(v_scenario.config->>'emailSubject',''), message_text,
        NULL,
        coalesce(v_scenario.config->>'consentBasis', '配信同意に基づく'),
        due_time, 'queued'
      )
      ON CONFLICT(owner_id, event_key) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END $$;
