-- Keep water_sources.rating in sync with the average of all users' ratings.
-- Ensures the displayed rating is the same for everyone and updates when anyone rates.

-- Add rating column to water_sources if it doesn't exist (e.g. table created elsewhere)
alter table public.water_sources
  add column if not exists rating real;

-- Function: recompute and set water_sources.rating from public.ratings for one water source
create or replace function public.sync_water_source_rating(p_water_source_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  avg_rating real;
begin
  select round(avg(rating)::numeric, 1)::real
  into avg_rating
  from public.ratings
  where water_source_id = p_water_source_id;

  update public.water_sources
  set rating = avg_rating
  where id = p_water_source_id;
end;
$$;

-- Trigger: after any change to ratings, sync the affected water source's average
create or replace function public.ratings_sync_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_water_source_rating(OLD.water_source_id);
    return OLD;
  end if;
  perform public.sync_water_source_rating(NEW.water_source_id);
  return NEW;
end;
$$;

drop trigger if exists ratings_sync_trigger on public.ratings;
create trigger ratings_sync_trigger
  after insert or update or delete on public.ratings
  for each row
  execute procedure public.ratings_sync_trigger_fn();

-- Backfill: sync rating for all water sources that have at least one rating
do $$
declare
  r record;
begin
  for r in select distinct water_source_id from public.ratings
  loop
    perform public.sync_water_source_rating(r.water_source_id);
  end loop;
end;
$$;
