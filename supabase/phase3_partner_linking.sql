-- Phase 3: real partner linking.
-- Run once in the Supabase SQL Editor against the live project.

-- Fix: group_profiles was created with security_invoker = true, which makes
-- it enforce the *invoking* user's RLS on profiles — and profiles only has
-- an owner-only select policy, so the view was silently only ever returning
-- your own row, never actual groupmates' names/colors (never caught because
-- every test group so far has had exactly one real member). Views default
-- to running as the view owner (postgres, which bypasses RLS) unless
-- security_invoker is set — that's exactly the "security-definer view"
-- behavior this needs, same trick as the user_group_ids() function.
alter view public.group_profiles set (security_invoker = false);

alter table public.profiles add column partner_invite_code text unique;

create table public.partner_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, partner_id)
);
alter table public.partner_links enable row level security;
create policy "own side: read" on public.partner_links
  for select using (user_id = auth.uid());

-- Replaces any existing partner for either side (one active partner at a
-- time), inserts both directions so each side sees the link from their own
-- row.
create function public.link_partner_by_code(code text) returns uuid as $$
declare
  target_id uuid;
begin
  select id into target_id from public.profiles where partner_invite_code = code;
  if target_id is null or target_id = auth.uid() then
    raise exception 'Invalid invite code';
  end if;
  delete from public.partner_links where user_id in (auth.uid(), target_id) or partner_id in (auth.uid(), target_id);
  insert into public.partner_links (user_id, partner_id) values (auth.uid(), target_id), (target_id, auth.uid());
  return target_id;
end;
$$ language plpgsql security definer;

create function public.unlink_partner() returns void as $$
begin
  delete from public.partner_links where user_id = auth.uid() or partner_id = auth.uid();
end;
$$ language plpgsql security definer;

-- Public-safe subset of the linked partner's profile — same
-- "runs as view owner to bypass the owner-only profiles policy" pattern as
-- group_profiles, deliberately NOT security_invoker.
create view public.partner_profile as
  select p.id, p.name, p.color, p.avatar_url
  from public.profiles p
  where p.id in (select partner_id from public.partner_links where user_id = auth.uid());

-- Full-detail rows, but is_private entries are fully excluded (not just
-- detail-hidden like the group feed) — private stays private even from a
-- linked partner.
create function public.partner_activity() returns setof public.activity
language sql security definer stable as $$
  select a.* from public.activity a
  where a.user_id in (select partner_id from public.partner_links where user_id = auth.uid())
    and a.is_private = false;
$$;
