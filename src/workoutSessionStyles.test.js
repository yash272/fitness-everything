import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canConfirmSet, trackingTypeForSet } from "./strengthSessionUtils.js";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workoutSource = readFileSync(new URL("./WorkoutView.jsx", import.meta.url), "utf8");
const strengthSource = readFileSync(new URL("./StrengthSession.jsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("Workout is a focused session instead of a suggestion panel", () => {
  assert.equal(appSource.includes('from "./WorkoutView"'), true);
  assert.equal(workoutSource.includes("SuggestedWorkoutPlan"), false);
  assert.equal(workoutSource.includes("Steps"), false);
  assert.equal(strengthSource.includes("Previous"), true);
  assert.equal(strengthSource.includes("Today"), true);
  assert.equal(strengthSource.includes("New best"), true);
  assert.equal(workoutSource.includes("setId: durationSet?.id"), true);
});


test("Past workout dates render as read-only history instead of active checklist", () => {
  assert.equal(appSource.includes("readOnly={workoutDate !== todayKey()}"), true);
  assert.equal(workoutSource.includes("PastWorkoutHistory"), true);
  assert.equal(workoutSource.includes("history-exercise-list"), true);
  assert.equal(workoutSource.includes("formatHistorySet"), true);
});

test("Strength session supports reps-only push-ups", () => {
  assert.equal(strengthSource.includes('trackingType === "bodyweight"'), true);
  assert.equal(strengthSource.includes("canConfirmSet(current, trackingType, exercise.isCustom)"), true);
  assert.equal(strengthSource.includes("normalizeExerciseName(item.name) === normalizeExerciseName(exercise.name)"), true);
});

test("custom reps-only exercises can be saved without pounds", () => {
  const customPushUps = { trackingType: "weighted", isCustom: true };
  assert.equal(canConfirmSet({ reps: "40", weight: "" }, "weighted", true), true);
  assert.equal(trackingTypeForSet(customPushUps, { reps: "40", weight: "" }), "bodyweight");
});

test("custom exercise weight field stays compact", () => {
  assert.equal(strengthSource.includes("optional"), false);
  assert.equal(strengthSource.includes('placeholder="lb"'), true);
});

test("Past history set rows keep set number visually separate from reps", () => {
  assert.match(stylesSource, /\.past-set-row\s*\{[\s\S]*grid-template-columns:\s*32px\s+minmax\(0,\s*1fr\)/);
  assert.match(stylesSource, /\.past-set-row\s*\{[\s\S]*gap:\s*12px/);
});


test("strength session renders pending and done exercise sections", () => {
  assert.equal(strengthSource.includes('Not done'), true);
  assert.equal(strengthSource.includes('Done exercises'), true);
  assert.equal(strengthSource.includes('setActiveIndex(isActive ? -1 : exerciseIndex)'), true);
  assert.equal(strengthSource.includes('orderSessionExercises'), true);
});


test("custom exercise input shows history suggestions", () => {
  assert.equal(strengthSource.includes('exercise-history-suggestions'), true);
  assert.equal(strengthSource.includes('buildCustomExerciseFromHistory'), true);
  assert.equal(strengthSource.includes('previousSets.length'), true);
});


test("Today dashboard includes calorie tracking", () => {
  const todaySource = readFileSync(new URL("./TodayView.jsx", import.meta.url), "utf8");
  assert.equal(todaySource.includes('aria-label="Calorie tracking"'), true);
  assert.equal(todaySource.includes('onSaveFood'), true);
  assert.equal(todaySource.includes('estimateFoodCalories'), true);
  assert.equal(todaySource.includes('Estimated'), true);
  assert.match(stylesSource, /\.calorie-card\s*\{/);
  assert.match(stylesSource, /\.food-log-entry\s*\{/);
});
