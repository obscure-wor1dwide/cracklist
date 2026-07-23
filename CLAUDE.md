# Cracklist

A gamified habit-tracking app for logging an activity ("I Cracked") with
friend groups, leaderboards, challenges, and social features. Single main
component right now, currently living as one large React file
(`src/Cracklist.jsx`) — a real candidate for splitting into smaller files
during the next pass.

## Stack
- React (JSX, functional components, hooks-only — no external state lib)
- Tailwind CSS (core utility classes only — inline `style={}` used for all
  actual colors/palette since arbitrary Tailwind color classes aren't
  available in this environment)
- lucide-react for icons
- recharts for the activity graph
- Backend: Supabase (Postgres, Auth, Row-Level Security, Storage) — see
  "Backend" below

## Screens / views
State machine driven by a single `view` string in the root component:
- **splash** — tap-to-enter screen
- **app** (main) — active group's leaderboard, cumulative activity graph,
  recent activity feed with likes/comments/photo reactions, floating
  "I Cracked" button
- **profile** — username/avatar editing, all-time stats, streak, favorite
  location, city + age range inputs, global leaderboard opt-in
- **community** — area average (by city), age-range average, an
  interactive draggable/zoomable 3D globe (real satellite texture via
  react-globe.gl) with per-city averages, combined leaderboard across all
  your groups, global leaderboard
- **calendar** — monthly calendar view of your own activity, with an
  opt-in partner-calendar linking flow (invite-code based, private-marked
  days never shared)
- **learn** — searchable sex-ed reference content (consent, contraception,
  STIs/testing, anatomy, pregnancy, relationships), each topic links out
  to a real health authority (Planned Parenthood, CDC, RAINN, NHS, etc.);
  intentionally short overviews only, no medical advice given directly
- **challenges** — weekly bonus-point challenges (streaks, variety,
  weekend activity, group totals) that feed into the leaderboard
- **contact** — simple "ask us a question" form (message + optional email),
  submissions write-only to Supabase, readable only via the dashboard

## Core data model
- **Groups**: each has `players[]`, an `activity[]` log, and a
  `challengeClaims[]` log. A user can belong to multiple groups and
  switch between them.
- **Activity events**: `{ id, playerId, timestamp, isPrivate, duration,
  rating, location, mood, reactions[], likes[], comments[] }`. Private
  entries still save full details to the user's own profile stats —
  `isPrivate` only hides details from the group feed (group still sees
  the point counted).
- **Points model is event-sourced**: leaderboard totals (both crack
  counts and challenge bonus points) are always computed by summing the
  raw event/claim logs for the selected time range (weekly/monthly/
  all-time) — never stored as a running total. This keeps "private"
  entries, challenge claims, and time-range filtering all consistent.
- **Challenges** reset weekly (`currentWeekNumber()` = epoch week number),
  claimed once per player per week per challenge.
- **Cross-user reads** (a groupmate's name/color, a linked partner's
  profile) go through Postgres views that are deliberately NOT
  `security_invoker` — the view runs as its owner to bypass the base
  table's owner-only RLS, while the view's own WHERE clause keeps it
  scoped to the real caller. Setting `security_invoker = true` on one of
  these views silently breaks it (happened once with `group_profiles` —
  it only ever returned your own row).

## Design
- Color palette: pink/red, defined in a single `C` constants object
  (`C.bg`, `C.primary`, `C.card`, `C.text`, `C.muted`, etc.) — always use
  this object rather than hardcoding new hex values
- Solid colors over gradients (gradients had rendering reliability
  issues on the floating action button in earlier iterations)
- Bottom-sheet modals (survey, group join/create) are scrollable with
  `max-h` + `overflow-y-auto` so the submit button never gets pushed
  off-screen
- Custom fonts loaded via `@import` in a `<style>` tag: Space Grotesk
  (display/headers) + Inter (body)

## Backend
Supabase (Postgres + Auth + Row-Level Security + Storage) is fully wired
in:
- Groups, activity log, likes, comments, photo reactions (Storage-backed),
  and challenge claims are all real, persisted rows — nothing here is
  mock/seeded anymore
- Global leaderboard is real too: opt-in users only, no bot handles,
  computed via a `global_leaderboard()` RPC
- Partner linking is real: invite-code based, `partner_links` table,
  linked partner's non-private activity shows on the Calendar screen
- Area and age-range "averages" on the Community screen are still fake —
  hashed numbers from the city/age-range string + current week, not real
  aggregated user data (the one unfinished piece of the backend pass)
- Login is email + password (no magic-link requirement); signup still
  requires email verification; a "Forgot password" flow exists via
  `supabase.auth.resetPasswordForEmail`

## Next steps / open issues
- [ ] Personal-dashboard home screen (replace the group-leaderboard view
      as the landing screen)
- [ ] In-app "let's crack" nudge button + realtime toast to a linked
      partner (needs Realtime enabled on a `nudges` table)
- [ ] Real area/age-range aggregation (still fake — see Backend section)
- [ ] App Store distribution: Capacitor is the likely wrap-not-rewrite
      path, but Apple/Google content-policy risk for sexual content +
      user-generated photos/comments hasn't actually been researched —
      do that before any implementation
- [ ] Consider splitting `Cracklist.jsx` into separate files per screen
      (SplashScreen, ProfileScreen, CommunityScreen, CalendarScreen,
      LearnScreen, ChallengesScreen are already separate components
      internally — just not separate files yet)

## Working preferences
- Show complete updated files rather than partial diffs when practical
- Call out any assumptions made about backend schema before wiring new
  calls
- Keep using the `C` palette object rather than introducing new inline
  hex colors
