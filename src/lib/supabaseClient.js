import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local — " +
      "create a Supabase project and fill these in. Auth/data calls will fail until then."
  );
}

// Falls back to a placeholder so `createClient` doesn't throw at import time
// and blank the whole app before .env.local is filled in — every Supabase
// call will simply fail (caught by the existing error handling) until then.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
