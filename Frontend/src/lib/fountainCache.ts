import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Fountain } from "../types/fountain";
import type { MapBounds } from "./waterSources";

const STORAGE_KEY = "fountain_cache_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredPayload = {
  fountains: Fountain[];
  bounds: MapBounds | null;
  timestamp: number;
};

export async function loadCachedFountains(): Promise<{
  fountains: Fountain[];
  bounds: MapBounds | null;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed || !Array.isArray(parsed.fountains)) return null;
    if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
      // Stale cache – clear it so we don't grow storage forever
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      fountains: parsed.fountains,
      bounds: parsed.bounds ?? null,
    };
  } catch {
    // Corrupt or unavailable storage – ignore and fall back to network
    return null;
  }
}

export async function saveCachedFountains(
  fountains: Fountain[],
  bounds: MapBounds | null,
): Promise<void> {
  try {
    const payload: StoredPayload = {
      fountains,
      bounds,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort cache – ignore failures
  }
}

