import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function usePartner(userId) {
  const [partner, setPartner] = useState(null);
  const [myInviteCode, setMyInviteCode] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPartner(null);
      setMyInviteCode(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("partner_invite_code")
      .eq("id", userId)
      .single();
    if (profileError) console.error("Failed to load invite code", profileError);

    let code = profileRow?.partner_invite_code ?? null;
    if (!code) {
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = randomCode();
        const { data, error } = await supabase
          .from("profiles")
          .update({ partner_invite_code: candidate })
          .eq("id", userId)
          .select("partner_invite_code")
          .single();
        if (!error) code = data.partner_invite_code;
        else if (error.code !== "23505") {
          console.error("Failed to generate invite code", error);
          break;
        }
      }
    }
    setMyInviteCode(code);

    const { data: partnerRows, error: partnerError } = await supabase
      .from("partner_profile")
      .select("id, name, color, avatar_url");
    if (partnerError) console.error("Failed to load partner profile", partnerError);
    const partnerRow = partnerRows?.[0];

    if (!partnerRow) {
      setPartner(null);
      setLoading(false);
      return;
    }

    const { data: activityRows, error: activityError } = await supabase.rpc("partner_activity");
    if (activityError) console.error("Failed to load partner activity", activityError);

    const activity = (activityRows || []).map((row) => ({
      id: row.id,
      playerId: "partner",
      timestamp: new Date(row.created_at).getTime(),
      isPrivate: row.is_private,
      duration: row.duration,
      rating: row.rating,
      location: row.location,
      mood: row.mood,
    }));

    setPartner({
      id: partnerRow.id,
      name: partnerRow.name,
      color: partnerRow.color,
      avatarUrl: partnerRow.avatar_url,
      activity,
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const linkPartner = useCallback(
    async (code) => {
      if (!code?.trim()) return { error: "Code required" };
      const { error } = await supabase.rpc("link_partner_by_code", {
        code: code.trim().toUpperCase(),
      });
      if (error) return { error: error.message };
      await refresh();
      return {};
    },
    [refresh]
  );

  const unlinkPartner = useCallback(async () => {
    const { error } = await supabase.rpc("unlink_partner");
    if (error) return { error: error.message };
    await refresh();
    return {};
  }, [refresh]);

  return { partner, myInviteCode, loading, linkPartner, unlinkPartner, refresh };
}
