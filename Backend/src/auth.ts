import type { Request } from "express";
import { supabase } from "./supabase";

/**
 * Extract Supabase user id from Authorization: Bearer <access_token>.
 * Returns null if no token, invalid, or Supabase not configured.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}
