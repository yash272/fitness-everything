import assert from "node:assert/strict";
import { buildSuggestedPlanForSplit, WORKOUT_PLAN_TEMPLATES } from "./workoutPlan.js";

const pushPlan = buildSuggestedPlanForSplit("Push");
assert.equal(pushPlan.title, "Suggested Push Day");
assert.deepEqual(pushPlan.exercises.map((exercise) => exercise.name), [
  "Flat Dumbbell Bench Press",
  "Incline Dumbbell Press",
  "Dumbbell Shoulder Press",
  "Lateral Raise",
  "Triceps Rope Pushdown"
]);
assert.deepEqual(pushPlan.exercises[0].sets, [
  { reps: "7", weight: "40", duration: "" },
  { reps: "7", weight: "40", duration: "" },
  { reps: "8", weight: "40", duration: "" }
]);

const pullPlan = buildSuggestedPlanForSplit("pull");
assert.deepEqual(pullPlan.exercises.map((exercise) => exercise.name), [
  "Lat Pulldown",
  "Low Row",
  "Machine Rear Delt",
  "Bicep Curl",
  "Hammer Curl"
]);
assert.equal(pullPlan.exercises[1].sets[0].weight, "120");

const legsPlan = buildSuggestedPlanForSplit("Legs");
assert.deepEqual(legsPlan.exercises.map((exercise) => exercise.name), [
  "Leg Extension",
  "Goblet Squats",
  "Leg Curls",
  "Romanian Deadlift",
  "Calf Raise"
]);
assert.equal(legsPlan.exercises[0].sets[0].weight, "145");
assert.equal(legsPlan.exercises[2].sets[0].weight, "115");

const unknownPlan = buildSuggestedPlanForSplit("Sports");
assert.equal(unknownPlan, null);

const mutated = buildSuggestedPlanForSplit("Push");
mutated.exercises[0].name = "Changed";
assert.equal(WORKOUT_PLAN_TEMPLATES.Push.exercises[0].name, "Flat Dumbbell Bench Press");
