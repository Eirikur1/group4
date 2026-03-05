#!/usr/bin/env node
/**
 * Print the OAuth redirect URLs to add in Supabase → Auth → URL Configuration → Redirect URLs.
 * Run from Frontend folder: npm run auth:redirect
 *
 * The exact URL when using Expo Go on a device depends on your machine's IP and is logged
 * in the Metro terminal when you tap "Sign in with Google" in the app.
 */
console.log(`
Add these to Supabase → Authentication → URL Configuration → Redirect URLs:

  • exp://127.0.0.1:8081/--/auth/callback   (iOS Simulator)
  • sustainable-island://auth/callback       (production / custom scheme)

On a real device with Expo Go, the URL is exp://YOUR_IP:8081/--/auth/callback.
To see the exact URL: run the app (npm start), tap "Sign in with Google", then check
the Metro terminal for: [Auth] Redirect URL for Supabase: ...
`);
