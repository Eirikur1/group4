import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Fountain } from "../types/fountain";

const CACHE_KEY = "osm_fountains_v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CacheEntry {
  lat: number;
  lon: number;
  savedAt: number;
  fountains: Fountain[];
}

/** Load cached OSM fountains. Returns null if cache is missing, expired, or too far from current location. */
export async function loadCachedFountains(
  lat: number,
  lon: number,
): Promise<Fountain[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const age = Date.now() - entry.savedAt;
    if (age > MAX_AGE_MS) return null;
    // Only use cache if within ~50 km of where it was saved
    const latDiff = Math.abs(entry.lat - lat);
    const lonDiff = Math.abs(entry.lon - lon);
    if (latDiff > 0.45 || lonDiff > 0.65) return null;
    return entry.fountains;
  } catch {
    return null;
  }
}

/** Save OSM fountains to cache, keyed by location. */
export async function saveCachedFountains(
  lat: number,
  lon: number,
  fountains: Fountain[],
): Promise<void> {
  try {
    const entry: CacheEntry = { lat, lon, savedAt: Date.now(), fountains };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // non-critical — ignore
  }
}

/** Clear the cache (e.g. when user moves far away). */
export async function clearFountainCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
