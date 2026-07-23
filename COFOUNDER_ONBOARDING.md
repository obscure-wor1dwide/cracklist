# Cracklist — cofounder onboarding

This doc is for whoever's picking this up who isn't the one who's been building
it. Two parts: **(1) what everything is and how to get access**, and **(2) a
"master prompt"** to paste into your own Claude Code session so it understands
the whole project instantly, without you having to explain any of this by hand.

---

## 1. What Cracklist actually is

A gamified habit-tracking app — you log an activity ("I Cracked"), it goes
into a leaderboard with your friend group, you can link up with a partner,
there are weekly challenges for bonus points, a calendar view, and a
sex-ed reference section. Think Strava, but for a very different activity.

## 2. The pieces, in plain English

There are 4 separate services involved. None of them know about each other
automatically — they're connected because our code tells them to talk to each
other.

| Piece | What it actually does | Where it lives |
|---|---|---|
| **The code** | The actual app — every screen, button, and piece of logic. Written in React (a way of building websites out of reusable pieces). | GitHub: `github.com/obscure-wor1dwide/cracklist` |
| **Supabase** | The backend. Handles logins/passwords, stores every table of data (users, groups, activity logs, etc.), and stores uploaded photos. Think of it as "the database and everything database-adjacent." | Its own dashboard at supabase.com |
| **Vercel** | Hosting. Takes the code from GitHub and actually serves it to people's browsers as a live website. Every time new code is pushed to GitHub, Vercel automatically rebuilds and redeploys the live site. | Its own dashboard at vercel.com |
| **The domain** | `cracked-list.com` — just the human-readable address that points at the Vercel-hosted site. | Wherever it was purchased (Vercel Domains, Namecheap, GoDaddy, etc. — check your email receipt if unsure) |

**How a request actually flows:** someone types `cracked-list.com` → domain
DNS points them at Vercel → Vercel serves the React app → the app in their
browser talks directly to Supabase for anything involving login or data
(Vercel is just serving files, it's not in the middle of that conversation).

## 3. Giving your cofounder full access

Do these in order. Each one is a normal "invite a teammate" flow on that
service — nobody needs to hand over a password for any of this.

### Step 1 — GitHub (the code)
1. Go to `github.com/obscure-wor1dwide/cracklist` → **Settings** → **Collaborators**
2. Click **Add people**, enter their GitHub username or email
3. Give them **Write** access (or transfer/add to an **Organization** later if you want fully equal ownership)

### Step 2 — Vercel (hosting)
1. Go to your Vercel dashboard → the team/project settings → **Members**
2. Invite by email, give them a role with deploy access (Member or above)
3. If the project currently lives under your *personal* Vercel account rather
   than a Team, consider creating a Vercel Team and moving the project into
   it — that makes ownership genuinely shared instead of "guest on your
   account" (optional, but worth doing eventually)

### Step 3 — Supabase (the backend/database)
1. Go to your Supabase dashboard → **Project Settings** (or Org Settings) → **Team**
2. Invite by email, give them a role with database + auth access (Admin or Owner)

### Step 4 — the domain
Whoever's registrar holds `cracked-list.com` (check the email receipt from
when it was bought — likely Vercel Domains based on how it's configured)
probably needs a separate invite/transfer through that registrar's own
"team" or "transfer" settings. If it was bought through Vercel Domains, Step
2 above already covers it.

### Step 5 — local environment variables
The code needs two values to talk to Supabase, kept in a file called
`.env.local` that's deliberately **not** stored in GitHub (it's in
`.gitignore`) since it's environment-specific. Once your cofounder has
Supabase access from Step 3, they can get these themselves from **Supabase
Dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
```

These two values are safe to share even outside the team — they're the
*public* key, meant to be used from a browser, and everything they can touch
is locked down by the database's row-level security rules. **Never** share
the Supabase **service_role key** or the database password — those bypass
all security rules entirely and should never leave the Supabase dashboard.

### One thing to do before inviting anyone
There's a batch of finished work sitting locally that hasn't been pushed to
GitHub yet (partner-linking, forgot-password, a couple of bug fixes). If your
cofounder clones the repo before this is pushed, they'll be looking at an
older version. Ask Claude to commit and push it first.

## 4. What's actually built so far

**Done and live:**
- Email/password signup + login, with email verification on signup
- Groups — create/join via invite code, switch between multiple groups
- Activity logging ("I Cracked") with duration/rating/location/mood, likes, comments, photo reactions — all real, stored in Supabase, not fake data
- Leaderboards (weekly/monthly/all-time), computed live from the real activity log — no bot accounts, no fake starting points
- Weekly challenges with bonus points
- Real global leaderboard (opt-in, anonymized handle, real users only)
- Partner linking — invite-code based, two real accounts can link/unlink calendars
- Calendar view of your own (and your linked partner's) activity
- Community screen — city/age-range averages, an interactive 3D globe, combined leaderboard
- "Forgot password" flow (just added)
- Learn section (sex-ed reference content, links out to real health authorities)
- Contact/feedback form

**In progress / not started yet:**
- A personal-dashboard home screen (currently the group leaderboard is still the first screen you land on)
- "Let's crack" in-app nudge button to notify a linked partner
- Splitting the one giant `Cracklist.jsx` file into smaller per-screen files (works fine, just not organized yet)

## 5. Where things live in the code (rough map)

```
src/
  Cracklist.jsx          — the main app, most screens still live in here
  screens/                — a few screens that have been split out already
    AuthScreen.jsx
    ContactScreen.jsx
    ResetPasswordScreen.jsx
  hooks/                  — the "talk to Supabase" layer
    useAuth.js
    useProfile.js
    useGroups.js
    usePartner.js
  lib/
    supabaseClient.js     — the actual Supabase connection
    mockData.js           — leftover generators for content that's still static (challenge list, etc.)
    theme.js              — the color palette, one object, reused everywhere

