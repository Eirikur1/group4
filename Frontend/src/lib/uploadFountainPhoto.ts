import { supabase } from "./supabase";

const BUCKET = "fountain-photos";

/**
 * Upload a single image from a local URI (e.g. from expo-image-picker) to
 * Supabase Storage and return the public URL.
 *
 * Create the bucket "fountain-photos" in Supabase Dashboard → Storage
 * and enable public read if you want images to be viewable without auth.
 */
export async function uploadFountainPhoto(localUri: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file in the Frontend folder, then restart the dev server (expo start)."
    );
  }
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error(`Failed to read image: ${response.status}`);
  }
  const blob = await response.blob();
  const ext = localUri.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false });

  if (error) {
    if (error.message?.toLowerCase().includes("bucket") && error.message?.toLowerCase().includes("not found")) {
      throw new Error(
        `Storage bucket "${BUCKET}" not found. Create it in Supabase: Dashboard → Storage → New bucket → name "${BUCKET}". Optionally enable "Public bucket" for read access.`
      );
    }
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

/**
 * Upload multiple images and return their public URLs in order.
 */
export async function uploadFountainPhotos(localUris: string[]): Promise<string[]> {
  const urls = await Promise.all(localUris.map((uri) => uploadFountainPhoto(uri)));
  return urls;
}
