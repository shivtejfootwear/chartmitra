-- ChartMitra cloud save (run once in Supabase > SQL Editor)
create table if not exists public.cm_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  k text not null,
  v jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table public.cm_state enable row level security;
drop policy if exists "cm read own" on public.cm_state;
drop policy if exists "cm insert own" on public.cm_state;
drop policy if exists "cm update own" on public.cm_state;
drop policy if exists "cm delete own" on public.cm_state;
create policy "cm read own" on public.cm_state for select using (auth.uid() = user_id);
create policy "cm insert own" on public.cm_state for insert with check (auth.uid() = user_id);
create policy "cm update own" on public.cm_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cm delete own" on public.cm_state for delete using (auth.uid() = user_id);
