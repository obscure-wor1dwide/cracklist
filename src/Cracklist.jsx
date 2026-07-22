import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Zap,
  Users,
  Copy,
  Check,
  Camera,
  X,
  TrendingUp,
  Trophy,
  Clock,
  Heart,
  MessageCircle,
  Send,
  Plus,
  ChevronLeft,
  Flame,
  MapPin,
  Globe,
  Lock,
  Target,
  Calendar,
  ChevronRight,
  Link2,
  Unlink,
  BookOpen,
  Search,
  ExternalLink,
  Info,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import ReactGlobe from "react-globe.gl";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { useGroups } from "./hooks/useGroups";
import AuthScreen from "./screens/AuthScreen";
import ContactScreen from "./screens/ContactScreen";
import {
  DAY_MS,
  LOCATIONS,
  QUICK_MOODS,
  mulberry32,
  generateActivity,
  seedSocial,
  randomInviteCode,
  CHALLENGES,
  currentWeekNumber,
  seedChallengeClaims,
  hashString,
} from "./lib/mockData";
import { C } from "./lib/theme";

const AVATAR_COLORS = ["#E8285B", "#FF6B6B", "#B0104F", "#FF9DB0", "#8A2846"];

function buildWeeklyGraph(activity, players) {
  const days = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const start = now - i * DAY_MS;
    const label = new Date(start).toLocaleDateString(undefined, { weekday: "short" });
    const row = { label };
    players.forEach((p) => (row[p.id] = 0));
    activity.forEach((e) => {
      if (e.timestamp >= start - DAY_MS / 2 && e.timestamp < start + DAY_MS / 2) {
        row[e.playerId] = (row[e.playerId] || 0) + 1;
      }
    });
    days.push(row);
  }
  return days;
}

function buildMonthlyGraph(activity, players) {
  const weeks = [];
  const now = Date.now();
  for (let i = 4; i >= 0; i--) {
    const start = now - i * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const row = { label: i === 0 ? "This wk" : `${i}wk ago` };
    players.forEach((p) => (row[p.id] = 0));
    activity.forEach((e) => {
      if (e.timestamp >= start && e.timestamp < end) {
        row[e.playerId] = (row[e.playerId] || 0) + 1;
      }
    });
    weeks.push(row);
  }
  return weeks;
}

function buildAllTimeGraph(activity, players) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString(undefined, { month: "short" });
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const row = { label };
    players.forEach((p) => (row[p.id] = 0));
    activity.forEach((e) => {
      if (e.timestamp >= start && e.timestamp < end) {
        row[e.playerId] = (row[e.playerId] || 0) + 1;
      }
    });
    months.push(row);
  }
  return months;
}

