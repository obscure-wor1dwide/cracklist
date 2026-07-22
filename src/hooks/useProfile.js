import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// The app works with a camelCase profile shape (matches the rest of
// Cracklist.jsx); the `profiles` table is snake_case. This hook is the only
// place that translates between the two.
function fromRow(row) {
  return {
    name: row.name,
    color: row.color,
    avatarPhoto: row.avatar_url,
    city: row.city,
    ageRange: row.age_range,
    birthdate: row.birthdate,
    ageVerified: row.age_verified,
    optedIntoGlobal: row.opted_into_global,
  };
}

function toRow(patch) {
  const row = {};
  if ("name" in patch) row.name = patch.name;
  if ("color" in patch) row.color = patch.color;
  if ("avatarPhoto" in patch) row.avatar_url = patch.avatarPhoto;
  if ("city" in patch) row.city = patch.city;
  if ("ageRange" in patch) row.age_range = patch.ageRange;
  if ("birthdate" in patch) row.birthdate = patch.birthdate;
  if ("ageVerified" in patch) row.age_verified = patch.ageVerified;
  if ("optedIntoGlobal" in patch) row.opted_into_global = patch.optedIntoGlobal;
  return row;
}

export function useProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load profile", error);
        } else {
          setProfile(fromRow(data));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Accepts a camelCase patch (may be the whole profile object, since every
  // existing call site in Cracklist.jsx does `setProfile(p => ({...p, x}))`)
  // and writes only the known columns to Supabase.
  const updateProfile = useCallback(
    (patch) => {
      if (!userId) return;
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      const row = toRow(patch);
      if (Object.keys(row).length === 0) return;
      supabase
        .from("profiles")
        .update(row)
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error("Failed to update profile", error);
        });
    },
    [userId]
  );

  return { profile, loading, updateProfile };
}
