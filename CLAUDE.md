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
- No backend yet — everything currently runs on in-memory mock/seeded data
  (see "Not yet wired to a backend" below)

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

## Not yet wired to a backend
Everything currently runs on deterministically-seeded mock data
(`mulberry32` PRNG) generated client-side:
- Group activity, challenge claims, global leaderboard handles, and
  partner-calendar activity are all fake/simulated
- Area and age-range "averages" on the Community screen are fake numbers
  hashed from the city/age-range string + current week (not real
  aggregated user data)
- No persistence — reloading the page resets all state to the seeded
  defaults

## Next steps / open issues
- [ ] Decide on and wire a real backend (Supabase was the earlier plan)
      for: groups, activity log, challenge claims, profile data
- [ ] Real photo storage for reactions (currently base64 data URLs held
      in React state only, not uploaded anywhere)
- [ ] Real global/area/age-range aggregation once there's an actual
      backend to aggregate from
- [ ] Consider splitting `Cracklist.jsx` into separate files per screen
      (SplashScreen, ProfileScreen, CommunityScreen, CalendarScreen,
      LearnScreen, ChallengesScreen are already separate components
      internally — just not separate files yet)
- [ ] (add anything else you're mid-way on here)

## Working preferences
- Show complete updated files rather than partial diffs when practical
- Call out any assumptions made about backend schema before wiring new
  calls
- Keep using the `C` palette object rather than introducing new inline
  hex colors
