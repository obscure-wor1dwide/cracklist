-- Phase 2: real global leaderboard, no bot handles.
-- Run once in the Supabase SQL Editor against the live project.

create function public.global_leaderboard() returns table(user_id uuid, points bigint)
language sql security definer stable as $$
  select a.user_id, count(*) as points
  from public.activity a
  join public.profiles p on p.id = a.user_id
  where p.opted_into_global = true
  group by a.user_id
  order by points desc
  limit 50;
$$;
