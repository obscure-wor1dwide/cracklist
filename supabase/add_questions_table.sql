-- Run once in the Supabase SQL Editor against the live project — adds the
-- contact/feedback table for the new "ask a question" screen.

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
