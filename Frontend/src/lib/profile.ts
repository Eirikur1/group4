import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const BUCKET = "avatars";

/** Fetch the current user's profile. Returns null if not signed in or no row. */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return {
    id: (data as { id: string }).id,
    displayName: (data as { display_name: string | null }).display_name,
    avatarUrl: (data as { avatar_url: string | null }).avatar_url,
  };
}

/** Upload avatar image and set profiles.avatar_url. Path: {userId}/avatar.jpg */
export async function uploadAvatar(
  userId: string,
  localUri: string
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  const base64Data = result.base64;
  if (!base64Data) throw new Error("Failed to encode image.");
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    if (
      uploadError.message?.toLowerCase().includes("bucket") &&
      uploadError.message?.toLowerCase().includes("not found")
    ) {
      throw new Error(
        `Storage bucket "${BUCKET}" not found. Create it in Supabase Dashboard → Storage.`
      );
    }
    throw uploadError;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (updateError) throw updateError;
  return publicUrl;
}
