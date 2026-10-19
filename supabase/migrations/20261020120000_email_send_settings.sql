create table if not exists public.email_send_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  sender_name text not null default '有限会社MST｜経営・業務改善支援',
  sender_email text not null default 'contact@mstcorp.info',
  reply_to_email text default 'mst.shikumikaizen@gmail.com',
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

insert into public.email_send_settings(owner_id, sender_name, sender_email, reply_to_email)
select id, '有限会社MST｜経営・業務改善支援', 'contact@mstcorp.info', 'mst.shikumikaizen@gmail.com'
from auth.users
on conflict (owner_id) do nothing;

comment on table public.email_send_settings is 'Owner-scoped default sender name, sender email, and reply-to address for communication send center.';
