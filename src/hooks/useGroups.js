import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  generateActivity,
  seedSocial,
  seedChallengeClaims,
  randomInviteCode,
  hashString,
} from "../lib/mockData";

// Membership and identity are real (Supabase); activity/leaderboard/challenge
// data is still the existing client-generated mock, seeded per real group id
// — this is the explicit scope boundary for this pass (see plan doc).
function buildPlayers(youName, youColor, userId, memberIds, profileMap) {
  const you = { id: "you", name: youName || "You", color: youColor || "#E8285B", isYou: true };
  const others = memberIds
    .filter((id) => id !== userId)
    .map((id) => ({
      id,
      name: profileMap.get(id)?.name ?? "Friend",
      color: profileMap.get(id)?.color ?? "#FF6B6B",
      isYou: false,
    }));
  return [you, ...others];
}

export function useGroups(userId, youName, youColor) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, groups(id, name, invite_code)")
      .eq("user_id", userId);

    if (membershipError) {
      console.error("Failed to load groups", membershipError);
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupRows = (memberships || []).map((m) => m.groups).filter(Boolean);
    if (groupRows.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const groupIds = groupRows.map((g) => g.id);

    const [{ data: allMembers, error: membersError }, { data: profileRows, error: profilesError }] =
      await Promise.all([
        supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds),
        supabase.from("group_profiles").select("id, name, color, avatar_url"),
      ]);

    if (membersError) console.error("Failed to load group members", membersError);
    if (profilesError) console.error("Failed to load group member profiles", profilesError);

    const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));
    const membersByGroup = new Map();
    (allMembers || []).forEach((m) => {
      const list = membersByGroup.get(m.group_id) || [];
      list.push(m.user_id);
      membersByGroup.set(m.group_id, list);
    });

    setGroups((prev) => {
      const prevById = new Map(prev.map((g) => [g.id, g]));
      return groupRows.map((g) => {
        const players = buildPlayers(
          youName,
          youColor,
          userId,
          membersByGroup.get(g.id) || [userId],
          profileMap
        );
        const existing = prevById.get(g.id);
        if (existing) {
          // keep existing activity/challengeClaims (and any live edits from
          // this session) — only membership/identity re-syncs from the backend
          return { ...existing, name: g.name, inviteCode: g.invite_code, players };
        }
        const seed = hashString(g.id);
        return {
          id: g.id,
          name: g.name,
          inviteCode: g.invite_code,
          players,
          activity: seedSocial(generateActivity(seed, players)),
          challengeClaims: seedChallengeClaims(seed, players),
        };
      });
    });
    setLoading(false);
  }, [userId, youName, youColor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createGroup = useCallback(
    async (name) => {
      if (!userId || !name.trim()) return { error: "Name required" };
      const code = randomInviteCode();
      const { data: group, error } = await supabase
        .from("groups")
        .insert({ name: name.trim(), invite_code: code, created_by: userId })
        .select()
        .single();
      if (error) return { error: error.message };
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: userId });
      if (memberError) return { error: memberError.message };
      await refresh();
      return { group };
    },
    [userId, refresh]
  );

  const joinGroup = useCallback(
    async (code) => {
      if (!userId || !code.trim()) return { error: "Code required" };
      const { data: groupId, error } = await supabase.rpc("join_group_by_code", {
        code: code.trim().toUpperCase(),
      });
      if (error) return { error: error.message };
      await refresh();
      return { groupId };
    },
    [userId, refresh]
  );

  return { groups, setGroups, loading, createGroup, joinGroup, refresh };
}
