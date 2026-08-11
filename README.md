# Fitness Everything

A mobile-first personal fitness tracker built with React, Supabase, and Vercel.

## Features

- Synced workout data across devices
- Custom workout type tracking
- Dynamic Push, Pull, and Legs suggestions based on your strongest recent matching exercise set
- Cardio day tracking
- Daily gym/no-gym status
- Daily steps
- Calendar view for workout and rest days
- Exercises with weighted sets, bodyweight rep sets, or time-only sets
- Previous bests for the same exercise
- PR flags when you beat a previous weighted, rep, or time mark
- Daily body weight in kg
- 30/60/90 day weight trend chart
- Current week and month workout day counts

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project.

3. Link this repo to that Supabase project:

```bash
npm run db:login
npm run db:link
```

4. Apply database migrations:

```bash
npm run db:push
```

This applies the files in `supabase/migrations` to your Supabase database. You do not need to copy/paste SQL into the Supabase dashboard.

5. Copy `.env.example` to `.env.local` and fill in your Supabase values:

```bash
cp .env.example .env.local
```

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_PERSONAL_USER_ID=00000000-0000-4000-8000-000000000000
```

`VITE_PERSONAL_USER_ID` can be any UUID. Keep the same value across local development and Vercel so all devices read and write the same personal data.

6. Start the app:

```bash
npm run dev
```

## Deploy To Vercel

1. Push this repo to GitHub.
2. Import the GitHub repo in Vercel.
3. Add these Vercel environment variables:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PERSONAL_USER_ID
```

4. Deploy.

Vercel should auto-detect Vite. The build command is `npm run build`, and the output directory is `dist`.

Database migrations are separate from the Vercel frontend deploy. When the schema changes, run:

```bash
npm run db:push
```

Then deploy the app.


## LLM Fitness Context API

The app exposes a public read-only Vercel API route for sending recent gym, food, weight, and steps data to an LLM without manually downloading JSON:

```bash
curl "https://your-app.vercel.app/api/fitness-context?days=90"
```

The response includes a compact JSON context with:

- period metadata and units
- summary totals for workouts, steps, weight change, and calories
- day-level workouts, exercise sets, food entries, calories, steps, and weight

The route defaults to the last 90 days and accepts `days=1..180`. It is intentionally public, so anyone with the URL can read the returned fitness context. In Vercel, add:

```bash
SUPABASE_SERVICE_ROLE_KEY # preferred server-only key; falls back to VITE_SUPABASE_ANON_KEY if omitted
```

Then give the API URL to an LLM/tool that supports HTTP requests.

## Data Storage

Workout and body data are stored in Supabase Postgres tables under your `VITE_PERSONAL_USER_ID`.

This no-login setup is convenient for a private personal app, but it is not strong access control. Anyone with your deployed app URL can use the public browser key and write to the same tables. Add Supabase Auth before sharing the app publicly.
