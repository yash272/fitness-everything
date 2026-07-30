import assert from "node:assert/strict";
import {
  buildProgressivePlanForSplit,
  buildSuggestedPlanForSplit,
  estimateSetStrength,
  formatSuggestedPrescription,
  progressBestSet,
  restoreSuggestedPlanForSplit,
  shouldShowSuggestedPlan,
  suggestedPlanDraftStorageKey,
  suggestedPlanHiddenStorageKey,
  WORKOUT_PLAN_TEMPLATES
} from "./workoutPlan.js";

assert.equal(estimateSetStrength({ weight: 40, reps: 12 }), 56);
assert.equal(Number(estimateSetStrength({ weight: 45, reps: 7 }).toFixed(1)), 55.5);

assert.deepEqual(progressBestSet({ weight: 40, reps: 10 }), {
  reps: "12",
  weight: "40",
  duration: "",
  kind: "reps",
  label: "+2 reps"
});

assert.deepEqual(progressBestSet({ weight: 40, reps: 12 }), {
  reps: "7",
  weight: "45",
  duration: "",
  kind: "weight",
  label: "+5 lb"
});

const history = [
  {
    workout_date: "2026-07-20",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [
        { weight: 40, reps: 12 },
        { weight: 45, reps: 7 }
      ]
    }]
  },
  {
    workout_date: "2026-07-25",
    split: "Pull",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ weight: 80, reps: 12 }]
    }]
  },
  {
    workout_date: "2026-07-30",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ weight: 100, reps: 12 }]
    }]
  }
];

const progressivePush = buildProgressivePlanForSplit({
  split: "Push",
  selectedDate: "2026-07-28",
  workouts: history
});

assert.equal(progressivePush.exercises.length, 5);
assert.deepEqual(progressivePush.exercises[0].sets, [
  { reps: "7", weight: "45", duration: "" },
  { reps: "7", weight: "45", duration: "" },
  { reps: "7", weight: "45", duration: "" }
]);
assert.deepEqual(progressivePush.exercises[0].progression, {
  sourceDate: "2026-07-20",
  previousSet: { reps: 12, weight: 40 },
  kind: "weight",
  label: "+5 lb"
});
assert.equal(progressivePush.exercises[1].progression.kind, "baseline");

assert.equal(formatSuggestedPrescription({
  sets: [
    { weight: "45", reps: "7" },
    { weight: "45", reps: "7" },
    { weight: "45", reps: "7" }
  ]
}), "3 x 45 lb x 7");

assert.equal(formatSuggestedPrescription({
  sets: [
    { weight: "45", reps: "7" },
    { weight: "45", reps: "8" }
  ]
}), "45x7 / 45x8");

assert.equal(formatSuggestedPrescription({
  sets: [{ weight: "", reps: "10" }]
}), "Set target");

const pushPlan = buildSuggestedPlanForSplit("Push");
assert.equal(pushPlan.title, "Suggested Push Day");
assert.deepEqual(pushPlan.exercises.map((exercise) => exercise.name), [
  "Flat Dumbbell Bench Press",
  "Incline Dumbbell Press",
  "Dumbbell Shoulder Press",
  "Lateral Raise",
  "Triceps Rope Pushdown",
  "Push-ups"
]);
const pushUps = pushPlan.exercises.find((exercise) => exercise.name === "Push-ups");
assert.equal(pushUps.trackingType, "bodyweight");
assert.deepEqual(pushUps.sets, [
  { reps: "12", weight: "", duration: "" },
  { reps: "10", weight: "", duration: "" }
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

const editedPullPlan = buildSuggestedPlanForSplit("Pull");
editedPullPlan.exercises = editedPullPlan.exercises.slice(1);
editedPullPlan.exercises[0].sets[0].weight = "1";
const restoredPullPlan = restoreSuggestedPlanForSplit("Pull");
assert.deepEqual(restoredPullPlan.exercises.map((exercise) => exercise.name), [
  "Lat Pulldown",
  "Low Row",
  "Machine Rear Delt",
  "Bicep Curl",
  "Hammer Curl"
]);
assert.equal(restoredPullPlan.exercises[0].sets[0].weight, "120");
assert.notDeepEqual(restoredPullPlan, editedPullPlan);
assert.equal(restoreSuggestedPlanForSplit("Sports"), null);
assert.equal(restoreSuggestedPlanForSplit("Push").exercises.at(-1).name, "Push-ups");
assert.equal(restoreSuggestedPlanForSplit("Push").exercises.at(-1).trackingType, "bodyweight");


const mutated = buildSuggestedPlanForSplit("Push");
mutated.exercises[0].name = "Changed";
assert.equal(WORKOUT_PLAN_TEMPLATES.Push.exercises[0].name, "Flat Dumbbell Bench Press");


assert.equal(shouldShowSuggestedPlan({ plan: pushPlan, selectedWorkout: { exercises: [] }, hiddenSplits: new Set() }), true);
assert.equal(shouldShowSuggestedPlan({ plan: pushPlan, selectedWorkout: { exercises: [{ name: "Flat Dumbbell Bench Press" }] }, hiddenSplits: new Set() }), true);
assert.equal(shouldShowSuggestedPlan({ plan: pushPlan, selectedWorkout: { exercises: [] }, hiddenSplits: new Set(["Push"]) }), false);
assert.equal(shouldShowSuggestedPlan({ plan: { ...pushPlan, exercises: [] }, selectedWorkout: { exercises: [] }, hiddenSplits: new Set() }), false);
assert.equal(shouldShowSuggestedPlan({ plan: null, selectedWorkout: { exercises: [] }, hiddenSplits: new Set() }), false);


assert.equal(suggestedPlanDraftStorageKey("2026-07-21", "push"), "fitness-suggested-plan-draft-v2:2026-07-21:Push");
assert.equal(suggestedPlanDraftStorageKey("2026-07-21", "Sports"), "fitness-suggested-plan-draft-v2:2026-07-21:none");
assert.equal(suggestedPlanHiddenStorageKey("2026-07-21"), "fitness-suggested-plan-hidden:2026-07-21");
