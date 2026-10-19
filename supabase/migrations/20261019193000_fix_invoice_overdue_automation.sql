-- customer_invoices uses its own trigger name; the original dispatcher checked
-- for "invoices", so overdue scenarios were never queued for this table.
create or replace function public.enqueue_marketing_invoice_overdue_jobs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := to_jsonb(NEW);
  v_owner uuid := auth.uid();
  v_contact_id uuid;
  v_company_id uuid;
  v_lead_id uuid;
  v_contact record;
  v_status text := lower(coalesce(v_new->>'status',''));
  v_event_time text := coalesce(v_new->>'updated_at', now()::text);
begin
  if v_owner is null then
    select owner_id into v_owner from public.marketing_automation_scenarios
      where coalesce((config->>'automationEnabled')::boolean,false)
        and coalesce(config->>'status','')='prepared'
        and coalesce(config->>'trigger','')='invoice_overdue'
        and coalesce(config->>'consentBasis','')<>''
      order by updated_at desc limit 1;
  end if;
  if v_owner is null or v_status in ('paid','paid_full','cancelled','canceled') then
    return NEW;
  end if;

  begin v_contact_id := nullif(v_new->>'contact_id','')::uuid; exception when others then v_contact_id := null; end;
  begin v_company_id := nullif(v_new->>'company_id','')::uuid; exception when others then v_company_id := null; end;
  begin v_lead_id := nullif(v_new->>'lead_id','')::uuid; exception when others then v_lead_id := null; end;

  if v_contact_id is null and v_lead_id is not null then
    select contact_id, company_id into v_contact_id, v_company_id
      from public.leads where id = v_lead_id;
  end if;
  if v_company_id is null and nullif(v_new->>'customer_id','') is not null then
    begin
      select company_id into v_company_id
        from public.customers where id = (v_new->>'customer_id')::uuid;
    exception when others then v_company_id := null;
    end;
  end if;

  if v_contact_id is not null then
    perform public.queue_marketing_scenarios(v_owner, v_contact_id, v_company_id, v_new,
      TG_TABLE_NAME, 'invoice_overdue', 'invoice_overdue', v_event_time);
  elsif v_company_id is not null then
    for v_contact in select id from public.contacts where company_id = v_company_id loop
      perform public.queue_marketing_scenarios(v_owner, v_contact.id, v_company_id, v_new,
        TG_TABLE_NAME, 'invoice_overdue', 'invoice_overdue', v_event_time);
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists marketing_automation_invoice_overdue on public.customer_invoices;
create trigger marketing_automation_invoice_overdue
  after insert or update on public.customer_invoices
  for each row execute function public.enqueue_marketing_invoice_overdue_jobs();
