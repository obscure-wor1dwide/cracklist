-- Fixes "infinite recursion detected in policy for relation group_members".
-- Run once in the Supabase SQL Editor. Safe to run on the existing project —
-- doesn't touch any data, only replaces the broken policies/view.

create or replace function public.user_group_ids() returns setof uuid
language sql security definer stable as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

drop view if exists public.group_profiles;
create view public.group_profiles with (security_invoker = true) as
  select p.id, p.name, p.color, p.avatar_url
  from public.profiles p
  where p.id in (
    select gm.user_id from public.group_members gm
    where gm.group_id in (select public.user_group_ids())
  );

drop policy if exists "members: read own groups" on public.groups;
create policy "members: read own groups" on public.groups
  for select using (id in (select public.user_group_ids()));

drop policy if exists "members: read own memberships" on public.group_members;
create policy "members: read own memberships" on public.group_members
  for select using (
    user_id = auth.uid()
    or group_id in (select public.user_group_ids())
  );
