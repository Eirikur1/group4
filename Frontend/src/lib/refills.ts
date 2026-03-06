import { supabase } from "./supabase";

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
