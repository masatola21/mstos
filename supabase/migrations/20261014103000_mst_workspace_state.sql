-- Shared per-user storage for AI President and Matrix workspaces.
create table if not exists public.mst_workspace_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mst_workspace_state enable row level security;

drop policy if exists "Users can read their own workspace state" on public.mst_workspace_state;
create policy "Users can read their own workspace state"
  on public.mst_workspace_state for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workspace state" on public.mst_workspace_state;
create policy "Users can insert their own workspace state"
  on public.mst_workspace_state for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workspace state" on public.mst_workspace_state;
create policy "Users can update their own workspace state"
  on public.mst_workspace_state for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.mst_workspace_state to authenticated;

