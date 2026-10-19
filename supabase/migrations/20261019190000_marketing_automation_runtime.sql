create table if not exists public.marketing_automation_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  unique(owner_id, scenario_id)
);
alter table public.marketing_automation_scenarios enable row level security;
drop policy if exists "Owners manage marketing scenarios" on public.marketing_automation_scenarios;
create policy "Owners manage marketing scenarios" on public.marketing_automation_scenarios
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.marketing_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  scenario_id text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null check (channel in ('email','line')),
  subject text,
  body_text text not null,
  line_message_payload jsonb,
  consent_basis text not null,
  due_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, event_key)
);
alter table public.marketing_automation_jobs enable row level security;
drop policy if exists "Owners read marketing automation jobs" on public.marketing_automation_jobs;
create policy "Owners read marketing automation jobs" on public.marketing_automation_jobs
  for select using (auth.uid() = owner_id);
drop policy if exists "Owners enqueue marketing automation jobs" on public.marketing_automation_jobs;
create policy "Owners enqueue marketing automation jobs" on public.marketing_automation_jobs
  for insert with check (auth.uid() = owner_id);
create index if not exists marketing_automation_jobs_due_idx on public.marketing_automation_jobs(status, due_at);

create or replace function public.enqueue_marketing_automation_jobs()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_trigger text;
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
begin
  if auth.uid() is null then return NEW; end if;
  if TG_TABLE_NAME = 'leads' and TG_OP = 'INSERT' then
    v_trigger := 'lead_created';
  elsif TG_TABLE_NAME = 'contacts' and (TG_OP = 'INSERT' or coalesce(v_old->>'line_user_id','') = '') and coalesce(v_new->>'line_user_id','') <> '' then
    v_trigger := 'line_registered';
  elsif TG_TABLE_NAME = 'prospects' and TG_OP = 'UPDATE'
    and (coalesce(v_old->>'is_selected','false') <> coalesce(v_new->>'is_selected','false')
      or coalesce(v_old->>'status','') <> coalesce(v_new->>'status',''))
    and (lower(coalesce(v_new->>'status','')) in ('selected','target','営業対象') or lower(coalesce(v_new->>'is_selected',''))='true') then
    v_trigger := 'prospect_selected';
  elsif TG_TABLE_NAME = 'line_friend_tags' and TG_OP = 'INSERT' then
    v_trigger := 'tag_added';
  elsif TG_TABLE_NAME = 'customer_service_engagements' and TG_OP = 'UPDATE'
    and coalesce(v_old->>'status','') <> coalesce(v_new->>'status','')
    and lower(coalesce(v_new->>'status','')) in ('completed','complete','done','完了') then
    v_trigger := 'meeting_completed';
  elsif TG_TABLE_NAME = 'invoices' and TG_OP in ('INSERT','UPDATE') then
    if TG_OP='UPDATE' and lower(coalesce(v_new->>'status','')) in ('paid','paid_full','cancelled','canceled') then
      update public.marketing_automation_jobs set status='failed', error_message='請求状態が変更されたため予約配信を停止しました。', updated_at=now()
        where owner_id=auth.uid() and status='queued' and event_key like 'invoices:'||coalesce(v_new->>'id','')||':%';
      return NEW;
    end if;
    v_trigger := 'invoice_due';
  elsif TG_TABLE_NAME = 'deals' and TG_OP = 'UPDATE' and coalesce(v_old->>'stage','') <> coalesce(v_new->>'stage','') then
    v_trigger := 'deal_stage_changed';
  elsif TG_TABLE_NAME = 'deals' and TG_OP = 'UPDATE' and coalesce(v_old->>'status','') <> coalesce(v_new->>'status','') then
    v_trigger := 'deal_stage_changed';
  elsif TG_TABLE_NAME = 'customer_documents' and TG_OP = 'UPDATE'
    and coalesce(v_old->>'status','') <> coalesce(v_new->>'status','')
    and lower(coalesce(v_new->>'status','')) in ('approved','sent','signed','signed_complete') then
    v_status := lower(coalesce(v_new->>'status',''));
    if v_status in ('signed','signed_complete') and lower(coalesce(v_new->>'document_type','')) like '%contract%' then v_trigger := 'contract_signed';
    elsif v_status = 'sent' and lower(coalesce(v_new->>'document_type','')) like '%contract%' then v_trigger := 'contract_sent';
    elsif v_status = 'approved' and lower(coalesce(v_new->>'document_type','')) like '%proposal%' then v_trigger := 'proposal_approved';
    elsif v_status = 'approved' and (lower(coalesce(v_new->>'document_type','')) like '%report%' or lower(coalesce(v_new->>'document_type','')) like '%diagnosis%') then v_trigger := 'report_approved';
    elsif v_status = 'sent' and lower(coalesce(v_new->>'document_type','')) like '%proposal%' then v_trigger := 'proposal_sent';
    elsif v_status = 'sent' and (lower(coalesce(v_new->>'document_type','')) like '%report%' or lower(coalesce(v_new->>'document_type','')) like '%diagnosis%') then v_trigger := 'report_sent';
    else return NEW;
    end if;
  elsif TG_TABLE_NAME = 'diagnosis_submissions' and TG_OP = 'INSERT' then
    v_trigger := 'diagnosis_completed';
  else
    return NEW;
  end if;

  if TG_TABLE_NAME = 'deals' and v_trigger = 'deal_stage_changed'
    and lower(coalesce(v_new->>'stage', v_new->>'status','')) in ('won','closed_won','success','成約','受注') then
    v_status := 'deal_won';
  else
    v_status := v_trigger;
  end if;

  begin v_contact_id := nullif(coalesce(v_new->>'contact_id',''),'')::uuid; exception when others then v_contact_id := null; end;
  begin v_company_id := nullif(coalesce(v_new->>'company_id',''),'')::uuid; exception when others then v_company_id := null; end;
  begin v_lead_id := nullif(coalesce(v_new->>'lead_id',''),'')::uuid; exception when others then v_lead_id := null; end;
  if v_contact_id is null and TG_TABLE_NAME = 'contacts' then begin v_contact_id := nullif(v_new->>'id','')::uuid; exception when others then null; end; end if;
  if v_contact_id is null and TG_TABLE_NAME = 'line_friend_tags' then
    begin select c.id,c.company_id into v_contact_id,v_company_id from public.line_friends f join public.contacts c on c.line_user_id=f.line_user_id where f.id=nullif(v_new->>'line_friend_id','')::uuid limit 1; exception when others then v_contact_id := null; end;
  end if;
  if v_contact_id is null and v_lead_id is not null then select contact_id, company_id into v_contact_id, v_company_id from public.leads where id = v_lead_id; end if;
  if v_contact_id is null and v_company_id is not null then
    for v_contact in select id, company_id from public.contacts where company_id = v_company_id loop
      v_contact_id := v_contact.id;
      perform public.queue_marketing_scenarios(auth.uid(), v_contact.id, v_company_id, v_new, TG_TABLE_NAME, v_status, v_trigger, coalesce(v_new->>'updated_at', now()::text));
    end loop;
    return NEW;
  end if;
  if v_contact_id is null then return NEW; end if;
  perform public.queue_marketing_scenarios(auth.uid(), v_contact_id, v_company_id, v_new, TG_TABLE_NAME, v_status, v_trigger, coalesce(v_new->>'updated_at', now()::text));
  if TG_TABLE_NAME = 'invoices' then
    perform public.queue_marketing_scenarios(auth.uid(), v_contact_id, v_company_id, v_new, TG_TABLE_NAME, 'invoice_overdue', 'invoice_overdue', coalesce(v_new->>'updated_at', now()::text));
  elsif v_status <> v_trigger then
    perform public.queue_marketing_scenarios(auth.uid(), v_contact_id, v_company_id, v_new, TG_TABLE_NAME, v_status, v_status, coalesce(v_new->>'updated_at', now()::text));
  end if;
  return NEW;
