-- Leaderboard: top users by refill count (SECURITY DEFINER so authenticated users can read aggregated data)
create or replace function public.get_refill_leaderboard(limit_count int default 10)
returns table (
  user_id uuid,
  refill_count bigint,
  display_name text,
  avatar_url text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    r.user_id,
    count(*)::bigint as refill_count,
    coalesce(
      nullif(trim(p.display_name), ''),
      split_part(u.email, '@', 1)
    ) as display_name,
    p.avatar_url
  from refills r
  left join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  group by r.user_id, p.display_name, p.avatar_url, u.email
  order by refill_count desc
  limit greatest(least(coalesce(limit_count, 10), 50), 1);
$$;

grant execute on function public.get_refill_leaderboard(int) to authenticated;
