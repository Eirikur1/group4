# Supabase migrations

Run the migrations in your Supabase project so the app can store ratings, creator info, and profiles.

**Option A – Supabase Dashboard**  
1. Open your project → SQL Editor.  
2. Run the contents of `migrations/001_ratings.sql`, then `migrations/002_created_by_profiles.sql`.

**Option B – Supabase CLI**  
From the repo root: `supabase db push` (or your usual migration command).

If `002_created_by_profiles.sql` fails on the `storage.buckets` insert (some projects restrict this), create the **avatars** bucket manually: Storage → New bucket → name **avatars**, set Public ON, then run the rest of the migration (or re-run after creating the bucket).

After the migrations, the app will:
- Let signed-in users rate water sources (1–5 stars) from the fountain detail screen.
- Store one rating per user per fountain (new rating overwrites the previous).
- Show the average of all users’ ratings and use it in the water sources list.
- Record who created each water source and show “Added by” with optional profile picture.
- Let users set a profile picture (stored in the **avatars** bucket and `profiles.avatar_url`).
- Let creators edit or delete their own locations.
