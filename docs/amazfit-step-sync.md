# Amazfit Active 2 step sync

This app can receive daily step counts through a secure Vercel endpoint. The watch does not post to the app directly; use Zepp as the source and bridge the day's steps from Apple Health, Google Fit, Health Connect, Shortcuts, Tasker, or another automation.

## Endpoint

```text
POST /api/steps
Authorization: Bearer <STEPS_SYNC_TOKEN>
Content-Type: application/json

{
  "date": "2026-07-16",
  "steps": 12345
}
```

The endpoint upserts `workouts.steps` for `VITE_PERSONAL_USER_ID` and the provided `workout_date`. It creates the day row if needed.

## Required Vercel environment variables

Add these in Vercel before deploying:

```text
VITE_SUPABASE_URL
VITE_PERSONAL_USER_ID
SUPABASE_SERVICE_ROLE_KEY
STEPS_SYNC_TOKEN
STEPS_SYNC_ALLOWED_ORIGIN=https://fitness.yashvipulkumarshah.com
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must be a server-only secret. Never expose it in browser code.
- `STEPS_SYNC_TOKEN` should be a long random secret used by your phone automation.
- Keep `VITE_SUPABASE_ANON_KEY` for the existing frontend app.

## iPhone / Apple Health path

1. Connect Amazfit Active 2 to the Zepp app.
2. In Zepp, enable Apple Health sync for steps.
3. Create an iOS Shortcut automation that runs near the end of the day.
4. Shortcut actions:
   - Find Health Samples: Steps, today, sum.
   - Text or Dictionary body: `{ "date": "YYYY-MM-DD", "steps": <sum> }`.
   - Get Contents of URL: `https://fitness.yashvipulkumarshah.com/api/steps`, method POST, JSON body, header `Authorization: Bearer <STEPS_SYNC_TOKEN>`.

## Android path

1. Connect Amazfit Active 2 to Zepp.
2. Enable Zepp sync to Google Fit / Health Connect if available on your phone.
3. Use Tasker, Automate, or a small Android bridge to read today's steps and POST the same JSON payload to `/api/steps`.

## Quick local test shape

```bash
curl -X POST https://fitness.yashvipulkumarshah.com/api/steps \
  -H 'Authorization: Bearer <STEPS_SYNC_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-07-16","steps":12345}'
```

Expected response:

```json
{ "ok": true, "date": "2026-07-16", "steps": 12345 }
```
