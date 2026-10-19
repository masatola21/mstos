create table if not exists public.email_send_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  reply_to_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_send_settings enable row level security;
drop policy if exists "Owners manage email send settings" on public.email_send_settings;
create policy "Owners manage email send settings"
  on public.email_send_settings for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.email_send_settings to authenticated;

comment on table public.email_send_settings is 'Owner-scoped default sender name, sender email, and reply-to address for communication send center.';
