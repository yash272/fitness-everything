import assert from "node:assert/strict";
import { buildWorkoutInsert, buildWorkoutUpdate, normalizeAllowedOrigin, parseStepRequest, resolveCorsOrigin } from "./stepsSync.js";

function makeRequest({ method = "POST", headers = {}, body = {} } = {}) {
  return {
    method,
    headers,
    body,
    query: {}
  };
}

assert.deepEqual(
  buildWorkoutUpdate({ steps: 12345 }),
  { steps: 12345 },
  "buildWorkoutUpdate only updates steps and does not overwrite split/workout fields"
);

assert.deepEqual(
  buildWorkoutInsert({ date: "2026-07-16", steps: 12345, userId: "00000000-0000-4000-8000-000000000000" }),
  {
    user_id: "00000000-0000-4000-8000-000000000000",
    workout_date: "2026-07-16",
    split: "",
    did_workout: false,
    steps: 12345
  },
  "buildWorkoutInsert creates a valid new day row when only steps exist"
);

assert.deepEqual(
  parseStepRequest(
    makeRequest({
      headers: { authorization: "Bearer sync-secret" },
      body: { date: "2026-07-16", steps: "12034" }
    }),
    { syncToken: "sync-secret" }
  ),
  { ok: true, date: "2026-07-16", steps: 12034 },
  "parseStepRequest accepts a valid bearer token, ISO date, and numeric step string"
);

assert.deepEqual(
  parseStepRequest(
    makeRequest({ headers: { authorization: "Bearer wrong" }, body: { date: "2026-07-16", steps: 12034 } }),
    { syncToken: "sync-secret" }
  ),
  { ok: false, status: 401, message: "Unauthorized" },
  "parseStepRequest rejects invalid sync tokens"
);

assert.deepEqual(
  parseStepRequest(
    makeRequest({ headers: { authorization: "Bearer sync-secret" }, body: { date: "16-07-2026", steps: 12034 } }),
    { syncToken: "sync-secret" }
  ),
  { ok: false, status: 400, message: "date must be YYYY-MM-DD" },
  "parseStepRequest rejects non-ISO dates"
);

assert.deepEqual(
  parseStepRequest(
    makeRequest({ headers: { authorization: "Bearer sync-secret" }, body: { date: "2026-07-16", steps: -1 } }),
    { syncToken: "sync-secret" }
  ),
  { ok: false, status: 400, message: "steps must be a non-negative integer" },
  "parseStepRequest rejects negative steps"
);

assert.equal(resolveCorsOrigin("https://fitness.yashvipulkumarshah.com", "https://fitness.yashvipulkumarshah.com"), "https://fitness.yashvipulkumarshah.com");
assert.equal(resolveCorsOrigin("https://evil.example", "https://fitness.yashvipulkumarshah.com"), "https://fitness.yashvipulkumarshah.com");
assert.equal(resolveCorsOrigin(undefined, "*"), "*");
assert.equal(normalizeAllowedOrigin("*"), "*");
assert.equal(normalizeAllowedOrigin("fitness.yashvipulkumarshah.com"), "https://fitness.yashvipulkumarshah.com");
assert.equal(normalizeAllowedOrigin("https://fitness.yashvipulkumarshah.com"), "https://fitness.yashvipulkumarshah.com");

console.log("steps sync endpoint tests passed");
