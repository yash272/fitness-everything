import test from "node:test";
import assert from "node:assert/strict";
import * as workoutDisplayUtils from "./workoutDisplayUtils.js";

const {
  hasWorkoutActivity,
  workoutActivityFlag,
  workoutStageLabel,
  workoutStatusLabel,
  toggleWorkoutType,
  workoutTypeForEdit,
  workoutTypeLabel
} = workoutDisplayUtils;

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

test("labels a strength workout and timed activity saved on the same day", () => {
  const sameDayWorkout = {
    split: "Push",
    exercises: [
      { name: "Flat Dumbbell Bench Press", tracking_type: "weighted", exercise_sets: [{ id: "set-1" }] },
      { name: "Badminton", tracking_type: "time", exercise_sets: [{ id: "set-2", duration_minutes: 60 }] }
    ]
  };

  assert.equal(workoutStatusLabel(sameDayWorkout), "Push + Badminton");
});

test("preserves the primary strength split when saving a timed activity", () => {
  assert.equal(workoutDisplayUtils.splitForTimedActivity({ split: "Push" }, "Badminton"), "Push");
  assert.equal(workoutDisplayUtils.splitForTimedActivity({ split: "" }, "Badminton"), "Badminton");
  assert.equal(workoutDisplayUtils.splitForTimedActivity(null, "Cardio"), "Cardio");
});

test("tapping the selected workout type clears it", () => {
  assert.equal(typeof toggleWorkoutType, "function");
  assert.equal(toggleWorkoutType("Legs", "Legs"), "");
  assert.equal(toggleWorkoutType("legs", "Legs"), "");
  assert.equal(toggleWorkoutType("Pull", "Legs"), "Legs");
});

test("clearing a type marks only no-set days as rest", () => {
  assert.equal(typeof workoutActivityFlag, "function");
  assert.equal(workoutActivityFlag("", { split: "Legs", exercises: [] }), false);
  assert.equal(workoutActivityFlag("", workoutWithSets("Legs")), true);
  assert.equal(workoutActivityFlag("Push", { exercises: [] }), true);
});

test("a cleared no-set day is labeled as rest instead of an active session", () => {
  assert.equal(typeof workoutStageLabel, "function");
  assert.equal(workoutStageLabel("", { exercises: [] }), "Rest day");
  assert.equal(workoutStageLabel("Legs", { exercises: [] }), "Active session");
  assert.equal(workoutStageLabel("", workoutWithSets("")), "Active session");
});


test("clearing a selected strength type is allowed when only timed activities are logged", () => {
  assert.deepEqual(workoutDisplayUtils.clearWorkoutTypePatch({ split: "Legs", exercises: [] }), {
    canClear: true,
    split: "",
    did_workout: false
  });
  assert.deepEqual(workoutDisplayUtils.clearWorkoutTypePatch({
    split: "Legs",
    exercises: [{ name: "Badminton", tracking_type: "time", exercise_sets: [{ id: "set-activity", duration_minutes: 45 }] }]
  }), {
    canClear: true,
    split: "Badminton",
    did_workout: true
  });
});

test("clearing a selected strength type is blocked only when strength sets exist", () => {
  assert.deepEqual(workoutDisplayUtils.clearWorkoutTypePatch({
    split: "Legs",
    exercises: [{ name: "Leg Extension", tracking_type: "weighted", exercise_sets: [{ id: "set-strength", reps: 10, weight: 80 }] }]
  }), { canClear: false });
});