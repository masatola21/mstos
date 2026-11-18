-- 20261119010000_plan_a_nurturing_and_unified_post_meeting.sql
-- 1. 待機上限を45日（64800分）まで許可し、A案長期育成シフト（診断/資料後 11日〜29日）を確実に収容する
-- 2. レポート送付・提案書送付を統合トリガー report_or_proposal_sent と連動させ、両方送付時の重複ジョブ投入を防ぐ
-- 3. channel='both' のDBトリガー実行時も「LINE優先・未連携時メールフォールバック」を徹底する
-- 4. 既登録分岐のある連絡先へLINE友だち追加が後から発生した場合、DBトリガー側でも分岐シフト日数を反映する

CREATE OR REPLACE FUNCTION public.enqueue_marketing_automation_jobs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_trigger text;
  v_owner uuid;
  v_contact_id uuid;
  v_contact record;
  v_scenario record;
  v_scenario_trigger text;
  v_status text;
  v_tag_name text;
  v_form_type text;
  v_form_slug text;
  v_form_name text;
  v_line_deliverable boolean := false;
  v_has_email boolean := false;
  v_line_shift_days integer := 0;
  v_is_unified_post_meeting boolean := false;
  channels text[];
  channel_name text;
  message_text text;
  delay_minutes integer;
  due_time timestamptz;
  job_key text;
