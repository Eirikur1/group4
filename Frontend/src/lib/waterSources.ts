import type { Fountain } from "../types/fountain";
import { supabase } from "./supabase";

const getBaseUrl = () => process.env.EXPO_PUBLIC_API_URL ?? "";

function authHeaders(accessToken: string | undefined): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

// ---------------------------------------------------------------------------
// Bounds-based fetch — replaces the old "fetch all" approach
// ---------------------------------------------------------------------------

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const MARKER_LIMIT = 300;

type SupabaseRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images: string[] | null;
  rating: number | null;
  is_operational: boolean;
  is_verified: boolean | null;
  created_by: string | null;
};

function rowToFountain(row: SupabaseRow): Fountain {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    images: row.images ?? undefined,
    imageUrl: row.images?.[0],
    rating: row.rating ?? undefined,
    isOperational: row.is_operational ?? true,
    useAdminPin: row.is_verified ?? false,
    createdBy: row.created_by ? { id: row.created_by } : undefined,
  };
}

/**
 * Fetch water sources inside the visible map bounds (LIMIT 300).
 *
 * Uses Supabase range filters:
 *   latitude BETWEEN south AND north
 *   longitude BETWEEN west AND east
 */
export async function fetchFountainsInBounds(
  bounds: MapBounds,
): Promise<Fountain[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("water_sources")
      .select(
        "id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by",
      )
      .gte("latitude", bounds.south)
      .lte("latitude", bounds.north)
      .gte("longitude", bounds.west)
      .lte("longitude", bounds.east)
      .limit(MARKER_LIMIT);
    if (error || !data) return [];
    return (data as SupabaseRow[]).map(rowToFountain);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// In-memory bounds cache — skip re-fetch if the view barely moved
// ---------------------------------------------------------------------------

let cachedBounds: MapBounds | null = null;
let cachedFountains: Fountain[] = [];

function boundsContain(outer: MapBounds, inner: MapBounds): boolean {
  return (
    inner.south >= outer.south &&
    inner.north <= outer.north &&
    inner.west >= outer.west &&
    inner.east <= outer.east
  );
}

function expandBounds(b: MapBounds, factor = 0.3): MapBounds {
  const latPad = (b.north - b.south) * factor;
  const lonPad = (b.east - b.west) * factor;
  return {
    north: b.north + latPad,
    south: b.south - latPad,
    east: b.east + lonPad,
    west: b.west - lonPad,
  };
}

/**
 * Fetch with caching. When we actually query, we fetch an expanded area so
 * small pans reuse the cache without hitting Supabase.
 */
export async function fetchFountainsInBoundsCached(
  bounds: MapBounds,
): Promise<Fountain[]> {
  if (cachedBounds && boundsContain(cachedBounds, bounds)) {
    return cachedFountains;
  }
  const expanded = expandBounds(bounds);
  const results = await fetchFountainsInBounds(expanded);
  cachedBounds = expanded;
  cachedFountains = results;
  return results;
}

export function invalidateFountainCache(): void {
  cachedBounds = null;
  cachedFountains = [];
}

// ---------------------------------------------------------------------------
// Legacy helpers (still used for initial load / bottom-sheet list)
// ---------------------------------------------------------------------------

export async function fetchVerifiedFountains(): Promise<Fountain[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("water_sources")
      .select(
        "id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by",
      )
      .eq("is_verified", true)
      .limit(MARKER_LIMIT);
    if (error || !data) return [];
    return (data as SupabaseRow[]).map(rowToFountain);
  } catch {
    return [];
  }
}

export async function fetchUserWaterSources(): Promise<Fountain[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("water_sources")
      .select(
        "id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by",
      )
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(MARKER_LIMIT);
    if (error || !data) return [];
    return (data as SupabaseRow[]).map(rowToFountain);
  } catch {
    return [];
  }
}

export interface InsertWaterSourceInput {
  name: string;
  latitude: number;
  longitude: number;
  images: string[];
  rating?: number | null;
}

export interface UpdateWaterSourceInput {
  name?: string;
}

const REQUEST_TIMEOUT_MS = 60_000; // 60s for slow networks / cold backend

