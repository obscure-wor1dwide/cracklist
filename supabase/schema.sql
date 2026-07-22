-- Cracklist: auth + profiles + groups schema.
-- Run this once in the Supabase project's SQL editor (Dashboard -> SQL Editor).
-- Scope: auth, profiles, group membership only. Activity/challenges stay
-- client-side mock data for now (see CLAUDE.md).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'You',
  color text not null default '#E8285B',
  avatar_url text,
  city text default '',
  age_range text default '',
  birthdate date,
  age_verified boolean not null default false,
  opted_into_global boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- auto-create a profile row on signup
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- join a group by invite code without exposing the whole groups table
create function public.join_group_by_code(code text) returns uuid as $$
declare
  target_group_id uuid;
begin
  select id into target_group_id from public.groups where invite_code = code;
  if target_group_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id)
    values (target_group_id, auth.uid())
    on conflict do nothing;
  return target_group_id;
end;
$$ language plpgsql security definer;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "own profile: full access" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Returns the current user's group ids. security definer + owned by the
-- table owner (postgres) means this query runs exempt from group_members'
-- own RLS, which is what lets the group_members policy below reference
-- group_members without recursing into itself infinitely.
create function public.user_group_ids() returns setof uuid
language sql security definer stable as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

-- groupmates only ever see name/color/avatar — city, age_range, birthdate,
-- age_verified stay private even from group members. No profiles RLS policy
-- grants read of the base table to anyone but the row's own owner; this view
-- is the only channel for the public-safe subset.
create view public.group_profiles with (security_invoker = true) as
  select p.id, p.name, p.color, p.avatar_url
  from public.profiles p
  where p.id in (
    select gm.user_id from public.group_members gm
    where gm.group_id in (select public.user_group_ids())
  );

-- "or created_by = auth.uid()" covers the instant right after a group is
-- created: the creator isn't in group_members yet (that insert happens as a
-- separate follow-up call), so without this the .insert().select() read-back
-- gets blocked by RLS and PostgREST reports it as if the INSERT itself failed.
create policy "members: read own groups" on public.groups
  for select using (
    id in (select public.user_group_ids())
    or created_by = auth.uid()
  );
create policy "members: create groups" on public.groups
  for insert with check (auth.uid() = created_by);

create policy "members: read own memberships" on public.group_members
  for select using (
    user_id = auth.uid()
    or group_id in (select public.user_group_ids())
  );
create policy "creator: insert self as first member" on public.group_members
  for insert with check (user_id = auth.uid());

-- avatar storage
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "avatar owner write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- contact/feedback submissions — write-only from the client, readable only
-- via the Supabase dashboard (no select policy for regular users).
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.questions enable row level security;
create policy "members: submit a question" on public.questions
  for insert to authenticated
  with check (auth.uid() = user_id);
grant insert on public.questions to authenticated;
