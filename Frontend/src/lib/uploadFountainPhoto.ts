import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

const BUCKET = "fountain-photos";

/**
 * Upload a single image from a local URI (e.g. from expo-image-picker) to
 * Supabase Storage and return the public URL.
 *
 * Uses expo-image-manipulator to convert to JPEG (handles HEIC from iPhone),
 * then reads via expo-file-system as base64 to avoid the Expo Go bug where
 * fetch(localUri).blob() always returns an empty blob.
 */
export async function uploadFountainPhoto(localUri: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file in the Frontend folder, then restart the dev server (expo start)."
    );
  }

  // Convert to JPEG — handles HEIC/HEIF and normalises other formats.
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Read file as base64 — reliable in Expo Go where fetch().blob() returns empty.
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode base64 to raw bytes for Supabase upload.
  const binaryString = atob(base64);
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
 */
export async function uploadFountainPhotos(localUris: string[]): Promise<string[]> {
  const urls = await Promise.all(localUris.map((uri) => uploadFountainPhoto(uri)));
  return urls;
}
