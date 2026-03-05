-- Ratings: one row per user per water source. Average is computed when displaying.
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_source_id uuid not null references public.water_sources(id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, water_source_id)
);

create index if not exists ratings_water_source_id_idx on public.ratings(water_source_id);

alter table public.ratings enable row level security;

create policy "Users can insert own rating"
  on public.ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own rating"
  on public.ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Anyone can read ratings (for computing averages)"
  on public.ratings for select
  to authenticated
  using (true);
