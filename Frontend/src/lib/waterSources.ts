import type { Fountain } from "../types/fountain";

const getBaseUrl = () => process.env.EXPO_PUBLIC_API_URL ?? "";

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

const REQUEST_TIMEOUT_MS = 60_000; // 60s for slow networks / cold backend

/** Insert a user-uploaded water source via the backend. Returns the new Fountain or null. */
export async function insertWaterSource(
  input: InsertWaterSourceInput
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) {
    throw new Error(
      "Backend URL not set. Add EXPO_PUBLIC_API_URL to a .env file in the Frontend folder (e.g. http://localhost:3000), then restart the dev server."
    );
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/water-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
