# Deploy Backend to Vercel

Deploy this folder as its own Vercel project so the app can reach the API from any device (no localhost/IP setup).

## 1. Deploy

**Option A – Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com) → Add New → Project.
2. Import your repo and set the **Root Directory** to `Backend` (not the repo root).
3. Leave Build Command and Output Directory as default (Vercel uses `vercel.json`).
4. Add environment variables (see below), then Deploy.

**Option B – Vercel CLI**

```bash
cd Backend
npx vercel
```

Follow the prompts. Set env vars in the dashboard (Project → Settings → Environment Variables) or with `vercel env add`.

## 2. Environment variables

In the Vercel project, add:

| Name                         | Value                                      | Notes                          |
|------------------------------|--------------------------------------------|--------------------------------|
| `SUPABASE_URL`               | `https://your-project.supabase.co`         | From Supabase → Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY`  | your service role key                      | Same place; keep secret        |

No `PORT` or `dotenv` needed; Vercel injects env at runtime.

## 3. Use the deployed URL in the app

After deploy, Vercel gives you a URL like `https://your-project.vercel.app`.

In the **Frontend** `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-project.vercel.app
```

Restart the Expo dev server. The app will use the Vercel backend from simulator and physical devices.

## Local development

Backend still runs locally as before:

```bash
cd Backend
cp .env.example .env   # fill in Supabase keys
npm install
npm run dev
```

Use `EXPO_PUBLIC_API_URL=http://localhost:3000` (or your machine’s IP on a device) when testing against local backend.
