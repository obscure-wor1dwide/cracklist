-- Phase 1: real activity, likes, comments, reactions, challenge claims.
-- Run once in the Supabase SQL Editor against the live project.

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
