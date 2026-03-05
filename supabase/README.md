# Supabase migrations

Run the ratings migration in your Supabase project so the app can store and average ratings.

**Option A – Supabase Dashboard**  
1. Open your project → SQL Editor.  
2. Paste and run the contents of `migrations/001_ratings.sql`.

**Option B – Supabase CLI**  
From the repo root: `supabase db push` (or your usual migration command).

After the migration, the app will:
- Let signed-in users rate water sources (1–5 stars) from the fountain detail screen.
- Store one rating per user per fountain (new rating overwrites the previous).
- Show the average of all users’ ratings and use it in the water sources list.
