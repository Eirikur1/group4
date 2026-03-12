import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

const BUCKET = "fountain-photos";

/**
 * Comment comment
 * Upload a single image from a local URI (e.g. from expo-image-picker) to
 * Supabase Storage and return the public URL.
 *
 * Converts to JPEG with base64:true so we get raw bytes without needing
 * expo-file-system, avoiding the Expo Go bug where fetch().blob() returns empty.
 */
export async function uploadFountainPhoto(localUri: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file in the Frontend folder, then restart the dev server (expo start)."
    );
  }

  // Downscale + convert to JPEG and get base64 in one step — handles HEIC, PNG, etc.
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [
      {
        resize: {
          width: 1200,
        },
      },
    ],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  const base64Data = result.base64;
  if (!base64Data) {
    throw new Error("Failed to encode image as base64.");
  }

  // Decode base64 to raw bytes for Supabase upload.
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

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
 *
 * Uses small-batch parallelism (up to 3 at a time) so uploading several photos
 * feels much faster, while still avoiding too many large base64 buffers in
 * memory on low-end devices.
 */
export async function uploadFountainPhotos(localUris: string[]): Promise<string[]> {
  if (localUris.length === 0) return [];

  const urls: string[] = new Array(localUris.length);
  const concurrency = Math.min(3, localUris.length);
  let nextIndex = 0;

  async function worker() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = nextIndex;
      if (current >= localUris.length) break;
      nextIndex += 1;
      urls[current] = await uploadFountainPhoto(localUris[current]);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return urls;
}
