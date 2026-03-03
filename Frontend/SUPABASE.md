# Supabase in this project

## Architecture

- **Backend** (`Backend/`): Holds the **Supabase service_role key** and talks to the **database** (`water_sources` table). The app never touches the DB directly for water sources.
- **Frontend**: Calls the backend at `EXPO_PUBLIC_API_URL` for **GET/POST /api/water-sources**. Photo uploads still go **directly to Supabase Storage** from the app (anon key, public bucket).

## When to use Supabase vs the water-fountains API

- **OSM / Overpass API**: Global, read-only POI data; shown with the blue AdminPin.
- **Supabase (via backend)**: User-uploaded water sources (table `water_sources`).
- **Supabase (from app)**: Photo uploads to the `fountain-photos` bucket only.

## Setup

1. **Create a Supabase project** at [app.supabase.com](https://app.supabase.com) (or [database.new](https://database.new)).

2. **Enable Auth (for login):**
   - In the Dashboard go to **Authentication** → **Providers**.
   - Enable **Email** (and optionally turn off "Confirm email" if you don’t want verification emails).
   - Use **Project Settings** → **API** and copy the **Project URL** and the **anon public** key (the one labeled "anon" / "public"; it’s a long JWT starting with `eyJ...`).

3. **Copy env file and add your keys:**
   ```bash
   cp .env.example .env
   ```
   In `.env`, set:
   - `EXPO_PUBLIC_SUPABASE_URL` – from Project Settings → API → Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` – from Project Settings → API → anon public key

3. **Use the client** in your app:
   ```ts
   import { supabase } from "./src/lib/supabase";
   ```

## What you can use it for

| Feature | Use case |
|--------|----------|
| **Database (PostgreSQL)** | Replace `mockFountains` with a `water_sources` (or `fountains`) table. Store name, lat/lng, description, rating, is_free, category, opening_hours, etc. Load fountains with `supabase.from("water_sources").select("*")` and use in the map and lists. |
| **Auth** | Wire SignIn/SignUp to `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`. Require sign-in to submit from “Add a new water source”. |
| **Storage** | In Add Water Source, upload photos with `supabase.storage.from("fountain-photos").upload()`, then save the public URL on the new row so FountainDetail can show real images. |
| **Realtime** | Subscribe to `water_sources` changes so when someone adds a fountain, the map updates without refresh: `supabase.channel("fountains").on("postgres_changes", { ... }).subscribe()`. |
| **Row Level Security (RLS)** | Allow public read on fountains, allow insert/update only for authenticated users (or only the creator). |

## Example: fetch fountains from Supabase

```ts
const { data: fountains, error } = await supabase
  .from("water_sources")
  .select("*")
  .order("created_at", { ascending: false });
```

## Example: add a new water source (with auth)

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return; // or redirect to SignIn

await supabase.from("water_sources").insert({
  name: "...",
  latitude: 57.1,
  longitude: 10.3,
  user_id: user.id,
  // ...
});
```

## Example: upload a photo (Storage)

```ts
const { data } = await supabase.storage
  .from("fountain-photos")
  .upload(`${userId}/${fileName}`, fileBlob, { contentType: "image/jpeg" });
const publicUrl = supabase.storage.from("fountain-photos").getPublicUrl(data.path).data.publicUrl;
```

Create the bucket in Supabase Dashboard → Storage and (optionally) enable public read for that bucket.

## Table: `water_sources` (user-uploaded locations)

Run this in Supabase **SQL Editor** to create the table and allow inserts/reads:

```sql
create table if not exists water_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  images text[] default '{}',
  rating smallint,
  is_operational boolean default true,
  created_at timestamptz default now()
);

alter table water_sources enable row level security;

-- Allow anyone to read
create policy "Allow public read"
  on water_sources for select
  using (true);

-- Allow anyone to insert (for app uploads without auth)
create policy "Allow public insert"
  on water_sources for insert
  with check (true);
```

Then user-uploaded pins will show on the map and in the list using the water-droplet pin icon.
