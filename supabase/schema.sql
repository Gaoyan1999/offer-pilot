create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.user_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_profile jsonb not null default '{}'::jsonb,
  ranked_jobs jsonb not null default '[]'::jsonb,
  selected_job_id text not null default '',
  tailored_resume jsonb,
  search_status text not null default 'Waiting for instructions',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_notes enable row level security;
alter table public.user_workspaces enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_notes to authenticated;
grant select, insert, update, delete on public.user_workspaces to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_notes_updated_at on public.user_notes;
create trigger set_user_notes_updated_at
before update on public.user_notes
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_workspaces_updated_at on public.user_workspaces;
create trigger set_user_workspaces_updated_at
before update on public.user_workspaces
for each row
execute function public.set_updated_at();

drop policy if exists "Users can read their own note" on public.user_notes;
create policy "Users can read their own note"
on public.user_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own note" on public.user_notes;
create policy "Users can insert their own note"
on public.user_notes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own note" on public.user_notes;
create policy "Users can update their own note"
on public.user_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own note" on public.user_notes;
create policy "Users can delete their own note"
on public.user_notes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
create policy "Users can read their own workspace"
on public.user_workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workspace" on public.user_workspaces;
create policy "Users can insert their own workspace"
on public.user_workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workspace" on public.user_workspaces;
create policy "Users can update their own workspace"
on public.user_workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own workspace" on public.user_workspaces;
create policy "Users can delete their own workspace"
on public.user_workspaces
for delete
to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
