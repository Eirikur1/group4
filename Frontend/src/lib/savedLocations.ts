import type { Fountain } from "../types/fountain";
import { supabase } from "./supabase";

interface WaterSourceRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images: string[] | null;
  rating: number | null;
  is_operational: boolean;
}

interface SavedLocationRow {
  water_sources: WaterSourceRow[] | WaterSourceRow | null;
}

function toFountain(row: WaterSourceRow): Fountain {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    images: row.images ?? undefined,
    imageUrl: row.images?.[0],
    rating: row.rating ?? undefined,
    isOperational: row.is_operational ?? true,
    useAdminPin: false,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function fetchSavedLocations(): Promise<Fountain[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("saved_locations")
    .select(
      "water_sources(id, name, latitude, longitude, images, rating, is_operational)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message ||
        "Failed to fetch saved locations. Ensure the saved_locations table exists in Supabase."
    );
  }

  const rows = (data ?? []) as SavedLocationRow[];
  return rows
    .map((r) =>
      Array.isArray(r.water_sources) ? r.water_sources[0] : r.water_sources
    )
    .filter((r): r is WaterSourceRow => !!r)
    .map(toFountain);
}

export async function isLocationSaved(fountainId: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from("saved_locations")
    .select("id")
    .eq("user_id", userId)
    .eq("fountain_id", fountainId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to check saved state.");
  }
  return !!data;
}

export async function toggleSavedLocation(fountainId: string): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Please sign in to save locations.");
  }

  const saved = await isLocationSaved(fountainId);
  if (saved) {
    const { error } = await supabase
      .from("saved_locations")
      .delete()
      .eq("user_id", userId)
      .eq("fountain_id", fountainId);
    if (error) {
      throw new Error(error.message || "Failed to remove saved location.");
    }
    return false;
  }

  const { error } = await supabase
    .from("saved_locations")
    .insert({ user_id: userId, fountain_id: fountainId });

  if (error) {
    throw new Error(
      error.message ||
        "Failed to save location. Ensure saved_locations has user_id + fountain_id columns and proper policies."
    );
  }
  return true;
}
