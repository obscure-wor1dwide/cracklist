import { useState } from "react";
import { ChevronLeft, HelpCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { C } from "../lib/theme";

export default function ContactScreen({ userId, email: initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // No .select() here — the questions table has no read policy for
      // regular users, so chaining .select() would trigger an RLS failure
      // on the read-back even though the insert itself succeeds.
      const { error: err } = await supabase
        .from("questions")
        .insert({ user_id: userId, email: email || null, message: message.trim() });
      if (err) setError(err.message);
      else setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans pb-16" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="w-full max-w-md mx-auto px-5 pt-10">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-6" style={{ color: C.text }}>
          <ChevronLeft size={18} />
          Back
        </button>

        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="flex flex-col items-center text-center mb-5">
            <HelpCircle size={32} style={{ color: C.primary }} className="mb-3" />
            <h1 className="font-display text-lg font-bold mb-1">Ask us a question</h1>
            <p className="text-xs" style={{ color: C.muted }}>
              Feedback, bugs, anything on your mind — we read every message.
            </p>
          </div>

          {sent ? (
            <p className="text-sm text-center py-4" style={{ color: C.text }}>
              Thanks — we'll get back to you.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
                Your message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3 resize-none"
                style={{ backgroundColor: C.chipBg, color: C.text, border: `1px solid ${C.border}` }}
              />

              <label className="text-[11px] mb-1 block" style={{ color: C.muted }}>
                Email (optional, so we can reply)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                {submitting ? "Sending..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