// turns per-period counts into a running total per player, so the line
// only ever climbs (or holds flat) across the visible window
function toCumulative(rows, players) {
  const totals = Object.fromEntries(players.map((p) => [p.id, 0]));
  return rows.map((row) => {
    const cumRow = { label: row.label };
    players.forEach((p) => {
      totals[p.id] += row[p.id] || 0;
      cumRow[p.id] = totals[p.id];
    });
    return cumRow;
  });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getAreaAverage(city) {
  if (!city) return null;
  const weekNumber = Math.floor(Date.now() / (7 * DAY_MS));
  const seed = hashString(city.toLowerCase().trim()) + weekNumber;
  const rand = mulberry32(seed);
  return Math.round((2 + rand() * 5) * 10) / 10;
}

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

function getAgeRangeAverage(ageRange) {
  if (!ageRange) return null;
  const weekNumber = Math.floor(Date.now() / (7 * DAY_MS));
  // offset seed so this doesn't collide with city hashes for the same string
  const seed = hashString("age-" + ageRange) + weekNumber;
  const rand = mulberry32(seed);
  return Math.round((2 + rand() * 5) * 10) / 10;
}

const GLOBAL_HANDLES = [
  "night_owl", "sunday_scaries", "quietstorm", "redeye", "no_sleep_92",
  "moonlit", "afterhours", "lowkey_loud", "midweek_mvp", "the_regular",
  "offthebooks", "steady_state", "backroom", "lastcall", "underrated",
];

function buildGlobalLeaderboard() {
  const rand = mulberry32(777);
  return GLOBAL_HANDLES.map((handle) => ({
    handle,
    points: Math.round(3 + rand() * 40),
  })).sort((a, b) => b.points - a.points);
}

// ---------- splash screen ----------
function SplashScreen({ onEnter }) {
  return (
    <div
      onClick={onEnter}
      className="min-h-screen w-full flex flex-col items-center justify-center cursor-pointer relative overflow-hidden"
      style={{ backgroundColor: C.primary }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        @keyframes floatLogo { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .logo-float { animation: floatLogo 3.2s ease-in-out infinite; }
        @keyframes fadePulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .tap-hint { animation: fadePulse 2s ease-in-out infinite; }
      `}</style>
      <div className="logo-float">
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <rect x="20" y="70" width="100" height="34" rx="8" stroke="white" strokeWidth="4" fill="rgba(255,255,255,0.08)" />
          <rect x="14" y="46" width="14" height="58" rx="6" stroke="white" strokeWidth="4" fill="rgba(255,255,255,0.08)" />
          <rect x="30" y="78" width="34" height="16" rx="6" fill="white" fillOpacity="0.85" />
          <line x1="20" y1="104" x2="20" y2="116" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <line x1="120" y1="104" x2="120" y2="116" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="font-display text-3xl font-bold mt-6 tracking-tight" style={{ color: "white" }}>
        Cracklist
      </h1>
      <p className="tap-hint text-sm mt-3 font-sans" style={{ color: "rgba(255,255,255,0.85)" }}>
        Tap to enter
      </p>
    </div>
  );
}

// ---------- age gate ----------
function calculateAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function AgeGateScreen({ onVerified }) {
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState(false);

  const handleContinue = () => {
    if (!dob) {
      setError("Enter your date of birth to continue.");
      return;
    }
    const dobDate = new Date(dob);
    if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) {
      setError("That date doesn't look right.");
      return;
    }
    if (calculateAge(dob) < 18) {
      setRejected(true);
      return;
    }
    onVerified(dob);
  };

  if (rejected) {
    return (
      <div
        className="min-h-screen w-full font-sans flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: C.bg, color: C.text }}
      >
        <ShieldCheck size={40} style={{ color: C.primary }} className="mb-4" />
        <h1 className="font-display text-xl font-bold mb-2">Cracklist is for adults 18+</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          Come back once you're 18 — this app includes sexual health content and social
          features that aren't meant for a younger audience.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full font-sans flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex flex-col items-center text-center mb-5">
          <ShieldCheck size={32} style={{ color: C.primary }} className="mb-3" />
          <h1 className="font-display text-lg font-bold mb-1">Confirm your age</h1>
          <p className="text-xs" style={{ color: C.muted }}>
            Cracklist includes sexual health content and social features meant for adults.
            You must be 18 or older to continue.
          </p>
        </div>
        <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
          Date of birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => {
            setDob(e.target.value);
            setError("");
          }}
          max={new Date().toISOString().split("T")[0]}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-2"
          style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
        />
        {error && (
          <p className="text-xs mb-2" style={{ color: C.primary }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleContinue}
          className="w-full rounded-xl py-2.5 text-sm font-semibold mt-2"
          style={{ backgroundColor: C.primary, color: "white" }}
        >
          Continue
        </button>
        <p className="text-[10px] mt-3 text-center" style={{ color: C.muted2 }}>
          By continuing you confirm this information is accurate.
        </p>
      </div>
    </div>
  );
}

// ---------- loading ----------
function LoadingScreen() {
  return (
    <div
      className="min-h-screen w-full font-sans flex items-center justify-center"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <p className="text-sm" style={{ color: C.text }}>
        Loading…
      </p>
    </div>
  );
}

// ---------- no groups yet ----------
function NoGroupsScreen({ onCreate, onJoin }) {
  const [tab, setTab] = useState("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = tab === "join" ? await onJoin(code) : await onCreate(name);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  };

  return (
    <div
      className="min-h-screen w-full font-sans flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex flex-col items-center text-center mb-5">
          <Users size={32} style={{ color: C.primary }} className="mb-3" />
          <h1 className="font-display text-lg font-bold mb-1">Connect with friends</h1>
          <p className="text-xs" style={{ color: C.muted }}>
            Join a group with an invite code, or start your own.
          </p>
        </div>

        <div className="flex rounded-xl p-1 mb-4" style={{ backgroundColor: C.chipBg }}>
          {[
            { id: "join", label: "Join by code" },
            { id: "create", label: "Create new" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError("");
              }}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold"
              style={
                tab === t.id
                  ? { backgroundColor: C.primary, color: "white" }
                  : { backgroundColor: "transparent", color: C.muted }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "join" ? (
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter invite code"
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3 font-display tracking-widest"
              style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
            />
          ) : (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
              style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
            />
          )}

          {error && (
            <p className="text-xs mb-3" style={{ color: C.primary }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-2.5 text-sm font-semibold"
            style={{ backgroundColor: C.primary, color: "white", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Please wait..." : tab === "join" ? "Join group" : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- profile screen ----------
function ProfileScreen({ profile, setProfile, groups, onBack, userId }) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const photoInputRef = useRef(null);

  const allYourEvents = useMemo(() => {
    const events = [];
    groups.forEach((g) => {
      g.activity.forEach((e) => {
        if (e.playerId === "you") events.push(e);
      });
    });
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [groups]);

  const totalCracks = allYourEvents.length;

  const favoriteLocation = useMemo(() => {
    if (allYourEvents.length === 0) return "—";
    const counts = {};
    allYourEvents.forEach((e) => (counts[e.location] = (counts[e.location] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [allYourEvents]);

  const currentStreak = useMemo(() => {
    if (allYourEvents.length === 0) return 0;
    const daySet = new Set(allYourEvents.map((e) => new Date(e.timestamp).toDateString()));
    let streak = 0;
    let cursor = new Date();
    while (daySet.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [allYourEvents]);

  const saveName = () => {
    const trimmed = draftName.trim();
    setProfile((p) => ({ ...p, name: trimmed || p.name }));
    setEditingName(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      console.error("Failed to upload avatar", error);
      e.target.value = "";
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setProfile((p) => ({ ...p, avatarPhoto: data.publicUrl }));
    e.target.value = "";
  };

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm mb-6"
          style={{ color: C.text }}
        >
          <ChevronLeft size={18} />
          Back
        </button>

        <input
          type="file"
          accept="image/*"
          ref={photoInputRef}
          onChange={handlePhotoUpload}
          className="hidden"
        />

        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-display text-3xl font-bold overflow-hidden"
              style={{ backgroundColor: profile.color, color: "white" }}
            >
              {profile.avatarPhoto ? (
                <img src={profile.avatarPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                profile.name.charAt(0).toUpperCase() || "Y"
              )}
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: C.card, border: `2px solid ${C.bg}`, color: C.primary }}
            >
              <Camera size={13} />
            </button>
          </div>
          {profile.avatarPhoto && (
            <button
              type="button"
              onClick={() => setProfile((p) => ({ ...p, avatarPhoto: null }))}
              className="text-[11px] mb-3"
              style={{ color: C.muted }}
            >
              Remove photo
            </button>
          )}
          <div className="flex gap-2 mb-3">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, color: c }))}
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: c,
                  outline: profile.color === c ? `2px solid ${C.text}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <label className="text-[11px] mb-1" style={{ color: C.muted }}>
            Username
          </label>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
                className="text-lg font-display font-bold text-center rounded-xl px-3 py-1.5 outline-none"
                style={{ backgroundColor: C.card, color: C.text, border: `1px solid ${C.border}` }}
              />
              <button
                type="button"
                onClick={saveName}
                className="rounded-full p-2"
                style={{ backgroundColor: C.primary, color: "white" }}
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(profile.name);
                setEditingName(true);
              }}
              className="flex items-center gap-1.5 font-display text-lg font-bold"
            >
              {profile.name}
              <span className="text-xs font-sans font-normal" style={{ color: C.primary }}>
                Edit
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8">
          <div
            className="rounded-2xl p-4 flex flex-col items-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <Zap size={16} style={{ color: C.primary }} className="mb-1" />
            <span className="font-display text-xl font-bold">{totalCracks}</span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              All-time
            </span>
          </div>
          <div
            className="rounded-2xl p-4 flex flex-col items-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <Flame size={16} style={{ color: C.primary }} className="mb-1" />
            <span className="font-display text-xl font-bold">{currentStreak}</span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              Day streak
            </span>
          </div>
          <div
            className="rounded-2xl p-4 flex flex-col items-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <MapPin size={16} style={{ color: C.primary }} className="mb-1" />
            <span className="font-display text-sm font-bold text-center">{favoriteLocation}</span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              Top spot
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Users size={13} />
          Your groups
        </div>
        <div className="flex flex-col gap-2 mb-8">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
            >
              <div>
                <div className="text-sm font-medium">{g.name}</div>
                <div className="text-xs font-display tracking-widest" style={{ color: C.muted }}>
                  {g.inviteCode}
                </div>
              </div>
              <div className="text-xs" style={{ color: C.muted }}>
                {g.players.length} members
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Globe size={13} />
          Community
        </div>
        <div
          className="rounded-2xl p-4 mb-3"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <label className="text-xs mb-2 block" style={{ color: C.muted }}>
            Your city (used only for an area-wide average, never shown per person)
          </label>
          <input
            type="text"
            value={profile.city}
            onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            placeholder="e.g. Toronto"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: C.chipBg, color: C.text }}
          />
        </div>

        <div
          className="rounded-2xl p-4 mb-3"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <label className="text-xs mb-2 block" style={{ color: C.muted }}>
            Your age range (used only for an age-bracket average, never shown per person)
          </label>
          <div className="flex gap-2 flex-wrap">
            {AGE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, ageRange: r }))}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={
                  profile.ageRange === r
                    ? { backgroundColor: C.primary, color: "white" }
                    : { backgroundColor: C.chipBg, color: C.muted }
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 mb-8 flex items-center justify-between"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="pr-3">
            <div className="text-sm font-medium mb-0.5">Global leaderboard</div>
            <div className="text-xs" style={{ color: C.muted }}>
              Share only your total crack count and top spot under an anonymous handle. No name, no group, no city shown to others.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfile((p) => ({ ...p, optedIntoGlobal: !p.optedIntoGlobal }))}
            className="flex-shrink-0 w-12 h-7 rounded-full relative transition-colors"
            style={{ backgroundColor: profile.optedIntoGlobal ? C.primary : C.border }}
          >
            <div
              className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: profile.optedIntoGlobal ? "26px" : "4px" }}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full text-center text-xs py-2"
          style={{ color: C.muted }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// simplified continent outlines (lat/lon), enough to read as real landmasses
// ---------- interactive globe ----------
function InteractiveGlobe() {
  const globeRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const SIZE = 300;

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 });
  }, []);

  const points = MAJOR_CITIES.map((city) => ({ ...city, lng: city.lon }));

  return (
    <div>
      <div className="flex justify-center">
        <ReactGlobe
          ref={globeRef}
          width={SIZE}
          height={SIZE}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          pointsData={points}
          pointColor={() => C.primary}
          pointAltitude={0.01}
          pointRadius={0.35}
          pointLabel={(d) => d.name}
          onPointClick={(point) => setSelectedCity(point)}
        />
      </div>
      <p className="text-center text-[11px] mt-2" style={{ color: C.muted }}>
        Drag to rotate • Scroll to zoom • Tap a city
      </p>

      {selectedCity && (
        <div
          className="rounded-2xl p-4 mt-3 flex items-center justify-between"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <div>
            <div className="text-sm font-medium">{selectedCity.name}</div>
            <div className="text-xs" style={{ color: C.muted }}>
              This week's average
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-bold" style={{ color: C.primary }}>
              {getAreaAverage(selectedCity.name)}
            </span>
            <button type="button" onClick={() => setSelectedCity(null)}>
              <X size={16} style={{ color: C.muted }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- challenges screen ----------
function ChallengesScreen({ group, onBack, onClaim }) {
  const activity = group.activity;
  const weekNumber = currentWeekNumber();
  const cutoff7d = Date.now() - 7 * DAY_MS;

  const yourStreak = useMemo(() => {
    const daySet = new Set(
      activity.filter((e) => e.playerId === "you").map((e) => new Date(e.timestamp).toDateString())
    );
    let streak = 0;
    let cursor = new Date();
    while (daySet.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [activity]);

  const progressFor = (challenge) => {
    switch (challenge.id) {
      case "weekend-warrior": {
        const weekendDays = new Set(
          activity
            .filter((e) => e.playerId === "you" && e.timestamp >= cutoff7d)
            .map((e) => new Date(e.timestamp).getDay())
            .filter((d) => d === 0 || d === 6)
        );
        return { progress: weekendDays.size, target: 2 };
      }
      case "variety-pack": {
        const locs = new Set(
          activity
            .filter((e) => e.playerId === "you" && e.timestamp >= Date.now() - 30 * DAY_MS)
            .map((e) => e.location)
        );
        return { progress: locs.size, target: 3 };
      }
      case "on-fire":
        return { progress: Math.min(yourStreak, 3), target: 3 };
      case "perfect-score": {
        const has = activity.some(
          (e) => e.playerId === "you" && e.timestamp >= cutoff7d && e.rating >= 9
        );
        return { progress: has ? 1 : 0, target: 1 };
      }
      case "squad-goals": {
        const count = activity.filter((e) => e.timestamp >= cutoff7d).length;
        return { progress: Math.min(count, 5), target: 5 };
      }
      default:
        return { progress: 0, target: 1 };
    }
  };

  const isClaimed = (challengeId) =>
    group.challengeClaims.some(
      (c) => c.playerId === "you" && c.challengeId === challengeId && c.weekNumber === weekNumber
    );

  const weeklyBonus = group.challengeClaims
    .filter((c) => c.playerId === "you" && c.weekNumber === weekNumber)
    .reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-6" style={{ color: C.text }}>
          <ChevronLeft size={18} />
          Back
        </button>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Challenges</h1>
        <p className="text-xs mb-6" style={{ color: C.muted }}>
          Bonus points for {group.name}'s leaderboard. Resets every week — you've earned{" "}
          <span style={{ color: C.primary, fontWeight: 600 }}>+{weeklyBonus}</span> so far this week.
        </p>

        <div className="flex flex-col gap-3">
          {CHALLENGES.map((ch) => {
            const { progress, target } = progressFor(ch);
            const complete = progress >= target;
            const claimed = isClaimed(ch.id);
            const Icon = ch.icon;
            return (
              <div
                key={ch.id}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: C.card,
                  border: `1px solid ${claimed ? C.primary + "66" : C.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: C.chipBg, color: C.primary }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{ch.title}</div>
                      <div className="text-xs" style={{ color: C.muted }}>
                        {ch.desc}
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-display text-sm font-bold flex-shrink-0"
                    style={{ color: C.primary }}
                  >
                    +{ch.points}
                  </span>
                </div>

                <div
                  className="h-1.5 rounded-full overflow-hidden mb-2"
                  style={{ backgroundColor: C.chipBg }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (progress / target) * 100)}%`,
                      backgroundColor: claimed ? C.muted2 : C.primary,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: C.muted2 }}>
                    {Math.min(progress, target)}/{target}
                  </span>
                  {claimed ? (
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: C.muted }}>
                      <Check size={12} /> Claimed
                    </span>
                  ) : complete ? (
                    <button
                      type="button"
                      onClick={() => onClaim(ch)}
                      className="text-xs font-semibold rounded-full px-3 py-1.5"
                      style={{ backgroundColor: C.primary, color: "white" }}
                    >
                      Claim +{ch.points}
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: C.muted2 }}>
                      In progress
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- community screen ----------
function CommunityScreen({ profile, groups, onBack }) {
  const areaAverage = getAreaAverage(profile.city);

  const combinedLeaderboard = useMemo(() => {
    const totals = {}; // key: groupId-playerId -> { name, color, points, groupName, isYou }
    groups.forEach((g) => {
      g.players.forEach((p) => {
        const key = `${g.id}-${p.id}`;
        totals[key] = {
          name: p.name,
          color: p.color,
          isYou: !!p.isYou,
          groupName: g.name,
          points: 0,
        };
      });
      g.activity.forEach((e) => {
        const key = `${g.id}-${e.playerId}`;
        if (totals[key]) totals[key].points += 1;
      });
    });
    // merge "You" entries across groups into one row
    const merged = {};
    Object.values(totals).forEach((row) => {
      if (row.isYou) {
        merged.you = merged.you || { name: profile.name, color: profile.color, isYou: true, points: 0 };
        merged.you.points += row.points;
      } else {
        const key = `${row.groupName}-${row.name}`;
        merged[key] = row;
      }
    });
    return Object.values(merged).sort((a, b) => b.points - a.points);
  }, [groups, profile]);

  const globalLeaderboard = useMemo(() => {
    const base = buildGlobalLeaderboard();
    if (!profile.optedIntoGlobal) return base;
    const yourTotal = combinedLeaderboard.find((r) => r.isYou)?.points ?? 0;
    const withYou = [...base, { handle: "you (this device)", points: yourTotal, isYou: true }];
    return withYou.sort((a, b) => b.points - a.points);
  }, [profile.optedIntoGlobal, combinedLeaderboard]);

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-6" style={{ color: C.text }}>
          <ChevronLeft size={18} />
          Back
        </button>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-6">Community</h1>

        {/* Area average */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <MapPin size={13} />
          Area activity
        </div>
        <div
          className="rounded-2xl p-4 mb-8"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          {areaAverage === null ? (
            <p className="text-sm" style={{ color: C.muted }}>
              Add your city in your profile to see this week's area average. No individual data is ever shown — just one aggregate number.
            </p>
          ) : (
            <>
              <div className="font-display text-3xl font-bold mb-1">{areaAverage}</div>
              <p className="text-xs" style={{ color: C.muted }}>
                Average cracks this week among {profile.city} users. Aggregate only — no individual numbers or names.
              </p>
            </>
          )}
        </div>

        {/* Age range average */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Users size={13} />
          Age range activity
        </div>
        <div
          className="rounded-2xl p-4 mb-8"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          {!profile.ageRange ? (
            <p className="text-sm" style={{ color: C.muted }}>
              Add your age range in your profile to see this week's average for people your age. Aggregate only — no individual data.
            </p>
          ) : (
            <>
              <div className="font-display text-3xl font-bold mb-1">
                {getAgeRangeAverage(profile.ageRange)}
              </div>
              <p className="text-xs" style={{ color: C.muted }}>
                Average cracks this week among {profile.ageRange} users. Aggregate only — no individual numbers or names.
              </p>
            </>
          )}
        </div>

        {/* Interactive globe */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Globe size={13} />
          Explore averages worldwide
        </div>
        <div
          className="rounded-2xl p-4 mb-8"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <InteractiveGlobe />
        </div>

        {/* Combined leaderboard across your groups */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Trophy size={13} />
          All your groups combined
        </div>
        <div className="flex flex-col gap-2 mb-8">
          {combinedLeaderboard.map((p, i) => (
            <div
              key={p.isYou ? "you" : `${p.groupName}-${p.name}`}
              className="flex items-center gap-4 rounded-2xl px-4 py-3.5"
              style={{
                backgroundColor: C.card,
                border: `1px solid ${p.isYou ? C.primary + "66" : C.border}`,
              }}
            >
              <span className="font-display text-sm w-5" style={{ color: i === 0 ? C.primary : C.muted2 }}>
                {i + 1}
              </span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              <div className="flex-1">
                <div className="text-[15px] font-medium">{p.isYou ? profile.name : p.name}</div>
                {!p.isYou && (
                  <div className="text-[11px]" style={{ color: C.muted2 }}>
                    {p.groupName}
                  </div>
                )}
              </div>
              <span className="font-display text-xl font-bold tabular-nums">{p.points}</span>
            </div>
          ))}
        </div>

        {/* Global leaderboard */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Globe size={13} />
          Global leaderboard
        </div>
        {!profile.optedIntoGlobal && (
          <div
            className="rounded-2xl p-4 mb-3 text-xs"
            style={{ backgroundColor: C.chipBg, color: C.muted }}
          >
            You're not sharing to the global board. Turn it on in your profile to see where you rank — only your total count and an anonymous handle are ever shown.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {globalLeaderboard.slice(0, 10).map((p, i) => (
            <div
              key={p.handle}
              className="flex items-center gap-4 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: C.card,
                border: `1px solid ${p.isYou ? C.primary + "66" : C.border}`,
              }}
            >
              <span className="font-display text-sm w-5" style={{ color: i === 0 ? C.primary : C.muted2 }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{p.handle}</span>
              <span className="font-display text-lg font-bold tabular-nums">{p.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MAJOR_CITIES = [
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "Toronto", lat: 43.65, lon: -79.38 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Paris", lat: 48.85, lon: 2.35 },
  { name: "Berlin", lat: 52.52, lon: 13.4 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Dubai", lat: 25.2, lon: 55.27 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Seoul", lat: 37.57, lon: 126.98 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
];

function seedPartnerActivity(code) {
  // demo only: any code "links" to a deterministic mock partner so the
  // feature is fully explorable without a second real device
  const seed = hashString(code.toUpperCase()) + 4000;
  const partnerPlayer = { id: "partner", name: "Partner", isYou: false, color: "#B0104F" };
  return generateActivity(seed, [partnerPlayer], 60).filter(() => Math.random() < 0.7);
}

// ---------- calendar screen ----------
function CalendarScreen({ profile, setProfile, groups, linkPartner, unlinkPartner, onBack }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const yourEventsByDay = useMemo(() => {
    const map = {};
    groups.forEach((g) => {
      g.activity.forEach((e) => {
        if (e.playerId !== "you") return;
        const key = new Date(e.timestamp).toDateString();
        (map[key] = map[key] || []).push(e);
      });
    });
    return map;
  }, [groups]);

  const partnerEventsByDay = useMemo(() => {
    if (!profile.partner) return {};
    const map = {};
    profile.partner.activity.forEach((e) => {
      if (e.isPrivate) return; // private entries never shared, even when linked
      const key = new Date(e.timestamp).toDateString();
      (map[key] = map[key] || []).push(e);
    });
    return map;
  }, [profile.partner]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const changeMonth = (delta) => {
    setMonthCursor((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
    setSelectedDay(null);
  };

  const dayKey = (d) => new Date(year, month, d).toDateString();

  const selectedYourEvents = selectedDay ? yourEventsByDay[dayKey(selectedDay)] || [] : [];
  const selectedPartnerEvents = selectedDay ? partnerEventsByDay[dayKey(selectedDay)] || [] : [];

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: C.text }}>
            <ChevronLeft size={18} />
            Back
          </button>
          <button
            type="button"
            onClick={() => setShareOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
          >
            {profile.partner ? <Link2 size={13} /> : <Users size={13} />}
            {profile.partner ? "Shared" : "Share"}
          </button>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-6">Calendar</h1>

        {shareOpen && (
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            {profile.partner ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium">Linked with your partner</div>
                    <div className="text-xs" style={{ color: C.muted }}>
                      Their non-private days show up on this calendar too
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={unlinkPartner}
                  className="flex items-center gap-1.5 text-xs rounded-full px-3 py-2"
                  style={{ backgroundColor: C.chipBg, color: C.muted }}
                >
                  <Unlink size={13} />
                  Unlink calendars
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-medium mb-1">Share your calendar</div>
                <p className="text-xs mb-3" style={{ color: C.muted }}>
                  Give your partner this code, or enter theirs — both people have to link for it to connect. Days you mark "private" never show up here for them.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(profile.myCalendarCode);
                  }}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 mb-3"
                  style={{ backgroundColor: C.chipBg }}
                >
                  <span className="font-display tracking-widest text-sm">{profile.myCalendarCode}</span>
                  <Copy size={13} style={{ color: C.muted }} />
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={partnerCodeInput}
                    onChange={(e) => setPartnerCodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && linkPartner(partnerCodeInput)}
                    placeholder="Enter their code"
                    className="flex-1 rounded-xl px-3 py-2 text-sm outline-none font-display tracking-widest"
                    style={{ backgroundColor: C.chipBg, color: C.text }}
                  />
                  <button
                    type="button"
                    onClick={() => linkPartner(partnerCodeInput)}
                    className="rounded-xl px-4 py-2 text-sm font-bold"
                    style={{ backgroundColor: C.primary, color: "white" }}
                  >
                    Link
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => changeMonth(-1)} style={{ color: C.text }}>
            <ChevronLeft size={20} />
          </button>
          <span className="font-display font-bold">{monthLabel}</span>
          <button type="button" onClick={() => changeMonth(1)} style={{ color: C.text }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {profile.partner && (
          <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: C.muted }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: profile.color }} />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: profile.partner.color }} />
              Partner
            </span>
          </div>
        )}

        {/* Grid */}
        <div
          className="rounded-2xl p-3 mb-4"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="grid grid-cols-7 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium py-1" style={{ color: C.muted2 }}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const key = dayKey(d);
              const hasYou = !!yourEventsByDay[key]?.length;
              const hasPartner = !!partnerEventsByDay[key]?.length;
              const isSelected = selectedDay === d;
              const isToday = key === new Date().toDateString();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : d)}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs"
                  style={{
                    backgroundColor: isSelected ? C.primary : C.chipBg,
                    color: isSelected ? "white" : isToday ? C.primary : C.text,
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {d}
                  <div className="flex gap-0.5">
                    {hasYou && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isSelected ? "white" : profile.color }}
                      />
                    )}
                    {hasPartner && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isSelected ? "white" : profile.partner.color }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        {selectedDay && (selectedYourEvents.length > 0 || selectedPartnerEvents.length > 0) && (
          <div className="flex flex-col gap-2">
            {selectedYourEvents.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl p-4"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">You{e.isPrivate ? " · private" : ""}</span>
                  <span className="text-xs" style={{ color: C.muted2 }}>
                    {new Date(e.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                  <span>{e.mood}</span>
                  <span>{e.duration} min</span>
                  <span>{e.location}</span>
                  <span>★ {e.rating}/10</span>
                </div>
              </div>
            ))}
            {selectedPartnerEvents.map((e, i) => (
              <div
                key={`p-${i}`}
                className="rounded-2xl p-4"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Partner</span>
                  <span className="text-xs" style={{ color: C.muted2 }}>
                    {new Date(e.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                  <span>{e.mood}</span>
                  <span>{e.duration} min</span>
                  <span>{e.location}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedDay && selectedYourEvents.length === 0 && selectedPartnerEvents.length === 0 && (
          <p className="text-xs text-center" style={{ color: C.muted }}>
            Nothing logged this day.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- learn / sex ed content ----------
// Short overviews only — original content stops at "what is this," never
// dosing/treatment/diagnosis. Every topic links out to an actual health
// authority for anything requiring real medical accuracy.
const LEARN_CATEGORIES = ["Consent", "Contraception", "STIs & Testing", "Anatomy & Response", "Pregnancy", "Relationships"];

const LEARN_TOPICS = [
  {
    category: "Consent",
    title: "What consent actually means",
    summary: "Consent is a clear, ongoing, freely given yes — not the absence of a no. It can be withdrawn at any time, for any reason, and needs to be checked in on, not just assumed from a past yes.",
    link: "https://www.plannedparenthood.org/learn/relationships/sexual-consent",
    linkLabel: "Planned Parenthood: Sexual Consent",
  },
  {
    category: "Consent",
    title: "Consent and alcohol or drugs",
    summary: "Someone who is incapacitated, asleep, or significantly impaired cannot legally or ethically consent, regardless of what they said earlier in the night.",
    link: "https://www.rainn.org/articles/drug-facilitated-sexual-assault",
    linkLabel: "RAINN: Drug-Facilitated Assault",
  },
  {
    category: "Contraception",
    title: "How effective is each method?",
    summary: "Effectiveness varies a lot by method and by how consistently it's used — condoms, the pill, IUDs, and implants all have different typical-use vs. perfect-use rates worth knowing before choosing one.",
    link: "https://www.plannedparenthood.org/learn/birth-control",
    linkLabel: "Planned Parenthood: Birth Control Options",
  },
  {
    category: "Contraception",
    title: "Emergency contraception",
    summary: "Emergency contraception can reduce pregnancy risk after unprotected sex, but it's time-sensitive — effectiveness drops the longer you wait, and options differ by how many hours or days have passed.",
    link: "https://www.plannedparenthood.org/learn/morning-after-pill-emergency-contraception",
    linkLabel: "Planned Parenthood: Emergency Contraception",
  },
  {
    category: "STIs & Testing",
    title: "Why regular testing matters",
    summary: "Many STIs have no visible symptoms, so status can't be judged by how someone looks or feels. Regular testing — especially with new or multiple partners — is the only reliable way to know.",
    link: "https://www.cdc.gov/std/prevention/screeningreccs.htm",
    linkLabel: "CDC: STI Screening Recommendations",
  },
  {
    category: "STIs & Testing",
    title: "Talking to a partner about STI status",
    summary: "Bringing it up before sex, not after, is the standard — a short, direct conversation about last test dates and protection normalizes it rather than making it a big confrontation.",
    link: "https://www.ashasexualhealth.org/talking-to-a-partner/",
    linkLabel: "ASHA: Talking to a Partner",
  },
  {
    category: "Anatomy & Response",
    title: "Basic anatomy, without the myths",
    summary: "A lot of common assumptions about anatomy and arousal don't hold up — bodies vary widely, and most of what's considered 'normal' has a huge range.",
    link: "https://www.scarleteen.com/article/body",
    linkLabel: "Scarleteen: Body Basics",
  },
  {
    category: "Anatomy & Response",
    title: "Pain shouldn't be normal",
    summary: "Persistent pain during sex is common but not something to just push through — it usually has an identifiable, treatable cause and is worth bringing to a doctor.",
    link: "https://www.nhs.uk/conditions/painful-sex-dyspareunia/",
    linkLabel: "NHS: Painful Sex",
  },
  {
    category: "Pregnancy",
    title: "Early signs and next steps",
    summary: "Missed periods aren't the only early sign, and home tests are most reliable a few days after a missed period. Confirming with a provider early opens up the most options.",
    link: "https://www.plannedparenthood.org/learn/pregnancy/pregnancy-symptoms",
    linkLabel: "Planned Parenthood: Pregnancy Symptoms",
  },
  {
    category: "Relationships",
    title: "Mismatched libido is common",
    summary: "Differences in desire between partners are one of the most common relationship friction points, not a sign something's wrong — communication and scheduling intentional time together helps more than most people expect.",
    link: "https://www.plannedparenthood.org/learn/relationships/sex-and-intimacy",
    linkLabel: "Planned Parenthood: Sex & Intimacy",
  },
  {
    category: "Relationships",
    title: "Setting boundaries with a partner",
    summary: "Boundaries aren't ultimatums — they're clear statements of what you're comfortable with, communicated ahead of time so both people know where they stand.",
    link: "https://www.plannedparenthood.org/learn/relationships/healthy-relationships",
    linkLabel: "Planned Parenthood: Healthy Relationships",
  },
];

// ---------- learn screen ----------
function LearnScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);

  const filtered = useMemo(() => {
    return LEARN_TOPICS.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [query, activeCategory]);

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-6" style={{ color: C.text }}>
          <ChevronLeft size={18} />
          Back
        </button>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Learn</h1>
        <p className="text-xs mb-5" style={{ color: C.muted }}>
          Straightforward answers to common questions, sourced from real health organizations.
        </p>

        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 mb-3"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <Search size={15} style={{ color: C.muted }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: C.text }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={
              activeCategory === null
                ? { backgroundColor: C.primary, color: "white" }
                : { backgroundColor: C.card, color: C.muted, border: `1px solid ${C.border}` }
            }
          >
            All
          </button>
          {LEARN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={
                activeCategory === cat
                  ? { backgroundColor: C.primary, color: "white" }
                  : { backgroundColor: C.card, color: C.muted, border: `1px solid ${C.border}` }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {filtered.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: C.muted }}>
              No topics match that search.
            </p>
          )}
          {filtered.map((topic) => {
            const isOpen = expandedTopic === topic.title;
            return (
              <div
                key={topic.title}
                className="rounded-2xl p-4"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedTopic(isOpen ? null : topic.title)}
                  className="w-full text-left"
                >
                  <div className="text-[10px] font-medium mb-1" style={{ color: C.primary }}>
                    {topic.category}
                  </div>
                  <div className="text-sm font-medium">{topic.title}</div>
                </button>
                {isOpen && (
                  <div className="mt-2">
                    <p className="text-xs mb-3" style={{ color: C.muted }}>
                      {topic.summary}
                    </p>
                    <a
                      href={topic.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5"
                      style={{ backgroundColor: C.chipBg, color: C.primary }}
                    >
                      {topic.linkLabel}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="rounded-2xl p-4 flex items-start gap-2.5"
          style={{ backgroundColor: C.chipBg }}
        >
          <Info size={15} style={{ color: C.muted, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[11px]" style={{ color: C.muted }}>
            This is general information, not medical advice. For anything specific to you — symptoms, testing, contraception choices — talk to a doctor or clinic.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- component ----------
export default function Cracklist() {
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState("app"); // "app" | "profile"

  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const { profile: dbProfile, loading: profileLoading, updateProfile } = useProfile(userId);
  // Calendar/partner-linking stays mock this pass (see plan doc) — these
  // fields never touch Supabase, they just ride along on the profile object.
  const [localProfile, setLocalProfile] = useState({
    myCalendarCode: randomInviteCode(),
    partner: null, // { name, color, activity } once linked
  });
  const profile = dbProfile ? { ...dbProfile, ...localProfile } : null;
  // Every existing call site does setProfile(p => ({...p, x})) — i.e. always
  // passes back the full merged shape. Split it into the columns that are
  // real (go to Supabase) vs. the calendar-only fields that stay local.
  const setProfile = (updater) => {
    if (!profile) return;
    const next = typeof updater === "function" ? updater(profile) : updater;
    const { myCalendarCode, partner, ...backendFields } = next;
    setLocalProfile((p) => ({ ...p, myCalendarCode, partner }));
    updateProfile(backendFields);
  };

  const {
    groups,
    setGroups,
    loading: groupsLoading,
    createGroup: createGroupRemote,
    joinGroup: joinGroupRemote,
  } = useGroups(userId, profile?.name, profile?.color);
  const [activeGroupId, setActiveGroupId] = useState(null);
  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.id === activeGroupId)) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalTab, setGroupModalTab] = useState("join"); // "join" | "create"
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupModalError, setGroupModalError] = useState("");
  const [groupModalSubmitting, setGroupModalSubmitting] = useState(false);

  const [range, setRange] = useState("weekly");
  const [leaderboardMode, setLeaderboardMode] = useState("points"); // "points" | "cracks"
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [survey, setSurvey] = useState({
    duration: 15,
    rating: 7,
    location: LOCATIONS[0],
    mood: QUICK_MOODS[0],
    isPrivate: false,
  });
  const fileInputRef = useRef(null);
  const pendingReactionId = useRef(null);
  const toastTimer = useRef(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [showMoreMoods, setShowMoreMoods] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // groups/profile load async now, so these stay null-safe — everything
  // below only ever renders once the gates further down confirm both exist
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const players = activeGroup?.players ?? [];
  const activity = activeGroup?.activity ?? [];

  const updateActiveActivity = (updater) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === activeGroupId ? { ...g, activity: updater(g.activity) } : g))
    );
  };

  const rangeMs = { weekly: 7 * DAY_MS, monthly: 30 * DAY_MS, alltime: Infinity };

  const leaderboard = useMemo(() => {
    const cutoff = Date.now() - rangeMs[range];
    const counts = Object.fromEntries(players.map((p) => [p.id, 0]));
    activity.forEach((e) => {
      if (range === "alltime" || e.timestamp >= cutoff) {
        counts[e.playerId] = (counts[e.playerId] || 0) + 1;
      }
    });
    // challenge bonus points, summed from the claims log same as activity
    const bonus = Object.fromEntries(players.map((p) => [p.id, 0]));
    (activeGroup?.challengeClaims || []).forEach((c) => {
      if (range === "alltime" || c.timestamp >= cutoff) {
        bonus[c.playerId] = (bonus[c.playerId] || 0) + c.points;
      }
    });
    return players
      .map((p) => {
        const crackCount = counts[p.id] || 0;
        const bonusPoints = bonus[p.id] || 0;
        return {
          ...p,
          crackCount,
          bonusPoints,
          totalPoints: crackCount + bonusPoints,
          // `points` tracks whichever metric is currently selected, so
          // existing rendering code keeps working unchanged
          points: leaderboardMode === "cracks" ? crackCount : crackCount + bonusPoints,
        };
      })
      .sort((a, b) => b.points - a.points);
  }, [activity, range, players, activeGroup?.challengeClaims, leaderboardMode]);

  const graphData = useMemo(() => {
    const raw =
      range === "weekly"
        ? buildWeeklyGraph(activity, players)
        : range === "monthly"
        ? buildMonthlyGraph(activity, players)
        : buildAllTimeGraph(activity, players);
    return toCumulative(raw, players);
  }, [activity, range, players]);

  const recentActivity = activity.slice(0, 10);

  const showToast = (msg, cb) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, cb });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const submitCrack = () => {
    const newEvent = {
      id: Date.now(),
      playerId: "you",
      timestamp: Date.now(),
      isPrivate: survey.isPrivate,
      // full details are always saved for your own profile/stats —
      // isPrivate only controls whether the group's feed shows them
      duration: survey.duration,
      rating: survey.rating,
      location: survey.location,
      mood: survey.mood,
      reactions: [],
      likes: [],
      comments: [],
    };
    updateActiveActivity((prev) => [newEvent, ...prev]);
    setSurveyOpen(false);
    showToast(
      survey.isPrivate
        ? "Logged privately 🔒 Saved to your profile — your group only sees the point"
        : "Logged. Your group's been notified 🎉"
    );
    setSurvey({ duration: 15, rating: 7, location: LOCATIONS[0], mood: QUICK_MOODS[0], isPrivate: false });
  };

  const claimChallenge = (challenge) => {
    const weekNumber = currentWeekNumber();
    const already = activeGroup.challengeClaims.some(
      (c) => c.playerId === "you" && c.challengeId === challenge.id && c.weekNumber === weekNumber
    );
    if (already) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroupId
          ? {
              ...g,
              challengeClaims: [
                ...g.challengeClaims,
                {
                  id: `you-${challenge.id}-${Date.now()}`,
                  playerId: "you",
                  challengeId: challenge.id,
                  points: challenge.points,
                  weekNumber,
                  timestamp: Date.now(),
                },
              ],
            }
          : g
      )
    );
    showToast(`+${challenge.points} pts — ${challenge.title} claimed 🏆`);
  };

  const openCameraFor = (activityId) => {
    pendingReactionId.current = activityId;
    fileInputRef.current?.click();
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file || pendingReactionId.current == null) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photo = reader.result;
      updateActiveActivity((prev) =>
        prev.map((ev) =>
          ev.id === pendingReactionId.current
            ? { ...ev, reactions: [...ev.reactions, { by: "You", photo }] }
            : ev
        )
      );
      pendingReactionId.current = null;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleLike = (eventId) => {
    updateActiveActivity((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const liked = ev.likes.includes("You");
        return {
          ...ev,
          likes: liked ? ev.likes.filter((n) => n !== "You") : [...ev.likes, "You"],
        };
      })
    );
  };

  const toggleComments = (eventId) => {
    setExpandedComments((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const addComment = (eventId) => {
    const text = (commentDrafts[eventId] || "").trim();
    if (!text) return;
    updateActiveActivity((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? { ...ev, comments: [...ev.comments, { by: "You", text, ts: Date.now() }] }
          : ev
      )
    );
    setCommentDrafts((prev) => ({ ...prev, [eventId]: "" }));
  };

  const nameFor = (id) => players.find((p) => p.id === id)?.name ?? id;
  const colorFor = (id) => players.find((p) => p.id === id)?.color ?? C.primary;

  const joinGroup = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setGroupModalError("");
    setGroupModalSubmitting(true);
    const { error, groupId } = await joinGroupRemote(code);
    setGroupModalSubmitting(false);
    if (error) {
      setGroupModalError(error);
      return;
    }
    if (groupId) setActiveGroupId(groupId);
    setGroupModalOpen(false);
    setJoinCodeInput("");
    showToast("Joined group 🎉");
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setGroupModalError("");
    setGroupModalSubmitting(true);
    const { error, group } = await createGroupRemote(name);
    setGroupModalSubmitting(false);
    if (error) {
      setGroupModalError(error);
      return;
    }
    if (group) setActiveGroupId(group.id);
    setGroupModalOpen(false);
    setNewGroupName("");
    showToast(`Created ${name}`);
  };

  const linkPartner = (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const partnerActivity = seedPartnerActivity(trimmed);
    setProfile((p) => ({
      ...p,
      partner: { name: "Partner", color: "#B0104F", activity: partnerActivity },
    }));
    showToast("Calendars linked 💗");
  };

  const unlinkPartner = () => {
    setProfile((p) => ({ ...p, partner: null }));
    showToast("Calendars unlinked");
  };

  if (!entered) {
    return <SplashScreen onEnter={() => setEntered(true)} />;
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (profileLoading || !profile) {
    return <LoadingScreen />;
  }

  if (!profile.ageVerified) {
    return (
      <AgeGateScreen
        onVerified={(dob) => setProfile((p) => ({ ...p, birthdate: dob, ageVerified: true }))}
      />
    );
  }

  if (groupsLoading) {
    return <LoadingScreen />;
  }

  if (groups.length === 0) {
    return <NoGroupsScreen onCreate={createGroupRemote} onJoin={joinGroupRemote} />;
  }

  if (view === "profile") {
    return (
      <ProfileScreen
        profile={profile}
        setProfile={setProfile}
        groups={groups}
        onBack={() => setView("app")}
        userId={userId}
      />
    );
  }

  if (view === "community") {
    return <CommunityScreen profile={profile} groups={groups} onBack={() => setView("app")} />;
  }

  if (view === "calendar") {
    return (
      <CalendarScreen
        profile={profile}
        setProfile={setProfile}
        groups={groups}
        linkPartner={linkPartner}
        unlinkPartner={unlinkPartner}
        onBack={() => setView("app")}
      />
    );
  }

  if (view === "learn") {
    return <LearnScreen onBack={() => setView("app")} />;
  }

  if (view === "challenges") {
    return (
      <ChallengesScreen
        group={activeGroup}
        onBack={() => setView("app")}
        onClaim={claimChallenge}
      />
    );
  }

  if (view === "contact") {
    return <ContactScreen userId={userId} email={session?.user?.email} onBack={() => setView("app")} />;
  }

  return (
    <div className="min-h-screen w-full font-sans pb-28" style={{ backgroundColor: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        @keyframes slideDown { from { transform: translateY(-16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .toast-in { animation: slideDown 0.25s ease-out; }
        @keyframes popIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .modal-in { animation: popIn 0.2s ease-out; }
        input[type="range"] { -webkit-appearance: none; height: 4px; border-radius: 4px; background: ${C.border}; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: ${C.primary}; cursor: pointer; box-shadow: 0 0 0 4px rgba(232,40,91,0.15); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handlePhoto}
        className="hidden"
      />

      {/* Toast */}
      <div className="fixed top-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
        {toast && (
          <div
            className="toast-in pointer-events-auto rounded-full pl-4 pr-2 py-2 text-sm shadow-lg flex items-center gap-3"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <span className="flex items-center gap-2">
              <Zap size={14} style={{ color: C.primary }} />
              {toast.msg}
            </span>
            {toast.cb && (
              <button
                onClick={toast.cb}
                className="rounded-full p-1.5"
                style={{ backgroundColor: C.primary, color: "white" }}
              >
                <Camera size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-md mx-auto px-5 pt-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setView("profile")}
            className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold overflow-hidden"
            style={{ backgroundColor: profile.color, color: "white" }}
          >
            {profile.avatarPhoto ? (
              <img src={profile.avatarPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              profile.name.charAt(0).toUpperCase() || "Y"
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMembersOpen((v) => !v)}
                onMouseEnter={() => setMembersOpen(true)}
                onMouseLeave={() => setMembersOpen(false)}
                className="flex items-center gap-1 text-xs rounded-full px-2 py-1"
                style={{ color: C.muted, backgroundColor: membersOpen ? C.chipBg : "transparent" }}
              >
                <Users size={13} />
                {players.length}
              </button>
              {membersOpen && (
                <>
                  {/* invisible scrim so tapping elsewhere on mobile closes it */}
                  <div className="fixed inset-0 z-40" onClick={() => setMembersOpen(false)} />
                  <div
                    onMouseEnter={() => setMembersOpen(true)}
                    onMouseLeave={() => setMembersOpen(false)}
                    className="modal-in absolute top-9 left-0 z-50 rounded-2xl p-3 shadow-xl"
                    style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, width: 200 }}
                  >
                    <div className="text-[11px] font-medium mb-2" style={{ color: C.muted }}>
                      {activeGroup.name} · {players.length} members
                    </div>
                    <div className="flex flex-col gap-2">
                      {players.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: p.color }}
                          />
                          <span className="text-xs">
                            {p.name}
                            {p.isYou && (
                              <span style={{ color: C.muted2 }}> (you)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setView("challenges")}
              className="flex items-center justify-center rounded-full p-1.5 relative"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
            >
              <Target size={14} />
              {leaderboard.find((p) => p.isYou)?.bonusPoints > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: C.primary, color: "white", fontSize: 8 }}
                >
                  •
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView("learn")}
              className="flex items-center justify-center rounded-full p-1.5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
            >
              <BookOpen size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className="flex items-center justify-center rounded-full p-1.5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
            >
              <Calendar size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("community")}
              className="flex items-center justify-center rounded-full p-1.5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
            >
              <Globe size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("contact")}
              className="flex items-center justify-center rounded-full p-1.5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
            >
              <HelpCircle size={14} />
            </button>
          </div>
        </div>

        {/* Group switcher */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-1 pb-1">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroupId(g.id)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
              style={
                g.id === activeGroupId
                  ? { backgroundColor: C.text, color: "white" }
                  : { backgroundColor: C.card, color: C.muted, border: `1px solid ${C.border}` }
              }
            >
              {g.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGroupModalOpen(true)}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.primary }}
          >
            <Plus size={16} />
          </button>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{activeGroup.name}</h1>
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 text-xs mb-6"
          style={{ color: C.muted }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span className="font-display tracking-widest">{activeGroup.inviteCode}</span>
        </button>

        {/* Range tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: "weekly", label: "Weekly" },
            { key: "monthly", label: "Monthly" },
            { key: "alltime", label: "All-time" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setRange(t.key)}
              className="flex-1 py-2 rounded-full text-sm font-medium transition-colors"
              style={
                range === t.key
                  ? { backgroundColor: C.primary, color: "white" }
                  : { backgroundColor: C.card, color: C.muted, border: `1px solid ${C.border}` }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Graph */}
        <div
          className="rounded-2xl p-4 mb-6 shadow-sm"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
            <TrendingUp size={13} />
            Cumulative activity
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={graphData}>
              <CartesianGrid stroke="#FBE2E7" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={C.muted2}
                tick={{ fontSize: 11, fill: C.muted }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: C.text }}
              />
              {players.map((p) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.id}
                  name={p.name}
                  stroke={p.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            <Trophy size={13} />
            Leaderboard
          </div>
          <div className="flex gap-1 rounded-full p-0.5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            {[
              { key: "points", label: "Points" },
              { key: "cracks", label: "Cracks" },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setLeaderboardMode(m.key)}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={
                  leaderboardMode === m.key
                    ? { backgroundColor: C.primary, color: "white" }
                    : { color: C.muted }
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {leaderboardMode === "points" && (
          <p className="text-[11px] mb-3 -mt-1" style={{ color: C.muted2 }}>
            Cracks + challenge bonus points
          </p>
        )}
        <div className="flex flex-col gap-2 mb-8">
          {leaderboard.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl px-4 py-3.5"
              style={{
                backgroundColor: C.card,
                border: `1px solid ${p.isYou ? C.primary + "66" : C.border}`,
              }}
            >
              <span className="font-display text-sm w-5" style={{ color: i === 0 ? C.primary : C.muted2 }}>
                {i + 1}
              </span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              <div className="flex-1">
                <div className="text-[15px] font-medium">{p.name}</div>
                {leaderboardMode === "points" && p.bonusPoints > 0 && (
                  <div className="text-[10px] flex items-center gap-1" style={{ color: C.primary }}>
                    <Target size={9} />
                    +{p.bonusPoints} from challenges
                  </div>
                )}
              </div>
              <span className="font-display text-xl font-bold tabular-nums">{p.points}</span>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.muted }}>
          <Clock size={13} />
          Recent activity
        </div>
        <div className="flex flex-col gap-3">
          {recentActivity.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl p-4 shadow-sm"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: colorFor(e.playerId) }} />
                  <span className="font-medium text-sm">{nameFor(e.playerId)} cracked</span>
                  {e.isPrivate && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5"
                      style={{ backgroundColor: C.chipBg, color: C.muted }}
                    >
                      <Lock size={9} />
                      Private
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: C.muted2 }}>
                  {timeAgo(e.timestamp)}
                </span>
              </div>
              {e.isPrivate ? (
                <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: C.muted2 }}>
                  <Lock size={11} />
                  Only the point counts — details are hidden
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-xs mb-3" style={{ color: C.muted }}>
                    <span>{e.mood}</span>
                    <span>{e.duration} min</span>
                    <span>{e.location}</span>
                    <span>★ {e.rating}/10</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {e.reactions.map((r, idx) => (
                      <img
                        key={idx}
                        src={r.photo}
                        alt="reaction"
                        className="w-9 h-9 rounded-lg object-cover"
                        style={{ border: `1px solid ${C.border}` }}
                      />
                    ))}
                    {e.playerId !== "you" && (
                      <button
                        onClick={() => openCameraFor(e.id)}
                        className="flex items-center gap-1 text-xs rounded-full px-3 py-1.5"
                        style={{ color: C.primary, backgroundColor: C.chipBg }}
                      >
                        <Camera size={12} />
                        React
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center gap-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => toggleLike(e.id)}
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: e.likes.includes("You") ? C.primary : C.muted }}
                >
                  <Heart size={15} fill={e.likes.includes("You") ? C.primary : "none"} />
                  {e.likes.length > 0 ? e.likes.length : "Like"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleComments(e.id)}
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: C.muted }}
                >
                  <MessageCircle size={15} />
                  {e.comments.length > 0 ? e.comments.length : "Comment"}
                </button>
              </div>

              {expandedComments[e.id] && (
                <div className="mt-3 flex flex-col gap-2">
                  {e.comments.map((c, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-semibold" style={{ color: C.text }}>
                        {c.by}
                      </span>{" "}
                      <span style={{ color: C.muted }}>{c.text}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={commentDrafts[e.id] || ""}
                      onChange={(ev2) =>
                        setCommentDrafts((prev) => ({ ...prev, [e.id]: ev2.target.value }))
                      }
                      onKeyDown={(ev2) => {
                        if (ev2.key === "Enter") addComment(e.id);
                      }}
                      placeholder="Add a comment"
                      className="flex-1 text-xs rounded-full px-3 py-2 outline-none"
                      style={{ backgroundColor: C.chipBg, color: C.text }}
                    />
                    <button
                      type="button"
                      onClick={() => addComment(e.id)}
                      className="rounded-full p-2"
                      style={{ backgroundColor: C.primary, color: "white" }}
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Floating crack button */}
      <button
        onClick={() => setSurveyOpen(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-7 py-4 font-display font-bold text-base shadow-xl flex items-center gap-2 active:scale-95 transition-transform z-40"
        style={{ backgroundColor: C.primary, color: "white" }}
      >
        <Zap size={18} fill="white" />
        I Cracked
      </button>

      {/* Join / create group modal */}
      {groupModalOpen && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setGroupModalOpen(false);
          }}
        >
          <div
            className="modal-in w-full max-w-md rounded-t-3xl p-6"
            style={{ backgroundColor: C.card, borderTop: `1px solid ${C.border}` }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold">Add a group</h2>
              <button type="button" onClick={() => setGroupModalOpen(false)}>
                <X size={20} style={{ color: C.muted }} />
              </button>
            </div>

            {groupModalError && (
              <p className="text-xs mb-3" style={{ color: C.primary }}>
                {groupModalError}
              </p>
            )}

            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setGroupModalTab("join")}
                className="flex-1 py-2 rounded-full text-sm font-medium"
                style={
                  groupModalTab === "join"
                    ? { backgroundColor: C.primary, color: "white" }
                    : { backgroundColor: C.chipBg, color: C.muted }
                }
              >
                Join by code
              </button>
              <button
                type="button"
                onClick={() => setGroupModalTab("create")}
                className="flex-1 py-2 rounded-full text-sm font-medium"
                style={
                  groupModalTab === "create"
                    ? { backgroundColor: C.primary, color: "white" }
                    : { backgroundColor: C.chipBg, color: C.muted }
                }
              >
                Create new
              </button>
            </div>

            {groupModalTab === "join" ? (
              <>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinGroup()}
                  placeholder="Enter invite code"
                  className="w-full rounded-xl px-4 py-3 mb-4 outline-none font-display tracking-widest"
                  style={{ backgroundColor: C.chipBg, color: C.text }}
                />
                <button
                  type="button"
                  onClick={joinGroup}
                  disabled={groupModalSubmitting}
                  className="w-full rounded-2xl py-4 font-display font-bold"
                  style={{ backgroundColor: C.primary, color: "white", opacity: groupModalSubmitting ? 0.6 : 1 }}
                >
                  {groupModalSubmitting ? "Joining..." : "Join group"}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGroup()}
                  placeholder="Group name"
                  className="w-full rounded-xl px-4 py-3 mb-4 outline-none"
                  style={{ backgroundColor: C.chipBg, color: C.text }}
                />
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={groupModalSubmitting}
                  className="w-full rounded-2xl py-4 font-display font-bold"
                  style={{ backgroundColor: C.primary, color: "white", opacity: groupModalSubmitting ? 0.6 : 1 }}
                >
                  {groupModalSubmitting ? "Creating..." : "Create group"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Survey modal */}
      {surveyOpen && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50 p-0"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSurveyOpen(false);
          }}
        >
          <div
            className="modal-in w-full max-w-md rounded-t-3xl p-6 overflow-y-auto"
            style={{ backgroundColor: C.card, borderTop: `1px solid ${C.border}`, maxHeight: "85vh" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold">Quick log</h2>
              <button onClick={() => setSurveyOpen(false)} type="button">
                <X size={20} style={{ color: C.muted }} />
              </button>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3 mb-5"
              style={{ backgroundColor: C.chipBg }}
            >
              <div className="flex items-center gap-2.5 pr-3">
                <Lock size={15} style={{ color: C.primary }} />
                <div>
                  <div className="text-sm font-medium">Private mode</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    Details still save to your profile — just hidden from the group
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSurvey((s) => ({ ...s, isPrivate: !s.isPrivate }))}
                className="flex-shrink-0 w-12 h-7 rounded-full relative transition-colors"
                style={{ backgroundColor: survey.isPrivate ? C.primary : C.border }}
              >
                <div
                  className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: survey.isPrivate ? "26px" : "4px" }}
                />
              </button>
            </div>

            {survey.isPrivate && (
              <div
                className="rounded-2xl p-3 mb-5 text-xs flex items-center gap-2"
                style={{ backgroundColor: C.chipBg, color: C.muted }}
              >
                <Lock size={13} />
                These details save to your profile stats only — your group won't see them.
              </div>
            )}

            <label className="text-xs mb-2 block" style={{ color: C.muted }}>
              How long? {survey.duration} min
            </label>
            <input
              type="range"
              min={1}
              max={90}
              value={survey.duration}
              onChange={(e) => setSurvey((s) => ({ ...s, duration: Number(e.target.value) }))}
              className="w-full mb-5"
            />

            <label className="text-xs mb-2 block" style={{ color: C.muted }}>
              Rate it: {survey.rating}/10
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={survey.rating}
              onChange={(e) => setSurvey((s) => ({ ...s, rating: Number(e.target.value) }))}
              className="w-full mb-5"
            />

            <label className="text-xs mb-2 block" style={{ color: C.muted }}>
              Where?
            </label>
            <div className="flex gap-2 flex-wrap mb-5">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setSurvey((s) => ({ ...s, location: loc }))}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={
                    survey.location === loc
                      ? { backgroundColor: C.primary, color: "white" }
                      : { backgroundColor: C.chipBg, color: C.muted }
                  }
                >
                  {loc}
                </button>
              ))}
            </div>

            <label className="text-xs mb-2 block" style={{ color: C.muted }}>
              Mood after?
            </label>
            <input
              type="text"
              value={survey.mood}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setSurvey((s) => ({ ...s, mood: "" }));
                  return;
                }
                if (typeof Intl !== "undefined" && Intl.Segmenter) {
                  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
                  const segments = Array.from(segmenter.segment(val), (s) => s.segment);
                  setSurvey((s) => ({ ...s, mood: segments[segments.length - 1] }));
                } else {
                  setSurvey((s) => ({ ...s, mood: val }));
                }
              }}
              placeholder="Tap the emoji key on your keyboard"
              className="w-full text-2xl text-center rounded-xl py-3 mb-3 outline-none"
              style={{ backgroundColor: C.chipBg, color: C.text }}
            />
            <div className="flex flex-wrap gap-2 mb-6">
              {(showMoreMoods ? QUICK_MOODS : QUICK_MOODS.slice(0, 5)).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSurvey((s) => ({ ...s, mood: m }))}
                  className="w-11 h-11 rounded-xl text-lg flex items-center justify-center"
                  style={{ backgroundColor: survey.mood === m ? C.primary : C.chipBg }}
                >
                  {m}
                </button>
              ))}
              {!showMoreMoods && (
                <button
                  type="button"
                  onClick={() => setShowMoreMoods(true)}
                  className="w-11 h-11 rounded-xl text-lg flex items-center justify-center font-bold"
                  style={{ backgroundColor: C.chipBg, color: C.muted }}
                >
                  •••
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={submitCrack}
              className="w-full rounded-2xl py-4 font-display font-bold mb-2"
              style={{ backgroundColor: C.primary, color: "white" }}
            >
              Log it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
