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
