import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../lib/theme";

export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) setError(err.message);
      else onDone();
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
          <h1 className="font-display text-lg font-bold mb-1">Set a new password</h1>
          <p className="text-xs" style={{ color: C.muted }}>
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
            style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
          />

          <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
            style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
          />

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
            {submitting ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
