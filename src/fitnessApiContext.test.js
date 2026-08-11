import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFitnessContextPayload,
  normalizeDaysParam
} from "../api/fitnessContext.js";
import handler from "../api/fitness-context.js";

const workouts = [
  {
    workout_date: "2026-08-08",
    split: "Push",
    did_workout: true,
    steps: 12000,
    exercises: [
      {
        name: "Flat Dumbbell Bench Press",
        tracking_type: "weighted",
        exercise_sets: [
          { reps: 8, weight: 40, duration_minutes: null, is_pr: true, logged_at: "2026-08-08T12:00:00Z" }
        ]
      }
    ]
  },
  { workout_date: "2026-08-07", split: "", did_workout: false, steps: 9000, exercises: [] }
];
const bodyLogs = [
  { log_date: "2026-08-01", weight: 66.8 },
  { log_date: "2026-08-08", weight: 66.1 }
];

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value; }
  };
}

const foodLogs = [
  { log_date: "2026-08-08", description: "Protein bar", calories: 210, logged_at: "2026-08-08T10:00:00Z" },
  { log_date: "2026-08-08", description: "Paneer sabzi", calories: 550, logged_at: "2026-08-08T20:00:00Z" }
];

test("normalizes days parameter for LLM API calls", () => {
  assert.equal(normalizeDaysParam(undefined), 90);
  assert.equal(normalizeDaysParam("30"), 30);
  assert.equal(normalizeDaysParam("999"), 180);
  assert.equal(normalizeDaysParam("bad"), 90);
});

test("fitness context endpoint is public and does not require a bearer token", async () => {
  const originalEnv = { ...process.env };
  delete process.env.FITNESS_API_TOKEN;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.FITNESS_USER_ID;
  delete process.env.VITE_PERSONAL_USER_ID;

  const response = mockResponse();
  await handler({ url: "/api/fitness-context?days=90", headers: {} }, response);

  process.env = originalEnv;
  assert.equal(response.statusCode, 500);
  assert.match(response.body, /Missing Supabase API configuration/);
});

test("builds a compact 90-day gym food and weight context for LLMs", () => {
  const payload = buildFitnessContextPayload({
    workouts,
    bodyLogs,
    foodLogs,
    days: 90,
    generatedAt: "2026-08-08T23:00:00Z",
    startDate: "2026-05-11",
    endDate: "2026-08-08"
  });

  assert.equal(payload.period.days, 90);
  assert.equal(payload.summary.workout_days, 1);
  assert.equal(payload.summary.total_steps, 21000);
  assert.equal(payload.summary.latest_weight_kg, 66.1);
  assert.equal(payload.summary.weight_change_kg, -0.7);
  assert.equal(payload.summary.total_calories_logged, 760);
  assert.deepEqual(payload.days.find((day) => day.date === "2026-08-08"), {
    date: "2026-08-08",
    steps: 12000,
    weight_kg: 66.1,
    calories_total: 760,
    food_entries: [
      { description: "Protein bar", calories: 210, logged_at: "2026-08-08T10:00:00Z" },
      { description: "Paneer sabzi", calories: 550, logged_at: "2026-08-08T20:00:00Z" }
    ],
    workout: {
      did_workout: true,
      type: "Push",
      exercises: [
        {
          name: "Flat Dumbbell Bench Press",
          tracking_type: "weighted",
          sets: [
            { reps: 8, weight_lbs: 40, duration_minutes: null, is_pr: true, logged_at: "2026-08-08T12:00:00Z" }
          ]
        }
      ]
    }
  });
});
