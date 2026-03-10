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
  is_verified?: boolean | null;
  created_at?: string;
  created_by?: string | null;
  osm_node_id?: number | null;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Creator info attached to a water source response */
export interface CreatedByInfo {
  id: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Shape returned to frontend */
export interface WaterSourceResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  images?: string[];
  imageUrl?: string;
  rating?: number;
  isOperational: boolean;
  useAdminPin: boolean;
  createdBy?: CreatedByInfo;
}

function toResponse(
  row: WaterSourceRow,
  creator?: ProfileRow | null
): WaterSourceResponse {
  const res: WaterSourceResponse = {
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
  if (row.created_by) {
    res.createdBy = {
      id: row.created_by,
      displayName: creator?.display_name ?? undefined,
      avatarUrl: creator?.avatar_url ?? undefined,
    };
  }
  return res;
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

/** Get or create a water source for an OSM node. Any signed-in user can add photos/rate. */
export async function getOrCreateByOsmNodeId(
  osmNodeId: number,
  name: string,
  latitude: number,
  longitude: number
): Promise<WaterSourceResponse | null> {
  if (!supabase) return null;
  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
    .eq("osm_node_id", osmNodeId)
    .maybeSingle();
  if (!selectError && existing) {
    const row = existing as WaterSourceRow;
    let creator: ProfileRow | null = null;
    if (row.created_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", row.created_by)
        .single();
      creator = profile as ProfileRow | null;
    }
    const res = toResponse(row, creator);
    const averages = await getAverageRatings();
    const avg = averages.get(row.id);
    if (avg != null) res.rating = avg;
    return res;
  }
  const { data: inserted, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      name: (name ?? "").trim() || "Water fountain",
      latitude,
      longitude,
      images: [],
      rating: null,
      is_operational: true,
      created_by: null,
      osm_node_id: osmNodeId,
    })
    .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
    .single();
  if (insertError) throw insertError;
  const row = inserted as WaterSourceRow;
  return toResponse(row, null);
}

export async function getWaterSources(): Promise<WaterSourceResponse[]> {
  if (!supabase) return [];
  const [sourcesResult, averages] = await Promise.all([
    supabase
      .from(TABLE)
      .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
      .order("created_at", { ascending: false }),
    getAverageRatings(),
  ]);
  if (sourcesResult.error) return [];
  const rows = (sourcesResult.data ?? []) as WaterSourceRow[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  let profilesMap = new Map<string, ProfileRow>();
  if (creatorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", creatorIds);
    if (!profilesError && profiles) {
      for (const p of profiles as ProfileRow[]) {
        profilesMap.set(p.id, p);
      }
    }
  }
  return rows.map((row) => {
    const creator = row.created_by ? profilesMap.get(row.created_by) : undefined;
    const res = toResponse(row, creator);
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
  newImages: string[],
  userId?: string | null
): Promise<WaterSourceResponse | null> {
  if (!supabase) return null;
  if (userId != null) {
    const ownerId = await getWaterSourceOwnerId(id);
    // Allow if user is the owner, or if there is no owner (legacy location)
    if (ownerId != null && ownerId !== userId) return null;
  }
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
  body: InsertWaterSourceBody,
  createdBy: string | null
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
      created_by: createdBy ?? null,
    })
    .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
    .single();
  if (error) throw error;
  const row = data as WaterSourceRow;
  let creator: ProfileRow | null = null;
  if (row.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", row.created_by)
      .single();
    creator = profile as ProfileRow | null;
  }
  return toResponse(row, creator);
}

/** Returns the created_by user id for the water source, or null. */
export async function getWaterSourceOwnerId(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("created_by")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return (data as { created_by: string | null }).created_by ?? null;
}

export async function deleteWaterSource(
  id: string,
  userId: string
): Promise<boolean> {
  if (!supabase) return false;
  const ownerId = await getWaterSourceOwnerId(id);
  if (ownerId !== userId) return false;
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  return !error;
}

export interface UpdateWaterSourceBody {
  name?: string;
}

export async function updateWaterSource(
  id: string,
  body: UpdateWaterSourceBody,
  userId: string
): Promise<WaterSourceResponse | null> {
  if (!supabase) return null;
  const ownerId = await getWaterSourceOwnerId(id);
  if (ownerId !== userId) return null;
  const updates: { name?: string } = {};
  if (body.name !== undefined) updates.name = (body.name ?? "").trim();
  if (Object.keys(updates).length === 0) {
    const { data } = await supabase
      .from(TABLE)
      .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
      .eq("id", id)
      .single();
    const row = data as WaterSourceRow | null;
    if (!row) return null;
    const { data: profile } = row.created_by
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", row.created_by)
          .single()
      : { data: null };
    return toResponse(row, profile as ProfileRow | null);
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .select("id, name, latitude, longitude, images, rating, is_operational, is_verified, created_by")
    .single();
  if (error) throw error;
  const row = data as WaterSourceRow;
  let creator: ProfileRow | null = null;
  if (row.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", row.created_by)
      .single();
    creator = profile as ProfileRow | null;
  }
  return toResponse(row, creator);
}
