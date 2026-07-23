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
-- is the only channel for the public-safe subset. Deliberately NOT
-- security_invoker: views default to running as the view owner (postgres,
-- which bypasses RLS), which is exactly what lets this view reach past the
-- owner-only profiles policy to read a groupmate's row — same trick as the
-- user_group_ids() security definer function. The view's own WHERE clause
-- (via user_group_ids(), which reads the real auth.uid()) is what keeps this
-- narrowed to only your actual groupmates, not every profile in the table.
create view public.group_profiles as
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

-- ---------- real activity, likes, comments, reactions, challenge claims ----------
-- Replaces the client-side mock generators in mockData.js — see CLAUDE.md.

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_private boolean not null default false,
  duration int,
  rating int,
  location text,
  mood text,
  created_at timestamptz not null default now()
);
alter table public.activity enable row level security;

create policy "members: read group activity" on public.activity
  for select using (group_id in (select public.user_group_ids()));
create policy "members: log own activity" on public.activity
  for insert to authenticated
  with check (user_id = auth.uid() and group_id in (select public.user_group_ids()));

-- Group feed view: private entries stay visible (so points still count,
-- matching the app's existing "isPrivate only hides details from the group
-- feed" promise) but their detail columns are nulled out for everyone
-- except the entry's own owner.
create view public.activity_feed with (security_invoker = true) as
  select
    id, group_id, user_id, is_private, created_at,
    case when is_private and user_id != auth.uid() then null else duration end as duration,
    case when is_private and user_id != auth.uid() then null else rating end as rating,
    case when is_private and user_id != auth.uid() then null else location end as location,
    case when is_private and user_id != auth.uid() then null else mood end as mood
  from public.activity
  where group_id in (select public.user_group_ids());

create table public.activity_likes (
  activity_id uuid not null references public.activity(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table public.activity_likes enable row level security;
create policy "members: read likes in own groups" on public.activity_likes
  for select using (activity_id in (select id from public.activity where group_id in (select public.user_group_ids())));
create policy "members: like/unlike own" on public.activity_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy "members: remove own like" on public.activity_likes
  for delete to authenticated using (user_id = auth.uid());

create table public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.activity_comments enable row level security;
create policy "members: read comments in own groups" on public.activity_comments
  for select using (activity_id in (select id from public.activity where group_id in (select public.user_group_ids())));
create policy "members: comment as self" on public.activity_comments
  for insert to authenticated with check (user_id = auth.uid());

create table public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
alter table public.activity_reactions enable row level security;
create policy "members: read reactions in own groups" on public.activity_reactions
  for select using (activity_id in (select id from public.activity where group_id in (select public.user_group_ids())));
create policy "members: react as self" on public.activity_reactions
  for insert to authenticated with check (user_id = auth.uid());

-- photo reactions go to real storage now instead of base64-in-memory
insert into storage.buckets (id, name, public) values ('reactions', 'reactions', true);
create policy "reaction owner write" on storage.objects
  for insert with check (bucket_id = 'reactions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reaction public read" on storage.objects
  for select using (bucket_id = 'reactions');

create table public.challenge_claims (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null,
  points int not null,
  week_number int not null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id, challenge_id, week_number)
);
alter table public.challenge_claims enable row level security;
create policy "members: read group claims" on public.challenge_claims
  for select using (group_id in (select public.user_group_ids()));
create policy "members: claim as self" on public.challenge_claims
  for insert to authenticated
  with check (user_id = auth.uid() and group_id in (select public.user_group_ids()));

-- ---------- real global leaderboard, no bot handles ----------
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

-- ---------- real partner linking ----------
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
