-- Cracklist: group renaming, member visibility, and private/approval groups.
-- Run this once in the Supabase project's SQL editor, after schema.sql +
-- phase1/2/3. Existing groups are unaffected: `private` defaults false, so
-- invite-code joins keep behaving exactly as they do today unless a group is
-- explicitly flipped private.

alter table public.groups add column private boolean not null default false;

-- RLS alone only restricts which ROWS an update can touch, not which
-- columns — without the column grant below, this policy would let any member
-- rewrite invite_code/created_by via a direct API call, not just name/private.
create policy "members: update own groups" on public.groups
  for update using (id in (select public.user_group_ids()))
  with check (id in (select public.user_group_ids()));
revoke update on public.groups from authenticated;
grant update (name, private) on public.groups to authenticated;

-- Pending requests only — rows are deleted on resolution (approve/deny),
-- never status-flagged.
create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
alter table public.group_join_requests enable row level security;

create policy "members: read pending requests for own groups" on public.group_join_requests
  for select using (group_id in (select public.user_group_ids()) or user_id = auth.uid());
create policy "requester: cancel own request" on public.group_join_requests
  for delete using (user_id = auth.uid());
create policy "members: resolve requests in own groups" on public.group_join_requests
  for delete using (group_id in (select public.user_group_ids()));
-- Deliberately no insert policy: every insert goes through
-- join_group_by_code (security definer), so a client can never spoof a
-- request row for someone else.

-- Requester name/color/avatar, visible only to existing members of that
-- group — same "view owner bypasses profiles' owner-only policy, WHERE
-- clause does the real narrowing" trick as group_profiles/partner_profile.
create view public.pending_join_requests as
  select r.id, r.group_id, r.user_id, p.name, p.color, p.avatar_url, r.created_at
  from public.group_join_requests r
  join public.profiles p on p.id = r.user_id
  where r.group_id in (select public.user_group_ids());

-- Return type changes uuid -> jsonb (so the client can distinguish an
-- instant join from a pending request), which requires dropping the old
-- signature first — create or replace can't change a return type.
drop function if exists public.join_group_by_code(text);
create function public.join_group_by_code(code text) returns jsonb as $$
declare
  target_group_id uuid;
  is_private boolean;
  already_member boolean;
begin
  select id, private into target_group_id, is_private from public.groups where invite_code = code;
  if target_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  select exists(
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid()
  ) into already_member;

  if already_member then
    return jsonb_build_object('status', 'joined', 'group_id', target_group_id);
  end if;

  if is_private then
    insert into public.group_join_requests (group_id, user_id)
      values (target_group_id, auth.uid())
      on conflict do nothing;
    return jsonb_build_object('status', 'pending', 'group_id', target_group_id);
  end if;

  -- Clears any stale request left over from a "group was private, I
  -- requested, it got flipped back to public later" edge case.
  delete from public.group_join_requests where group_id = target_group_id and user_id = auth.uid();
  insert into public.group_members (group_id, user_id) values (target_group_id, auth.uid());
  return jsonb_build_object('status', 'joined', 'group_id', target_group_id);
end;
$$ language plpgsql security definer;

-- Both approve/deny silently no-op on an already-resolved/missing request
-- rather than raising, so a benign race between two members acting on the
-- same request doesn't surface as an error toast for whoever clicks second.
create function public.approve_join_request(request_id uuid) returns void as $$
declare
  req record;
begin
  select * into req from public.group_join_requests where id = request_id;
  if req is null then return; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = req.group_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;
  insert into public.group_members (group_id, user_id) values (req.group_id, req.user_id)
    on conflict do nothing;
  delete from public.group_join_requests where id = request_id;
end;
$$ language plpgsql security definer;

create function public.deny_join_request(request_id uuid) returns void as $$
begin
  delete from public.group_join_requests
  where id = request_id
    and group_id in (select public.user_group_ids());
end;
$$ language plpgsql security definer;
