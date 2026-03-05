# Google Sign-In Setup

The app uses **Supabase Auth** with OAuth for **Google** and **email/password** only. Configure the Google provider in the Supabase Dashboard and add the redirect URL so the app can receive the auth callback.

## 1. Supabase Dashboard – URL configuration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add **all** of these (so both Expo Go and production work):
   - **Expo Go / dev:** `exp://127.0.0.1:8081/--/auth/callback` (simulator)  
     If on a real device, use your machine’s IP, e.g. `exp://192.168.1.5:8081/--/auth/callback` (replace with your IP; the app uses this when you run in Expo Go).
   - **Production / custom scheme:** `sustainable-island://auth/callback`

Supabase will only redirect to URLs listed here. If you see “Safari can’t open the page” or “couldn’t connect to the server”, the redirect URL Supabase is using is probably not in this list—add the exact `exp://...` URL for your setup.

## 2. Enable Google

1. In the Dashboard go to **Authentication** → **Providers** → **Google**.
2. Turn **Enable Google provider** on.
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - **Web application** (for Supabase):
     - **Authorized redirect URIs:** `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
     - You can copy this from the Supabase Google provider page.
   - Create **OAuth 2.0 Client ID** (Web application), copy **Client ID** and **Client secret** into Supabase.

## 3. App config

- **Scheme** is set in `app.json`: `"scheme": "sustainable-island"` (for production builds).
- The OAuth helper uses `makeRedirectUri({ path: "auth/callback" })` so in **Expo Go** you get an `exp://...` URL and in production you can use `sustainable-island://auth/callback`. Add the URL that matches how you run the app to Supabase (step 1).

After saving, use **Sign in with Google** or **email/password** on the Sign In / Sign Up screens.
