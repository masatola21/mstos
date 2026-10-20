-- Carry selected rich LINE templates into the existing automation job payload.
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
      if message_text = '' and not (channel_name='line' and coalesce(s.config->>'lineMessageType','') in ('image','video','flex')) then continue; end if;
      payload := case
        when channel_name='line' and jsonb_typeof(s.config->'lineMessagePayload')='object'
          then s.config->'lineMessagePayload'
        when channel_name='line' and coalesce(s.config->>'lineMessageType','')='image'
          then jsonb_build_object('type','image','originalContentUrl',s.config->>'lineImageUrl','previewImageUrl',coalesce(s.config->>'linePreviewImageUrl',s.config->>'lineImageUrl'))
        when channel_name='line' and coalesce(s.config->>'lineMessageType','')='video'
          then jsonb_build_object('type','video','originalContentUrl',s.config->>'lineVideoUrl','previewImageUrl',s.config->>'lineVideoPreviewUrl')
        else null end;
      delay_minutes := greatest(0, least(coalesce((s.config->>'waitMinutes')::integer,0), 10080));
      if p_table='customer_invoices' and p_matching_trigger in ('invoice_due','invoice_overdue') then
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
