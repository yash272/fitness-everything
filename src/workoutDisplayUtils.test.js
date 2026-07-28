import test from "node:test";
import assert from "node:assert/strict";
import {
  hasWorkoutActivity,
  workoutStatusLabel,
  workoutTypeForEdit,
  workoutTypeLabel
} from "./workoutDisplayUtils.js";

const workoutWithSets = (split = "") => ({
  split,
  exercises: [{ exercise_sets: [{ id: "set-1" }] }]
});

test("keeps blank workout types blank for type-specific UI", () => {
  assert.equal(workoutTypeLabel(""), "");
  assert.equal(workoutTypeLabel("   "), "");
  assert.equal(workoutTypeLabel(null), "");
  assert.equal(workoutTypeForEdit({ split: "  Pull  " }), "Pull");
});

test("uses Workout only as an activity-status fallback", () => {
  assert.equal(workoutStatusLabel(workoutWithSets("Push")), "Push");
  assert.equal(workoutStatusLabel(workoutWithSets("")), "Workout");
  assert.equal(workoutStatusLabel({ split: "Push", exercises: [] }), "Rest");
  assert.equal(workoutStatusLabel(null), "Rest");
  assert.equal(hasWorkoutActivity(workoutWithSets("")), true);
});
