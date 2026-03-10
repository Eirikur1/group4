import type { Fountain } from "../types/fountain";
import { supabase } from "./supabase";

const getBaseUrl = () => process.env.EXPO_PUBLIC_API_URL ?? "";

function authHeaders(accessToken: string | undefined): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

/**
 * Fetch verified (blue-pin) fountains directly from Supabase.
 * These are seeded from OSM and stored with is_verified = true.
 */
export async function fetchVerifiedFountains(): Promise<Fountain[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("water_sources")
      .select("id, name, latitude, longitude, images, rating, is_operational")
      .eq("is_verified", true);
    if (error || !data) return [];
    return (data as Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      images: string[] | null;
      rating: number | null;
      is_operational: boolean;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      images: row.images ?? undefined,
      imageUrl: row.images?.[0],
      rating: row.rating ?? undefined,
      isOperational: row.is_operational ?? true,
      useAdminPin: true,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch user-uploaded (orange-pin) fountains directly from Supabase.
 * Filters to is_verified = false so there is zero overlap with fetchVerifiedFountains.
 */
export async function fetchUserWaterSources(): Promise<Fountain[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("water_sources")
      .select("id, name, latitude, longitude, images, rating, is_operational, created_by")
      .eq("is_verified", false)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      images: string[] | null;
      rating: number | null;
      is_operational: boolean;
      created_by: string | null;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      images: row.images ?? undefined,
      imageUrl: row.images?.[0],
      rating: row.rating ?? undefined,
      isOperational: row.is_operational ?? true,
      useAdminPin: false,
      createdBy: row.created_by ? { id: row.created_by } : undefined,
    }));
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
  accessToken: string | undefined
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) {
    throw new Error(
      "Backend URL not set. Add EXPO_PUBLIC_API_URL to a .env file in the Frontend folder (e.g. http://localhost:3000), then restart the dev server."
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
      throw new Error((err as { error?: string }).error ?? "Failed to create water source");
    }
    const data = (await res.json()) as Fountain;
    return data ?? null;
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(e.message) || isAbort));
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
  accessToken: string | undefined
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) throw new Error("Backend URL not set.");
  if (!accessToken) throw new Error("Sign in to add photos or rate this location.");
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
      throw new Error((err as { error?: string }).error ?? "Failed to load location");
    }
    const data = (await res.json()) as Fountain;
    return data ?? null;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Save a complete image list to a water source (single UPDATE, no extra SELECT).
 * Pass the full final array — caller is responsible for merging old + new images.
 * Requires the "Allow update own or public" RLS policy on water_sources.
 */
export async function addPhotosToWaterSource(
  id: string,
  allImages: string[],
  _accessToken: string | undefined
): Promise<Fountain | null> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("water_sources")
    .update({ images: allImages })
    .eq("id", id)
    .select("id, name, latitude, longitude, images, rating, is_operational, is_verified")
    .single();

  if (error) throw new Error(error.message || "Failed to update photos.");

  const row = data as {
    id: string; name: string; latitude: number; longitude: number;
    images: string[] | null; rating: number | null; is_operational: boolean; is_verified: boolean | null;
  };
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
  };
}

/** Update a water source (name). Creator only; pass accessToken. */
export async function updateWaterSource(
  id: string,
  input: UpdateWaterSourceInput,
  accessToken: string | undefined
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
      throw new Error((err as { error?: string }).error ?? "Failed to update location");
    }
    return (await res.json()) as Fountain;
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(e.message) || isAbort));
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
  accessToken: string | undefined
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
      throw new Error((err as { error?: string }).error ?? "Failed to delete location");
    }
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error &&
        (/network request timed out|timeout|failed to fetch|network error/i.test(e.message) || isAbort));
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
