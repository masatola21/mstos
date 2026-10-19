alter table public.line_channel_integrations
  add column if not exists rich_menu_id text;

create table if not exists public.email_channel_integrations (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  inbound_address text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_email_id text not null,
  from_email text not null,
  to_emails text[] not null default '{}',
  subject text not null default '',
  text_body text not null default '',
  html_body text not null default '',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_id, provider_email_id)
);

alter table public.email_channel_integrations enable row level security;
alter table public.email_inbox_messages enable row level security;

drop policy if exists "Owners manage email channel integration" on public.email_channel_integrations;
create policy "Owners manage email channel integration"
  on public.email_channel_integrations for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage email inbox messages" on public.email_inbox_messages;
create policy "Owners manage email inbox messages"
  on public.email_inbox_messages for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists email_inbox_messages_owner_received_idx
  on public.email_inbox_messages(owner_id, received_at desc);
