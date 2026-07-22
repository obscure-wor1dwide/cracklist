import { Flame, MapPin, Sparkles, Trophy, Users } from "lucide-react";

// ---------- shared mock-data generators ----------
// Pulled out of Cracklist.jsx so both the main component and the
// useGroups hook can seed per-group activity/challenge data without a
// circular import between the two.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const LOCATIONS = ["Bedroom", "Shower", "Car", "Hotel", "Other"];
export const QUICK_MOODS = [
  "😴", "🔥", "😂", "😐", "🥵", "🥰", "😳", "🤤",
  "😭", "🙃", "😮‍💨", "🫠", "😈", "🎉", "💀", "✨",
];

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateActivity(seed, players, daysBack = 180) {
  const rand = mulberry32(seed);
  const events = [];
  const now = Date.now();
  let id = 0;
  for (let d = daysBack; d >= 0; d--) {
    const dayTime = now - d * 24 * 60 * 60 * 1000;
    const cracksToday = rand() < 0.55 ? 1 : rand() < 0.8 ? 0 : 2;
    for (let c = 0; c < cracksToday; c++) {
      const player = players[Math.floor(rand() * players.length)];
      const isPrivate = rand() < 0.15;
      events.push({
        id: `${seed}-${id++}`,
        playerId: player.id,
        timestamp: dayTime - Math.floor(rand() * 20 * 60 * 60 * 1000),
        isPrivate,
        duration: Math.round(5 + rand() * 40),
        rating: Math.round(1 + rand() * 9),
        location: LOCATIONS[Math.floor(rand() * LOCATIONS.length)],
        mood: QUICK_MOODS[Math.floor(rand() * QUICK_MOODS.length)],
        reactions: [],
        likes: [],
        comments: [],
      });
    }
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function seedSocial(events) {
  const others = ["Alex", "Sam", "Jordan", "Riley", "Casey"];
  events.slice(0, 6).forEach((e, i) => {
    if (i % 2 === 0) e.likes = [others[i % others.length]];
    if (i === 1) {
      e.comments = [{ by: others[0], text: "lol nice", ts: e.timestamp + 60000 }];
    }
  });
  return events;
}

export function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// simple string hash -> stable pseudo-random seed, used anywhere a uuid or
// other string needs to become a deterministic mulberry32 seed
export function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// ---------- challenges ----------
// Points from challenges are never stored as a running total — like the
// activity log, they're a log of individual "claims" that get summed on
// read. This keeps them consistent with the event-sourced points model.
export const CHALLENGES = [
  {
    id: "weekend-warrior",
    icon: Flame,
    title: "Weekend Warrior",
    desc: "Log on both Saturday and Sunday this week",
    points: 5,
  },
  {
    id: "variety-pack",
    icon: MapPin,
    title: "Variety Pack",
    desc: "Use 3 different locations in the last 30 days",
    points: 3,
  },
  {
    id: "on-fire",
    icon: Sparkles,
    title: "On Fire",
    desc: "Hit a 3-day streak",
    points: 5,
  },
  {
    id: "perfect-score",
    icon: Trophy,
    title: "Perfect Score",
    desc: "Log a 9+ rated entry this week",
    points: 3,
  },
  {
    id: "squad-goals",
    icon: Users,
    title: "Squad Goals",
    desc: "Group logs 5+ entries combined this week",
    points: 4,
  },
];

export function currentWeekNumber() {
  return Math.floor(Date.now() / (7 * DAY_MS));
}

// deterministically seed some already-claimed challenges for the other
// (non-"you") members of a group, so the leaderboard feels alive
export function seedChallengeClaims(seed, players) {
  const rand = mulberry32(seed + 555);
  const weekNumber = currentWeekNumber();
  const claims = [];
  players.forEach((p) => {
    if (p.isYou) return;
    CHALLENGES.forEach((ch) => {
      if (rand() < 0.35) {
        claims.push({
          id: `${p.id}-${ch.id}-seed`,
          playerId: p.id,
          challengeId: ch.id,
          points: ch.points,
          weekNumber,
          timestamp: Date.now() - Math.floor(rand() * 5 * DAY_MS),
        });
      }
    });
  });
  return claims;
}
