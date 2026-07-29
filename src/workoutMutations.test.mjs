import assert from "node:assert/strict";
import { addSetToPlan, removeSetFromPlan, removeSetFromWorkouts, upsertSetInWorkouts } from "./workoutMutations.js";

const workouts = [
  {
    id: "workout-1",
    exercises: [
      {
        id: "exercise-1",
        name: "Lat Pulldown",
        exercise_sets: [
          { id: "set-1", reps: 10, weight: 120 },
          { id: "set-2", reps: 8, weight: 120 }
        ]
      },
      {
        id: "exercise-2",
        name: "Bicep Curl",
        exercise_sets: [{ id: "set-3", reps: 10, weight: 30 }]
      }
    ]
  }
];

const updated = removeSetFromWorkouts(workouts, "set-2");
assert.deepEqual(updated[0].exercises[0].exercise_sets.map((set) => set.id), ["set-1"]);
assert.deepEqual(updated[0].exercises[1].exercise_sets.map((set) => set.id), ["set-3"]);
assert.deepEqual(workouts[0].exercises[0].exercise_sets.map((set) => set.id), ["set-1", "set-2"]);
assert.notEqual(updated, workouts);
assert.notEqual(updated[0], workouts[0]);
assert.notEqual(updated[0].exercises[0], workouts[0].exercises[0]);

const unchanged = removeSetFromWorkouts(workouts, "missing-set");
assert.deepEqual(unchanged, workouts);


const plan = {
  title: "Suggested Push Day",
  exercises: [
    { name: "Bench", sets: [{ reps: "7", weight: "40" }, { reps: "8", weight: "40" }] },
    { name: "Press", sets: [{ reps: "10", weight: "30" }] }
  ]
};
const planAfterSetRemoval = removeSetFromPlan(plan, 0, 1);
assert.deepEqual(planAfterSetRemoval.exercises[0].sets, [{ reps: "7", weight: "40" }]);
assert.deepEqual(planAfterSetRemoval.exercises[1].sets, [{ reps: "10", weight: "30" }]);
assert.deepEqual(plan.exercises[0].sets, [{ reps: "7", weight: "40" }, { reps: "8", weight: "40" }]);
assert.notEqual(planAfterSetRemoval, plan);
assert.notEqual(planAfterSetRemoval.exercises[0], plan.exercises[0]);

const planWithOneSet = removeSetFromPlan(plan, 1, 0);
assert.equal(planWithOneSet.exercises[1].sets.length, 1);
assert.deepEqual(planWithOneSet.exercises[1].sets, [{ reps: "10", weight: "30" }]);


const planAfterAddingSet = addSetToPlan(plan, 0);
assert.deepEqual(planAfterAddingSet.exercises[0].sets, [
  { reps: "7", weight: "40" },
  { reps: "8", weight: "40" },
  { reps: "8", weight: "40" }
]);
assert.deepEqual(plan.exercises[0].sets, [{ reps: "7", weight: "40" }, { reps: "8", weight: "40" }]);
assert.notEqual(planAfterAddingSet, plan);
assert.notEqual(planAfterAddingSet.exercises[0], plan.exercises[0]);

const planAfterAddingBlankSet = addSetToPlan({ exercises: [{ name: "New movement", sets: [] }] }, 0);
assert.deepEqual(planAfterAddingBlankSet.exercises[0].sets, [{ reps: "", weight: "", duration: "" }]);

const withNewExerciseSet = upsertSetInWorkouts(
  workouts,
  "workout-1",
  { id: "exercise-3", name: "Hammer Curl", exercise_sets: [] },
  { id: "set-4", reps: 12, weight: 25 }
);
assert.deepEqual(withNewExerciseSet[0].exercises[2], {
  id: "exercise-3",
  name: "Hammer Curl",
  exercise_sets: [{ id: "set-4", reps: 12, weight: 25 }]
});
assert.equal(workouts[0].exercises.length, 2);

const withEditedSet = upsertSetInWorkouts(
  workouts,
  "workout-1",
  workouts[0].exercises[0],
  { id: "set-1", reps: 12, weight: 120 }
);
assert.deepEqual(withEditedSet[0].exercises[0].exercise_sets[0], {
  id: "set-1",
  reps: 12,
  weight: 120
});
assert.deepEqual(workouts[0].exercises[0].exercise_sets[0], {
  id: "set-1",
  reps: 10,
  weight: 120
});