BEGIN
  -- owner_idの解決
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
    SELECT name INTO v_tag_name FROM public.line_tags WHERE id = nullif(v_new->>'tag_id','')::uuid;
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
    SELECT form_type, public_slug, name INTO v_form_type, v_form_slug, v_form_name
      FROM public.diagnosis_forms WHERE id = nullif(v_new->>'form_id','')::uuid;
    IF coalesce(v_form_slug,'') = 'business-diagnosis' OR (
      coalesce(v_form_type,'') = 'diagnosis'
      AND coalesce(v_form_slug,'') NOT IN ('contact-inquiry', 'material-download', 'care-package-inquiry')
      AND coalesce(v_form_name,'') NOT LIKE '%相談%'
      AND coalesce(v_form_name,'') NOT LIKE '%問い合わせ%'
      AND coalesce(v_form_name,'') NOT LIKE '%お問合せ%'
    ) THEN
      v_trigger := 'diagnosis_completed';
    ELSIF coalesce(v_form_slug,'') = 'material-download' OR (
      coalesce(v_form_slug,'') NOT IN ('contact-inquiry', 'business-diagnosis')
      AND coalesce(v_form_name,'') LIKE '%資料%'
    ) THEN
      v_trigger := 'material_requested';
    ELSE
      RETURN NEW;
    END IF;
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
    v_contact_id := nullif(v_new->>'contact_id','')::uuid;
    IF v_contact_id IS NULL THEN
      SELECT contact_id INTO v_contact_id FROM public.leads WHERE id = nullif(v_new->>'lead_id','')::uuid;
    END IF;
  ELSIF TG_TABLE_NAME = 'customer_documents' THEN
    v_contact_id := nullif(v_new->>'contact_id','')::uuid;
    IF v_contact_id IS NULL AND nullif(v_new->>'lead_id','') IS NOT NULL THEN
      SELECT contact_id INTO v_contact_id FROM public.leads WHERE id = nullif(v_new->>'lead_id','')::uuid;
    END IF;
    IF v_contact_id IS NULL AND nullif(v_new->>'company_id','') IS NOT NULL THEN
      SELECT contact_id INTO v_contact_id FROM public.leads
        WHERE company_id = v_new->>'company_id' AND contact_id IS NOT NULL
        ORDER BY updated_at DESC LIMIT 1;
      IF v_contact_id IS NULL THEN
        SELECT id INTO v_contact_id FROM public.contacts
          WHERE company_id = v_new->>'company_id'
          ORDER BY updated_at DESC LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_contact_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE id = v_contact_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_line_deliverable := coalesce(v_contact.line_user_id, '') <> '' AND EXISTS (
    SELECT 1 FROM public.line_friends lf
    WHERE lf.line_user_id = v_contact.line_user_id
      AND lf.status = 'active'
      AND lf.consent_status = 'opted_in'
  );
  v_has_email := coalesce(v_contact.email, '') <> '' AND coalesce(v_contact.email_consent_status, '') <> 'opted_out';

  -- line_registered 時に既にWebフォーム履歴・分岐タグがあればA案シフト日数を算出
  IF v_trigger = 'line_registered' THEN
    IF EXISTS (SELECT 1 FROM public.leads WHERE contact_id = v_contact_id AND status IN ('資料請求', '診断申込'))
       OR EXISTS (SELECT 1 FROM public.diagnosis_submissions WHERE contact_id = v_contact_id) THEN
      v_line_shift_days := 9;
    ELSIF EXISTS (SELECT 1 FROM public.leads WHERE contact_id = v_contact_id AND status = '相談申込') THEN
      v_line_shift_days := 3;
    END IF;
  END IF;

  -- 対象シナリオの検索とジョブ投入
  FOR v_scenario IN SELECT scenario_id, config FROM public.marketing_automation_scenarios WHERE owner_id = v_owner LOOP
    v_scenario_trigger := coalesce(v_scenario.config->>'trigger', '');
    IF coalesce((v_scenario.config->>'automationEnabled')::boolean, false) IS NOT TRUE THEN
      CONTINUE;
    END IF;

    IF NOT (
      v_scenario_trigger = v_trigger
      OR (v_trigger IN ('report_sent', 'proposal_sent') AND v_scenario_trigger = 'report_or_proposal_sent')
    ) THEN
      CONTINUE;
    END IF;

    IF v_trigger = 'tag_added' AND coalesce(v_scenario.config->>'targetTag','') <> '' THEN
      IF coalesce(v_tag_name,'') <> (v_scenario.config->>'targetTag') THEN
        CONTINUE;
      END IF;
    END IF;

    v_is_unified_post_meeting := (v_scenario_trigger = 'report_or_proposal_sent');

    -- レポート＆提案書 統合フォローは、別種書類を後から送っても14日以内は重複スケジュールしない
    IF v_is_unified_post_meeting AND EXISTS (
      SELECT 1 FROM public.marketing_automation_jobs
      WHERE contact_id = v_contact_id
        AND scenario_id = v_scenario.scenario_id
        AND (
          status IN ('queued', 'processing')
          OR (status = 'sent' AND created_at > (now() - interval '14 days'))
        )
    ) THEN
      CONTINUE;
    END IF;

    IF v_scenario.config->>'channel' = 'both' THEN
      IF v_line_deliverable THEN
        channels := ARRAY['line'];
      ELSIF v_has_email THEN
        channels := ARRAY['email'];
      ELSE
        channels := ARRAY[]::text[];
      END IF;
    ELSIF v_scenario.config->>'channel' = 'email' THEN
      channels := CASE WHEN v_has_email THEN ARRAY['email'] ELSE ARRAY[]::text[] END;
    ELSE
      channels := CASE WHEN v_line_deliverable THEN ARRAY['line'] ELSE ARRAY[]::text[] END;
    END IF;

    FOREACH channel_name IN ARRAY channels LOOP
      -- 【重複防止 1】すでに queued または processing 状態の同一シナリオ・チャネルジョブがあれば投入をスキップ
      IF EXISTS (
        SELECT 1 FROM public.marketing_automation_jobs
        WHERE contact_id = v_contact_id
          AND scenario_id = v_scenario.scenario_id
          AND channel = channel_name
          AND status IN ('queued', 'processing')
      ) THEN
        CONTINUE;
      END IF;

      -- 【重複防止 2】直近2分以内に投入された同一コンタクト・シナリオ・チャネルのジョブがあればスキップ
      IF EXISTS (
        SELECT 1 FROM public.marketing_automation_jobs
        WHERE contact_id = v_contact_id
          AND scenario_id = v_scenario.scenario_id
          AND channel = channel_name
          AND created_at > (now() - interval '2 minutes')
      ) THEN
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

      delay_minutes := greatest(
        0,
        least(coalesce((v_scenario.config->>'waitMinutes')::integer, 0) + (CASE WHEN v_trigger = 'line_registered' THEN v_line_shift_days * 1440 ELSE 0 END), 64800)
      );
      due_time := now() + make_interval(mins => delay_minutes);
      job_key := CASE
        WHEN v_is_unified_post_meeting THEN concat('report_or_proposal_sent:', v_contact_id, ':', v_scenario.scenario_id, ':', channel_name)
        WHEN v_trigger = 'line_registered' AND v_line_shift_days > 0 THEN concat('education_delayed:line_registered:', v_contact_id, ':', v_scenario.scenario_id, ':', channel_name)
        ELSE concat(v_trigger, ':', v_contact_id, ':', v_scenario.scenario_id, ':', channel_name)
      END;

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

-- 旧タイトルの第7話と最新タイトルの第7話が重複している場合のみ、旧タイトル側（一時停止中の旧版）を整理
DELETE FROM public.marketing_automation_scenarios old_row
WHERE coalesce(old_row.config->>'name', '') LIKE '【第7話・最終話】自分がいないと現場が回らない状態から%'
  AND EXISTS (
    SELECT 1 FROM public.marketing_automation_scenarios new_row
    WHERE new_row.owner_id = old_row.owner_id
      AND coalesce(new_row.config->>'name', '') = '【第7話・最終話】「自分がいなくても回る会社」への最初の一歩'
  );