supabase/
  schema.sql              — the full current database schema, always up to date
  phase*.sql              — individual patches, in the order they were applied (kept for history)
```

`CLAUDE.md` at the repo root has more detail on conventions (design system,
data model, etc.) and is what any Claude session automatically reads for
context on this specific project.

---

## The master prompt

Paste this into a fresh Claude Code session (after cloning the repo and
running `npm install`) to get it fully caught up, no re-explaining needed.

```
I'm picking up an existing project called Cracklist — a gamified habit-tracking
app with friend groups, leaderboards, challenges, and social features. I'm a
cofounder joining after most of the initial build. Please read the following
files to get oriented before we do anything else:

1. CLAUDE.md — project conventions, screens, data model, design system
2. COFOUNDER_ONBOARDING.md — plain-English overview of the whole stack
3. supabase/schema.sql — the current, complete database schema
4. src/Cracklist.jsx — the main app component (large file, most screens
   still live here — skim it, don't try to hold the whole thing in your head)
5. src/hooks/*.js — how the app talks to Supabase (auth, profile, groups,
   partner linking)

Stack: React (JSX, hooks-only, no external state library), Tailwind for
utility classes, inline style={} for actual colors via a single C constants
object (src/lib/theme.js), lucide-react for icons, recharts for the activity
graph, react-globe.gl for the community globe. Backend is Supabase — Postgres
+ Auth + Row-Level Security + Storage. Hosted on Vercel, deployed from the
main branch on git push, live at cracked-list.com.

Everything that looks like it could be fake/mock data has deliberately been
replaced with real Supabase-backed data (activity log, likes, comments,
photo reactions, challenge claims, the global leaderboard, partner linking) —
if you see a generator function that looks like it produces fake seeded
data, check whether it's actually still called anywhere before assuming
it's live, since a few were deliberately left in place but disconnected
during cleanup.

Once you've read those files, give me a one-paragraph summary of the current
state of the project and ask me what I want to work on.
```

---

Questions about any of this — ask whoever set it up, or ask Claude directly
in a session with this repo open. This doc will go stale as the app changes,
so if something here stops matching reality, that's a sign to update it, not
a sign it was wrong.
