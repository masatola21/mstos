-- 迷惑メール・スパム送信元ブロックリスト
create table if not exists public.email_blocklist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,
  match_type text not null default 'address' check (match_type in ('address', 'domain')),
  reason text default '',
  created_at timestamptz not null default now(),
  unique(owner_id, pattern)
);

alter table public.email_blocklist enable row level security;

drop policy if exists "Owners manage their email blocklist" on public.email_blocklist;
create policy "Owners manage their email blocklist"
  on public.email_blocklist for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists idx_email_blocklist_owner_pattern
  on public.email_blocklist(owner_id, pattern);
