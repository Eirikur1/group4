import { supabase } from "./supabase";

/** Rating is 1–5 (one star to five stars). */
const MIN_RATING = 1;
const MAX_RATING = 5;

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

/**
 * Submit or update the current user's rating for a water source (1–5).
 * Uses upsert so one rating per user per fountain; average is computed elsewhere.
 */
export async function submitRating(
  waterSourceId: string,
  rating: number
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Sign in to rate.");

  const value = Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(rating)));
  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      water_source_id: waterSourceId,
      rating: value,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,water_source_id",
    }
  );
  if (error) throw new Error(error.message || "Failed to save rating.");
}

/**
 * Fetch the average rating for a water source (from all users). Returns null if no ratings.
 */
export async function getAverageRating(
  waterSourceId: string
): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("ratings")
    .select("rating")
    .eq("water_source_id", waterSourceId);
  if (error || !data || data.length === 0) return null;
  const sum = data.reduce((a, r) => a + (r.rating ?? 0), 0);
  const avg = sum / data.length;
  return Math.round(avg * 10) / 10;
}
