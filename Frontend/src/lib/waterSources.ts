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

/** Insert a user-uploaded water source via the backend. Returns the new Fountain or null. */
export async function insertWaterSource(
  input: InsertWaterSourceInput
): Promise<Fountain | null> {
  const base = getBaseUrl();
  if (!base) return null;
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
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Failed to create water source");
    }
    const data = (await res.json()) as Fountain;
    return data ?? null;
  } catch (e) {
    throw e;
  }
}