/** Insert a user-uploaded water source via the backend. Requires accessToken (sign in). Returns the new Fountain or null. */
export async function insertWaterSource(
  input: InsertWaterSourceInput,
  accessToken: string | undefined,
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) {
    throw new Error(
      "Backend URL not set. Add EXPO_PUBLIC_API_URL to a .env file in the Frontend folder (e.g. http://localhost:3000), then restart the dev server.",
    );
  }
  if (!accessToken) {
    throw new Error("Sign in to add a location.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources`, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        images: input.images,
        rating: input.rating ?? null,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Failed to create water source",
      );
    }
    const data = (await res.json()) as Fountain;
    return data ?? null;
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(
          e.message,
        ) ||
          isAbort));
    if (isNetwork || isAbort) {
      const hint =
        base.includes("localhost") || base.includes("127.0.0.1")
          ? " On a physical device, set EXPO_PUBLIC_API_URL in Frontend/.env to your computer's IP (e.g. http://192.168.1.x:3000) and ensure the backend is running."
          : " Check that the backend is running and reachable.";
      throw new Error(`Network request timed out.${hint}`);
    }
    throw e;
  }
}

/**
 * Get or create a backend water source for an OSM node so users can add photos and rate.
 * Returns the Fountain-shaped row (id is string uuid). Requires sign-in.
 */
export async function getOrCreateWaterSourceForOsm(
  osmNodeId: number,
  name: string,
  latitude: number,
  longitude: number,
  accessToken: string | undefined,
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) throw new Error("Backend URL not set.");
  if (!accessToken)
    throw new Error("Sign in to add photos or rate this location.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources/by-osm`, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        osm_node_id: osmNodeId,
        name: name.trim() || "Water fountain",
        latitude,
        longitude,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Failed to load location",
      );
    }
    const data = (await res.json()) as Fountain;
    return data ?? null;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Append new image URLs to an existing water source. Passes auth token to backend which handles merging. */
export async function addPhotosToWaterSource(
  id: string,
  images: string[],
  accessToken: string | undefined,
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) throw new Error("Backend URL not set.");
  if (!accessToken) throw new Error("Sign in to add photos.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources/${id}/images`, {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ images }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Failed to update images",
      );
    }
    return (await res.json()) as Fountain;
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(
          e.message,
        ) ||
          isAbort));
    if (isNetwork || isAbort) {
      const hint =
        base.includes("localhost") || base.includes("127.0.0.1")
          ? " On a physical device, set EXPO_PUBLIC_API_URL in Frontend/.env to your computer's IP (e.g. http://192.168.1.x:3000) and ensure the backend is running."
          : " Check that the backend is running and reachable.";
      throw new Error(`Network request timed out.${hint}`);
    }
    throw e;
  }
}

/** Update a water source (name). Creator only; pass accessToken. */
export async function updateWaterSource(
  id: string,
  input: UpdateWaterSourceInput,
  accessToken: string | undefined,
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) throw new Error("Backend URL not set.");
  if (!accessToken) throw new Error("Sign in to edit a location.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources/${id}`, {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Failed to update location",
      );
    }
    return (await res.json()) as Fountain;
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(
          e.message,
        ) ||
          isAbort));
    if (isNetwork || isAbort) {
      const hint =
        base.includes("localhost") || base.includes("127.0.0.1")
          ? " On a physical device, set EXPO_PUBLIC_API_URL in Frontend/.env to your computer's IP (e.g. http://192.168.1.x:3000) and ensure the backend is running."
          : " Check that the backend is running and reachable.";
      throw new Error(`Network request timed out.${hint}`);
    }
    throw e;
  }
}

/** Delete a water source. Creator only; pass accessToken. */
export async function deleteWaterSource(
  id: string,
  accessToken: string | undefined,
): Promise<void> {
  const base = getBaseUrl();
  if (!base) throw new Error("Backend URL not set.");
  if (!accessToken) throw new Error("Sign in to delete a location.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources/${id}`, {
      method: "DELETE",
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ?? "Failed to delete location",
      );
    }
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(
          e.message,
        ) ||
          isAbort));
    if (isNetwork || isAbort) {
      const hint =
        base.includes("localhost") || base.includes("127.0.0.1")
          ? " On a physical device, set EXPO_PUBLIC_API_URL in Frontend/.env to your computer's IP (e.g. http://192.168.1.x:3000) and ensure the backend is running."
          : " Check that the backend is running and reachable.";
      throw new Error(`Network request timed out.${hint}`);
    }
    throw e;
  }
}
