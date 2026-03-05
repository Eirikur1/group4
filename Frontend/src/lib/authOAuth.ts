import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

/** Call once at app init (e.g. in App.tsx). Required for web OAuth redirect. */
export function maybeCompleteAuthSession() {
  WebBrowser.maybeCompleteAuthSession();
}

/** Supabase returns tokens in the URL hash; parse them into a params object. */
function getParamsFromRedirectUrl(url: string): Record<string, string> {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1).split("#")[0] : "";
  const combined = fragment ? fragment : query;
  const params: Record<string, string> = {};
  combined.split("&").forEach((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) return;
    try {
      const key = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, " "));
      const value = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
      if (key) params[key] = value;
    } catch {
      // skip malformed pair
    }
  });
  return params;
}

/**
 * Create a Supabase session from the OAuth redirect URL (hash or query with access_token, refresh_token).
 */
export async function createSessionFromUrl(url: string): Promise<void> {
  const params = getParamsFromRedirectUrl(url);
  const errorCode = params.error_description ?? params.error;
  if (errorCode) throw new Error(errorCode);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token ?? "";
  if (!access_token) return;
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
}

/**
 * Sign in with Google via Supabase OAuth.
 * Opens the provider in a browser; on success, redirects back to the app and sets the session.
 */
export async function signInWithOAuthProvider(): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  // Use Expo's default redirect so it works in Expo Go (exp://...).
  // Add this exact URL to Supabase → Auth → URL Configuration → Redirect URLs.
  const redirectTo = makeRedirectUri({
    path: "auth/callback",
    preferLocalhost: false,
  });
  if (__DEV__) {
    console.log("[Auth] Redirect URL for Supabase:", redirectTo);
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success" && result.url) {
    await createSessionFromUrl(result.url);
  } else if (result.type === "cancel") {
    // User closed the browser; no session.
    return;
  } else {
    throw new Error("Sign-in was not completed.");
  }
}