end $$;

create or replace function public.queue_marketing_scenarios(
  p_owner uuid, p_contact uuid, p_company uuid, p_record jsonb, p_table text,
  p_event text, p_matching_trigger text, p_event_time text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s record;
  c record;
  candidate jsonb;
  segment_row record;
  field_name text;
  field_value text;
  channels text[];
  channel_name text;
  message_text text;
  payload jsonb;
  job_key text;
  due_time timestamptz;
  delay_minutes integer;
begin
  select * into c from public.contacts where id = p_contact;
  if not found then return; end if;
  for s in select scenario_id, config from public.marketing_automation_scenarios where owner_id = p_owner loop
    if coalesce((s.config->>'automationEnabled')::boolean,false) is not true
      or coalesce(s.config->>'status','') <> 'prepared'
      or coalesce(s.config->>'trigger','') <> p_matching_trigger
      or coalesce(s.config->>'consentBasis','') = '' then continue; end if;
    candidate := p_record;
    if coalesce(s.config->>'audience','') like 'segment:%' then
      begin
        select entity_type, conditions into segment_row from public.crm_segments
          where id = substring(s.config->>'audience' from 9)::uuid and owner_id = p_owner;
      exception when others then continue; end;
      if not found then continue; end if;
      if segment_row.entity_type = 'contacts' then candidate := to_jsonb(c);
      elsif segment_row.entity_type = 'companies' and c.company_id is not null then
        select to_jsonb(x) into candidate from public.companies x where x.id = c.company_id;
      elsif segment_row.entity_type = 'leads' then
        select to_jsonb(x) into candidate from public.leads x where x.contact_id = p_contact limit 1;
      elsif segment_row.entity_type = 'deals' then
        select to_jsonb(d) into candidate from public.deals d join public.leads l on l.id=d.lead_id where l.contact_id=p_contact limit 1;
      elsif segment_row.entity_type = 'prospects' and c.company_id is not null then
        select to_jsonb(x) into candidate from public.prospects x where x.company_id=c.company_id limit 1;
      elsif segment_row.entity_type = 'customers' and c.company_id is not null then
        select to_jsonb(x) into candidate from public.customers x where x.company_id=c.company_id limit 1;
      else continue; end if;
      field_name := coalesce(segment_row.conditions->>'field','');
      field_value := lower(coalesce(segment_row.conditions->>'value',''));
      if candidate is null or (field_name <> '' and position(field_value in lower(coalesce(candidate->>field_name,''))) = 0) then continue; end if;
    end if;
    channels := case s.config->>'channel' when 'both' then array['email','line'] when 'email' then array['email'] else array['line'] end;
    foreach channel_name in array channels loop
      if channel_name = 'email' then message_text := coalesce(s.config->>'emailBody',''); else message_text := coalesce(s.config->>'messageBody',''); end if;
      if message_text = '' and channel_name='line' and coalesce(s.config->>'lineMessageType','')='flex' then
        message_text := concat_ws(E'\n',nullif(s.config->>'flexTitle',''),nullif(s.config->>'flexBody',''));
      end if;
      if message_text = '' and not (channel_name='line' and coalesce(s.config->>'lineMessageType','')='video') then continue; end if;
      payload := case when channel_name='line' and coalesce(s.config->>'lineMessageType','')='video'
        then jsonb_build_object('type','video','originalContentUrl',s.config->>'lineVideoUrl','previewImageUrl',s.config->>'lineVideoPreviewUrl') else null end;
      delay_minutes := greatest(0, least(coalesce((s.config->>'waitMinutes')::integer,0), 10080));
      if p_table='invoices' and p_matching_trigger in ('invoice_due','invoice_overdue') then
        begin
          due_time := (coalesce(p_record->>'due_date',p_record->>'due_at',p_record->>'payment_due_date'))::timestamptz;
          if p_matching_trigger='invoice_overdue' then due_time := due_time + interval '1 day'; end if;
        exception when others then due_time := null; end;
        if due_time is null then continue; end if;
      else
        due_time := now() + make_interval(mins => delay_minutes);
      end if;
      job_key := concat(p_table,':',coalesce(p_record->>'id',''),':',p_event_time,':',s.scenario_id,':',channel_name);
      insert into public.marketing_automation_jobs(owner_id,event_key,scenario_id,contact_id,channel,subject,body_text,line_message_payload,consent_basis,due_at)
      values(p_owner,job_key,s.scenario_id,p_contact,channel_name,nullif(s.config->>'emailSubject',''),message_text,payload,s.config->>'consentBasis',due_time)
      on conflict(owner_id,event_key) do nothing;
    end loop;
  end loop;
end $$;

drop trigger if exists marketing_automation_prospects on public.prospects;
create trigger marketing_automation_prospects after update on public.prospects
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_friend_tags on public.line_friend_tags;
create trigger marketing_automation_friend_tags after insert on public.line_friend_tags
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_customer_service on public.customer_service_engagements;
create trigger marketing_automation_customer_service after update on public.customer_service_engagements
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_invoices on public.invoices;
create trigger marketing_automation_invoices after insert or update on public.invoices
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_leads on public.leads;
create trigger marketing_automation_leads after insert on public.leads
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_contacts on public.contacts;
create trigger marketing_automation_contacts after insert or update of line_user_id on public.contacts
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_deals on public.deals;
create trigger marketing_automation_deals after update on public.deals
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_documents on public.customer_documents;
create trigger marketing_automation_documents after update on public.customer_documents
  for each row execute function public.enqueue_marketing_automation_jobs();
drop trigger if exists marketing_automation_diagnosis_submissions on public.diagnosis_submissions;
create trigger marketing_automation_diagnosis_submissions after insert on public.diagnosis_submissions
  for each row execute function public.enqueue_marketing_automation_jobs();
