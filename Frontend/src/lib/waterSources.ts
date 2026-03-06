import type { Fountain } from "../types/fountain";

const getBaseUrl = () => process.env.EXPO_PUBLIC_API_URL ?? "";

function authHeaders(accessToken: string | undefined): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

/** Fetch all user-uploaded water sources from the backend. Returns Fountain[] with useAdminPin: false (use PinIcon). */
export async function fetchUserWaterSources(): Promise<Fountain[]> {
  const base = getBaseUrl();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/water-sources`);
    if (!res.ok) return [];
    const data = (await res.json()) as Fountain[];
    return Array.isArray(data) ? data : [];
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

/** Append new image URLs to an existing user-uploaded water source. Creator only; pass accessToken. */
export async function addPhotosToWaterSource(
  id: string,
  images: string[],
  accessToken: string | undefined
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
      throw new Error((err as { error?: string }).error ?? "Failed to update images");
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
