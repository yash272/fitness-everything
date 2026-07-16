/* global process */
import { createClient } from "@supabase/supabase-js";
import { buildWorkoutInsert, buildWorkoutUpdate, normalizeAllowedOrigin, parseStepRequest, resolveCorsOrigin } from "../src/stepsSync.js";

function setCors(req, res) {
  const allowedOrigin = normalizeAllowedOrigin(process.env.STEPS_SYNC_ALLOWED_ORIGIN || process.env.VERCEL_PROJECT_PRODUCTION_URL || "*");
  const origin = resolveCorsOrigin(req.headers?.origin, allowedOrigin);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = parseStepRequest(req, { syncToken: process.env.STEPS_SYNC_TOKEN });
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.message });
  }

  try {
    const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const userId = requireEnv("VITE_PERSONAL_USER_ID");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const updatePayload = buildWorkoutUpdate({ steps: parsed.steps });
    const { data: updatedRows, error: updateError } = await supabase
      .from("workouts")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("workout_date", parsed.date)
      .select("workout_date,steps");

    if (updateError) throw updateError;

    let savedRow = updatedRows?.[0];
    if (!savedRow) {
      const insertPayload = buildWorkoutInsert({ date: parsed.date, steps: parsed.steps, userId });
      const { data: insertedRow, error: insertError } = await supabase
        .from("workouts")
        .insert(insertPayload)
        .select("workout_date,steps")
        .single();

      if (insertError) throw insertError;
      savedRow = insertedRow;
    }

    return res.status(200).json({ ok: true, date: savedRow.workout_date, steps: savedRow.steps });
  } catch (error) {
    console.error("Step sync failed", error);
    return res.status(500).json({ error: "Step sync failed" });
  }
}
