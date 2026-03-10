import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const CACHE_PREFIX = "osm_uuid_v1_";

/**
 * Resolve an OSM node ID to a water_sources UUID.
 *
 * Priority:
 * 1. AsyncStorage cache (instant, no network)
 * 2. Supabase lookup by osm_node_id column (if the column exists via migration)
 * 3. Insert a new water_sources row (created_by = null so any user can update it)
 *
 * The resolved UUID is cached in AsyncStorage so subsequent calls are instant
 * and we never create duplicate rows for the same OSM node.
 */
export async function resolveOsmToUuid(
  osmNodeId: number,
  name: string,
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!supabase) return null;

  const cacheKey = `${CACHE_PREFIX}${osmNodeId}`;

  // 1. Check local cache
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {}

  // 2. Look up by osm_node_id (works if the column was added via migration)
  try {
    const { data } = await supabase
      .from("water_sources")
      .select("id")
      .eq("osm_node_id", osmNodeId)
      .maybeSingle();
    if (data?.id) {
      const id = data.id as string;
      try { await AsyncStorage.setItem(cacheKey, id); } catch {}
      return id;
    }
  } catch {
    // osm_node_id column may not exist yet — fall through to insert
  }

  // 3. Create a new row (created_by = null means any signed-in user can add photos/rate)
  try {
    const { data } = await supabase
      .from("water_sources")
      .insert({
        name: name.trim() || "Water fountain",
        latitude,
        longitude,
        images: [],
      })
      .select("id")
      .single();
    if (data?.id) {
      const id = data.id as string;
      try { await AsyncStorage.setItem(cacheKey, id); } catch {}
      return id;
    }
  } catch {}

  return null;
}
