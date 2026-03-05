import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabase: SupabaseClient | null =
  url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;

const TABLE = "water_sources";

export interface WaterSourceRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images: string[] | null;
  rating: number | null;
  is_operational: boolean;
  created_at?: string;
}

/** Shape returned to frontend (Fountain with useAdminPin: false) */
export interface WaterSourceResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images?: string[];
  imageUrl?: string;
  rating?: number;
  isOperational: boolean;
  useAdminPin: false;
}

function toResponse(row: WaterSourceRow): WaterSourceResponse {
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

/** Fetch average rating per water_source_id from ratings table (empty if table missing). */
async function getAverageRatings(): Promise<Map<string, number>> {
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("ratings")
    .select("water_source_id, rating");
  if (error) return new Map(); // e.g. ratings table not yet created
  const byId = new Map<string, number[]>();
  for (const row of (data ?? []) as { water_source_id: string; rating: number }[]) {
    const id = row.water_source_id;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(row.rating);
  }
  const result = new Map<string, number>();
  byId.forEach((ratings, id) => {
    const sum = ratings.reduce((a, r) => a + r, 0);
    result.set(id, Math.round((sum / ratings.length) * 10) / 10);
  });
  return result;
}

export async function getWaterSources(): Promise<WaterSourceResponse[]> {
  if (!supabase) return [];
  const [sourcesResult, averages] = await Promise.all([
    supabase
      .from(TABLE)
      .select("id, name, latitude, longitude, images, rating, is_operational")
      .order("created_at", { ascending: false }),
    getAverageRatings(),
  ]);
  if (sourcesResult.error) return [];
  const rows = (sourcesResult.data ?? []) as WaterSourceRow[];
  return rows.map((row) => {
    const res = toResponse(row);
    const avg = averages.get(row.id);
    if (avg != null) res.rating = avg;
    return res;
  });
}

export interface InsertWaterSourceBody {
  name: string;
  latitude: number;
  longitude: number;
  images: string[];
  rating?: number | null;
}

export async function addImagesToWaterSource(
  id: string,
  newImages: string[]
): Promise<WaterSourceResponse | null> {
  if (!supabase) return null;
  const { data: existing } = await supabase
    .from(TABLE)
    .select("images")
    .eq("id", id)
    .single();
  const existingImages: string[] = (existing as { images: string[] | null } | null)?.images ?? [];
  const updatedImages = [...existingImages, ...newImages];
  const { data, error } = await supabase
    .from(TABLE)
    .update({ images: updatedImages })
    .eq("id", id)
    .select("id, name, latitude, longitude, images, rating, is_operational")
    .single();
  if (error) throw error;
  return data ? toResponse(data as WaterSourceRow) : null;
}

export async function insertWaterSource(
  body: InsertWaterSourceBody
): Promise<WaterSourceResponse | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: (body.name ?? "").trim(),
      latitude: body.latitude,
      longitude: body.longitude,
      images: body.images ?? [],
      rating: body.rating ?? null,
      is_operational: true,
    })
    .select("id, name, latitude, longitude, images, rating, is_operational")
    .single();
  if (error) throw error;
  return data ? toResponse(data as WaterSourceRow) : null;
}
