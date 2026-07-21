import assert from "node:assert/strict";
import { removeSetFromWorkouts } from "./workoutMutations.js";

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
