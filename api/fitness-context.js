import { createClient } from "@supabase/supabase-js";
import { fetchFitnessContext, normalizeDaysParam } from "./fitnessContext.js";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload, null, 2));
}

export default async function handler(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const userId = process.env.FITNESS_USER_ID || process.env.VITE_PERSONAL_USER_ID;

  if (!supabaseUrl || !supabaseKey || !userId) {
    sendJson(response, 500, { error: "Missing Supabase API configuration" });
    return;
  }

  try {
    const url = new URL(request.url, "https://fitness.local");
    const days = normalizeDaysParam(url.searchParams.get("days"));
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const payload = await fetchFitnessContext({ supabase, userId, days });
    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Could not load fitness context" });
  }
}
