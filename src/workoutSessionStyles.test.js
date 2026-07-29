import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const workoutSource = readFileSync(new URL("./WorkoutView.jsx", import.meta.url), "utf8");
const strengthSource = readFileSync(new URL("./StrengthSession.jsx", import.meta.url), "utf8");

test("Workout is a focused session instead of a suggestion panel", () => {
  assert.equal(appSource.includes('from "./WorkoutView"'), true);
  assert.equal(workoutSource.includes("SuggestedWorkoutPlan"), false);
  assert.equal(workoutSource.includes("Steps"), false);
  assert.equal(strengthSource.includes("Previous"), true);
  assert.equal(strengthSource.includes("Today"), true);
  assert.equal(strengthSource.includes("New best"), true);
  assert.equal(workoutSource.includes("setId: durationSet?.id"), true);
});
