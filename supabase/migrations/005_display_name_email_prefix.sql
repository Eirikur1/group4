-- Use email prefix (part before @) for new users when no display name
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update set
    display_name = coalesce(
      nullif(trim(profiles.display_name), ''),
      split_part(new.email, '@', 1)
    ),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

-- Backfill existing profiles: set display_name to email prefix where missing or currently full email
create or replace function public.backfill_display_names_from_email()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles p
  set display_name = split_part(u.email, '@', 1),
      updated_at = now()
  from auth.users u
  where p.id = u.id
    and (p.display_name is null or trim(p.display_name) = '' or p.display_name like '%@%');
end;
$$;

-- Run backfill once (comment out after first run if you prefer to run manually)
select public.backfill_display_names_from_email();
