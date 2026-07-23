import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when Supabase fires PASSWORD_RECOVERY (user clicked a reset-password
  // email link) — lets the app show a "set new password" screen instead of
  // dropping them straight into the app on that temporary recovery session.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get auth session", err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading, passwordRecovery, clearPasswordRecovery: () => setPasswordRecovery(false) };
}
