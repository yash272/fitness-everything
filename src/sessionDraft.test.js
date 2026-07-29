import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStrengthSessionDraft,
  findNextIncompleteExerciseIndex,
  pairedSetRows,
  sessionDraftStorageKey
} from "./sessionDraft.js";

const workouts = [
  {
    workout_date: "2026-07-26",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [
        { id: "a", reps: 10, weight: 40, logged_at: "2026-07-26T10:00:00Z" },
        { id: "b", reps: 9, weight: 40, logged_at: "2026-07-26T10:02:00Z" },
        { id: "c", reps: 8, weight: 40, logged_at: "2026-07-26T10:04:00Z" }
      ]
    }]
  },
  {
    workout_date: "2026-07-20",
    split: "Push",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ id: "old", reps: 12, weight: 35, logged_at: "2026-07-20T10:00:00Z" }]
    }]
  },
  {
    workout_date: "2026-07-28",
    split: "Pull",
    exercises: [{
      name: "Flat Dumbbell Bench Press",
      tracking_type: "weighted",
      exercise_sets: [{ id: "wrong-split", reps: 12, weight: 50 }]
    }]
  }
];

test("draft uses every set from the latest matching same-split session", () => {
  const draft = buildStrengthSessionDraft({
    split: "Push",
    selectedDate: "2026-07-29",
    workouts
  });

  assert.equal(draft.exercises.length, 5);
  assert.equal(draft.exercises[0].previousDate, "2026-07-26");
  assert.deepEqual(draft.exercises[0].previousSets.map(({ reps, weight }) => ({ reps, weight })), [
    { reps: 10, weight: 40 },
    { reps: 9, weight: 40 },
    { reps: 8, weight: 40 }
  ]);
  assert.deepEqual(draft.exercises[0].sets[0], {
    id: null,
    reps: "12",
    weight: "40",
    duration: "",
    is_pr: false
  });
});

test("pairedSetRows keeps unmatched rows visible", () => {
  assert.deepEqual(pairedSetRows([{ id: "p1" }, { id: "p2" }], [{ id: "c1" }]), [
    { previous: { id: "p1" }, current: { id: "c1" } },
    { previous: { id: "p2" }, current: null }
  ]);
});

test("next incomplete exercise wraps after the current exercise", () => {
  const exercises = [
    { sets: [{ id: "saved" }] },
    { sets: [{ id: null }] },
    { sets: [{ id: "saved" }] }
  ];
  assert.equal(findNextIncompleteExerciseIndex(exercises, 0), 1);
  assert.equal(findNextIncompleteExerciseIndex(exercises, 1), 1);
});

test("draft storage keys are isolated by date and canonical split", () => {
  assert.equal(sessionDraftStorageKey("2026-07-29", "push"), "fitness-session-draft-v1:2026-07-29:Push");
});
