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

export async function getWaterSources(): Promise<WaterSourceResponse[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, latitude, longitude, images, rating, is_operational")
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = (data ?? []) as WaterSourceRow[];
  return rows.map(toResponse);
}

export interface InsertWaterSourceBody {
  name: string;
  latitude: number;
  longitude: number;
  images: string[];
  rating?: number | null;
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
