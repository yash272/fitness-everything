import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPersonalRecordFlags,
  bestSetForExercise,
  isBetterSet
} from "./personalRecordUtils.js";

const workouts = [{
  workout_date: "2026-08-10",
  exercises: [{
    id: "old-bench",
    name: "Flat Dumbbell Bench Press",
    tracking_type: "weighted",
    exercise_sets: [{ id: "old", reps: 12, weight: 40, logged_at: "2026-08-10T10:00:00Z" }]
  }]
}, {
  workout_date: "2026-08-21",
  exercises: [{
    id: "today-bench",
    name: "Flat Dumbbell Bench Press",
    tracking_type: "weighted",
    exercise_sets: [
      { id: "today-1", reps: 10, weight: 45, logged_at: "2026-08-21T10:00:00Z" }
    ]
  }]
}];

test("bestSetForExercise includes earlier sets already logged on the selected date", () => {
  const best = bestSetForExercise({
    workouts,
    exerciseName: "flat dumbbell bench press",
    trackingType: "weighted",
    selectedDate: "2026-08-21"
  });

  assert.equal(best.id, "today-1");
  assert.equal(best.date, "2026-08-21");
  assert.equal(isBetterSet({ reps: 9, weight: 45 }, best, "weighted"), false);
  assert.equal(isBetterSet({ reps: 11, weight: 45 }, best, "weighted"), true);
});

test("bestSetForExercise excludes the set being updated while keeping other same-day sets", () => {
  const best = bestSetForExercise({
    workouts: [{
      workout_date: "2026-08-21",
      exercises: [{
        name: "Flat Dumbbell Bench Press",
        tracking_type: "weighted",
        exercise_sets: [
          { id: "editing", reps: 12, weight: 45, logged_at: "2026-08-21T10:00:00Z" },
          { id: "other", reps: 10, weight: 45, logged_at: "2026-08-21T10:02:00Z" }
        ]
      }]
    }],
    exerciseName: "Flat Dumbbell Bench Press",
    trackingType: "weighted",
    selectedDate: "2026-08-21",
    excludeSetId: "editing"
  });

  assert.equal(best.id, "other");
});

test("applyPersonalRecordFlags compares each new set against earlier sets in the same save batch", () => {
  const baseline = { reps: 12, weight: 40, date: "2026-08-10" };
  const flagged = applyPersonalRecordFlags([
    { reps: 10, weight: 45, duration_minutes: null },
    { reps: 9, weight: 45, duration_minutes: null },
    { reps: 11, weight: 45, duration_minutes: null }
  ], baseline, "weighted");

  assert.deepEqual(flagged.map((set) => set.is_pr), [true, false, true]);
});
