import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { randomInviteCode } from "../lib/mockData";

// Membership and identity are real (Supabase); activity/likes/comments/
// reactions/challenge claims are now real too (see supabase/phase1_activity.sql)
// — this hook maps DB rows onto the same object shapes the rest of the app
// already expects (playerId "you" sentinel, etc).
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

function nameFor(userId, viewerId, profileMap) {
  return userId === viewerId ? "You" : profileMap.get(userId)?.name ?? "Friend";
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

    const [
      { data: allMembers, error: membersError },
      { data: profileRows, error: profilesError },
      { data: activityRows, error: activityError },
      { data: likeRows, error: likeError },
      { data: commentRows, error: commentError },
      { data: reactionRows, error: reactionError },
      { data: claimRows, error: claimError },
    ] = await Promise.all([
      supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds),
      supabase.from("group_profiles").select("id, name, color, avatar_url"),
      supabase
        .from("activity_feed")
        .select("*")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false }),
      supabase.from("activity_likes").select("activity_id, user_id"),
      supabase.from("activity_comments").select("id, activity_id, user_id, text, created_at"),
      supabase.from("activity_reactions").select("id, activity_id, user_id, photo_url"),
      supabase.from("challenge_claims").select("*").in("group_id", groupIds),
    ]);

    if (membersError) console.error("Failed to load group members", membersError);
    if (profilesError) console.error("Failed to load group member profiles", profilesError);
    if (activityError) console.error("Failed to load activity", activityError);
    if (likeError) console.error("Failed to load likes", likeError);
    if (commentError) console.error("Failed to load comments", commentError);
    if (reactionError) console.error("Failed to load reactions", reactionError);
    if (claimError) console.error("Failed to load challenge claims", claimError);

    const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));
    const membersByGroup = new Map();
    (allMembers || []).forEach((m) => {
      const list = membersByGroup.get(m.group_id) || [];
      list.push(m.user_id);
      membersByGroup.set(m.group_id, list);
    });

    const likesByActivity = new Map();
    (likeRows || []).forEach((l) => {
      const list = likesByActivity.get(l.activity_id) || [];
      list.push(l.user_id === userId ? "you" : l.user_id);
      likesByActivity.set(l.activity_id, list);
    });
    const commentsByActivity = new Map();
    (commentRows || []).forEach((c) => {
      const list = commentsByActivity.get(c.activity_id) || [];
      list.push({
        by: nameFor(c.user_id, userId, profileMap),
        text: c.text,
        ts: new Date(c.created_at).getTime(),
      });
      commentsByActivity.set(c.activity_id, list);
    });
    const reactionsByActivity = new Map();
    (reactionRows || []).forEach((r) => {
      const list = reactionsByActivity.get(r.activity_id) || [];
      list.push({ by: nameFor(r.user_id, userId, profileMap), photo: r.photo_url });
      reactionsByActivity.set(r.activity_id, list);
    });

    const activityByGroup = new Map();
    (activityRows || []).forEach((row) => {
      const list = activityByGroup.get(row.group_id) || [];
      list.push({
        id: row.id,
        playerId: row.user_id === userId ? "you" : row.user_id,
        timestamp: new Date(row.created_at).getTime(),
        isPrivate: row.is_private,
        duration: row.duration,
        rating: row.rating,
        location: row.location,
        mood: row.mood,
        reactions: reactionsByActivity.get(row.id) || [],
        likes: likesByActivity.get(row.id) || [],
        comments: commentsByActivity.get(row.id) || [],
      });
      activityByGroup.set(row.group_id, list);
    });

    const claimsByGroup = new Map();
    (claimRows || []).forEach((row) => {
      const list = claimsByGroup.get(row.group_id) || [];
      list.push({
        id: row.id,
        playerId: row.user_id === userId ? "you" : row.user_id,
        challengeId: row.challenge_id,
        points: row.points,
        weekNumber: row.week_number,
        timestamp: new Date(row.created_at).getTime(),
      });
      claimsByGroup.set(row.group_id, list);
    });

    setGroups(
      groupRows.map((g) => {
        const players = buildPlayers(
          youName,
          youColor,
          userId,
          membersByGroup.get(g.id) || [userId],
          profileMap
        );
        return {
          id: g.id,
          name: g.name,
          inviteCode: g.invite_code,
          players,
          activity: activityByGroup.get(g.id) || [],
          challengeClaims: claimsByGroup.get(g.id) || [],
        };
      })
    );
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
