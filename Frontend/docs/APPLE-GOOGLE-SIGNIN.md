# Google Sign-In Setup

The app uses **Supabase Auth** with OAuth for **Google** and **email/password** only. Configure the Google provider in the Supabase Dashboard and add the redirect URL so the app can receive the auth callback.

## 1. Supabase Dashboard – URL configuration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add:
   - `sustainable-island://auth/callback`
   - For Expo Go development you may also need the URL from `makeRedirectUri()` (e.g. `exp://192.168.x.x:8081/--/auth/callback`).

Supabase will only redirect to URLs listed here.

## 2. Enable Google

1. In the Dashboard go to **Authentication** → **Providers** → **Google**.
2. Turn **Enable Google provider** on.
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - **Web application** (for Supabase):
     - **Authorized redirect URIs:** `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
     - You can copy this from the Supabase Google provider page.
   - Create **OAuth 2.0 Client ID** (Web application), copy **Client ID** and **Client secret** into Supabase.

## 3. App config

- **Scheme** is set in `app.json`: `"scheme": "sustainable-island"`.
- The OAuth helper uses `makeRedirectUri({ scheme: "sustainable-island", path: "auth/callback" })` so the redirect URL matches what you added in step 1.

After saving, use **Sign in with Google** or **email/password** on the Sign In / Sign Up screens.
