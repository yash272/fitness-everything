import test from "node:test";
import assert from "node:assert/strict";
import { consistencySummary, historyCategory, recentHistoryItems } from "./historyUtils.js";

function weightedWorkout(date, split) {
  return {
    workout_date: date,
    split,
    exercises: [{ name: "Exercise", exercise_sets: [{ id: `${date}-set`, reps: 10, weight: 40 }] }]
  };
}

test("metadata-only days remain Rest and are excluded from trained filters", () => {
  const stale = { workout_date: "2026-06-10", split: "Push", exercises: [] };
  assert.equal(historyCategory(stale), "Rest");
  assert.deepEqual(recentHistoryItems([stale], "Push"), []);
  assert.deepEqual(recentHistoryItems([stale], "All"), [stale]);
});

test("non-strength sessions with logged work are grouped as Activity", () => {
  const badminton = {
    workout_date: "2026-07-28",
    split: "Badminton",
    exercises: [{ tracking_type: "time", exercise_sets: [{ duration_minutes: 45 }] }]
  };
  assert.equal(historyCategory(badminton), "Activity");
  assert.deepEqual(recentHistoryItems([badminton], "Activity"), [badminton]);
});

test("recent history filters and sorts without mutating input", () => {
  const input = [
    weightedWorkout("2026-07-20", "Push"),
    weightedWorkout("2026-07-28", "Pull"),
    weightedWorkout("2026-07-25", "Push")
  ];
  assert.deepEqual(recentHistoryItems(input, "Push").map((item) => item.workout_date), [
    "2026-07-25",
    "2026-07-20"
  ]);
  assert.equal(input[0].workout_date, "2026-07-20");
});

test("consistency counts Monday-to-today and month-to-today", () => {
  const input = [
    weightedWorkout("2026-07-27", "Pull"),
    weightedWorkout("2026-07-26", "Push"),
    weightedWorkout("2026-07-01", "Legs"),
    { workout_date: "2026-07-28", split: "Push", exercises: [] }
  ];
  assert.deepEqual(consistencySummary(input, new Date(2026, 6, 29, 12)), {
    week: 1,
    month: 3
  });
});
