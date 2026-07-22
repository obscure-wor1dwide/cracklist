import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../lib/theme";

const TABS = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Sign up" },
  { id: "magic", label: "Magic link" },
];

export default function AuthScreen() {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (tab === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
      } else if (tab === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) setError(err.message);
      } else if (tab === "magic") {
        const { error: err } = await supabase.auth.signInWithOtp({ email });
        if (err) setError(err.message);
        else setMagicLinkSent(true);
      }
    } finally {
      setSubmitting(false);
    }
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
          <ShieldCheck size={32} style={{ color: C.primary }} className="mb-3" />
          <h1 className="font-display text-lg font-bold mb-1">Welcome to Cracklist</h1>
          <p className="text-xs" style={{ color: C.muted }}>
            Sign in or create an account to connect with your friends.
          </p>
        </div>

        <div
          className="flex rounded-xl p-1 mb-4"
          style={{ backgroundColor: C.chipBg }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError("");
                setMagicLinkSent(false);
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

        {tab === "magic" && magicLinkSent ? (
          <p className="text-sm text-center py-4" style={{ color: C.text }}>
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
              style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
            />

            {tab !== "magic" && (
              <>
                <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
                  style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
                />
              </>
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
              {submitting
                ? "Please wait..."
                : tab === "signin"
                ? "Sign in"
                : tab === "signup"
                ? "Create account"
                : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
