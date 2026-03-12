import { supabase } from "./supabase";

export interface LeaderboardEntry {
  userId: string;
  refillCount: number;
  displayName: string | null;
  avatarUrl: string | null;
}

export type LeaderboardResult =
  | { data: LeaderboardEntry[]; error: null }
  | { data: []; error: string };

/**
 * Get top users by refill count. Requires Supabase migration 004_refill_leaderboard
 * (run the SQL in that file in Dashboard → SQL Editor).
 */
export async function getRefillLeaderboard(
  limit = 10
): Promise<LeaderboardResult> {
  if (!supabase) return { data: [], error: "Supabase not configured" };
  const { data, error } = await supabase.rpc("get_refill_leaderboard", {
    limit_count: Math.min(Math.max(1, limit), 50),
  });
  if (error) {
    return { data: [], error: error.message };
  }
  const rows = (data ?? []) as Array<{
    user_id: string;
    refill_count: number | string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  return {
    data: rows.map((r) => ({
      userId: r.user_id,
      refillCount: Number(r.refill_count),
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    })),
    error: null,
  };
}

/**
 * Get the total number of refills logged by the user.
 */
export async function getRefillCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("refills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Log a refill. Optionally link to a water source (when user taps "I refilled here" on a location).
 */
export async function logRefill(
  userId: string,
  waterSourceId?: string | null
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("refills").insert({
    user_id: userId,
    water_source_id: waterSourceId ?? null,
  });
  return !error;
}
