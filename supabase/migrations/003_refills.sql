-- Refills: one row per refill so users can count how many times they refilled (optionally at which location)
create table if not exists public.refills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_source_id uuid references public.water_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists refills_user_id_idx on public.refills(user_id);

alter table public.refills enable row level security;

create policy "Users can insert own refill"
  on public.refills for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own refills"
  on public.refills for select
  to authenticated
  using (auth.uid() = user_id);
